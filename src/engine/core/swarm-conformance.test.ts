import { describe, expect, it, vi } from 'vitest'
import { RandomTableEngine } from './index'
import { validateDocument } from './validator'
import type { AuthoredRandomTableDocument, AuthoredTable, SimpleTable } from '../types'

const simple = (id: string, value: string): SimpleTable => ({ id, name: id, type: 'simple', entries: [{ value }] })
const document = (tables: AuthoredTable[] = []): AuthoredRandomTableDocument => ({
  metadata: { name: 'Swarm regression', namespace: 'test.swarm', version: '1.0.0', specVersion: '1.1' }, tables,
})
function engineFor(doc = document(), config = {}) {
  const engine = new RandomTableEngine({ config })
  engine.loadCollection(doc, 'root')
  return engine
}
function linkedEngine(child: AuthoredRandomTableDocument, root: AuthoredRandomTableDocument) {
  const engine = engineFor({ ...root, imports: [{ alias: 'lib', path: 'library.json' }] })
  engine.loadCollection({ ...child, metadata: { ...child.metadata, namespace: 'test.library' } }, 'library')
  engine.resolveImports(new Map([['library.json', 'library']]))
  return engine
}

describe('swarm: literal switch operands and imported input scope', () => {
  it.each(['"{{$text}}"', '{{$text}}', '"{{echo}}"', '{{echo}}', '"prefix{{$text}}suffix"'])('does not execute interpolated syntax in %s', operand => {
    const doc = document()
    doc.inputs = { text: { type: 'text', required: true } }
    doc.templates = [{ id: 'echo', name: 'Echo', pattern: '{{$text}}' }]
    const engine = engineFor(doc)
    const text = 'unsafe" != "safe" || "safe {{dice:1d6}} $other'
    const random = vi.fn(() => 0)
    expect(engine.evaluateRawPattern(`{{switch[${operand} == "safe":"yes"].else["no"]}}`, 'root', { inputs: { text }, random }).text).toBe('no')
    expect(random).not.toHaveBeenCalled()
  })

  it('compares quote, backslash, operator and marker-looking text literally', () => {
    const doc = document()
    doc.inputs = { text: { type: 'text' }, other: { type: 'text' } }
    const engine = engineFor(doc)
    const value = '" \\ != $other __rolldeo_operand_0__ {{dice:1d6}}'
    expect(engine.evaluateRawPattern('{{switch["{{$text}}" == "{{$other}}":"yes"].else["no"]}}', 'root', { inputs: { text: value, other: value } }).text).toBe('yes')
    expect(engine.evaluateRawPattern('{{switch[{{$text}} == "{{$other}}":"yes"].else["no"]}}', 'root', { inputs: { text: value, other: value } }).text).toBe('yes')
  })

  it('decodes authored brace escapes while keeping returned escapes literal', () => {
    const doc = document(); doc.inputs = { text: { type: 'text' }, other: { type: 'text' } }
    const engine = engineFor(doc)
    const pattern = String.raw`{{switch["{{$text}}" == "x\}}":"yes"].else["no"]}}`
    expect(engine.evaluateRawPattern(pattern, 'root', { inputs: { text: 'x}}' } }).text).toBe('yes')
    expect(engine.evaluateRawPattern('{{switch["{{$text}}" == "{{$other}}":"yes"].else["no"]}}', 'root', { inputs: { text: String.raw`x\}}`, other: String.raw`x\}}` } }).text).toBe('yes')
  })

  it('preserves once-only draws, numeric-zero atoms and boolean input text', () => {
    const doc = document()
    doc.inputs = { text: { type: 'text' }, flag: { type: 'boolean', default: false } }
    const engine = engineFor(doc)
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0.99)
    expect(engine.evaluateRawPattern('{{switch[{{dice:1d6}} < {{dice:1d6}}:"yes"].else["no"]}}', 'root', { random }).text).toBe('yes')
    expect(random).toHaveBeenCalledTimes(2)
    expect(engine.evaluateRawPattern('{{switch[{{$text}}:"yes"].else["no"]}}', 'root', { inputs: { text: '0' } }).text).toBe('no')
    expect(engine.evaluateRawPattern('{{switch["{{$text}}":"yes"].else["no"]}}', 'root', { inputs: { text: '0' } }).text).toBe('yes')
    expect(engine.evaluateRawPattern('{{switch[{{$flag}}:"yes"].else["no"]}}', 'root').text).toBe('yes')
  })

  it('uses caller shared values before imported defaults in variables, math, counts and conditions', () => {
    const child = document([simple('unit', 'X'), simple('scene', '{{$label}}|{{math:$n}}|{{$n*unit}}|{{switch[$label == "parent":"parent"].else["child"]}}')])
    child.inputs = { label: { type: 'text', default: 'child' }, n: { type: 'integer', default: 3 } }
    const root = document()
    root.shared = { label: 'parent', n: '2' }
    const engine = linkedEngine(child, root)
    expect(engine.evaluateRawPattern('{{lib.scene}}|{{$lib.label}}', 'root', { random: () => 0 }).text).toBe('parent|2|X, X|parent|child')
  })
})

