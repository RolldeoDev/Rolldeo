import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import type { AuthoredRandomTableDocument } from '../types'
import { RandomTableEngine } from './index'
import { validateDocument } from './validator'

// Exercise the documents users download; ignored extraction drafts are excluded.
const documents = import.meta.glob<AuthoredRandomTableDocument>([
  '/docs/examples/fantasyExample/*.json',
  '/docs/examples/sciFiExample/*.json',
], { eager: true, import: 'default' })
const bundleNames = ['fantasyExample', 'sciFiExample'] as const
const trials = Array.from({ length: 8 }, (_, index) => index + 1)

function seededRandom(trial: number): () => number {
  let seed = trial * 731
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

for (const bundleName of bundleNames) {
  const bundle = Object.entries(documents)
    .filter(([path]) => path.includes(`/${bundleName}/`))
    .map(([path, document]) => ({ filename: path.split('/').pop()!, document }))

  function linkedEngine(): RandomTableEngine {
    const engine = new RandomTableEngine()
    const paths = new Map<string, string>()
    for (const { filename, document } of bundle) {
      engine.loadCollection(document, document.metadata.namespace)
      paths.set(`./${filename}`, document.metadata.namespace)
    }
    engine.resolveImports(paths)
    expect(engine.getImportDiagnostics()).toEqual([])
    return engine
  }

  describe(`published ${bundleName} conformance`, () => {
    it('contains complete, valid and linkable source documents', () => {
      expect(bundle).toHaveLength(4)
      for (const { filename, document } of bundle) {
        const validation = validateDocument(document)
        expect(validation.errors, filename).toEqual([])
        expect(validation.valid, filename).toBe(true)
      }
      linkedEngine()
    })

    for (const { filename, document } of bundle) {
      for (const template of document.templates ?? []) {
        it(`${filename}: ${template.id} generates across eight deterministic trials without warnings`, () => {
          const engine = linkedEngine()
          const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
          try {
            for (const trial of trials) {
              const result = engine.rollTemplate(template.id, document.metadata.namespace, {
                random: seededRandom(trial),
              })
              expect(result.text.trim().length, `trial ${trial}`).toBeGreaterThan(0)
              expect(warning.mock.calls, `trial ${trial}`).toEqual([])
            }
          } finally {
            warning.mockRestore()
          }
        })
      }
    }

    it.each(['docs', 'public'] as const)('%s ZIP contains the exact source JSON files', async (location) => {
      const archivePath = location === 'docs'
        ? `../../../docs/examples/${bundleName}/${bundleName}.zip`
        : `../../../public/guide/examples/${bundleName}.zip`
      const archive = await JSZip.loadAsync(readFileSync(new URL(archivePath, import.meta.url)))
      const jsonFiles = Object.values(archive.files)
        .filter(file => !file.dir && file.name.endsWith('.json'))
      expect(jsonFiles.map(file => file.name).sort()).toEqual(bundle.map(item => item.filename).sort())
      for (const { filename } of bundle) {
        const sourcePath = `../../../docs/examples/${bundleName}/${filename}`
        const source = readFileSync(new URL(sourcePath, import.meta.url), 'utf8')
        const archived = await archive.file(filename)!.async('string')
        expect(archived, filename).toBe(source)
      }
    })
  })
}
