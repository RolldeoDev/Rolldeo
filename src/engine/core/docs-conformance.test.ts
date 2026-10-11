import { readFileSync } from 'node:fs'
import Ajv from 'ajv'
import { describe, expect, it, vi } from 'vitest'
import schema from '../../../public/schemas/random-table-spec-v1.0.json'
import type { AuthoredRandomTableDocument } from '../types'
import { RandomTableEngine } from './index'
import { validateDocument } from './validator'

const files = ['docs/randomTableSpecV1.md', 'docs/Quickstart.md', 'docs/UsingRolldeo.md', 'docs/syntax-quick-reference.md', 'README.md']
const root = new URL('../../../', import.meta.url)
const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false })
ajv.addSchema(schema)
const definition = (name: string) => ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` })
const metadata = { name: 'Documentation fragment', namespace: 'docs.fragment', version: '1.0.0', specVersion: '1.0' as const }

// Comments are explanatory, never stripped from inside quoted pattern strings.
function withoutComments(source: string): string {
  let output = '', quoted = false, escaped = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (!quoted && char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++
      output += '\n'
      continue
    }
    output += char
    if (escaped) escaped = false
    else if (quoted && char === '\\') escaped = true
    else if (char === '"') quoted = !quoted
  }
  return output.trim()
}

function parseObjects(source: string): Record<string, unknown>[] {
  const text = withoutComments(source)
  // A field snippet is interpreted in an enclosing object. Custom-type alternatives
  // are independent lines, not duplicate members in a single object.
  if (text.startsWith('"')) {
    if (text.split('\n').every(line => /^"resultType":/.test(line))) return text.split('\n').map(line => JSON.parse(`{${line}}`))
    return [JSON.parse(`{${text}}`)]
  }
  const objects: Record<string, unknown>[] = []
  let depth = 0, start = 0, quoted = false, escaped = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (escaped) { escaped = false; continue }
    if (quoted && char === '\\') { escaped = true; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (quoted) continue
    if (char === '{' || char === '[') depth++
    if (char === '}' || char === ']') depth--
    if (!depth && (char === '}' || char === ']')) {
      objects.push(JSON.parse(text.slice(start, i + 1)))
      start = i + 1
    }
  }
  if (depth || quoted || text.slice(start).trim()) throw new Error('Incomplete JSON fragment')
  return objects
}

const snippets = files.flatMap(file => {
  const source = readFileSync(new URL(file, root), 'utf8')
  return [...source.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match, index) => ({
    file, index, text: match[1],
    heading: [...source.slice(0, match.index).matchAll(/^#{1,6} (.+)$/gm)].slice(-1)[0]?.[1] ?? '',
    invalid: /\*\*Avoid:\*\*\s*$/.test(source.slice(0, match.index)),
  }))
})
const yamlReference = readFileSync(new URL('docs/random-table-spec-llm.yaml', root), 'utf8')
const yamlExample = yamlReference.match(/^example: \|\n((?: {2}.*\n|\n)+)/m)?.[1]
const yamlMinimal = yamlReference.match(/^ {2}minimal: '([^\n]+)'$/m)?.[1]
if (!yamlExample || !yamlMinimal) throw new Error('Missing YAML reference JSON examples')
snippets.push(
  { file: 'docs/random-table-spec-llm.yaml', index: 0, text: yamlMinimal, heading: 'Minimal document', invalid: false },
  { file: 'docs/random-table-spec-llm.yaml', index: 1, text: yamlExample.replace(/^ {2}/gm, '').trim(), heading: 'Complete YAML example', invalid: false },
)
const sketchHeadings = new Set(['File Structure', '3.2 Table Source Attribution', '9.5 Cross-File and Cross-Namespace Inheritance'])

function check(name: string, value: unknown): void {
  const validate = definition(name)
  expect(validate(value), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true)
}

function validateFragment(object: Record<string, unknown>): void {
  if (object.type) { check('table', object); return }
  if (object.id && !object.pattern && !object.metadata) {
    check(Object.values(object).some(value => value === null) || !('value' in object) ? 'inheritedEntryOverride' : 'entry', object)
    return
  }
  if (object.metadata) check('metadata', object.metadata)
  if (object.tables) for (const table of object.tables as unknown[]) check('table', table)
  if (object.templates) for (const template of object.templates as unknown[]) check('template', template)
  if (object.imports) for (const item of object.imports as unknown[]) check('import', item)
  for (const [key, value] of Object.entries(object)) {
    if (['metadata', 'tables', 'templates', 'imports'].includes(key)) continue
    if (key === 'entries') for (const entry of value as unknown[]) check('entry', entry)
    else if (key === 'sets') check('setsObject', value)
    else if (key === 'assets') check('assetsObject', value)
    else if (key === 'source') check('metadataSource', value)
    else if (key === 'rights') check('rights', value)
    else if (key === 'variables' || key === 'shared') check(key, value)
    else if (key === 'tags') check('tagsArray', value)
    else if (key === 'resultType') check('resultType', value)
  }
  if ('value' in object || (object.id && !object.pattern)) {
    const hasNull = Object.values(object).some(value => value === null)
    check(hasNull || !('value' in object) ? 'inheritedEntryOverride' : 'entry', object)
  }
  if (object.pattern) {
    // Anonymous pattern fragments sometimes show entry sets beside a template;
    // validate each contextual part rather than treating it as a standalone file.
    const template = Object.fromEntries(Object.entries(object).filter(([key]) => key !== 'sets'))
    check('template', { id: 'fragment', name: 'Fragment', ...template })
  }
  if (object.text) expect(typeof object.text).toBe('string') // output example
}

describe('inline published JSON examples', () => {
  for (const snippet of snippets) {
    it(`${snippet.file} #${snippet.index}: ${snippet.heading}`, () => {
      if (/\.\.\./.test(withoutComments(snippet.text).replace(/"(?:[^"\\]|\\.)*"/g, ''))) {
        // Explicitly scoped structural sketches cannot be loaded or generated.
        expect(sketchHeadings.has(snippet.heading)).toBe(true)
        return
      }
      for (const object of parseObjects(snippet.text)) {
        if (snippet.invalid) {
          const validate = definition('entry')
          expect(validate(object)).toBe(false)
        } else validateFragment(object)
      }
    })
  }
})

