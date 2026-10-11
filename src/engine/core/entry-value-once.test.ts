import { describe, expect, it, vi } from 'vitest'
import { RandomTableEngine } from './index'
import type { RandomTableDocument } from '../types'

const doc: RandomTableDocument = {
  metadata: { name: 'One value', namespace: 'test.once', specVersion: '1.0', version: '1.0.0' },
  tables: [
    { id: 'reaction', name: 'Reaction', type: 'simple', entries: [{ value: 'Hostile' }, { value: 'Friendly' }] },
    { id: 'outer', name: 'Outer', type: 'simple', entries: [{ value: 'Reaction {{reaction}}' }] },
    { id: 'pooled', name: 'Pooled', type: 'collection', collections: ['outer'] },
    { id: 'nested', name: 'Nested', type: 'simple', entries: [{ value: '{{reaction}}' }] },
  ],
  templates: [{ id: 'summary', name: 'Summary', pattern: '{{outer >> $scene}}|{{$scene}}|{{@outer.value}}' }],
}

describe('entry output is evaluated once', () => {
  it.each(['outer', 'pooled'])('keeps %s rendered output and automatic value consistent with two draws', tableId => {
    const engine = new RandomTableEngine()
    engine.loadCollection(doc, 'root')
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(0.99)
    const result = engine.roll(tableId, 'root', { random })
    expect(result.text).toBe('Reaction Hostile')
    expect(result.placeholders?.value).toBe(result.text)
    expect(random).toHaveBeenCalledTimes(2)
  })

  it('preserves surrounding whitespace while evaluating a single nested reference once', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection({ ...doc, tables: [...doc.tables, { id: 'spaced', name: 'Spaced', type: 'simple', entries: [{ value: '  {{reaction}}  ' }] }] }, 'root')
    const random = vi.fn(() => 0)
    const result = engine.roll('spaced', 'root', { random })
    expect(result.text).toBe('  Hostile  ')
    expect(result.placeholders?.value).toMatchObject({ value: '  Hostile  ' })
    expect(random).toHaveBeenCalledTimes(2)
  })

  it('retains nested captures when entry.value is a single table reference', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(doc, 'root')
    const random = vi.fn(() => 0)
    const result = engine.evaluateRawPattern('{{nested >> $scene}}|{{$scene.@value.value}}|{{@nested.value}}', 'root', { random })
    expect(result.text).toBe('Hostile|Hostile|Hostile')
    expect(random).toHaveBeenCalledTimes(2)
  })

  it('renders captured text and placeholder values identically', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(doc, 'root')
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(0.99)
    const result = engine.rollTemplate('summary', 'root', { random })
    expect(result.text).toBe('Reaction Hostile|Reaction Hostile|Reaction Hostile')
    expect(random).toHaveBeenCalledTimes(2)
  })
})
