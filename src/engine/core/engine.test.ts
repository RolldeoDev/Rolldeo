import { describe, it, expect, beforeEach } from 'vitest'
import { RandomTableEngine } from './index'
import type { RandomTableDocument } from '../types'

// Sample test document
const sampleDocument: RandomTableDocument = {
  metadata: {
    name: 'Test Tables',
    namespace: 'test.tables',
    version: '1.0.0',
    specVersion: '1.2',
  },
  tables: [
    {
      id: 'colors',
      name: 'Colors',
      type: 'simple',
      entries: [
        { id: 'red', value: 'Red', weight: 1 },
        { id: 'blue', value: 'Blue', weight: 1 },
        { id: 'green', value: 'Green', weight: 1 },
      ],
    },
    {
      id: 'sizes',
      name: 'Sizes',
      type: 'simple',
      entries: [
        { id: 'small', value: 'small', weight: 1 },
        { id: 'medium', value: 'medium', weight: 2 },
        { id: 'large', value: 'large', weight: 1 },
      ],
    },
    {
      id: 'weighted',
      name: 'Weighted Table',
      type: 'simple',
      entries: [
        { value: 'Common', weight: 10 },
        { value: 'Uncommon', weight: 5 },
        { value: 'Rare', weight: 1 },
      ],
    },
    {
      id: 'withDice',
      name: 'With Dice',
      type: 'simple',
      entries: [
        { value: 'You find {{dice:2d6}} gold pieces' },
      ],
    },
    {
      id: 'withTableRef',
      name: 'With Table Reference',
      type: 'simple',
      entries: [
        { value: 'A {{sizes}} {{colors}} gem' },
      ],
    },
    {
      id: 'allItems',
      name: 'All Items',
      type: 'collection',
      collections: ['colors', 'sizes'],
    },
    {
      id: 'compositeTest',
      name: 'Composite Test',
      type: 'composite',
      sources: [
        { tableId: 'colors', weight: 1 },
        { tableId: 'sizes', weight: 1 },
      ],
    },
  ],
  templates: [
    {
      id: 'description',
      name: 'Item Description',
      pattern: 'A {{sizes}} {{colors}} item',
    },
  ],
  variables: {
    setting: 'fantasy',
  },
}

describe('RandomTableEngine', () => {
  let engine: RandomTableEngine

  beforeEach(() => {
    engine = new RandomTableEngine()
    engine.loadCollection(sampleDocument, 'test')
  })

  describe('loading', () => {
    it('should load a collection', () => {
      expect(engine.hasCollection('test')).toBe(true)
    })

    it('should list collections', () => {
      const collections = engine.listCollections()
      expect(collections).toHaveLength(1)
      expect(collections[0].id).toBe('test')
      expect(collections[0].name).toBe('Test Tables')
    })

    it('should unload a collection', () => {
      engine.unloadCollection('test')
      expect(engine.hasCollection('test')).toBe(false)
    })

    it('should load from JSON string', () => {
      const json = JSON.stringify(sampleDocument)
      const result = engine.loadFromJson(json, 'test2')
      expect(result.valid).toBe(true)
      expect(engine.hasCollection('test2')).toBe(true)
    })
  })

  describe('table access', () => {
    it('should get a table by ID', () => {
      const table = engine.getTable('colors', 'test')
      expect(table).toBeDefined()
      expect(table?.name).toBe('Colors')
    })

    it('should return undefined for non-existent table', () => {
      const table = engine.getTable('nonexistent', 'test')
      expect(table).toBeUndefined()
    })

    it('should list tables', () => {
      const tables = engine.listTables('test')
      expect(tables.length).toBeGreaterThan(0)
      expect(tables.find((t) => t.id === 'colors')).toBeDefined()
    })

    it('should get a template', () => {
      const template = engine.getTemplate('description', 'test')
      expect(template).toBeDefined()
      expect(template?.name).toBe('Item Description')
    })

    it('should list templates', () => {
      const templates = engine.listTemplates('test')
      expect(templates).toHaveLength(1)
      expect(templates[0].id).toBe('description')
    })
  })

  describe('rolling', () => {
    it('should roll on a simple table', () => {
      const result = engine.roll('colors', 'test')
      expect(result.text).toMatch(/Red|Blue|Green/)
      expect(result.metadata.sourceId).toBe('colors')
      expect(result.metadata.collectionId).toBe('test')
    })

    it('should return consistent structure', () => {
      const result = engine.roll('colors', 'test')
      expect(result).toHaveProperty('text')
      expect(result).toHaveProperty('metadata')
      expect(result.metadata).toHaveProperty('timestamp')
    })

    it('should handle dice in entry values', () => {
      const result = engine.roll('withDice', 'test')
      expect(result.text).toMatch(/You find \d+ gold pieces/)
    })

    it('should handle table references in entry values', () => {
      const result = engine.roll('withTableRef', 'test')
      // Should have size and color
      expect(result.text).toMatch(/(small|medium|large) (Red|Blue|Green) gem/)
    })

    it('should roll on a composite table', () => {
      const result = engine.roll('compositeTest', 'test')
      // Should be either a color or a size
      expect(result.text).toMatch(/Red|Blue|Green|small|medium|large/)
    })

    it('should roll on a collection table', () => {
      const result = engine.roll('allItems', 'test')
      // Should be either a color or a size
      expect(result.text).toMatch(/Red|Blue|Green|small|medium|large/)
    })

    it('should roll on a template', () => {
      const result = engine.rollTemplate('description', 'test')
      expect(result.text).toMatch(/A (small|medium|large) (Red|Blue|Green) item/)
    })

    it('should throw for non-existent collection', () => {
      expect(() => engine.roll('colors', 'nonexistent')).toThrow()
    })

    it('should throw for non-existent table', () => {
      expect(() => engine.roll('nonexistent', 'test')).toThrow()
    })
  })

  describe('weighted selection', () => {
    it('should respect weights over many rolls', () => {
      const counts: Record<string, number> = { Common: 0, Uncommon: 0, Rare: 0 }
      const iterations = 1000

      for (let i = 0; i < iterations; i++) {
        const result = engine.roll('weighted', 'test')
        counts[result.text]++
      }

      // Common should appear most often (~62.5%)
      expect(counts['Common']).toBeGreaterThan(counts['Uncommon'])
      expect(counts['Uncommon']).toBeGreaterThan(counts['Rare'])
    })
  })

  describe('validation', () => {
    it('should validate a valid document', () => {
      const result = engine.validate(sampleDocument)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should catch missing metadata', () => {
      const invalid = {
        metadata: {
          name: '',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2' as const,
        },
        tables: [],
      }
      const result = engine.validate(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'MISSING_NAME')).toBe(true)
    })

    it('should catch invalid spec version', () => {
      const invalid = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '2.0' as any,
        },
        tables: [],
      }
      const result = engine.validate(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_SPEC_VERSION')).toBe(true)
    })
  })
})