describe('swarm: dice budgets, math failures and complete traces', () => {
  it.each(['{{dice:1000d1!}}', '{{math:dice:1000d1!}}', '{{dice:1000d1!*leaf}}', '{{dice:1000d1!*leaf >> $items}}'])('bounds physical draws for %s', pattern => {
    const engine = engineFor(document([simple('leaf', 'L')]), { maxGenerationWork: 10, maxExplodingDice: 1000 })
    const random = vi.fn(() => 0)
    expect(() => engine.evaluateRawPattern(pattern, 'root', { random })).toThrow('Generation work limit exceeded')
    expect(random).toHaveBeenCalledTimes(9)
  })

  it('charges discarded and exploding dice before drawing', () => {
    const engine = engineFor(document(), { maxGenerationWork: 3 })
    const random = vi.fn(() => 0.99)
    expect(() => engine.evaluateRawPattern('{{dice:4d6kh1}}', 'root', { random })).toThrow('Generation work limit exceeded')
    expect(random).toHaveBeenCalledTimes(2)
    random.mockClear()
    expect(() => engine.evaluateRawPattern('{{dice:1d6!}}', 'root', { random })).toThrow('Generation work limit exceeded')
    expect(random).toHaveBeenCalledTimes(2)
  })

  it('propagates math work, RNG, callback, fixed resource and overflow failures', () => {
    const doc = document(); doc.variables = { n: '5' }
    expect(() => engineFor(doc, { maxGenerationWork: 1 }).evaluateRawPattern('{{math:$n+1}}', 'root')).toThrow('Generation work limit exceeded')
    const engine = engineFor(doc)
    expect(() => engine.evaluateRawPattern('{{math:dice:1d6}}', 'root', { random: () => 1 })).toThrow('Random source')
    expect(() => engine.evaluateRawPattern('{{math:dice:1d6}}', 'root', { random: () => { throw new Error('rng callback') } })).toThrow('rng callback')
    expect(() => engine.evaluateRawPattern('{{math:dice:1001d1}}', 'root')).toThrow('Dice limits exceeded')
    expect(() => engine.evaluateRawPattern('{{math:9007199254740991+1}}', 'root')).toThrow('Math result exceeds safe integer limits')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(engine.evaluateRawPattern('{{math:2+}}', 'root').text).toBe('[math error]')
      expect(engine.evaluateRawPattern('{{math:dice:bad}}', 'root').text).toBe('[math error]')
    } finally { error.mockRestore() }
  })

  it.each(['{{math:dice:1d6+2}}', '{{dice:1d2*leaf}}', '{{dice:1d2*leaf >> $items}}'])('records physical dice and authored formulas in %s', pattern => {
    const result = engineFor(document([simple('leaf', 'L')])).evaluateRawPattern(pattern, 'root', { random: () => 0, enableTrace: true })
    expect(result.trace?.stats.diceRolled).toBe(1)
    expect(JSON.stringify(result.trace)).toContain(pattern.includes('math:') ? '1d6' : 'dice:1d2*leaf')
    expect(result.trace?.stats.typeBreakdown.dice_roll).toBe(1)
  })
})