// These are dependencies expressly named by the complete examples, not generic
// missing-reference fallbacks. A newly missing local table must fail this suite.
const dependencies: Record<string, AuthoredRandomTableDocument> = Object.fromEntries([
  ['./creatures/undead.json', 'docs.undead', 'allUndead', 'Skeleton'],
  ['./creatures/beasts.json', 'docs.beasts', 'dungeonBeasts', 'Wolf'],
  ['../shared/treasure.json', 'docs.treasure', 'minorTreasure', 'Silver coins'],
  ['../shared/core-v2.json', 'docs.core', 'library', 'Core'],
  ['./shared/names.json', 'docs.names', 'townName', 'Millbrook'],
].map(([path, namespace, id, value]) => [path, {
  metadata: { ...metadata, namespace }, tables: [{ id, name: id, type: 'simple', entries: [{ value }] }],
}]))

function randomFor(trial: number): () => number {
  let seed = trial * 731
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
}

for (const snippet of snippets.filter(item => !item.text.includes('...'))) {
  const [object] = parseObjects(snippet.text)
  if (!object?.metadata || !object.tables) continue
  const document = object as unknown as AuthoredRandomTableDocument
  it(`${snippet.file} #${snippet.index}: complete document validates, links and generates`, () => {
    expect(validateDocument(document).errors).toEqual([])
    const engine = new RandomTableEngine()
    const paths = new Map<string, string>()
    for (const item of document.imports ?? []) {
      const dependency = dependencies[item.path]
      expect(dependency, `Provide a named fixture for ${item.path}`).toBeDefined()
      engine.loadCollection(dependency, dependency.metadata.namespace)
      paths.set(item.path, dependency.metadata.namespace)
    }
    engine.loadCollection(document, document.metadata.namespace)
    engine.resolveImports(paths)
    expect(engine.getImportDiagnostics()).toEqual([])
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (const table of document.tables) for (let trial = 1; trial <= 8; trial++) {
        const result = engine.roll(table.id, document.metadata.namespace, { random: randomFor(trial) })
        expect(result.text.trim()).not.toBe('')
        expect(warning.mock.calls).toEqual([])
      }
      for (const template of document.templates ?? []) for (let trial = 1; trial <= 8; trial++) {
        const result = engine.rollTemplate(template.id, document.metadata.namespace, { random: randomFor(trial) })
        expect(result.text.trim()).not.toBe('')
        expect(warning.mock.calls).toEqual([])
        if (template.id === 'townDescription') {
          expect(result.text).toMatch(/\d+ residents/)
          expect(result.text).toMatch(/\d+ buildings/)
          expect(result.text).toContain('Millbrook')
        }
      }
    } finally { warning.mockRestore() }
  })
}

