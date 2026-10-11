import React, { type ReactElement, type ReactNode } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { Table2 } from 'lucide-react'
import { KeyValueEditor } from './KeyValueEditor'
import { TableEditor } from './TableEditor'
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