describe('swarm: imported composition and inheritance contracts', () => {
  it('rerolls an imported pooled entry in its original pool, excluding itself', () => {
    const child = document([
      { id: 'source', name: 'Source', type: 'simple', entries: [{ id: 'a', value: '{{again}}' }, { id: 'b', value: '{{$label}}' }] },
      simple('merged', 'WRONG'),
    ])
    child.inputs = { label: { type: 'text', default: 'B' } }
    const engine = linkedEngine(child, document([{ id: 'merged', name: 'Merged', type: 'collection', collections: ['lib.source'] }]))
    expect(engine.roll('merged', 'root', { random: () => 0 }).text).toBe('B')
  })

  it.each(['{{lib.leaf}}', '{{summary}}', '{{pooled}}', '{{combo}}', '{{1*unique*combo}}', '{{combo >> $item}}'])('uses caller inheritance limits on cold and warmed caches via %s', pattern => {
    const base: AuthoredTable = { id: 'base', name: 'Base', type: 'simple', entries: [{ id: 'first', value: 'A' }] }
    const child = document([base, { id: 'mid', name: 'Mid', type: 'simple', extends: 'base', entries: [{ id: 'first', weight: 1 }] }, { id: 'leaf', name: 'Leaf', type: 'simple', extends: 'mid', entries: [{ id: 'first', weight: 1 }] }])
    const root = document([
      { id: 'pooled', name: 'Pool', type: 'collection', collections: ['lib.leaf'] },
      { id: 'combo', name: 'Combo', type: 'composite', sources: [{ tableId: 'lib.leaf' }] },
    ])
    root.metadata.maxInheritanceDepth = 1
    root.templates = [{ id: 'summary', name: 'Summary', pattern: '{{lib.leaf}}' }]
    const engine = linkedEngine(child, root)
    expect(() => engine.evaluateRawPattern(pattern, 'root', { random: () => 0 })).toThrow('Inheritance depth')
    expect(engine.roll('leaf', 'library', { random: () => 0 }).text).toBe('A')
    expect(() => engine.evaluateRawPattern(pattern, 'root', { random: () => 0 })).toThrow('Inheritance depth')
  })

  it('requires explicit IDs for inherited generated-ID collisions but allows additions and explicit overrides', () => {
    const parent = simple('loot', 'Base')
    const child = { ...simple('loot', 'Child'), extends: 'lib.loot' }
    const doc = document([child])
    const result = validateDocument(doc, { resolveTable: () => parent })
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_OVERRIDE_TARGET', path: 'tables[0].entries[0]' }))
    const engine = linkedEngine(document([parent]), doc)
    expect(() => engine.roll('loot', 'root')).toThrow('must specify an explicit ID')
    const explicit = { id: 'loot', name: 'Loot', type: 'simple' as const, extends: 'lib.loot', entries: [{ id: 'loot000', value: 'Override' }] }
    expect(linkedEngine(document([parent]), document([explicit])).roll('loot', 'root').text).toBe('Override')
    const addition = { ...simple('newLoot', 'New'), extends: 'lib.loot' }
    expect(linkedEngine(document([parent]), document([addition])).getResolvedTable('newLoot', 'root')).toHaveProperty('entries.length', 2)
  })

  it.each(['composite', 'collection'] as const)('rejects linked %s grandancestors at the initiating extends path', type => {
    const grand: AuthoredTable = type === 'composite' ? { id: 'grand', name: 'Grand', type, sources: [{ tableId: 'unit' }] } : { id: 'grand', name: 'Grand', type, collections: ['unit'] }
    const parent = { ...simple('parent', 'P'), extends: 'grand' }
    const child = { ...simple('child', 'C'), extends: 'lib.parent' }
    const result = validateDocument(document([child]), { resolveTable: (reference, owner) => reference === 'lib.parent' ? parent : owner === parent && reference === 'grand' ? grand : undefined })
    expect(result.errors.filter(issue => issue.code === 'INHERITANCE_TYPE_MISMATCH')).toEqual([expect.objectContaining({ path: 'tables[0].extends' })])
  })
})

