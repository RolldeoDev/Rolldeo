import { describe, expect, it } from 'vitest'
import { RandomTableEngine } from '@/engine/core'
import type { RandomTableDocument } from '@/engine/types'

const makeDocument = (namespace: string, value: string): RandomTableDocument => ({
  metadata: { name: namespace, namespace, version: '1.0.0', specVersion: '1.0' },
  tables: [{ id: 'result', name: 'Result', type: 'simple', entries: [{ value }] }],
})

describe('isolated draft previews', () => {
  it('uses each full draft revision and imported filename bindings without changing saved state', () => {
    const saved = makeDocument('my.draft', 'Saved')
    saved.imports = [{ alias: 'ext', path: 'dependency.json' }]
    const engine = new RandomTableEngine()
    engine.loadCollection(saved, 'draft')
    engine.loadCollection(makeDocument('my.dependency', 'Dependency'), 'dependency')
    engine.resolveImports(new Map([['dependency.json', 'dependency']]))
    const draft = structuredClone(saved)
    draft.tables[0] = { id: 'result', name: 'Result', type: 'simple', entries: [{ value: 'Draft' }] }
    draft.variables = { greeting: 'New variable' }
    const preview = engine.cloneForPreview(draft, 'draft')
    expect(preview.evaluateRawPattern('{{result}} / {{ext.result}} / {{$greeting}}', 'draft').text)
      .toBe('Draft / Dependency / New variable')
    expect(engine.evaluateRawPattern('{{result}} / {{ext.result}}', 'draft').text).toBe('Saved / Dependency')
    draft.tables[0] = { id: 'result', name: 'Result', type: 'simple', entries: [{ value: 'Later revision' }] }
    const later = engine.cloneForPreview(draft, 'draft')
    expect(later.evaluateRawPattern('{{result}}', 'draft').text).toBe('Later revision')
    // Leaving the editor simply releases the preview, so reopen/roll sees the saved data.
    expect(engine.getCollection('draft')?.document).toEqual(saved)
  })

  it('previews a new unsaved collection before it has a persisted ID', () => {
    const engine = new RandomTableEngine()
    const preview = engine.cloneForPreview(makeDocument('new.draft', 'Unsaved'), '__editor_preview__')
    expect(preview.evaluateRawPattern('{{result}}', '__editor_preview__').text).toBe('Unsaved')
    expect(engine.listCollections()).toEqual([])
  })
})
