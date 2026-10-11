import React, { type ReactElement, type ReactNode } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { Table2 } from 'lucide-react'
import { KeyValueEditor } from './KeyValueEditor'
import { TableEditor } from './TableEditor'
import { AdvancedSettings, TagsField } from './AdvancedSettings'
import { ConversionReviewPanel } from './ConversionReviewPanel'
import { getConversionReviewStatus, markConversionReviewed } from '@/lib/conversionVerification'
import { EntryEditor } from './EntryEditor'
import { parseDraftSnapshot } from './draftState'
import { RandomTableEngine } from '@/engine/core'
import type { AuthoredRandomTableDocument, AuthoredSimpleTable } from '@/engine/types'
import { InsertDropdown } from './InsertDropdown'
import { CollectionPathSelector } from './CollectionPathSelector'
import { insertSuggestion, type TriggerInfo } from '@/hooks/usePatternAutocomplete'
import type { Suggestion } from '@/hooks/usePatternSuggestions'
import type { ImportedTableInfo } from '@/engine/core'
import type { CollectionMeta } from '@/stores/collectionStore'

// Exercise the actual components and their handlers without a browser dependency.
// Effects/DOM focus are deliberately outside this harness's coverage.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useId: () => 'editor-test-field',
    useState: (initial: unknown) => {
      const index = hooks.cursor++
      if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === 'function' ? initial() : initial
      return [hooks.slots[index], (next: unknown) => {
        hooks.slots[index] = typeof next === 'function' ? next(hooks.slots[index]) : next
      }]
    },
    useRef: (initial: unknown) => {
      const index = hooks.cursor++
      if (!(index in hooks.slots)) hooks.slots[index] = { current: initial }
      return hooks.slots[index]
    },
    useMemo: (callback: () => unknown) => callback(),
    useCallback: (callback: unknown) => callback,
    useEffect: () => {},
  }
})
vi.mock('./PatternPreview/usePatternEvaluation', () => ({
  usePatternEvaluation: () => ({ result: null, reroll: () => {}, isEvaluating: false, traceNodeCount: 0, captureCount: 0 }),
}))
vi.mock('react-dom', async importOriginal => ({
  ...await importOriginal<typeof import('react-dom')>(),
  createPortal: (children: ReactNode) => children,
}))

function render<T>(component: () => T): T {
  hooks.cursor = 0
  return component()
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!React.isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}
function handler(element: ReactElement<Record<string, unknown>>, name: string) {
  return element.props[name] as (event?: unknown) => void
}
function keyEvent(key: string) {
  const target = { tagName: 'INPUT' }
  return { key, target, currentTarget: target, preventDefault: vi.fn() }
}
const imported = (name: string, alias = name.toLowerCase()): ImportedTableInfo => ({
  id: 'names', name: 'Names', alias, sourceCollectionName: name,
  sourceNamespace: 'test.source', type: 'simple', entryCount: 1,
  resultType: undefined,
})

beforeEach(() => {
  hooks.slots = []
  hooks.cursor = 0
  vi.stubGlobal('document', { body: {} })
})
afterEach(() => vi.unstubAllGlobals())

