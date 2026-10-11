import React, { type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TableImportModal } from './TableImportModal'
import { getConversionReviewStatus } from '@/lib/conversionVerification'
import type { SimpleTable } from '@/engine/types'

// Actual component handlers, including the nested preview component; DOM focus
// is intentionally outside this dependency-free harness's coverage.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++
    if (!(index in hooks.slots)) hooks.slots[index] = initial
    return [hooks.slots[index], (next: unknown) => {
      hooks.slots[index] = typeof next === 'function' ? next(hooks.slots[index]) : next
    }]
  },
  useRef: (initial: unknown) => {
    const index = hooks.cursor++
    if (!(index in hooks.slots)) hooks.slots[index] = { current: initial }
    return hooks.slots[index]
  },
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
}))
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!React.isValidElement<Record<string, unknown>>(node)) return []
  const nested = typeof node.type === 'function' && ['InputStep', 'PreviewStep'].includes(node.type.name)
    ? (node.type as (props: Record<string, unknown>) => ReactNode)(node.props) : node.props.children as ReactNode
  return [node, ...elements(nested)]
}
function content(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(content).join('')
  if (React.isValidElement<{ children?: ReactNode }>(node)) return content(node.props.children)
  return node === null || node === undefined || typeof node === 'boolean' ? '' : String(node)
}
function invoke(element: ReactElement<Record<string, unknown>>, handler: string, value?: unknown) {
  (element.props[handler] as (event?: unknown) => void)(value)
}
const raw = '2d6 Reaction\n2 Hostile\n3-5 Wary\n6-8 Neutral\n9-11 Friendly\n12 Helpful'
function workflow(source = raw, existingTableIds: string[] = []) {
  const onImport = vi.fn()
  const onClose = vi.fn()
  const render = () => { hooks.cursor = 0; return elements(TableImportModal({ isOpen: true, onClose, onImport, existingTableIds })) }
  let tree = render()
  invoke(tree.find(element => element.props.id === 'raw-text')!, 'onChange', { target: { value: source } })
  tree = render()
  invoke(tree.find(element => element.type === 'button' && content(element.props.children as ReactNode) === 'Parse Text')!, 'onClick')
  const importButton = (nodes: typeof tree) => nodes.find(element => element.type === 'button' && content(element.props.children as ReactNode).includes('Import '))!
  return { render, onImport, onClose, importButton }
}
beforeEach(() => { hooks.slots = []; hooks.cursor = 0 })

describe('import source review workflow', () => {
  it('defaults to persisted unreviewed provenance with raw text and actual probabilities', () => {
    const flow = workflow()
    let tree = flow.render()
    expect(content(tree.find(element => element.type === 'pre')!.props.children as ReactNode)).toBe(raw)
    expect(tree.some(element => content(element.props.children as ReactNode).includes('44.44%'))).toBe(true)
    invoke(tree.find(element => element.props.id === 'import-book')!, 'onChange', { target: { value: 'Synthetic Book' } })
    tree = flow.render()
    invoke(tree.find(element => element.props.id === 'import-page')!, 'onChange', { target: { value: '42' } })
    tree = flow.render()
    invoke(tree.find(element => element.props.id === 'import-kind')!, 'onChange', { target: { value: 'adaptation' } })
    tree = flow.render()
    invoke(tree.find(element => element.props.id === 'import-notes')!, 'onChange', { target: { value: 'Deliberately changed wording.' } })
    tree = flow.render()
    expect(content(flow.importButton(tree).props.children as ReactNode)).toContain('Unreviewed')
    invoke(flow.importButton(tree), 'onClick')
    const table = flow.onImport.mock.calls[0][0] as SimpleTable
    expect(table.source).toEqual({ book: 'Synthetic Book', page: '42' })
    expect(table.conversion).toMatchObject({ sourceText: raw, kind: 'adaptation', notes: 'Deliberately changed wording.' })
    expect(getConversionReviewStatus(table)).toBe('unreviewed')
    expect(flow.onClose).toHaveBeenCalledOnce()
  })

  it('requires explicit acknowledgement for reviewed import and clears it after edits', () => {
    const flow = workflow()
    let tree = flow.render()
    invoke(tree.find(element => element.props.type === 'checkbox')!, 'onChange', { target: { checked: true } })
    tree = flow.render()
    expect(content(flow.importButton(tree).props.children as ReactNode)).toContain('Reviewed')
    invoke(tree.find(element => element.props.id === 'table-name')!, 'onChange', { target: { value: 'Changed name' } })
    tree = flow.render()
    expect(tree.find(element => element.props.type === 'checkbox')!.props.checked).toBe(false)
    expect(content(flow.importButton(tree).props.children as ReactNode)).toContain('Unreviewed')
    invoke(tree.find(element => element.props.type === 'checkbox')!, 'onChange', { target: { checked: true } })
    tree = flow.render()
    invoke(flow.importButton(tree), 'onClick')
    expect(getConversionReviewStatus(flow.onImport.mock.calls[0][0])).toBe('reviewed')
  })

  it('blocks incomplete coverage and becomes importable after correction', () => {
    const flow = workflow('d6 Incomplete\n1-3 First\n4-5 Second')
    let tree = flow.render()
    expect(flow.importButton(tree).props.disabled).toBe(true)
    expect(tree.find(element => element.props.type === 'checkbox')!.props.disabled).toBe(true)
    invoke(flow.importButton(tree), 'onClick')
    expect(flow.onImport).not.toHaveBeenCalled()
    invoke(tree.find(element => element.props['aria-label'] === 'Entry 2 range end')!, 'onChange', { target: { value: '6' } })
    tree = flow.render()
    expect(flow.importButton(tree).props.disabled).toBe(false)
    invoke(flow.importButton(tree), 'onClick')
    expect(flow.onImport.mock.calls[0][0].entries[1].range).toEqual([4, 6])
  })

  it('announces parse failures and preserves input when returning to edit', () => {
    const bad = '2d6! Unsupported\n2 Low\n12 High'
    const flow = workflow(bad)
    let tree = flow.render()
    expect(tree.find(element => element.props.role === 'alert')!.props.tabIndex).toBe(-1)
    expect(flow.importButton(tree).props.disabled).toBe(true)
    invoke(tree.find(element => element.type === 'button' && content(element.props.children as ReactNode).includes('Back'))!, 'onClick')
    tree = flow.render()
    expect(tree.find(element => element.props.id === 'raw-text')!.props.value).toBe(bad)
  })
})