// Inheritance fragments are shown together in the prose. Assemble those exact
// authored objects rather than fabricating parents for value-less overrides.
it('basic and multilevel inheritance snippets link to their published parents', () => {
  const tables = snippets.filter(item => item.file.endsWith('randomTableSpecV1.md') && /^9\.[12] /.test(item.heading))
    .flatMap(item => parseObjects(item.text))
  const document = { metadata, tables } as unknown as AuthoredRandomTableDocument
  expect(validateDocument(document).errors).toEqual([])
  const engine = new RandomTableEngine()
  engine.loadCollection(document, metadata.namespace)
  const richLoot = engine.getResolvedTable('richLoot', metadata.namespace)
  const largeTreasure = engine.getResolvedTable('largeTreasure', metadata.namespace)
  expect(richLoot?.type).toBe('simple')
  expect(largeTreasure?.type).toBe('simple')
  if (largeTreasure?.type !== 'simple') throw new Error('Expected resolved simple table')
  expect(largeTreasure.entries.find(entry => entry.id === 'copper')?.weight).toBe(0)
  expect(largeTreasure.entries.find(entry => entry.id === 'gold')?.value).toBe('Platinum coins')
  expect(largeTreasure.defaultSets).toEqual({ rarity: 'rare', quality: 'fine' })
})

it('entry math example evaluates its count once and reuses it in text and XP', () => {
  const snippet = snippets.find(item => item.heading === 'Entry Value Examples')!
  const [entry] = parseObjects(snippet.text)
  const document = { metadata, variables: { partySize: '4' }, tables: [{
    id: 'goblinBand', name: 'Goblin Band', type: 'simple', entries: [entry],
  }] } as unknown as AuthoredRandomTableDocument
  expect(validateDocument(document).errors).toEqual([])
  const engine = new RandomTableEngine()
  engine.loadCollection(document, metadata.namespace)
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const result = engine.roll('goblinBand', metadata.namespace, { random: randomFor(1) })
    const count = Number(result.placeholders?.creatureCount)
    expect(result.text).toBe(`A band of ${count} goblins`)
    expect(Number(result.placeholders?.totalXP)).toBe(count * 50)
    expect(warning.mock.calls).toEqual([])
  } finally { warning.mockRestore() }
})

it('property merge and null deletion examples preserve the published inheritance contract', () => {
  const fragments = snippets.filter(item => item.heading === '9.3 Property-Level Inheritance')
  const [parent, override] = parseObjects(fragments[0].text)
  const [expected] = parseObjects(fragments[1].text)
  const [deletion] = parseObjects(fragments[2].text)
  const document = { metadata, tables: [
    { id: 'base', name: 'Base', type: 'simple', entries: [parent] },
    { id: 'child', name: 'Child', type: 'simple', extends: 'base', entries: [override] },
    { id: 'removed', name: 'Removed', type: 'simple', extends: 'child', entries: [deletion] },
  ] } as unknown as AuthoredRandomTableDocument
  expect(validateDocument(document).errors).toEqual([])
  const engine = new RandomTableEngine()
  engine.loadCollection(document, metadata.namespace)
  const child = engine.getResolvedTable('child', metadata.namespace)
  const removed = engine.getResolvedTable('removed', metadata.namespace)
  if (child?.type !== 'simple' || removed?.type !== 'simple') throw new Error('Expected resolved simple tables')
  expect(child.entries[0]).toEqual(expected)
  expect(removed.entries[0]).not.toHaveProperty('description')
  expect(removed.entries[0]).not.toHaveProperty('sets')
  expect(removed.entries[0].assets).toEqual(expected.assets)
})