describe('arbitrary JSON keys in actual editor handlers', () => {
  it('preserves __proto__ when renaming an unrelated key', () => {
    const value = JSON.parse('{"__proto__":"Keep this","normal":"Value"}') as Record<string, string>
    const onChange = vi.fn()
    const component = () => KeyValueEditor({ value, onChange })
    let inputs = elements(render(component)).filter(element => element.type === 'input')
    handler(inputs[1], 'onFocus')()
    inputs = elements(render(component)).filter(element => element.type === 'input')
    handler(inputs[1], 'onChange')({ target: { value: 'renamed' } })
    inputs = elements(render(component)).filter(element => element.type === 'input')
    handler(inputs[1], 'onBlur')()
    expect(JSON.stringify(onChange.mock.calls[0][0])).toBe('{"__proto__":"Keep this","renamed":"Value"}')
  })

  it.each(['constructor', 'toString', '__proto__'])('can add %s when it is not an own key', key => {
    const onChange = vi.fn()
    const component = () => KeyValueEditor({ value: {}, onChange })
    let tree = elements(render(component))
    handler(tree.find(element => element.type === 'input')!, 'onChange')({ target: { value: key } })
    tree = elements(render(component))
    handler(tree.find(element => element.type === 'button' && element.props.disabled !== undefined)!, 'onClick')()
    expect(Object.prototype.hasOwnProperty.call(onChange.mock.calls[0][0], key)).toBe(true)
  })

  it('retains null deletion markers while renaming another inherited map value', () => {
    const value = { removed: null, normal: 'Value' }
    const onChange = vi.fn()
    const component = () => KeyValueEditor({ value, onChange })
    let inputs = elements(render(component)).filter(element => element.type === 'input')
    handler(inputs[1], 'onFocus')()
    inputs = elements(render(component)).filter(element => element.type === 'input')
    handler(inputs[1], 'onChange')({ target: { value: 'renamed' } })
    inputs = elements(render(component)).filter(element => element.type === 'input')
    handler(inputs[1], 'onBlur')()
    expect(onChange.mock.calls[0][0]).toEqual({ removed: null, renamed: 'Value' })
  })
})

describe('dropdown display order and keyboard selection', () => {
  it.each(['constructor', 'toString', '__proto__'])('renders the valid imported collection name %s', name => {
    expect(() => render(() => InsertDropdown({ localTables: [], localTemplates: [], importedTables: [imported(name)], onInsert: vi.fn() }))).not.toThrow()
  })

  it('inserts the highlighted alphabetical group and the row hovered after it', () => {
    const onInsert = vi.fn()
    const component = () => InsertDropdown({ localTables: [], localTemplates: [],
      importedTables: [imported('Zebra'), imported('Alpha')], onInsert })
    handler(elements(render(component)).find(element => element.type === 'button')!, 'onClick')()
    let tree = elements(render(component))
    const rows = tree.filter(element => element.type === 'button' && element.props.onMouseEnter)
    expect(rows[0].props.children).toBeTruthy()
    handler(tree.find(element => element.props.onKeyDown)!, 'onKeyDown')(keyEvent('Enter'))
    expect(onInsert).toHaveBeenLastCalledWith('{{alpha.names}}')
    // Reopen then hover the second visual row and press Enter.
    handler(elements(render(component)).find(element => element.type === 'button')!, 'onClick')()
    tree = elements(render(component))
    handler(tree.filter(element => element.type === 'button' && element.props.onMouseEnter)[1], 'onMouseEnter')()
    tree = elements(render(component))
    handler(tree.find(element => element.props.onKeyDown)!, 'onKeyDown')(keyEvent('Enter'))
    expect(onInsert).toHaveBeenLastCalledWith('{{zebra.names}}')
  })

  it('selects preloaded collections before user collections using the same visual order', () => {
    const onChange = vi.fn()
    const availableCollections = [
      { id: 'user', name: 'User', namespace: 'test.user', isPreloaded: false, tableCount: 1 },
      { id: 'preloaded', name: 'Preloaded', namespace: 'test.preloaded', isPreloaded: true, tableCount: 1 },
    ] as CollectionMeta[]
    const component = () => CollectionPathSelector({ value: '', onChange, availableCollections })
    handler(elements(render(component)).find(element => element.type === 'input')!, 'onFocus')()
    let tree = elements(render(component))
    handler(tree.find(element => element.type === 'input')!, 'onKeyDown')(keyEvent('Enter'))
    expect(onChange).toHaveBeenLastCalledWith('test.preloaded')
    handler(elements(render(component)).find(element => element.type === 'input')!, 'onFocus')()
    tree = elements(render(component))
    handler(tree.find(element => element.type === 'input')!, 'onKeyDown')(keyEvent('ArrowDown'))
    tree = elements(render(component))
    handler(tree.find(element => element.type === 'input')!, 'onKeyDown')(keyEvent('Enter'))
    expect(onChange).toHaveBeenLastCalledWith('test.user')
  })
})