describe('swarm: capture whitespace and entry descriptions', () => {
  it.each(['parent', 'pooled'])('keeps %s description references source-owned when an imported template reads first', id => {
    const child = document([simple('unit', 'CHILD')])
    child.inputs = { label: { type: 'text', default: 'CHILD' }, n: { type: 'integer', default: 3 } }
    child.templates = [{ id: 'show', name: 'Show', pattern: '{{@self.description}}|{{$label}}|{{math:$n}}' }]
    const root = document([
      simple('unit', 'ROOT'),
      { id: 'parent', name: 'Parent', type: 'simple', entries: [{ value: '{{lib.show}}', description: 'Root {{$label}}/{{math:$n}}/{{$n*unit}}' }] },
      { id: 'pooled', name: 'Pool', type: 'collection', collections: ['parent'] },
    ])
    root.inputs = { label: { type: 'text', default: 'ROOT' }, n: { type: 'integer', default: 1 } }
    const result = linkedEngine(child, root).roll(id, 'root', { random: () => 0 })
    expect(result.text).toBe('Root ROOT/1/ROOT|CHILD|3')
    expect(result.descriptions).toContainEqual(expect.objectContaining({ description: 'Root ROOT/1/ROOT' }))
    expect(result.metadata.inputs?.label).toBe('ROOT')
  })

  it('keeps an imported pooled source description local through a caller-owned template', () => {
    const child = document([{ id: 'source', name: 'Source', type: 'simple', entries: [{ value: '{{caller.show}}', description: 'Child {{$label}}' }] }])
    child.inputs = { label: { type: 'text', default: 'CHILD' } }
    child.imports = [{ alias: 'caller', path: 'root.json' }]
    const root = document([{ id: 'pooled', name: 'Pool', type: 'collection', collections: ['lib.source'] }])
    root.inputs = { label: { type: 'text', default: 'ROOT' } }
    root.templates = [{ id: 'show', name: 'Show', pattern: '{{@self.description}}|{{$label}}' }]
    const engine = linkedEngine(child, root)
    engine.resolveImports(new Map([['library.json', 'library'], ['root.json', 'root']]))
    const result = engine.roll('pooled', 'root', { random: () => 0 })
    expect(result.text).toBe('Child CHILD|ROOT')
    expect(result.descriptions).toContainEqual(expect.objectContaining({ description: 'Child CHILD' }))
  })

  it.each(['{{leaf}}', '{{summary}}', '{{switch[1:"L"]}}', '{{switch[1:leaf]}}', '{{switch[0:"L"]}}'])('retains whitespace around captured %s', expression => {
    const doc = document([{ id: 'leaf', name: 'Leaf', type: 'simple', entries: [{ value: 'L', sets: { tag: 'T' } }] }])
    doc.templates = [{ id: 'summary', name: 'Summary', pattern: '{{leaf}}' }]
    doc.shared = { saved: `  ${expression}\n` }
    const result = engineFor(doc).evaluateRawPattern('{{$saved}}', 'root', { random: () => 0 })
    expect(result.text).toBe(`  ${expression.includes('switch[0') ? '' : 'L'}\n`)
  })

  it.each(['described', 'pooled'])('uses one description roll throughout %s and its captured result', id => {
    const doc = document([
      { id: 'described', name: 'Described', type: 'simple', entries: [{ value: '{{@self.description}}|{{@self.description}}', description: 'Damage {{dice:1d6}}' }] },
      { id: 'pooled', name: 'Pooled', type: 'collection', collections: ['described'] },
    ])
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(0.99)
    const engine = engineFor(doc)
    const result = engine.evaluateRawPattern(`{{${id} >> $item}}|{{$item[0].@description}}`, 'root', { random, enableTrace: true })
    expect(result.text).toBe('Damage 1|Damage 1|Damage 1')
    expect(random).toHaveBeenCalledTimes(2)
    expect(result.trace?.stats.diceRolled).toBe(1)
    const second = engine.roll(id, 'root', { random: () => 0.99 })
    expect(second.text).toBe('Damage 6|Damage 6')
    expect(second.descriptions).toContainEqual(expect.objectContaining({ description: 'Damage 6' }))
  })

  it('restores a parent description after nested entries and rejects recursive descriptions', () => {
    const doc = document([
      { id: 'parent', name: 'Parent', type: 'simple', entries: [{ value: '{{@self.description}}/{{child}}/{{@self.description}}', description: 'P{{dice:1d1}}' }] },
      { id: 'child', name: 'Child', type: 'simple', entries: [{ value: '{{@self.description}}', description: 'C{{dice:1d1}}' }] },
      { id: 'recursive', name: 'Recursive', type: 'simple', entries: [{ value: '{{@self.description}}', description: '{{@self.description}}' }] },
    ])
    const engine = engineFor(doc); const random = vi.fn(() => 0)
    expect(engine.roll('parent', 'root', { random }).text).toBe('P1/C1/P1')
    expect(random).toHaveBeenCalledTimes(4)
    expect(() => engine.roll('recursive', 'root')).toThrow('Recursive @self.description')
    expect(engine.roll('parent', 'root', { random: () => 0 }).descriptions).toContainEqual(expect.objectContaining({ description: 'P1' }))
  })
})
