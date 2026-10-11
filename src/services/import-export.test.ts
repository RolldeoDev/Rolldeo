import { describe, expect, it } from 'vitest'
import { allocateImportBatch, importFiles, normalizeImportPath } from './import'
import { createCollectionArchive, resolveExportDependencies } from './export'
import { RandomTableEngine } from '../engine/core'
import type { RandomTableDocument } from '../engine/types'

const doc = (namespace = 'same', value = 'FIRST'): RandomTableDocument => ({
  metadata: { name: 'Test', namespace, version: '1.0.0', specVersion: '1.0' },
  tables: [{ id: 'one', name: 'One', type: 'simple', entries: [{ value }] }],
})
const imported = (id: string, originalPath: string, bundleId = 'bundle') => ({
  id, originalPath, fileName: originalPath.split('/').pop()!, bundleId, name: 'Test', document: doc(),
})

describe('import identities and portable exports', () => {
  it('reserves every identity within one batch without ambiguous basename mappings', () => {
    const allocated = allocateImportBatch([imported('same', 'a/data.json'), imported('same', 'b/data.json')], new Set(['same']))
    expect(allocated.collections.map(({ id }) => id)).toEqual(['same-2', 'same-3'])
    expect(allocated.pathToIdMap.get('a/data.json')).toBe('same-2')
    expect(allocated.pathToIdMap.has('data.json')).toBe(false)
  })

  it('normalizes parent-relative paths and refuses bundle escape or remote URLs', () => {
    expect(normalizeImportPath('../tables/./data.json', 'generators/main.json')).toBe('tables/data.json')
    expect(normalizeImportPath('../../outside.json', 'generators/main.json')).toBeUndefined()
    expect(normalizeImportPath('https://example.com/data.json')).toBeUndefined()
  })

  it('exports duplicate namespaces without overwriting and rewrites exact identity bindings', async () => {
    const main = doc('main')
    main.imports = [{ alias: 'selected', path: './tables/source.json' }]
    const zip = createCollectionArchive([
      { id: 'main', document: main, importTargets: { selected: 'second' } },
      { id: 'first', document: doc('same', 'FIRST') },
      { id: 'second', document: doc('same', 'SECOND') },
    ])
    expect(Object.keys(zip.files)).toEqual(['main.json', 'same.json', 'same-2.json'])
    const exported = JSON.parse(await zip.file('main.json')!.async('string')) as RandomTableDocument
    expect(exported.imports![0].path).toBe('./same-2.json')
    const contents = await zip.generateAsync({ type: 'uint8array' })
    const file = { name: 'backup.zip', arrayBuffer: async () => contents.buffer, type: 'application/zip' } as File
    const result = await importFiles([file])
    expect(result.errors).toEqual([])
    expect(result.collections).toHaveLength(3)
    expect(new Set(result.collections.map((item) => item.bundleId)).size).toBe(1)
  })

  it('traverses actual bindings by collection ID through namespace collisions and cycles', () => {
    const engine = new RandomTableEngine()
    const main = doc('main')
    main.imports = [{ alias: 'a', path: 'same' }, { alias: 'b', path: 'same' }]
    const a = doc('same', 'FIRST')
    a.imports = [{ alias: 'back', path: 'main' }]
    engine.loadCollection(main, 'main')
    engine.loadCollection(a, 'a')
    engine.loadCollection(doc('same', 'SECOND'), 'b')
    engine.resolveImports(undefined, new Map([
      ['main', new Map([['a', 'a'], ['b', 'b']])], ['a', new Map([['back', 'main']])],
    ]))
    const exported = resolveExportDependencies(main, 'main', engine, new Map())
    expect(exported.dependencies.map(({ id }) => id)).toEqual(['a', 'b'])
    expect(exported.primary.importTargets).toEqual({ a: 'a', b: 'b' })
    expect(exported.dependencies[0].importTargets).toEqual({ back: 'main' })
    expect(exported.unresolvedPaths).toEqual([])
  })

  it('keeps omitted bound dependencies unresolved instead of binding another exported version', async () => {
    const main = doc('main'); main.imports = [{ alias: 'source', path: 'same' }]
    const zip = createCollectionArchive([
      { id: 'main', document: main, importTargets: { source: 'unselectedVersion' } },
      { id: 'otherVersion', document: doc('same'), importTargets: {} },
    ])
    const output = JSON.parse(await zip.file('main.json')!.async('string')) as RandomTableDocument
    expect(output.imports![0].path).toBe('./rolldeo-missing-imports/main-source.json')
    expect(zip.file('rolldeo-missing-imports/main-source.json')).toBeNull()
  })

  it('rejects invalid documents before generating archives', () => {
    expect(() => createCollectionArchive([{ id: 'bad', document: {} as RandomTableDocument }])).toThrow()
  })
})