describe('autocomplete replacement spans', () => {
  const suggestion: Suggestion = { id: 'race', label: 'race', insertText: 'race', category: 'table',
    icon: Table2, source: 'Local', colorClass: 'mint' }
  const trigger = (type: TriggerInfo['type'], startIndex: number, cursorIndex: number): TriggerInfo =>
    ({ type, startIndex, cursorIndex, partialInput: '', position: { top: 0, left: 0 } })

  it('replaces an existing expression when accepted inside its token', () => {
    expect(insertSuggestion('Before {{race}} after', trigger('braces', 7, 12), suggestion))
      .toEqual({ newValue: 'Before {{race}} after', newCursorPos: 15 })
  })
  it('completes incomplete tokens without consuming a later expression', () => {
    expect(insertSuggestion('{{rac {{other}}', trigger('braces', 0, 5), suggestion).newValue).toBe('{{race}} {{other}}')
  })
  it.each([
    ['variable', '{{$hero.@name}}', 2, 5, '$hero', '{{$hero.@name}}'],
    ['placeholder', '{{@race}}', 2, 6, '@race', '{{@race}}'],
    ['property', '{{race.@name}}', 7, 10, 'name', '{{race.@name}}'],
    ['property', '{{race.@name}}', 7, 7, 'name', '{{race.@name}}'],
  ] as const)('replaces the full %s identifier while retaining its property chain and delimiters', (type, value, start, cursor, insertText, expected) => {
    expect(insertSuggestion(value, trigger(type, start, cursor), { ...suggestion, insertText }).newValue).toBe(expected)
  })
})


describe('authored inherited overrides in editor callbacks', () => {
  const document: AuthoredRandomTableDocument = {
    metadata: { name: 'Inheritance', namespace: 'test.inheritance', version: '1.0.0', specVersion: '1.0' },
    tables: [
      { id: 'base', name: 'Base', type: 'simple', entries: [
        { id: 'a', value: 'A', description: 'Inherited', sets: { removed: 'Old', kept: 'Kept' } },
        { id: 'b', value: 'B' },
      ] },
      { id: 'child', name: 'Child', type: 'simple', extends: 'base', entries: [
        { id: 'a', description: null, sets: { removed: null } }, { id: 'b', weight: 2 },
      ] },
    ],
  }
  const child = document.tables[1] as AuthoredSimpleTable

  it('keeps omission and null markers when editing another entry field', () => {
    const onChange = vi.fn()
    const tree = elements(render(() => EntryEditor({ entry: child.entries[0], index: 0,
      defaultExpanded: true, onChange, onDelete: () => {} })))
    const weight = tree.find(element => element.type === 'input' && element.props.type === 'number')!
    handler(weight, 'onChange')({ target: { value: '3' } })
    expect(onChange.mock.calls[0][0]).toEqual({ id: 'a', description: null, sets: { removed: null }, weight: 3 })
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('value')
  })

  it('keeps author patches through actual reorder and validated export snapshots', () => {
    const onChange = vi.fn()
    const tableTree = elements(render(() => TableEditor({ table: child, defaultExpanded: true, availableTableIds: ['base', 'child'],
      onChange, onDelete: () => {} })))
    const simpleEditor = tableTree.find(element => typeof element.type === 'function' && element.type.name === 'SimpleTableEditor')!
    hooks.slots = []
    const component = simpleEditor.type as (props: Record<string, unknown>) => ReactNode
    const tree = elements(render(() => component(simpleEditor.props)))
    handler(tree.find(element => element.props.onReorder)!, 'onReorder')([...child.entries].reverse())
    const snapshot = parseDraftSnapshot(JSON.stringify({ ...document, tables: [document.tables[0], onChange.mock.calls[0][0]] }))
    expect(snapshot.tables[1]).toEqual({ ...child, entries: [...child.entries].reverse() })
  })

  it('clones an inherited patch as a valid materialized new entry', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document, 'draft')
    const resolved = engine.getResolvedTable('child', 'draft')!
    const onChange = vi.fn()
    const tableTree = elements(render(() => TableEditor({ table: child, defaultExpanded: true, availableTableIds: ['base', 'child'],
      tableMap: new Map([['child', resolved]]), onChange, onDelete: () => {} })))
    const simpleEditor = tableTree.find(element => typeof element.type === 'function' && element.type.name === 'SimpleTableEditor')!
    hooks.slots = []
    const component = simpleEditor.type as (props: Record<string, unknown>) => ReactNode
    const tree = elements(render(() => component(simpleEditor.props)))
    handler(tree.find(element => element.props.entry === child.entries[0])!, 'onClone')()
    const updated = onChange.mock.calls[0][0] as AuthoredSimpleTable
    expect(updated.entries[0]).toEqual(child.entries[0])
    expect(updated.entries[1]).toMatchObject({ id: 'a_copy', value: 'A', sets: { kept: 'Kept' } })
    expect(updated.entries[1]).not.toHaveProperty('description')
    expect(() => parseDraftSnapshot(JSON.stringify({ ...document, tables: [document.tables[0], updated] }))).not.toThrow()
  })
})