describe('RandomTableEngine edge cases', () => {
  it('should handle empty entry value', () => {
    const engine = new RandomTableEngine()
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Test',
        namespace: 'test',
        version: '1.0.0',
        specVersion: '1.2',
      },
      tables: [
        {
          id: 'empty',
          name: 'Empty',
          type: 'simple',
          entries: [{ value: '' }],
        },
      ],
    }
    engine.loadCollection(doc, 'test')
    const result = engine.roll('empty', 'test')
    expect(result.text).toBe('')
  })

  it('should handle deeply nested table references', () => {
    const engine = new RandomTableEngine()
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Test',
        namespace: 'test',
        version: '1.0.0',
        specVersion: '1.2',
      },
      tables: [
        {
          id: 'level1',
          name: 'Level 1',
          type: 'simple',
          entries: [{ value: '{{level2}}' }],
        },
        {
          id: 'level2',
          name: 'Level 2',
          type: 'simple',
          entries: [{ value: '{{level3}}' }],
        },
        {
          id: 'level3',
          name: 'Level 3',
          type: 'simple',
          entries: [{ value: 'Deep!' }],
        },
      ],
    }
    engine.loadCollection(doc, 'test')
    const result = engine.roll('level1', 'test')
    expect(result.text).toBe('Deep!')
  })

  it('should respect recursion limit', () => {
    const engine = new RandomTableEngine({ config: { maxRecursionDepth: 3 } })
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Test',
        namespace: 'test',
        version: '1.0.0',
        specVersion: '1.2',
      },
      tables: [
        {
          id: 'recursive',
          name: 'Recursive',
          type: 'simple',
          entries: [{ value: '{{recursive}} again' }],
        },
      ],
    }
    engine.loadCollection(doc, 'test')
    expect(() => engine.roll('recursive', 'test')).toThrow(/recursion/i)
  })
})

// ============================================================================
// Capture System Tests
// ============================================================================

