import { describe, expect, it } from 'vitest'
import { createSessionItemKeys, nextAvailableId, parseDraftSnapshot, savedDraftState } from './draftState'
import type { RandomTableDocument } from '@/engine/types'

const document: RandomTableDocument = {
  metadata: { name: 'Draft', namespace: 'my.draft', version: '1.0.0', specVersion: '1.0' },
  tables: [{ id: 'result', name: 'Result', type: 'simple', entries: [{ value: 'Original' }] }],
}

describe('authoring boundaries', () => {
  it('rejects the actual raw snapshot even if the last visual draft was valid', () => {
    expect(parseDraftSnapshot(JSON.stringify(document))).toEqual(document)
    for (const raw of ['{}', 'null', '{', JSON.stringify({ ...document, imports: [{ path: '', alias: 'broken' }] })]) {
      expect(() => parseDraftSnapshot(raw)).toThrow()
    }
    // The caller can continue editing the raw buffer and recover normally.
    const repaired = JSON.stringify({ ...document, variables: { fixed: 'yes' } })
    expect(parseDraftSnapshot(repaired).variables).toEqual({ fixed: 'yes' })
  })

  it('rebases delayed save completion without dropping a newer raw or visual edit', async () => {
    const savedJson = JSON.stringify(document)
    let release!: () => void
    const persistence = new Promise<void>(resolve => { release = resolve })
    let current = savedJson
    const completion = persistence.then(() => savedDraftState(current, savedJson))
    const edited = structuredClone(document)
    edited.tables[0] = { id: 'result', name: 'Result', type: 'simple', entries: [{ value: 'Newer edit' }] }
    current = JSON.stringify(edited)
    release()
    const state = await completion
    expect(JSON.parse(state.jsonContent).tables[0].entries[0].value).toBe('Newer edit')
    expect(state.originalJson).toBe(savedJson)
    expect(state.isDirty).toBe(true)
    expect(savedDraftState('{', savedJson).jsonContent).toBe('{')
    expect(savedDraftState(savedJson, savedJson).isDirty).toBe(false)
  })

  it('allocates IDs across deleted holes and table/template namespaces', () => {
    expect(nextAvailableId('table', ['table1', 'table3', 'template1'])).toBe('table2')
    expect(nextAvailableId('table', ['table1', 'table2', 'table3'])).toBe('table4')
    expect(nextAvailableId('template', ['template1', 'template3', 'table2'])).toBe('template2')
    expect(nextAvailableId('import', ['import1', 'import3'])).toBe('import2')
  })
  it('keeps drag/editor identity with each entry through edit, reorder and clone', () => {
    const keys = createSessionItemKeys<{ id?: string; value: string }>()
    const first = { id: 'duplicate', value: 'First' }
    const second = { id: 'duplicate', value: 'Second' }
    const firstKey = keys.get(first)
    const secondKey = keys.get(second)
    expect(firstKey).not.toBe(secondKey)
    const edited = { ...first, value: 'Edited' }
    keys.replace(first, edited)
    expect([second, edited].map(keys.get)).toEqual([secondKey, firstKey])
    expect(keys.get({ ...edited })).not.toBe(firstKey)
    expect(edited).toEqual({ id: 'duplicate', value: 'Edited' })
  })

})