describe('bounded browser imports', () => {
  const zipFile = async (documents: RandomTableDocument[]) => {
    const { default: JSZip } = await import('jszip')
    const archive = new JSZip()
    documents.forEach((document, index) => archive.file(`${index}.json`, JSON.stringify(document)))
    const bytes = await archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
    return { name: 'test.zip', type: 'application/zip', size: bytes.byteLength, arrayBuffer: async () => bytes.buffer } as File
  }

  it.each(['fantasyExample.zip', 'sciFiExample.zip'])('preserves the published %s archive within import budgets', async (name) => {
    const { readFile } = await import('node:fs/promises')
    const data = await readFile(new URL(`../../public/guide/examples/${name}`, import.meta.url))
    const bytes = Uint8Array.from(data)
    const result = await importFiles([{ name, type: 'application/zip', size: bytes.byteLength,
      arrayBuffer: async () => bytes.buffer } as File])
    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.collections.length).toBeGreaterThan(1)
  })

  it('rejects oversized compressed files before reading them', async () => {
    let read = false
    const file = { name: 'large.zip', type: 'application/zip', size: 33 * 1024 * 1024,
      arrayBuffer: async () => { read = true; return new ArrayBuffer(0) } } as File
    const result = await importFiles([file])
    expect(read).toBe(false)
    expect(result.success).toBe(false)
    expect(result.errors[0].error).toContain('32 MiB')
  })

  it('bounds actual streamed ZIP expansion even when the declared expansion size is forged', async () => {
    const file = await zipFile([doc('large', 'X'.repeat(9 * 1024 * 1024))])
    const buffer = await file.arrayBuffer()
    const view = new DataView(buffer)
    // Central header's advertised uncompressed bytes cannot bypass actual accounting.
    for (let index = 0; index + 46 < buffer.byteLength; index++) {
      if (view.getUint32(index, true) === 0x02014b50) { view.setUint32(index + 24, 64, true); break }
    }
    const result = await importFiles([file])
    expect(result.success).toBe(false)
    expect(result.collections).toEqual([])
    expect(result.errors[0].error).toContain('JSON document exceeds 8 MiB')
  })

  it('applies document and total expansion budgets across multiple archives', async () => {
    const file = await zipFile([doc('bounded', 'X'.repeat(7 * 1024 * 1024))])
    const result = await importFiles([file, file, file, file, file])
    expect(result.success).toBe(false)
    expect(result.collections).toEqual([])
    expect(result.errors.some((error) => error.error.includes('expands beyond 32 MiB'))).toBe(true)
  })

  it('rejects excessive document counts before inflation', async () => {
    const result = await importFiles([await zipFile(Array.from({ length: 129 }, () => doc()))])
    expect(result.success).toBe(false)
    expect(result.errors[0].error).toContain('128 JSON documents')
  })

  it('bounds actual central-directory entry count even with a forged advertised count', async () => {
    const { default: JSZip } = await import('jszip')
    const archive = new JSZip()
    for (let index = 0; index < 1025; index++) archive.file(`${index}.txt`, '')
    const bytes = await archive.generateAsync({ type: 'uint8array' })
    const view = new DataView(bytes.buffer)
    view.setUint16(bytes.byteLength - 22 + 8, 1, true)
    view.setUint16(bytes.byteLength - 22 + 10, 1, true)
    const file = { name: 'many.zip', type: 'application/zip', size: bytes.byteLength, arrayBuffer: async () => bytes.buffer } as File
    const result = await importFiles([file])
    expect(result.success).toBe(false)
    expect(result.errors[0].error).toContain('1024 entries')
  })

  it('checks JSON bytes before parsing and preserves normal Unicode content', async () => {
    let read = false
    const oversized = { name: 'large.json', type: 'application/json', size: 9 * 1024 * 1024,
      arrayBuffer: async () => { read = true; return new ArrayBuffer(0) } } as File
    const rejected = await importFiles([oversized])
    expect(read).toBe(false)
    expect(rejected.errors[0].error).toContain('8 MiB')
    const bytes = new TextEncoder().encode(JSON.stringify(doc('unicode', '🧙 café 日本語')))
    const accepted = await importFiles([{ name: 'normal.json', type: 'application/json', size: bytes.byteLength,
      arrayBuffer: async () => bytes.buffer } as File])
    expect(accepted.success).toBe(true)
    expect(accepted.collections[0].document.tables[0]).toMatchObject({ entries: [{ value: '🧙 café 日本語' }] })
  })
})
