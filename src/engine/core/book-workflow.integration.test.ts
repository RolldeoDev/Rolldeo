import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RandomTableEngine } from './index'
import { validateDocument } from './validator'
import { parseTableText } from '../../lib/tableParser'
import { getConversionReviewStatus, markConversionReviewed } from '../../lib/conversionVerification'
import { createCollectionArchive } from '../../services/export'
import { importFiles } from '../../services/import'
import type { RandomTableDocument } from '../types'

const source = '2d6 Reaction\n2-5 Hostile\n6-8 Uncertain\n9-12 Friendly'

function collection(): RandomTableDocument {
  const parsed = parseTableText(source)
  expect(parsed.success).toBe(true)
  expect(parsed.warnings).toEqual([])
  const table = markConversionReviewed(parsed.table!, new Date('2026-10-11T12:00:00Z'))
  return {
    metadata: { name: 'Book workflow fixture', namespace: 'test.book_workflow', version: '1.0.0', specVersion: '1.1' },
    inputs: {
      terrain: { type: 'choice', options: ['forest', 'road'], default: 'forest' },
      partyLevel: { type: 'integer', min: 1, max: 20, default: 3 },
    },
    tables: [table],
    templates: [{ id: 'meeting', name: 'Meeting', pattern: `{{$terrain}}: {{${table.id}}} (level {{$partyLevel}})` }],
  }
}

describe('Book conversion workflow integration', () => {
  it('preserves source, review status, input declarations and dice odds through ZIP export/import', async () => {
    const document = collection()
    const archive = createCollectionArchive([{ id: 'book', document }])
    const bytes = await archive.generateAsync({ type: 'uint8array' })
    const file = { name: 'book.zip', type: 'application/zip', arrayBuffer: async () => bytes.buffer } as File
    const imported = await importFiles([file])
    expect(imported.errors).toEqual([])
    expect(imported.collections).toHaveLength(1)
    const restored = imported.collections[0]
    expect(restored.document.inputs).toEqual(document.inputs)
    expect(restored.document.tables[0].conversion?.sourceText).toBe(source)
    expect(getConversionReviewStatus(restored.document.tables[0])).toBe('reviewed')
    const engine = new RandomTableEngine()
    engine.loadCollection(restored.document, restored.id)
    const histogram: Record<string, number> = {}
    for (let first = 1; first <= 6; first++) for (let second = 1; second <= 6; second++) {
      const draws = [(first - 0.5) / 6, (second - 0.5) / 6]
      const result = engine.rollTemplate('meeting', restored.id, {
        inputs: { terrain: 'road', partyLevel: 7 },
        random: () => {
          expect(draws.length).toBeGreaterThan(0)
          return draws.shift()!
        },
      })
      expect(draws).toHaveLength(0)
      expect(result.metadata.inputs).toEqual({ terrain: 'road', partyLevel: 7 })
      expect(result.text).toMatch(/^road: (Hostile|Uncertain|Friendly) \(level 7\)$/)
      histogram[result.text] = (histogram[result.text] || 0) + 1
    }
    expect(histogram).toEqual({ 'road: Hostile (level 7)': 10, 'road: Uncertain (level 7)': 16, 'road: Friendly (level 7)': 10 })
    expect(() => engine.rollTemplate('meeting', restored.id, { inputs: { partyLevel: 21 } })).toThrow(/INPUT_ERROR/)
    const defaulted = engine.rollTemplate('meeting', restored.id, { random: () => 0 })
    expect(defaulted.text).toBe('forest: Hostile (level 3)')
  })

  it('runs complete specification 1.1 examples under their declared version', () => {
    const spec = readFileSync(new URL('../../../docs/randomTableSpecV1_1.md', import.meta.url), 'utf8')
    const examples = [...spec.matchAll(/```json\n([\s\S]*?)\n```/g)]
    expect(examples.length).toBeGreaterThan(0)
    for (const [, example] of examples) {
      const document = JSON.parse(example) as RandomTableDocument
      expect(validateDocument(document).errors).toEqual([])
      const engine = new RandomTableEngine()
      engine.loadCollection(document, 'docs11')
      for (const template of document.templates ?? []) {
        expect(engine.rollTemplate(template.id, 'docs11', { random: () => 0 }).text.trim()).not.toBe('')
      }
    }
  })

  it('calculates the documented positive ability modifier for every score 1–30', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection({ metadata: { name: 'Arithmetic', namespace: 'test.ability', version: '1.0.0', specVersion: '1.1' },
      inputs: { abilityScore: { type: 'integer', min: 1, max: 30, required: true } }, tables: [],
      templates: [{ id: 'modifier', name: 'Modifier', pattern: '{{math:$abilityScore / 2 - 5}}' }],
    }, 'ability')
    for (let abilityScore = 1; abilityScore <= 30; abilityScore++) {
      expect(engine.rollTemplate('modifier', 'ability', { inputs: { abilityScore } }).text).toBe(String(Math.floor((abilityScore - 10) / 2)))
    }
  })

  it('uses the documented explicit boolean comparison under text-expression semantics', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection({ metadata: { name: 'Boolean context', namespace: 'test.boolean', version: '1.0.0', specVersion: '1.1' },
      inputs: { night: { type: 'boolean', required: true } }, tables: [],
      templates: [{ id: 'time', name: 'Time', pattern: '{{switch[$night=="true":"night"].else["day"]}}' }],
    }, 'boolean')
    expect(engine.rollTemplate('time', 'boolean', { inputs: { night: true } }).text).toBe('night')
    expect(engine.rollTemplate('time', 'boolean', { inputs: { night: false } }).text).toBe('day')
  })
})