describe('basic authoring and explicit advanced controls', () => {
  const table: AuthoredSimpleTable = { id: 'reactions', name: 'Reactions', type: 'simple', entries: [
    { value: 'Friendly', weight: 2 }, { value: 'Hostile', weight: 1 },
  ] }

  it('keeps optional settings closed but exposes configured values and lets authors collapse them', () => {
    expect(render(() => AdvancedSettings({ children: 'Optional' })).props.open).toBe(false)
    hooks.slots = []
    const component = () => AdvancedSettings({ children: 'Shared values', configured: ['2 shared values'] })
    let disclosure = render(component)
    expect(disclosure.props.open).toBe(true)
    expect(JSON.stringify(disclosure.props.children)).toContain('2 shared values')
    handler(disclosure, 'onToggle')({ currentTarget: { open: false } })
    disclosure = render(component)
    expect(disclosure.props.open).toBe(false)
    expect(JSON.stringify(disclosure.props.children)).toContain('2 shared values')
  })

  it('keeps required ID errors visible inside advanced settings', () => {
    expect(render(() => AdvancedSettings({ children: 'Invalid ID', hasError: true })).props.open).toBe(true)
  })

  it('presents entry authoring before technical table settings', () => {
    const tree = elements(render(() => TableEditor({ table, defaultExpanded: true, availableTableIds: [], onChange: vi.fn(), onDelete: vi.fn() })))
    const entriesIndex = tree.findIndex(element => typeof element.type === 'function' && element.type.name === 'SimpleTableEditor')
    expect(entriesIndex).toBeGreaterThan(0)
    expect(entriesIndex).toBeLessThan(tree.findIndex(element => element.type === AdvancedSettings))
  })

  it('selects source dice without silently rewriting weights, ranges or source text', () => {
    const onChange = vi.fn()
    const tree = elements(render(() => TableEditor({ table, specVersion: '1.0', defaultExpanded: true, availableTableIds: [], onChange, onDelete: vi.fn() })))
    const selector = tree.find(element => element.type === 'select' && element.props.value === 'weighted')!
    handler(selector, 'onChange')({ target: { value: 'dice' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toEqual({ ...table, selection: { mode: 'dice', dice: '1d6' } })
    expect(table.entries[0]).toEqual({ value: 'Friendly', weight: 2 })
  })

  it('retains conversion provenance when changing table type', () => {
    const converted = { ...table, conversion: { kind: 'adaptation' as const, sourceText: 'Original table', notes: 'Adapted' } }
    const onChange = vi.fn()
    const tree = elements(render(() => TableEditor({ table: converted, defaultExpanded: true, availableTableIds: [], onChange, onDelete: vi.fn() })))
    handler(tree.find(element => element.type === 'select' && element.props.value === 'simple')!, 'onChange')({ target: { value: 'composite' } })
    expect(onChange.mock.calls[0][0].conversion).toEqual(converted.conversion)
  })

  it('honors inherited source dice and disables a misleading weighted override', () => {
    const parent = { ...table, selection: { mode: 'dice' as const, dice: '1d6' } }
    const child = { ...table, id: 'child', extends: 'reactions' }
    const tree = elements(render(() => TableEditor({ table: child, defaultExpanded: true, availableTableIds: ['reactions'],
      tableMap: new Map([['reactions', parent]]), onChange: vi.fn(), onDelete: vi.fn() })))
    expect(tree.find(element => element.type === 'option' && element.props.value === 'weighted')?.props.disabled).toBe(true)
    expect(tree.find(element => typeof element.type === 'function' && element.type.name === 'SimpleTableEditor')?.props.nativeDice).toBe(true)
  })

  it('uses the qualified imported parent’s native dice instead of the child’s stale resolved selection', () => {
    const child: AuthoredSimpleTable = { id: 'child', name: 'Child', type: 'simple', extends: 'alias.nativeParent', entries: [] }
    const parent = { id: 'nativeParent', name: 'Parent', type: 'simple' as const, selection: { mode: 'dice' as const, dice: '2d6' }, entries: [{ value: 'Result', range: [2, 12] as [number, number] }] }
    const staleChild = { ...parent, id: 'child', selection: { mode: 'dice' as const, dice: '1d8' } }
    const tree = elements(render(() => TableEditor({ table: child, defaultExpanded: true, availableTableIds: [],
      tableMap: new Map([['child', staleChild], ['alias.nativeParent', parent]]), onChange: vi.fn(), onDelete: vi.fn() })))
    expect(tree.find(element => element.type === 'option' && element.props.value === 'weighted')?.props.disabled).toBe(true)
    expect(tree.find(element => typeof element.type === 'function' && element.type.name === 'SimpleTableEditor')?.props.nativeDice).toBe(true)
    expect(tree.find(element => element.type === 'input' && String(element.props.id).endsWith('-dice'))?.props.value).toBe('2d6')
  })

  it('uses the current draft parent when extends changes while the resolved child is stale', () => {
    let child: AuthoredSimpleTable = { id: 'child', name: 'Child', type: 'simple', extends: 'alias.nativeParent', entries: [] }
    const native = { id: 'nativeParent', name: 'Parent', type: 'simple' as const, selection: { mode: 'dice' as const, dice: '2d6' }, entries: [] }
    const weighted = { id: 'weightedParent', name: 'Weighted', type: 'simple' as const, entries: [{ value: 'Result' }] }
    const tableMap = new Map<string, import('@/engine/types').Table>([['child', { ...native, id: 'child' }], ['alias.nativeParent', native], ['alias.weightedParent', weighted]])
    const component = () => TableEditor({ table: child, defaultExpanded: true, availableTableIds: [], tableMap, onChange: vi.fn(), onDelete: vi.fn() })
    expect(elements(render(component)).find(element => element.type === 'option' && element.props.value === 'weighted')?.props.disabled).toBe(true)
    child = { ...child, extends: 'alias.weightedParent' }
    const tree = elements(render(component))
    expect(tree.find(element => element.type === 'option' && element.props.value === 'weighted')?.props.disabled).toBe(false)
    expect(tree.find(element => typeof element.type === 'function' && element.type.name === 'SimpleTableEditor')?.props.nativeDice).toBe(false)
  })

  it('allows clearing an explicit local dice override for a weighted imported parent', () => {
    let child: AuthoredSimpleTable = { id: 'child', name: 'Child', type: 'simple', extends: 'alias.weightedParent', entries: [], selection: { mode: 'dice', dice: '1d6' } }
    const resolved = { id: 'child', name: 'Child', type: 'simple' as const, selection: { mode: 'dice' as const, dice: '1d6' }, entries: [] }
    const parent = { id: 'weightedParent', name: 'Weighted', type: 'simple' as const, entries: [{ value: 'Result' }] }
    const tableMap = new Map<string, import('@/engine/types').Table>([['child', resolved], ['alias.weightedParent', parent]])
    const onChange = vi.fn(updated => { child = updated })
    const component = () => TableEditor({ table: child, defaultExpanded: true, availableTableIds: [], tableMap, onChange, onDelete: vi.fn() })
    let tree = elements(render(component))
    expect(tree.find(element => element.type === 'option' && element.props.value === 'weighted')?.props.disabled).toBe(false)
    handler(tree.find(element => element.type === 'select' && String(element.props.id).endsWith('-selection'))!, 'onChange')({ target: { value: 'weighted' } })
    expect(child).not.toHaveProperty('selection')
    tree = elements(render(component))
    expect(tree.find(element => typeof element.type === 'function' && element.type.name === 'SimpleTableEditor')?.props.nativeDice).toBe(false)
  })

  it('can clear a local native override explicitly to restore an imported parent’s native selection', () => {
    let child: AuthoredSimpleTable = { id: 'child', name: 'Child', type: 'simple', extends: 'alias.nativeParent', entries: [], selection: { mode: 'dice', dice: '1d8' } }
    const parent = { id: 'nativeParent', name: 'Native', type: 'simple' as const, selection: { mode: 'dice' as const, dice: '2d6' }, entries: [] }
    const onChange = vi.fn(updated => { child = updated })
    const component = () => TableEditor({ table: child, defaultExpanded: true, availableTableIds: [], tableMap: new Map([['alias.nativeParent', parent]]), onChange, onDelete: vi.fn() })
    let tree = elements(render(component))
    expect(tree.find(element => element.type === 'input' && String(element.props.id).endsWith('-dice'))?.props.value).toBe('1d8')
    handler(tree.find(element => element.type === 'select' && String(element.props.id).endsWith('-selection'))!, 'onChange')({ target: { value: 'inherited' } })
    expect(child).not.toHaveProperty('selection')
    tree = elements(render(component))
    expect(tree.find(element => element.type === 'select' && String(element.props.id).endsWith('-selection'))?.props.value).toBe('inherited')
    expect(tree.find(element => element.type === 'input' && String(element.props.id).endsWith('-dice'))?.props.value).toBe('2d6')
    expect(tree.find(element => element.type === 'option' && element.props.value === 'weighted')?.props.disabled).toBe(true)
  })

  it.each(['0', '-3'])('retains the signed source-dice range endpoint %s', endpoint => {
    const onChange = vi.fn()
    const tree = elements(render(() => EntryEditor({ entry: { value: 'Result', range: [-4, 3] }, index: 0, nativeDice: true, onChange, onDelete: vi.fn() })))
    const input = tree.find(element => element.type === 'input' && element.props.title === 'Range start')!
    handler(input, 'onChange')({ target: { value: endpoint } })
    expect(onChange.mock.calls[0][0]).toEqual({ value: 'Result', range: [Number(endpoint), 3] })
    expect(input.props.min).toBeUndefined()
  })

  it('removes a conflicting native weight only after the explicit Range action, retaining its authored range', () => {
    const onChange = vi.fn()
    const entry = { value: 'Result', weight: 2, range: [2, 7] as [number, number] }
    const tree = elements(render(() => EntryEditor({ entry, index: 0, nativeDice: true, defaultExpanded: true, onChange, onDelete: vi.fn() })))
    expect(onChange).not.toHaveBeenCalled()
    handler(tree.find(element => element.type === 'button' && element.props.children === 'Range')!, 'onClick')()
    expect(onChange.mock.calls[0][0]).toEqual({ value: 'Result', range: [2, 7] })
  })

  it('keeps comma separators while typing tags and commits the complete list on blur', () => {
    const onChange = vi.fn()
    const component = () => TagsField({ value: ['town'], onChange })
    let input = elements(render(component)).find(element => element.type === 'input')!
    handler(input, 'onChange')({ target: { value: 'town, ' } })
    input = elements(render(component)).find(element => element.type === 'input')!
    expect(input.props.value).toBe('town, ')
    expect(onChange).not.toHaveBeenCalled()
    handler(input, 'onChange')({ target: { value: 'town, urban' } })
    input = elements(render(component)).find(element => element.type === 'input')!
    handler(input, 'onBlur')()
    expect(onChange).toHaveBeenCalledWith(['town', 'urban'])
  })

  it('keeps shared declaration order when renaming an earlier dependency', () => {
    const onChange = vi.fn()
    const component = () => KeyValueEditor({ value: { zDependency: '2', aDependent: '{{math:$zDependency + 1}}' }, onChange })
    let input = elements(render(component)).filter(element => element.type === 'input')[0]
    handler(input, 'onFocus')()
    input = elements(render(component)).filter(element => element.type === 'input')[0]
    handler(input, 'onChange')({ target: { value: 'zRenamed' } })
    input = elements(render(component)).filter(element => element.type === 'input')[0]
    handler(input, 'onBlur')()
    expect(Object.keys(onChange.mock.calls[0][0])).toEqual(['zRenamed', 'aDependent'])
  })
})

describe('explicit source review renewal', () => {
  const table: AuthoredSimpleTable = { id: 'review', name: 'Review', type: 'simple', entries: [{ value: 'Result', range: [1, 6] }],
    selection: { mode: 'dice', dice: '1d6' }, conversion: { kind: 'transcription', sourceText: '1d6\n1-6 Result' } }

  it('records an authored review only after a person acknowledges checking the source', () => {
    const onChange = vi.fn()
    const component = () => ConversionReviewPanel({ table, onChange })
    let tree = elements(render(component))
    let record = tree.find(element => element.type === 'button' && element.props.children === 'Record source review')!
    expect(record.props.disabled).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
    handler(tree.find(element => element.type === 'input' && element.props.type === 'checkbox')!, 'onChange')({ target: { checked: true } })
    tree = elements(render(component))
    record = tree.find(element => element.type === 'button' && element.props.children === 'Record source review')!
    expect(record.props.disabled).toBe(false)
    handler(record, 'onClick')()
    expect(getConversionReviewStatus(onChange.mock.calls[0][0])).toBe('reviewed')
    expect(onChange.mock.calls[0][0].conversion.sourceText).toBe(table.conversion?.sourceText)
  })

  it('blocks review for incomplete source mechanics even after acknowledgement', () => {
    const onChange = vi.fn()
    const component = () => ConversionReviewPanel({ table: { ...table, entries: [{ value: 'Result' }] }, onChange })
    let tree = elements(render(component))
    handler(tree.find(element => element.type === 'input' && element.props.type === 'checkbox')!, 'onChange')({ target: { checked: true } })
    tree = elements(render(component))
    expect(tree.find(element => element.type === 'button' && element.props.children === 'Record source review')?.props.disabled).toBe(true)
    expect(JSON.stringify(tree.find(element => element.props.role === 'alert')?.props.children)).toContain('literal outcome range')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('changes a reviewed conversion to stale when notes are edited, retaining the excerpt', () => {
    const reviewed = markConversionReviewed(table)
    const onChange = vi.fn()
    const tree = elements(render(() => ConversionReviewPanel({ table: reviewed, onChange })))
    const notes = tree.find(element => element.type === 'textarea' && String(element.props.id).endsWith('-notes'))!
    handler(notes, 'onChange')({ target: { value: 'Adapted from the book.' } })
    expect(getConversionReviewStatus(onChange.mock.calls[0][0])).toBe('stale')
    expect(onChange.mock.calls[0][0].conversion.sourceText).toBe(table.conversion?.sourceText)
  })
})
