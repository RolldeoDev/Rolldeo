import { describe, expect, it, vi } from 'vitest'
import { RandomTableEngine } from './index'
import { InputError, resolveInputs } from './inputs'
import type { AuthoredRandomTableDocument, Inputs, InputValue } from '../types'

function document(inputs?: Inputs, value = '{{$terrain}} / {{$level}} / {{$night}}'): AuthoredRandomTableDocument {
  return {
    metadata: { name: 'Inputs', namespace: 'test.inputs', version: '1.0.0', specVersion: '1.1' },
    inputs,
    tables: [{ id: 'scene', name: 'Scene', type: 'simple', entries: [{ value }] }],
    templates: [{ id: 'summary', name: 'Summary', pattern: '{{scene}}' }],
  }
}

const declarations: Inputs = {
  terrain: { type: 'choice', options: ['forest', 'desert'], default: 'forest' },
  level: { type: 'integer', min: 1, max: 20, required: true },
  night: { type: 'boolean', default: false },
}

describe('explicit generator inputs', () => {
  it('resolves defaults and validates exact types, limits, unknown keys and missing required values', () => {
    expect(resolveInputs(declarations, { level: 3 })).toEqual({ terrain: 'forest', level: 3, night: false })
    for (const supplied of [{ level: '3' }, { level: 3.5 }, { level: 0 }, { level: 21 }, { level: 3, terrain: 'sea' }, { level: 3, extra: true }, { level: 3, night: 'false' }, {}]) {
      expect(() => resolveInputs(declarations, supplied as Record<string, InputValue>)).toThrow(InputError)
    }
    expect(resolveInputs({ optional: { type: 'integer' }, required: { type: 'boolean', required: true, default: false } })).toEqual({ optional: '', required: false })
  })

  it('applies inputs to tables, templates, shared expressions, math and previews, without leakage between generations', () => {
    const engine = new RandomTableEngine()
    const doc = document(declarations, '{{$terrain}} / {{math:$level+1}} / {{$night}} / {{$context}}')
    doc.shared = { context: 'Level {{$level}}' }
    engine.loadCollection(doc, 'root')
    expect(engine.roll('scene', 'root', { inputs: { level: 3 } }).text).toBe('forest / 4 / false / Level 3')
    expect(engine.rollTemplate('summary', 'root', { inputs: { level: 7, terrain: 'desert' } }).metadata.inputs).toEqual({ terrain: 'desert', level: 7, night: false })
    const preview = engine.evaluateRawPattern('{{$level}}', 'root', { inputs: { level: 2 }, enableTrace: true })
    expect(preview.text).toBe('2')
    expect(preview.trace?.stats.variablesAccessed).toContain('level')
    expect(() => engine.roll('scene', 'root')).toThrow('level')
    expect(engine.roll('scene', 'root', { inputs: { level: 1 } }).text).toContain('forest / 2')
  })

  it('treats macro-looking text as literal even when copied through shared values and sets', () => {
    const engine = new RandomTableEngine()
    const doc = document({ text: { type: 'text', required: true } }, '{{$text}} / {{$saved}} / {{@scene.note}}')
    doc.shared = { saved: '{{$text}}' }
    doc.tables[0] = { id: 'scene', name: 'Scene', type: 'simple', entries: [{ value: '{{$text}} / {{$saved}} / {{@scene.note}}', sets: { note: '{{$text}}' } }] }
    engine.loadCollection(doc, 'root')
    const literal = '{{dice:1d6}} {{$saved}} {{missing}}'
    const random = vi.fn(() => 0)
    expect(engine.roll('scene', 'root', { inputs: { text: literal }, random }).text).toBe(`${literal} / ${literal} / ${literal}`)
    expect(random).toHaveBeenCalledTimes(1)
  })

  it('reserves optional absent inputs as empty values', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document({ terrain: { type: 'text' } }, 'before{{$terrain}}after'), 'root')
    expect(engine.roll('scene', 'root').text).toBe('beforeafter')
    expect(engine.roll('scene', 'root').metadata.inputs).toEqual({ terrain: '' })
  })

  it('isolates root supplied values from imported defaults in tables, templates and qualified variables', () => {
    const engine = new RandomTableEngine()
    const child = document({ terrain: { type: 'text', default: 'child' } }, '{{$terrain}}')
    child.metadata.namespace = 'test.child'
    const root = document({ terrain: { type: 'text', required: true } }, '{{$terrain}}|{{other.scene}}|{{other.summary}}|{{$other.terrain}}|{{$terrain}}')
    root.imports = [{ alias: 'other', path: 'child.json' }]
    engine.loadCollection(child, 'child')
    engine.loadCollection(root, 'root')
    engine.resolveImports(new Map([['child.json', 'child']]))
    expect(engine.roll('scene', 'root', { inputs: { terrain: 'root' } }).text).toBe('root|child|child|child|root')
    expect(engine.roll('scene', 'root', { inputs: { terrain: 'root' } }).metadata.inputs).toEqual({ terrain: 'root' })
  })

  it('fails missing required imported values upon invocation, including imported templates', () => {
    const engine = new RandomTableEngine()
    const child = document({ terrain: { type: 'text', required: true } }, '{{$terrain}}')
    child.metadata.namespace = 'test.child'
    const root = document({ terrain: { type: 'text', default: 'root' } }, '{{$terrain}}')
    root.imports = [{ alias: 'other', path: 'child.json' }]
    root.tables.push({ id: 'borrowed', name: 'Borrowed', type: 'collection', collections: ['other.scene'] })
    engine.loadCollection(child, 'child')
    engine.loadCollection(root, 'root')
    engine.resolveImports(new Map([['child.json', 'child']]))
    expect(engine.roll('scene', 'root').text).toBe('root')
    expect(() => engine.evaluateRawPattern('{{other.scene}}', 'root')).toThrow('terrain')
    expect(() => engine.evaluateRawPattern('{{other.summary}}', 'root')).toThrow('terrain')
    expect(() => engine.roll('borrowed', 'root')).toThrow('terrain')
  })
})
