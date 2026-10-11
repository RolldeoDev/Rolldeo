import { describe, expect, it } from 'vitest'
import { RandomTableEngine } from './index'
import type { RandomTableDocument, Table, AuthoredRandomTableDocument } from '../types'

const simple = (id: string, value: string): Table => ({ id, name: id, type: 'simple', entries: [{ value }] })
const doc = (namespace: string, tables: Table[] = []): RandomTableDocument => ({
  metadata: { name: namespace, namespace, version: '1.0.0', specVersion: '1.0' }, tables,
})

function importedEngine() {
  const engine = new RandomTableEngine()
  const caller = { ...doc('test.caller', [simple('color', 'LOCAL')]), variables: { color: 'RED' }, imports: [{ alias: 'b', path: 'test.imported' }] }
  const imported = { ...doc('test.imported', [simple('color', 'FOREIGN'), simple('static', '{{$color}}')]), variables: { color: 'BLUE' }, shared: { forbidden: '{{missing}}' } }
  engine.loadCollection(caller, 'caller')
  engine.loadCollection(imported, 'imported')
  return engine
}

describe('Runtime review regressions', () => {
  it('EC01 routes ordinary, multi, captured and instance references to their qualified owner', () => {
    const engine = importedEngine()
    expect(engine.evaluateRawPattern('{{b.color}}|{{2*b.color}}|{{b.color#one}}|{{2*b.color >> $values}}', 'caller').text)
      .toBe('FOREIGN|FOREIGN, FOREIGN|FOREIGN|FOREIGN, FOREIGN')
    expect(engine.evaluateRawPattern('{{2*test.imported.color}}', 'caller').text).toBe('FOREIGN, FOREIGN')
  })

  it('EC02 resolves qualified static variables and source-local variables without evaluating imported document shared', () => {
    const engine = importedEngine()
    expect(engine.evaluateRawPattern('{{$b.color}}|{{$test.imported.color}}|{{b.static}}|{{$color}}', 'caller').text)
      .toBe('BLUE|BLUE|BLUE|RED')
    expect(() => engine.evaluateRawPattern('{{$b.forbidden}}', 'caller')).toThrow('REFERENCE_ERROR')
  })

  it('EC02 resolves qualified static variable counts for ordinary and captured multi-rolls', () => {
    const engine = importedEngine()
    const imported = engine.getCollection('imported')!.document
    engine.updateDocument('imported', { ...imported, variables: { ...imported.variables, amount: '2' } })
    expect(engine.evaluateRawPattern('{{$b.amount*b.color}}|{{$b.amount*b.color >> $items}}|{{$items.count}}', 'caller').text)
      .toBe('FOREIGN, FOREIGN|FOREIGN, FOREIGN|2')
  })

  it('EC03 restores parent self context after nested value and set rolls', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(doc('test.frames', [
      simple('child', 'CHILD'),
      { id: 'parent', name: 'parent', type: 'simple', entries: [{
        value: '{{child}}|{{@self.description}}|{{@self.value}}', description: 'PARENT', sets: { nested: '{{child}}' },
      }] },
    ]), 'main')
    expect(engine.roll('parent', 'main').text).toBe('CHILD|PARENT|{{child}}|{{@self.description}}|{{@self.value}}')
  })

  it('EC03 restores parent again target after nested rolls', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(doc('test.frames', [
      { id: 'child', name: 'child', type: 'simple', entries: [{ id: 'a', value: 'CHILD' }, { id: 'b', value: 'WRONG' }] },
      { id: 'parent', name: 'parent', type: 'simple', entries: [{ id: 'first', value: '{{child}}|{{again}}' }, { id: 'other', value: 'PARENT' }] },
    ]), 'main')
    expect(engine.roll('parent', 'main', { random: () => 0 }).text).toBe('CHILD|PARENT')
  })

  it('EC04 keeps missing unqualified references local regardless of unrelated libraries', () => {
    const engine = importedEngine()
    expect(() => engine.evaluateRawPattern('{{static}}', 'caller')).toThrow('REFERENCE_ERROR')
    engine.loadCollection(doc('test.unrelated', [simple('other', 'OTHER')]), 'other')
    expect(() => engine.evaluateRawPattern('{{other}}', 'caller')).toThrow('REFERENCE_ERROR')
  })

  it('EC04 treats declared aliases as authoritative when the target member is absent', () => {
    const engine = importedEngine()
    engine.loadCollection(doc('b', [simple('missing', 'WRONG')]), 'namespace')
    expect(() => engine.evaluateRawPattern('{{b.missing}}', 'caller')).toThrow('REFERENCE_ERROR')
  })

  it('EC04 honors first-segment aliases before colliding multisegment namespaces and resolves nested aliases', () => {
    const engine = importedEngine()
    engine.loadCollection(doc('b.nested', [simple('color', 'WRONG')]), 'collision')
    expect(() => engine.evaluateRawPattern('{{b.nested.color}}', 'caller')).toThrow('REFERENCE_ERROR')
    const imported = engine.getCollection('imported')!.document
    engine.updateDocument('imported', { ...imported, imports: [{ alias: 'nested', path: 'test.child' }] })
    engine.loadCollection(doc('test.child', [simple('color', 'NESTED')]), 'child')
    expect(engine.evaluateRawPattern('{{b.nested.color}}', 'caller').text).toBe('NESTED')
  })

  it('EC04 rejects ambiguous exact namespaces independent of collection order', () => {
    const engine = importedEngine()
    engine.loadCollection(doc('test.imported', [simple('color', 'WRONG')]), 'duplicate')
    expect(engine.getImportDiagnostics().some(issue => issue.code === 'IMPORT_ERROR')).toBe(true)
    expect(() => engine.evaluateRawPattern('{{test.imported.color}}', 'caller')).toThrow('REFERENCE_ERROR: Ambiguous namespace')
  })

  it('EC05 preserves surrounding literals and full qualified references in shared captures', () => {
    const engine = importedEngine()
    expect(engine.evaluateRawPattern('{{$value}}', 'caller', { shared: { value: 'before {{b.color}} after' } }).text)
      .toBe('before FOREIGN after')
    expect(engine.evaluateRawPattern('{{$value}}', 'caller', { shared: { value: '{{b.color}}' } }).text).toBe('FOREIGN')
  })

  it('EC06 gives direct, property, captured and multi-template access one ordered isolated shared scope', () => {
    const engine = new RandomTableEngine()
    const document = doc('test.templates')
    document.templates = [{ id: 'prop', name: 'prop', shared: { first: 'ONE', second: '{{$first}}' }, pattern: '{{$first}}|{{$second}}' }]
    engine.loadCollection(document, 'main')
    expect(engine.evaluateRawPattern('{{prop}}|{{prop.@second}}|{{$result.@second}}|{{2*prop}}', 'main', { shared: { result: '{{prop}}' } }).text)
      .toBe('ONE|ONE|ONE|ONE|ONE|ONE, ONE|ONE')
    expect(engine.evaluateRawPattern('{{$first}}', 'main').text).toBe('')
  })

  it('EC08 preserves zero for ordinary and capture counts', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection({ ...doc('test.counts', [simple('child', 'CHILD')]), variables: { amount: '0' } }, 'main')
    expect(engine.evaluateRawPattern('{{$amount*child}}|{{$amount*child >> $items}}|{{$items.count}}', 'main').text).toBe('||0')
  })

  it.each(['NaN', '2junk', '-1', '0.5', ''])('EC08 treats invalid, negative or subunit counts as zero %j', (amount) => {
    const engine = new RandomTableEngine()
    engine.loadCollection({ ...doc('test.counts', [simple('child', 'CHILD')]), variables: { amount } }, 'main')
    expect(engine.evaluateRawPattern('{{$amount*child}}', 'main').text).toBe('')
    expect(engine.evaluateRawPattern('{{$amount*child >> $items}}', 'main').text).toBe('')
  })

  it('bounds fanout with shared work and output budgets before retaining huge arrays', () => {
    const engine = new RandomTableEngine({ config: { maxGenerationWork: 80, maxOutputLength: 5000 } })
    engine.loadCollection(doc('test.budget', [simple('leaf', 'L'), simple('middle', '{{30*leaf}}')]), 'main')
    expect(() => engine.evaluateRawPattern('{{30*middle}}', 'main')).toThrow('Generation work limit')
    expect(() => engine.evaluateRawPattern('{{99999999999999999999999*leaf}}', 'main')).toThrow('Generation work limit')
    const textEngine = new RandomTableEngine({ config: { maxOutputLength: 5000 } })
    textEngine.loadCollection(doc('test.budget', [simple('long', 'x'.repeat(1000))]), 'main')
    expect(() => textEngine.evaluateRawPattern('{{1000*long >> $items |silent}}', 'main')).toThrow('Generation output limit')
  })

  it('preserves durable filename bindings across update, replacement, missing dependencies and isolated previews', () => {
    const engine = new RandomTableEngine()
    const caller = { ...doc('test.caller'), imports: [{ alias: 'b', path: 'library.json' }] }
    engine.loadCollection(caller, 'caller')
    engine.loadCollection(doc('test.library', [simple('color', 'ORIGINAL')]), 'library')
    engine.resolveImports(undefined, new Map([['caller', new Map([['b', 'library']])]]))
    engine.updateDocument('caller', { ...caller, variables: { edit: 'done' } })
    engine.loadCollection(doc('test.library', [simple('color', 'UPDATED')]), 'library')
    expect(engine.evaluateRawPattern('{{b.color}}', 'caller').text).toBe('UPDATED')
    const preview = engine.cloneForPreview({ ...caller, tables: [simple('draft', 'DRAFT')] }, 'caller')
    expect(preview.evaluateRawPattern('{{b.color}}|{{draft}}', 'caller').text).toBe('UPDATED|DRAFT')
    expect(engine.getTable('draft', 'caller')).toBeUndefined()
    engine.unloadCollection('library')
    engine.loadCollection(doc('library', [simple('color', 'WRONG')]), 'unrelated')
    expect(() => engine.evaluateRawPattern('{{b.color}}', 'caller')).toThrow('REFERENCE_ERROR')
    expect(engine.getImportDiagnostics()[0]?.code).toBe('IMPORT_ERROR')
  })

  it('preview import path edits use the new target without mutating committed aliases', () => {
    const engine = importedEngine()
    engine.loadCollection(doc('test.new', [simple('color', 'NEW')]), 'new')
    engine.resolveImports(undefined, new Map([['caller', new Map([['b', 'imported']])]]))
    const caller = engine.getCollection('caller')!.document
    const preview = engine.cloneForPreview({ ...caller, imports: [{ alias: 'b', path: 'test.new' }] }, 'caller')
    expect(preview.evaluateRawPattern('{{b.color}}', 'caller').text).toBe('NEW')
    expect(engine.evaluateRawPattern('{{b.color}}', 'caller').text).toBe('FOREIGN')
  })

  it('reports import cycles while allowing independent local generation', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection({ ...doc('test.a', [simple('local', 'LOCAL')]), imports: [{ alias: 'b', path: 'test.b' }] }, 'a')
    engine.loadCollection({ ...doc('test.b'), imports: [{ alias: 'a', path: 'test.a' }] }, 'b')
    expect(engine.getImportDiagnostics().filter(issue => issue.code === 'IMPORT_CYCLE')).toHaveLength(2)
    expect(engine.roll('local', 'a').text).toBe('LOCAL')
  })

  it('supports authored partial inherited overrides, clears caches on edits and rejects unmatched missing values', () => {
    const engine = new RandomTableEngine()
    const authored: AuthoredRandomTableDocument = {
      ...doc('test.inheritance'), tables: [
        { id: 'base', name: 'base', type: 'simple', entries: [{ id: 'a', value: 'A' }] },
        { id: 'child', name: 'child', type: 'simple', extends: 'base', entries: [{ id: 'a', weight: 2 }] },
      ],
    }
    engine.loadCollection(authored, 'main')
    expect(engine.roll('child', 'main').text).toBe('A')
    engine.updateDocument('main', { ...authored, tables: [
      { id: 'base', name: 'base', type: 'simple', entries: [{ id: 'a', value: 'UPDATED' }] }, authored.tables[1],
    ] })
    expect(engine.roll('child', 'main').text).toBe('UPDATED')
    expect(() => engine.updateDocument('main', { ...authored, tables: [authored.tables[0],
      { id: 'child', name: 'child', type: 'simple', extends: 'base', entries: [{ id: 'missing', weight: 2 }] },
    ] })).toThrow('VALIDATION_ERROR')
    expect(engine.roll('child', 'main').text).toBe('UPDATED')
  })

  it('routes composite and merged qualified source expressions to the owning collection', () => {
    const engine = importedEngine()
    const caller = engine.getCollection('caller')!.document
    engine.updateDocument('caller', { ...caller, tables: [...caller.tables,
      { id: 'composite', name: 'composite', type: 'composite', sources: [{ tableId: 'b.static' }] },
      { id: 'merged', name: 'merged', type: 'collection', collections: ['b.static'] },
    ] })
    expect(engine.roll('composite', 'caller').text).toBe('BLUE')
    expect(engine.roll('merged', 'caller').text).toBe('BLUE')
  })

  it('switch base substitution respects quoted dollar literals, regex anchors and raw newline values', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection({ ...doc('test.conditions'), variables: { label: 'foo', multiline: 'line\nnext', dollar: '$' } }, 'main')
    expect(engine.evaluateRawPattern('{{$label.switch[$ matches "^foo$":"YES"].else["NO"]}}', 'main').text).toBe('YES')
    expect(engine.evaluateRawPattern('{{$dollar.switch[$ == "$":"YES"].else["NO"]}}', 'main').text).toBe('YES')
    expect(engine.evaluateRawPattern('{{$multiline.switch[$ contains "next":"YES"].else["NO"]}}', 'main').text).toBe('YES')
  })

  it('supports multiline quoted output in standalone and chained switches', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(doc('test.multiline'), 'main')
    expect(engine.evaluateRawPattern('{{switch[1:"first\nsecond"].else["fallback"]}}', 'main').text).toBe('first\nsecond')
    expect(engine.evaluateRawPattern('{{switch[0:"unused"].switch[1:"first\nsecond"].else["fallback"]}}', 'main').text).toBe('first\nsecond')
  })

  it('injected random source applies consistently to table selection and dice', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(doc('test.random', [{ id: 'choice', name: 'choice', type: 'simple', entries: [{ value: 'LOW' }, { value: 'HIGH' }] }]), 'main')
    expect(engine.evaluateRawPattern('{{choice}}|{{dice:1d6}}|{{math:dice:1d6 + 2}}', 'main', { random: () => 0 }).text).toBe('LOW|1|3')
    expect(engine.evaluateRawPattern('{{choice}}|{{dice:1d6}}|{{math:dice:1d6 + 2}}', 'main', { random: () => 0.99 }).text).toBe('HIGH|6|8')
    expect(() => engine.evaluateRawPattern('{{choice}}', 'main', { random: () => 1 })).toThrow('Random source')
  })

  it('rejects malformed committed shapes without losing the previous collection', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(doc('test.valid', [simple('local', 'SAFE')]), 'main')
    expect(() => engine.loadCollection({} as RandomTableDocument, 'main')).toThrow('VALIDATION_ERROR')
    expect(() => engine.updateDocument('main', {} as RandomTableDocument)).toThrow('VALIDATION_ERROR')
    expect(engine.roll('local', 'main').text).toBe('SAFE')
    expect(engine.loadFromJson('{', 'bad').valid).toBe(false)
  })
})