describe('Roll Capture System', () => {
  describe('capture multi-roll', () => {
    it('should capture roll results into a variable', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'items',
            name: 'Items',
            type: 'simple',
            entries: [
              { id: 'sword', value: 'Sword' },
              { id: 'shield', value: 'Shield' },
              { id: 'bow', value: 'Bow' },
            ],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern:
              '{{3*unique*items >> $loot|silent}}You found: {{$loot|"; "}}. Count: {{$loot.count}}.',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      // Should have 3 unique items
      expect(result.text).toMatch(/You found: .+\. Count: 3\./)
      expect(result.text).toContain('; ') // Custom separator
    })

    it('should support indexed access', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'items',
            name: 'Items',
            type: 'simple',
            entries: [{ value: 'Sword' }],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern: '{{1*items >> $stuff|silent}}First: {{$stuff[0]}}',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toBe('First: Sword')
    })

    it('should support negative indexing', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'nums',
            name: 'Numbers',
            type: 'simple',
            entries: [
              { id: 'a', value: 'A' },
              { id: 'b', value: 'B' },
              { id: 'c', value: 'C' },
            ],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern: '{{3*unique*nums >> $list|silent}}Last: {{$list[-1]}}',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toMatch(/Last: [ABC]/)
    })

    it('should handle out of bounds gracefully', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'items',
            name: 'Items',
            type: 'simple',
            entries: [{ value: 'Sword' }],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern: '{{1*items >> $stuff|silent}}Missing: [{{$stuff[5]}}]',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toBe('Missing: []')
    })

    it('should access sets properties', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'enemies',
            name: 'Enemies',
            type: 'simple',
            entries: [
              { value: 'Goblin', sets: { cr: '1/4', type: 'humanoid' } },
            ],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern:
              '{{1*enemies >> $foe|silent}}Enemy: {{$foe[0]}}, CR: {{$foe[0].@cr}}, Type: {{$foe[0].@type}}',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toBe('Enemy: Goblin, CR: 1/4, Type: humanoid')
    })

    it('should output captured values when not silent', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'items',
            name: 'Items',
            type: 'simple',
            entries: [{ value: 'Sword' }],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern: 'Found: {{1*items >> $loot}}',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toBe('Found: Sword')
    })
  })

  describe('collect aggregation', () => {
    it('should collect all values', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'enemies',
            name: 'Enemies',
            type: 'simple',
            entries: [
              { id: 'a', value: 'Goblin', sets: { type: 'humanoid' } },
              { id: 'b', value: 'Orc', sets: { type: 'humanoid' } },
              { id: 'c', value: 'Dragon', sets: { type: 'dragon' } },
            ],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern:
              '{{3*unique*enemies >> $foes|silent}}Values: {{collect:$foes.value}}',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toMatch(/Values: .+/)
      // Should contain all three enemies
      expect(result.text).toContain('Goblin')
      expect(result.text).toContain('Orc')
      expect(result.text).toContain('Dragon')
    })

    it('should collect properties from all items', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'enemies',
            name: 'Enemies',
            type: 'simple',
            entries: [
              { id: 'a', value: 'Goblin', sets: { type: 'humanoid' } },
              { id: 'b', value: 'Orc', sets: { type: 'humanoid' } },
              { id: 'c', value: 'Dragon', sets: { type: 'dragon' } },
            ],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern:
              '{{3*unique*enemies >> $foes|silent}}Types: {{collect:$foes.@type}}',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toMatch(/Types: .+/)
    })

    it('should deduplicate with unique modifier', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'enemies',
            name: 'Enemies',
            type: 'simple',
            entries: [
              { id: 'a', value: 'Goblin', sets: { type: 'humanoid' } },
              { id: 'b', value: 'Orc', sets: { type: 'humanoid' } },
            ],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern:
              '{{2*unique*enemies >> $foes|silent}}Types: {{collect:$foes.@type|unique}}',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      // Both have type 'humanoid', so unique should give just one
      expect(result.text).toBe('Types: humanoid')
    })

    it('should use custom separator', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'items',
            name: 'Items',
            type: 'simple',
            entries: [
              { id: 'a', value: 'Sword' },
              { id: 'b', value: 'Shield' },
            ],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern:
              '{{2*unique*items >> $stuff|silent}}Items: {{collect:$stuff.value|" and "}}',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toContain(' and ')
    })
  })

  describe('edge cases', () => {
    it('should handle empty capture (0 items)', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'items',
            name: 'Items',
            type: 'simple',
            entries: [{ value: 'Sword' }],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern:
              '{{0*items >> $stuff|silent}}Count: {{$stuff.count}}, Values: [{{$stuff|"; "}}]',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toBe('Count: 0, Values: []')
    })

    it('should handle missing property gracefully', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'items',
            name: 'Items',
            type: 'simple',
            entries: [{ value: 'Sword' }], // No sets
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern:
              '{{1*items >> $stuff|silent}}Type: [{{$stuff[0].@type}}]',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toBe('Type: []')
    })

    it('should filter empty values in collect', () => {
      const engine = new RandomTableEngine()
      const doc: RandomTableDocument = {
        metadata: {
          name: 'Test',
          namespace: 'test',
          version: '1.0.0',
          specVersion: '1.2',
        },
        tables: [
          {
            id: 'items',
            name: 'Items',
            type: 'simple',
            entries: [
              { id: 'a', value: 'Sword', sets: { bonus: '+1' } },
              { id: 'b', value: 'Shield' }, // No bonus
              { id: 'c', value: 'Bow', sets: { bonus: '+2' } },
            ],
          },
        ],
        templates: [
          {
            id: 'test',
            name: 'Test',
            pattern:
              '{{3*unique*items >> $stuff|silent}}Bonuses: {{collect:$stuff.@bonus}}',
          },
        ],
      }
      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      // Should not have empty string between values
      expect(result.text).not.toContain(', ,')
    })
  })
})