it('chooses the final unused ID before source acknowledgement so reviewed import stays reviewed', () => {
  const flow = workflow(raw, ['reaction'])
  let tree = flow.render()
  expect(tree.find(element => element.props.id === 'table-id')!.props.value).toBe('reaction1')
  invoke(tree.find(element => element.props.type === 'checkbox')!, 'onChange', { target: { checked: true } })
  tree = flow.render()
  invoke(flow.importButton(tree), 'onClick')
  const table = flow.onImport.mock.calls[0][0] as SimpleTable
  expect(table.id).toBe('reaction1')
  expect(getConversionReviewStatus(table)).toBe('reviewed')
})

it('blocks manually choosing an existing ID and clears prior acknowledgement', () => {
  const flow = workflow(raw, ['reaction'])
  let tree = flow.render()
  invoke(tree.find(element => element.props.type === 'checkbox')!, 'onChange', { target: { checked: true } })
  tree = flow.render()
  invoke(tree.find(element => element.props.id === 'table-id')!, 'onChange', { target: { value: 'reaction' } })
  tree = flow.render()
  expect(flow.importButton(tree).props.disabled).toBe(true)
  expect(tree.find(element => element.props.id === 'table-id')!.props['aria-invalid']).toBe(true)
  expect(tree.find(element => element.props.type === 'checkbox')!.props.checked).toBe(false)
  expect(tree.find(element => element.props.type === 'checkbox')!.props.disabled).toBe(true)
  invoke(flow.importButton(tree), 'onClick')
  expect(flow.onImport).not.toHaveBeenCalled()
})

it('clearing optional source page and book keeps the resulting reviewed import valid', () => {
  const flow = workflow()
  let tree = flow.render()
  invoke(tree.find(element => element.props.id === 'import-page')!, 'onChange', { target: { value: '12-14' } })
  tree = flow.render()
  invoke(tree.find(element => element.props.id === 'import-book')!, 'onChange', { target: { value: 'Synthetic Book' } })
  tree = flow.render()
  invoke(tree.find(element => element.props.id === 'import-page')!, 'onChange', { target: { value: '   ' } })
  tree = flow.render()
  invoke(tree.find(element => element.props.id === 'import-book')!, 'onChange', { target: { value: '' } })
  tree = flow.render()
  expect(flow.importButton(tree).props.disabled).toBe(false)
  expect(tree.find(element => element.props.id === 'import-page')!.props['aria-invalid']).toBe(false)
  invoke(tree.find(element => element.props.type === 'checkbox')!, 'onChange', { target: { checked: true } })
  tree = flow.render()
  invoke(flow.importButton(tree), 'onClick')
  const table = flow.onImport.mock.calls[0][0] as SimpleTable
  expect(table.source?.page).toBeUndefined()
  expect(table.source?.book).toBeUndefined()
  expect(JSON.parse(JSON.stringify(table)).source).toEqual({})
  expect(getConversionReviewStatus(table)).toBe('reviewed')
})

it('blocks malformed page input before review or import, then accepts a corrected page range', () => {
  const flow = workflow()
  let tree = flow.render()
  invoke(tree.find(element => element.props.id === 'import-page')!, 'onChange', { target: { value: 'pages twelve to fourteen' } })
  tree = flow.render()
  expect(tree.find(element => element.props.id === 'import-page')!.props['aria-invalid']).toBe(true)
  expect(tree.find(element => element.props.id === 'import-page-error')).toBeDefined()
  expect(flow.importButton(tree).props.disabled).toBe(true)
  expect(tree.find(element => element.props.type === 'checkbox')!.props.disabled).toBe(true)
  invoke(flow.importButton(tree), 'onClick')
  expect(flow.onImport).not.toHaveBeenCalled()
  invoke(tree.find(element => element.props.id === 'import-page')!, 'onChange', { target: { value: '12-14' } })
  tree = flow.render()
  expect(flow.importButton(tree).props.disabled).toBe(false)
  expect(tree.find(element => element.props.id === 'import-page')!.props['aria-invalid']).toBe(false)
  invoke(tree.find(element => element.props.type === 'checkbox')!, 'onChange', { target: { checked: true } })
  tree = flow.render()
  invoke(flow.importButton(tree), 'onClick')
  const table = flow.onImport.mock.calls[0][0] as SimpleTable
  expect(table.source?.page).toBe('12-14')
  expect(getConversionReviewStatus(table)).toBe('reviewed')
})
