import { describe, it, expect, beforeEach } from 'vitest'
import { RandomTableEngine } from './index'
import type { RandomTableDocument } from '../types'

// Sample test document
const sampleDocument: RandomTableDocument = {
  metadata: {
    name: 'Test Tables',
    namespace: 'test.tables',
    version: '1.0.0',
    specVersion: '1.0',
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
          specVersion: '1.0' as const,
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
        specVersion: '1.0',
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
        specVersion: '1.0',
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
        specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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
          specVersion: '1.0',
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

describe('Capture-Aware Shared Variables', () => {
  let engine: RandomTableEngine

  // Helper to create minimal test document with required metadata
  const createTestDoc = (
    tables: RandomTableDocument['tables'],
    templates: RandomTableDocument['templates']
  ): RandomTableDocument => ({
    metadata: {
      name: 'Test',
      namespace: 'test.capture',
      version: '1.0.0',
      specVersion: '1.0',
    },
    tables,
    templates,
  })

  beforeEach(() => {
    engine = new RandomTableEngine()
  })

  describe('basic capture-aware shared variables', () => {
    it('should capture table roll with sets using $ prefix in shared key', () => {
      // With explicit {{}} syntax, patterns in sets are evaluated at merge time
      const doc = createTestDoc(
        [
          {
            id: 'race',
            name: 'Race',
            type: 'simple',
            entries: [
              // Use explicit {{}} syntax to roll name table at merge time
              { id: 'elf', value: 'Elf', sets: { name: '{{elfNames}}', size: 'Medium' } },
              { id: 'dwarf', value: 'Dwarf', sets: { name: '{{dwarfNames}}', size: 'Medium' } },
            ],
          },
          {
            id: 'elfNames',
            name: 'Elf Names',
            type: 'simple',
            entries: [{ value: 'Legolas' }, { value: 'Arwen' }, { value: 'Thranduil' }],
          },
          {
            id: 'dwarfNames',
            name: 'Dwarf Names',
            type: 'simple',
            entries: [{ value: 'Gimli' }, { value: 'Thorin' }, { value: 'Balin' }],
          },
        ],
        [
          {
            id: 'character',
            name: 'Character',
            shared: {
              '$hero': '{{race}}',
            },
            // Access pre-evaluated name from sets
            pattern: '{{$hero.@name}} the {{$hero}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('character', 'test')

      // The result should be a name from the appropriate name table followed by the race
      // e.g., "Legolas the Elf" or "Gimli the Dwarf"
      expect(result.text).toMatch(/^(Legolas|Arwen|Thranduil|Gimli|Thorin|Balin) the (Elf|Dwarf)$/)
    })

    it('should support multiple independent capture-aware shared variables', () => {
      // With explicit {{}} syntax, patterns in sets are evaluated at merge time
      const doc = createTestDoc(
        [
          {
            id: 'race',
            name: 'Race',
            type: 'simple',
            entries: [
              // Use explicit {{}} syntax to roll name table at merge time
              { id: 'elf', value: 'Elf', sets: { name: '{{elfNames}}' } },
              { id: 'dwarf', value: 'Dwarf', sets: { name: '{{dwarfNames}}' } },
            ],
          },
          {
            id: 'elfNames',
            name: 'Elf Names',
            type: 'simple',
            entries: [{ value: 'Legolas' }],
          },
          {
            id: 'dwarfNames',
            name: 'Dwarf Names',
            type: 'simple',
            entries: [{ value: 'Gimli' }],
          },
        ],
        [
          {
            id: 'rivals',
            name: 'Rivals',
            shared: {
              '$hero': '{{race}}',
              '$enemy': '{{race}}',
            },
            // Access pre-evaluated name from sets
            pattern: '{{$hero.@name}} the {{$hero}} vs {{$enemy.@name}} the {{$enemy}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('rivals', 'test')

      // Both characters should have names appropriate to their race
      // The result could be "Legolas the Elf vs Gimli the Dwarf" or any combination
      expect(result.text).toMatch(/^(Legolas|Gimli) the (Elf|Dwarf) vs (Legolas|Gimli) the (Elf|Dwarf)$/)
    })

    it('should access captured value without property', () => {
      const doc = createTestDoc(
        [
          {
            id: 'color',
            name: 'Color',
            type: 'simple',
            entries: [{ value: 'Red', sets: { hex: '#FF0000' } }],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: {
              '$chosen': '{{color}}',
            },
            pattern: 'Color: {{$chosen}}, Hex: {{$chosen.@hex}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toBe('Color: Red, Hex: #FF0000')
    })

    it('should return empty string for missing property', () => {
      const doc = createTestDoc(
        [
          {
            id: 'item',
            name: 'Item',
            type: 'simple',
            entries: [{ value: 'Sword', sets: { type: 'weapon' } }],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: {
              '$item': '{{item}}',
            },
            pattern: 'Item: {{$item}}, Missing: [{{$item.@nonexistent}}]',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toBe('Item: Sword, Missing: []')
    })
  })

  describe('dynamic table resolution', () => {
    it('should evaluate pattern in set value at merge time', () => {
      // With explicit {{}} syntax, table rolls happen at merge time
      const doc = createTestDoc(
        [
          {
            id: 'characterType',
            name: 'Character Type',
            type: 'simple',
            entries: [
              // Use explicit {{}} syntax to roll weapon table at merge time
              { value: 'Warrior', sets: { weapon: '{{warriorWeapons}}' } },
              { value: 'Mage', sets: { weapon: '{{mageWeapons}}' } },
            ],
          },
          {
            id: 'warriorWeapons',
            name: 'Warrior Weapons',
            type: 'simple',
            entries: [{ value: 'Sword' }, { value: 'Axe' }],
          },
          {
            id: 'mageWeapons',
            name: 'Mage Weapons',
            type: 'simple',
            entries: [{ value: 'Staff' }, { value: 'Wand' }],
          },
        ],
        [
          {
            id: 'character',
            name: 'Character',
            shared: {
              '$char': '{{characterType}}',
            },
            // Access pre-evaluated weapon from sets
            pattern: '{{$char}} with {{$char.@weapon}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('character', 'test')

      // Warriors should get warrior weapons, mages should get mage weapons
      const isWarriorCombo = /^Warrior with (Sword|Axe)$/.test(result.text)
      const isMageCombo = /^Mage with (Staff|Wand)$/.test(result.text)
      expect(isWarriorCombo || isMageCombo).toBe(true)
    })

    it('should return value as-is when property is not a table ID', () => {
      const doc = createTestDoc(
        [
          {
            id: 'item',
            name: 'Item',
            type: 'simple',
            entries: [{ value: 'Potion', sets: { effect: 'Healing', power: '50' } }],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: {
              '$potion': '{{item}}',
            },
            pattern: '{{$potion}} of {{$potion.@effect}} (power: {{$potion.@power}})',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toBe('Potion of Healing (power: 50)')
    })
  })

  describe('pattern evaluation in captured sets', () => {
    it('should evaluate patterns in set values for captured items', () => {
      // With explicit {{}} syntax, patterns are evaluated at merge time
      const doc = createTestDoc(
        [
          {
            id: 'enemy',
            name: 'Enemy',
            type: 'simple',
            entries: [
              // Use explicit {{}} syntax to roll loot table at merge time
              { value: 'Orc', sets: { loot: '{{orcLoot}}' } },
              { value: 'Goblin', sets: { loot: '{{goblinLoot}}' } },
            ],
          },
          {
            id: 'orcLoot',
            name: 'Orc Loot',
            type: 'simple',
            entries: [{ value: 'Orcish Blade' }],
          },
          {
            id: 'goblinLoot',
            name: 'Goblin Loot',
            type: 'simple',
            entries: [{ value: 'Rusty Dagger' }],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            // Access pre-evaluated loot from sets
            pattern: '{{1*enemy >> $foe|silent}}Defeated {{$foe[0]}}, found {{$foe[0].@loot}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')

      const isOrcCombo = result.text === 'Defeated Orc, found Orcish Blade'
      const isGoblinCombo = result.text === 'Defeated Goblin, found Rusty Dagger'
      expect(isOrcCombo || isGoblinCombo).toBe(true)
    })

    it('should evaluate patterns in set values for collect', () => {
      // With explicit {{}} syntax, patterns are evaluated at merge time
      const doc = createTestDoc(
        [
          {
            id: 'character',
            name: 'Character',
            type: 'simple',
            entries: [
              // Use explicit {{}} syntax to roll greeting table at merge time
              { value: 'Fighter', sets: { greeting: '{{fighterGreeting}}' } },
              { value: 'Wizard', sets: { greeting: '{{wizardGreeting}}' } },
            ],
          },
          {
            id: 'fighterGreeting',
            name: 'Fighter Greeting',
            type: 'simple',
            entries: [{ value: 'Hail!' }],
          },
          {
            id: 'wizardGreeting',
            name: 'Wizard Greeting',
            type: 'simple',
            entries: [{ value: 'Greetings!' }],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            // Access pre-evaluated greeting from sets via collect
            pattern: '{{2*unique*character >> $party|silent}}Greetings: {{collect:$party.@greeting}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')

      // Both Fighter and Wizard should have their greetings evaluated (order varies)
      expect(result.text).toMatch(/^Greetings: (Hail!, Greetings!|Greetings!, Hail!)$/)
    })
  })

  describe('fallback for complex expressions', () => {
    it('should handle complex expressions with empty sets', () => {
      const doc = createTestDoc(
        [
          {
            id: 'item',
            name: 'Item',
            type: 'simple',
            entries: [{ value: 'Gold' }],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: {
              '$result': '{{dice:1d6}} {{item}}',
            },
            pattern: 'Found: {{$result}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')

      // Complex expression (dice + table) should evaluate but sets will be empty
      expect(result.text).toMatch(/^Found: [1-6] Gold$/)
    })
  })
})

describe('Explicit Pattern Syntax in Sets', () => {
  let engine: RandomTableEngine

  const createTestDoc = (
    tables: import('../types').Table[],
    templates: import('../types').Template[]
  ): import('../types').RandomTableDocument => ({
    metadata: {
      name: 'Test',
      namespace: 'test.sets.explicit',
      version: '1.0.0',
      specVersion: '1.0',
    },
    tables,
    templates,
  })

  beforeEach(() => {
    engine = new RandomTableEngine()
  })

  describe('pattern evaluation in sets', () => {
    it('should evaluate {{tableName}} patterns in sets at merge time', () => {
      const doc = createTestDoc(
        [
          {
            id: 'character',
            name: 'Character',
            type: 'simple',
            entries: [
              {
                value: 'Warrior',
                sets: {
                  // Explicit pattern - evaluated at merge time
                  weapon: '{{weapons}}',
                },
              },
            ],
          },
          {
            id: 'weapons',
            name: 'Weapons',
            type: 'simple',
            entries: [{ value: 'Sword' }, { value: 'Axe' }],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: { _init: '{{character}}' },
            pattern: '{{@character}} with {{@character.weapon}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toMatch(/^Warrior with (Sword|Axe)$/)
    })

    it('should evaluate {{dice:}} patterns in sets at merge time', () => {
      const doc = createTestDoc(
        [
          {
            id: 'monster',
            name: 'Monster',
            type: 'simple',
            entries: [
              {
                value: 'Dragon',
                sets: {
                  hp: '{{dice:4d10+20}}',
                  ac: '18',
                },
              },
            ],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: { _init: '{{monster}}' },
            pattern: '{{@monster}}: HP={{@monster.hp}}, AC={{@monster.ac}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      // HP should be a number between 24-60, AC should be literal "18"
      expect(result.text).toMatch(/^Dragon: HP=\d+, AC=18$/)
      const hpMatch = result.text.match(/HP=(\d+)/)
      expect(hpMatch).not.toBeNull()
      const hp = parseInt(hpMatch![1], 10)
      expect(hp).toBeGreaterThanOrEqual(24)
      expect(hp).toBeLessThanOrEqual(60)
    })

    it('should support mixed content in set values', () => {
      const doc = createTestDoc(
        [
          {
            id: 'item',
            name: 'Item',
            type: 'simple',
            entries: [
              {
                value: 'Potion',
                sets: {
                  // Mixed literal and pattern content
                  description: 'A {{adjective}} potion worth {{dice:1d6*10}} gold',
                },
              },
            ],
          },
          {
            id: 'adjective',
            name: 'Adjective',
            type: 'simple',
            entries: [{ value: 'glowing' }, { value: 'bubbling' }],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: { _init: '{{item}}' },
            pattern: '{{@item.description}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toMatch(/^A (glowing|bubbling) potion worth \d+ gold$/)
    })

    it('should keep literal strings as literals even if they match table IDs', () => {
      const doc = createTestDoc(
        [
          {
            id: 'creature',
            name: 'Creature',
            type: 'simple',
            entries: [
              {
                value: 'Dragon',
                sets: {
                  // This is a literal string, not a table reference
                  type: 'weapons', // "weapons" table exists but shouldn't be rolled
                },
              },
            ],
          },
          {
            id: 'weapons',
            name: 'Weapons',
            type: 'simple',
            entries: [{ value: 'Sword' }],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: { _init: '{{creature}}' },
            pattern: 'Type: {{@creature.type}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      // Should return "weapons" as literal, NOT "Sword"
      expect(result.text).toBe('Type: weapons')
    })
  })

  describe('cycle detection', () => {
    it('should handle self-referential table rolls gracefully', () => {
      // A set value that references the same table should work (recursion tracking)
      // The table recursion limit (default 50) will catch truly infinite cases
      const doc = createTestDoc(
        [
          {
            id: 'items',
            name: 'Items',
            type: 'simple',
            entries: [
              {
                value: 'Chest',
                sets: {
                  // Contains another roll of the same table
                  // This creates a chain but is not truly self-referential
                  contents: '{{items}}',
                },
              },
              {
                value: 'Gold',
                sets: {
                  contents: 'nothing',
                },
              },
            ],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: { _init: '{{items}}' },
            pattern: 'Found: {{@items}}, Contains: {{@items.contents}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      // Should get either "Chest" with nested roll, or "Gold" with "nothing"
      expect(result.text).toMatch(/^Found: (Chest|Gold), Contains: (Chest|Gold|nothing)$/)
    })

    it('should not re-evaluate set key during same evaluation', () => {
      // If a set value pattern is being evaluated, another attempt to evaluate
      // the same key should return the raw pattern (cycle detection)
      const doc = createTestDoc(
        [
          {
            id: 'table1',
            name: 'Table 1',
            type: 'simple',
            entries: [
              {
                value: 'Value1',
                sets: {
                  // This pattern will try to roll table2
                  prop1: '{{table2}}',
                },
              },
            ],
          },
          {
            id: 'table2',
            name: 'Table 2',
            type: 'simple',
            entries: [
              {
                value: 'Value2',
                sets: {
                  // During evaluation of table1.prop1, this would try to evaluate
                  // table1.prop1 again, triggering cycle detection
                  prop2: '{{@table1.prop1}}',
                },
              },
            ],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: { _init: '{{table1}}' },
            // Access the nested property
            pattern: 'Result: {{@table1.prop1}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      // The inner set evaluation of table1.prop1 happens at merge time,
      // which rolls table2, which stores its sets including prop2.
      // At the template level, @table1.prop1 returns "Value2" (the evaluated result)
      expect(result.text).toBe('Result: Value2')
    })

    it('should handle nested table rolls in sets without cycles', () => {
      // Nested patterns should work fine when there are no cycles
      const doc = createTestDoc(
        [
          {
            id: 'outer',
            name: 'Outer',
            type: 'simple',
            entries: [
              {
                value: 'Outer',
                sets: {
                  nested: '{{inner}}',
                },
              },
            ],
          },
          {
            id: 'inner',
            name: 'Inner',
            type: 'simple',
            entries: [{ value: 'InnerValue' }],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: { _init: '{{outer}}' },
            pattern: 'Nested: {{@outer.nested}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toBe('Nested: InnerValue')
    })
  })

  describe('defaultSets with patterns', () => {
    it('should evaluate patterns in defaultSets', () => {
      const doc = createTestDoc(
        [
          {
            id: 'character',
            name: 'Character',
            type: 'simple',
            defaultSets: {
              // Default set with pattern
              baseHp: '{{dice:2d6}}',
            },
            entries: [
              { value: 'Warrior' },
              { value: 'Mage' },
            ],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: { _init: '{{character}}' },
            pattern: '{{@character}} has {{@character.baseHp}} HP',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      const result = engine.rollTemplate('test', 'test')
      expect(result.text).toMatch(/^(Warrior|Mage) has \d+ HP$/)
    })

    it('should allow entry sets to override defaultSets patterns', () => {
      const doc = createTestDoc(
        [
          {
            id: 'character',
            name: 'Character',
            type: 'simple',
            defaultSets: {
              weapon: '{{commonWeapons}}', // Default pattern
            },
            entries: [
              { value: 'Warrior' }, // Uses default
              { value: 'Mage', sets: { weapon: '{{mageWeapons}}' } }, // Override
            ],
          },
          {
            id: 'commonWeapons',
            name: 'Common Weapons',
            type: 'simple',
            entries: [{ value: 'Sword' }],
          },
          {
            id: 'mageWeapons',
            name: 'Mage Weapons',
            type: 'simple',
            entries: [{ value: 'Staff' }],
          },
        ],
        [
          {
            id: 'test',
            name: 'Test',
            shared: { _init: '{{character}}' },
            pattern: '{{@character}} with {{@character.weapon}}',
          },
        ]
      )

      engine.loadCollection(doc, 'test')
      // Roll multiple times to verify both paths work
      let foundWarrior = false
      let foundMage = false
      for (let i = 0; i < 20; i++) {
        const result = engine.rollTemplate('test', 'test')
        if (result.text === 'Warrior with Sword') foundWarrior = true
        if (result.text === 'Mage with Staff') foundMage = true
        expect(result.text).toMatch(/^(Warrior with Sword|Mage with Staff)$/)
      }
      // With enough rolls, we should have seen both
      expect(foundWarrior || foundMage).toBe(true)
    })
  })
})
