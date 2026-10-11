import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RandomTableEngine } from '@/engine/core'
import { TableEditor } from './TableEditor'
import { usePatternEvaluation } from './PatternPreview/usePatternEvaluation'
import type { RandomTableDocument } from '@/engine/types'
import { EntryEditor } from './EntryEditor'
import { KeyValueEditor } from './KeyValueEditor'
import { TemplateEditor } from './TemplateEditor'
import type { AuthoredEntry as Entry } from '@/engine/types'

vi.mock('./PatternPreview/usePatternEvaluation', () => ({
  usePatternEvaluation: vi.fn(() => ({ result: null, reroll: () => {}, isEvaluating: false, traceNodeCount: 0, captureCount: 0 })),
}))

beforeEach(() => vi.mocked(usePatternEvaluation).mockClear())

describe('entry editor authored values', () => {
  it('renders an inherited override whose value is intentionally omitted', () => {
    const inherited = { override: 'base000', weight: 2 }
    // Persisted authored overrides are resolved by the engine when rolled, but
    // retain their omission in the source editor until explicitly changed.
    expect(() => renderToStaticMarkup(
      <EntryEditor entry={{ id: 'base000', weight: inherited.weight }} index={0} onChange={() => {}} onDelete={() => {}} />
    )).not.toThrow()
    expect(inherited).not.toHaveProperty('value')
  })

  it('renders a cleared required value as an editable empty input', () => {
    const html = renderToStaticMarkup(
      <EntryEditor entry={{ value: '' }} index={0} onChange={() => {}} onDelete={() => {}} />
    )
    expect(html).toContain('value=""')
  })
})


describe('entry preview shared scope', () => {
  const document: RandomTableDocument = {
    metadata: { name: 'Preview', namespace: 'my.preview', version: '1.0.0', specVersion: '1.0' },
    shared: { world: 'World' },
    tables: [{ id: 'result', name: 'Result', type: 'simple', shared: { hero: 'Ada' },
      entries: [{ value: '{{$hero}} in {{$world}}', description: 'About {{$hero}} in {{$world}}' }] }],
  }

  it('forwards table shared to the inline value preview without shadowing document shared', () => {
    renderToStaticMarkup(<TableEditor table={document.tables[0]} defaultExpanded collectionId="draft"
      availableTableIds={['result']} sharedVariables={document.shared} onChange={() => {}} onDelete={() => {}} />)
    const options = vi.mocked(usePatternEvaluation).mock.calls.find(call => call[2]?.debounceMs === 200)?.[2]
    expect(options?.sharedVariables).toEqual({ hero: 'Ada' })
    const engine = new RandomTableEngine()
    engine.loadCollection(document, 'draft')
    const value = document.tables[0].type === 'simple' ? document.tables[0].entries[0].value : ''
    expect(engine.evaluateRawPattern(value, 'draft', { shared: options?.sharedVariables }).text)
      .toBe(engine.roll('result', 'draft').text)
    expect(engine.evaluateRawPattern(value, 'draft', { shared: options?.sharedVariables }).text).toBe('Ada in World')
  })

  it('uses table shared for description evaluation and refreshes changed local shared values', () => {
    const entry = document.tables[0].type === 'simple' ? document.tables[0].entries[0] : { value: '' }
    for (const hero of ['Ada', 'Grace']) {
      vi.mocked(usePatternEvaluation).mockClear()
      renderToStaticMarkup(<EntryEditor entry={entry} index={0} defaultExpanded collectionId="draft"
        sharedVariables={{ hero }} autocompleteSharedVariables={{ ...document.shared, hero }}
        onChange={() => {}} onDelete={() => {}} />)
      const options = vi.mocked(usePatternEvaluation).mock.calls.find(call => call[0] === entry.description)?.[2]
      expect(options?.sharedVariables).toEqual({ hero })
      const engine = new RandomTableEngine()
      engine.loadCollection(document, 'draft')
      expect(engine.evaluateRawPattern(entry.description ?? '', 'draft', { shared: options?.sharedVariables }).text)
        .toBe(`About ${hero} in World`)
    }
  })
})


describe('shared definition row preview scope', () => {
  const shared = { hero: 'Ada', sentence: 'Hello {{$hero}}' }

  it('forwards the local scope through the actual shared-row preview component', () => {
    renderToStaticMarkup(<KeyValueEditor value={shared} onChange={() => {}}
      valueSupportsExpressions collectionId="draft" sharedVariables={shared} previewSharedVariables={shared} />)
    const call = vi.mocked(usePatternEvaluation).mock.calls.find(call => call[0] === shared.sentence)
    expect(call?.[2]?.sharedVariables).toEqual(shared)
    const engine = new RandomTableEngine()
    engine.loadCollection({ metadata: { name: 'Scope', namespace: 'test.scope', version: '1.0.0', specVersion: '1.0' },
      tables: [{ id: 'result', name: 'Result', type: 'simple', shared, entries: [{ value: '{{$sentence}}' }] }] }, 'draft')
    expect(engine.evaluateRawPattern(shared.sentence, 'draft', { shared: call?.[2]?.sharedVariables }).text).toBe('Hello Ada')
  })

  it('supplies template shared to its definition rows and does not substitute the autocomplete map', () => {
    renderToStaticMarkup(<TemplateEditor template={{ id: 'greeting', name: 'Greeting', pattern: '{{$sentence}}', shared }}
      collectionId="draft" defaultExpanded localTables={[]} localTemplates={[]} documentShared={{ world: 'World' }}
      onChange={() => {}} onDelete={() => {}} />)
    const options = vi.mocked(usePatternEvaluation).mock.calls.find(call => call[0] === shared.sentence)?.[2]
    expect(options?.sharedVariables).toEqual(shared)
  })
})

it('renders inherited null deletion markers and omitted values without changing authored content', () => {
  const entry: Entry = { id: 'base', description: null, resultType: null, weight: null,
    range: null, tags: null, sets: { removed: null, kept: 'Value' }, assets: null }
  const before = JSON.stringify(entry)
  const onChange = vi.fn()
  expect(() => renderToStaticMarkup(<EntryEditor entry={entry} index={0} defaultExpanded
    onChange={onChange} onDelete={() => {}} />)).not.toThrow()
  expect(JSON.stringify(entry)).toBe(before)
  expect(onChange).not.toHaveBeenCalled()
})
