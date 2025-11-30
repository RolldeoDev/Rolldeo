/**
 * Phase 5 Feature Tests
 *
 * Tests for:
 * - Table inheritance (extends)
 * - Shared variables evaluation
 * - Conditionals evaluation
 * - Namespace resolution
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { RandomTableEngine } from './index'
import { evaluateWhenClause, applyConditionals } from './conditionals'
import { createContext, setSharedVariable, resolveVariable, setPlaceholders } from './context'
import type { RandomTableDocument, Conditional } from '../types'
import type { GenerationContext } from './context'

// ============================================================================
// Test Documents
// ============================================================================

// Document with table inheritance
const inheritanceDocument: RandomTableDocument = {
  metadata: {
    name: 'Inheritance Test',
    namespace: 'test.inheritance',
    version: '1.0.0',
    specVersion: '1.2',
  },
  tables: [
    {
      id: 'baseWeapons',
      name: 'Base Weapons',
      type: 'simple',
      entries: [
        { id: 'sword', value: 'Sword', weight: 1 },
        { id: 'axe', value: 'Axe', weight: 1 },
        { id: 'bow', value: 'Bow', weight: 1 },
      ],
    },
    {
      id: 'magicWeapons',
      name: 'Magic Weapons',
      type: 'simple',
      extends: 'baseWeapons',
      entries: [
        { id: 'sword', value: 'Magic Sword', weight: 2 }, // Overrides base sword
        { id: 'staff', value: 'Staff', weight: 1 }, // New entry
      ],
    },
    {
      id: 'legendaryWeapons',
      name: 'Legendary Weapons',
      type: 'simple',
      extends: 'magicWeapons',
      entries: [
        { id: 'sword', value: 'Legendary Sword', weight: 3 }, // Overrides magic sword
        { id: 'excalibur', value: 'Excalibur', weight: 1 }, // New entry
      ],
    },
  ],
}

// Document with shared variables
const sharedVarsDocument: RandomTableDocument = {
  metadata: {
    name: 'Shared Vars Test',
    namespace: 'test.shared',
    version: '1.0.0',
    specVersion: '1.2',
  },
  shared: {
    level: '{{dice:1d10}}',
    bonus: '{{math:$level + 5}}',
  },
  tables: [
    {
      id: 'character',
      name: 'Character',
      type: 'simple',
      entries: [
        { value: 'Level {{$level}} warrior with +{{$bonus}} to hit' },
      ],
    },
  ],
}

// Document with conditionals
const conditionalsDocument: RandomTableDocument = {
  metadata: {
    name: 'Conditionals Test',
    namespace: 'test.conditionals',
    version: '1.0.0',
    specVersion: '1.2',
  },
  tables: [
    {
      id: 'creatures',
      name: 'Creatures',
      type: 'simple',
      entries: [
        { id: 'dragon', value: 'Dragon', sets: { size: 'huge', type: 'fire' } },
        { id: 'goblin', value: 'Goblin', sets: { size: 'small', type: 'humanoid' } },
        { id: 'wolf', value: 'Wolf', sets: { size: 'medium', type: 'beast' } },
      ],
    },
  ],
  conditionals: [
    {
      when: '@creatures.size == "huge"',
      action: 'append',
      value: ' (Ancient)',
    },
    {
      when: '@creatures.type == "fire"',
      action: 'append',
      value: ' - breathes fire',
    },
  ],
}

// Document with namespace for cross-collection tests
const namespaceDoc1: RandomTableDocument = {
  metadata: {
    name: 'Fantasy Core',
    namespace: 'fantasy.core',
    version: '1.0.0',
    specVersion: '1.2',
  },
  tables: [
    {
      id: 'races',
      name: 'Fantasy Races',
      type: 'simple',
      entries: [
        { value: 'Elf' },
        { value: 'Dwarf' },
        { value: 'Human' },
      ],
    },
  ],
}

const namespaceDoc2: RandomTableDocument = {
  metadata: {
    name: 'Sci-Fi Core',
    namespace: 'scifi.core',
    version: '1.0.0',
    specVersion: '1.2',
  },
  tables: [
    {
      id: 'races',
      name: 'Sci-Fi Races',
      type: 'simple',
      entries: [
        { value: 'Android' },
        { value: 'Cyborg' },
        { value: 'Alien' },
      ],
    },
    {
      id: 'crossRef',
      name: 'Cross Reference',
      type: 'simple',
      entries: [
        { value: '{{fantasy.core.races}} meets {{races}}' },
      ],
    },
  ],
}

// ============================================================================
// Test Helpers
// ============================================================================

function createTestContext(): GenerationContext {
  return createContext({
    maxRecursionDepth: 50,
    maxExplodingDice: 100,
    maxInheritanceDepth: 5,
    uniqueOverflowBehavior: 'stop',
  })
}

// ============================================================================
// Table Inheritance Tests
// ============================================================================

describe('Table Inheritance', () => {
  let engine: RandomTableEngine

  beforeEach(() => {
    engine = new RandomTableEngine()
    engine.loadCollection(inheritanceDocument, 'inheritance-test')
  })

  it('should roll on base table without inheritance', () => {
    const result = engine.roll('baseWeapons', 'inheritance-test')
    expect(['Sword', 'Axe', 'Bow']).toContain(result.text)
  })

  it('should include parent entries when rolling on child table', () => {
    // Roll many times to get statistical coverage
    const results = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const result = engine.roll('magicWeapons', 'inheritance-test')
      results.add(result.text)
    }

    // Should include overridden entry from child
    expect(results.has('Magic Sword')).toBe(true)
    // Should include parent entries (axe, bow not overridden)
    expect(results.has('Axe')).toBe(true)
    expect(results.has('Bow')).toBe(true)
    // Should include new entry from child
    expect(results.has('Staff')).toBe(true)
    // Should NOT include base sword (overridden)
    expect(results.has('Sword')).toBe(false)
  })

  it('should support multi-level inheritance', () => {
    const results = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const result = engine.roll('legendaryWeapons', 'inheritance-test')
      results.add(result.text)
    }

    // Should include legendary sword (overrides magic sword)
    expect(results.has('Legendary Sword')).toBe(true)
    // Should include entries from grandparent (axe, bow)
    expect(results.has('Axe')).toBe(true)
    expect(results.has('Bow')).toBe(true)
    // Should include new entry from child
    expect(results.has('Excalibur')).toBe(true)
    // Should include staff from parent
    expect(results.has('Staff')).toBe(true)
    // Should NOT include overridden entries
    expect(results.has('Sword')).toBe(false)
    expect(results.has('Magic Sword')).toBe(false)
  })

  it('should throw error when inheritance depth exceeded', () => {
    const deepDoc: RandomTableDocument = {
      metadata: {
        name: 'Deep Inheritance',
        namespace: 'test.deep',
        version: '1.0.0',
        specVersion: '1.2',
        maxInheritanceDepth: 2,
      },
      tables: [
        { id: 't1', name: 'T1', type: 'simple', entries: [{ value: 'A' }] },
        { id: 't2', name: 'T2', type: 'simple', extends: 't1', entries: [{ value: 'B' }] },
        { id: 't3', name: 'T3', type: 'simple', extends: 't2', entries: [{ value: 'C' }] },
        { id: 't4', name: 'T4', type: 'simple', extends: 't3', entries: [{ value: 'D' }] },
      ],
    }

    engine.loadCollection(deepDoc, 'deep-test')
    expect(() => engine.roll('t4', 'deep-test')).toThrow(/inheritance depth limit/i)
  })
})

// ============================================================================
// Shared Variables Tests
// ============================================================================

describe('Shared Variables', () => {
  let engine: RandomTableEngine

  beforeEach(() => {
    engine = new RandomTableEngine()
    engine.loadCollection(sharedVarsDocument, 'shared-test')
  })

  it('should evaluate shared variables at generation start', () => {
    const result = engine.roll('character', 'shared-test')

    // Result should contain evaluated level and bonus
    expect(result.text).toMatch(/Level \d+ warrior with \+\d+ to hit/)
  })

  it('should allow later shared variables to reference earlier ones', () => {
    // The bonus variable uses level variable: {{math:$level + 5}}
    // So if level is 5, bonus should be 10
    const result = engine.roll('character', 'shared-test')

    // Extract numbers from result
    const match = result.text.match(/Level (\d+) warrior with \+(\d+) to hit/)
    expect(match).not.toBeNull()

    if (match) {
      const level = parseInt(match[1], 10)
      const bonus = parseInt(match[2], 10)
      expect(bonus).toBe(level + 5)
    }
  })
})

// ============================================================================
// Table/Template-Level Shared Variables Tests
// ============================================================================

describe('Table/Template-Level Shared Variables', () => {
  let engine: RandomTableEngine

  beforeEach(() => {
    engine = new RandomTableEngine()
  })

  it('should evaluate table-level shared variables lazily when rolled', () => {
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Table Shared Test',
        namespace: 'test.tableshared',
        version: '1.0.0',
        specVersion: '1.2',
      },
      tables: [
        {
          id: 'scaledEncounter',
          name: 'Scaled Encounter',
          type: 'simple',
          shared: {
            threatLevel: '{{dice:1d6}}',
            monsterCount: '{{math:$threatLevel + 2}}',
          },
          entries: [{ value: '{{$monsterCount}} goblins attack!' }],
        },
      ],
    }

    engine.loadCollection(doc, 'table-shared-test')
    const result = engine.roll('scaledEncounter', 'table-shared-test')

    // Result should contain evaluated monsterCount (threatLevel + 2)
    // threatLevel is 1-6, so monsterCount is 3-8
    const match = result.text.match(/(\d+) goblins attack!/)
    expect(match).not.toBeNull()
    if (match) {
      const count = parseInt(match[1], 10)
      expect(count).toBeGreaterThanOrEqual(3)
      expect(count).toBeLessThanOrEqual(8)
    }
  })

  it('should propagate table-level shared vars to nested table references', () => {
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Propagation Test',
        namespace: 'test.propagation',
        version: '1.0.0',
        specVersion: '1.2',
      },
      tables: [
        {
          id: 'parent',
          name: 'Parent Table',
          type: 'simple',
          shared: {
            count: '5',
          },
          entries: [{ value: '{{child}}' }],
        },
        {
          id: 'child',
          name: 'Child Table',
          type: 'simple',
          entries: [{ value: '{{$count}} items' }],
        },
      ],
    }

    engine.loadCollection(doc, 'propagation-test')
    const result = engine.roll('parent', 'propagation-test')

    // Child should use parent's shared variable
    expect(result.text).toBe('5 items')
  })

  it('should skip table-level shared var if already set by parent', () => {
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Inheritance Test',
        namespace: 'test.sharedinherit',
        version: '1.0.0',
        specVersion: '1.2',
      },
      tables: [
        {
          id: 'parent',
          name: 'Parent Table',
          type: 'simple',
          shared: {
            count: '10',
          },
          entries: [{ value: '{{child}}' }],
        },
        {
          id: 'child',
          name: 'Child Table',
          type: 'simple',
          shared: {
            count: '3', // Would set count to 3, but parent already set it to 10
          },
          entries: [{ value: '{{$count}} things' }],
        },
      ],
    }

    engine.loadCollection(doc, 'inherit-test')

    // When rolled from parent, child's shared is skipped
    const parentResult = engine.roll('parent', 'inherit-test')
    expect(parentResult.text).toBe('10 things')

    // When rolled directly, child's shared is used
    const childResult = engine.roll('child', 'inherit-test')
    expect(childResult.text).toBe('3 things')
  })

  it('should throw error when table-level shared shadows document-level', () => {
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Shadow Test',
        namespace: 'test.shadow',
        version: '1.0.0',
        specVersion: '1.2',
      },
      shared: {
        globalVar: '100',
      },
      tables: [
        {
          id: 'shadowTable',
          name: 'Shadow Table',
          type: 'simple',
          shared: {
            globalVar: '50', // Should throw - shadows document-level
          },
          entries: [{ value: '{{$globalVar}}' }],
        },
      ],
    }

    engine.loadCollection(doc, 'shadow-test')
    expect(() => engine.roll('shadowTable', 'shadow-test')).toThrow(/SHARED_SHADOW/)
  })

  it('should throw error when table-level shared shadows static variable', () => {
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Static Shadow Test',
        namespace: 'test.staticshadow',
        version: '1.0.0',
        specVersion: '1.2',
      },
      variables: {
        staticVar: 'static value',
      },
      tables: [
        {
          id: 'shadowTable',
          name: 'Shadow Table',
          type: 'simple',
          shared: {
            staticVar: 'dynamic value', // Should throw - shadows static var
          },
          entries: [{ value: '{{$staticVar}}' }],
        },
      ],
    }

    engine.loadCollection(doc, 'static-shadow-test')
    expect(() => engine.roll('shadowTable', 'static-shadow-test')).toThrow(/SHARED_SHADOW/)
  })

  it('should evaluate template-level shared variables', () => {
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Template Shared Test',
        namespace: 'test.templateshared',
        version: '1.0.0',
        specVersion: '1.2',
      },
      tables: [
        {
          id: 'enemyType',
          name: 'Enemy Type',
          type: 'simple',
          entries: [{ value: 'goblins' }],
        },
      ],
      templates: [
        {
          id: 'encounter',
          name: 'Encounter Template',
          shared: {
            enemyCount: '{{dice:2d4}}',
            danger: '{{math:$enemyCount * 10}}',
          },
          pattern: '{{$enemyCount}} {{enemyType}} (danger: {{$danger}})',
        },
      ],
    }

    engine.loadCollection(doc, 'template-shared-test')
    const result = engine.rollTemplate('encounter', 'template-shared-test')

    // Result should contain evaluated variables
    const match = result.text.match(/(\d+) goblins \(danger: (\d+)\)/)
    expect(match).not.toBeNull()
    if (match) {
      const count = parseInt(match[1], 10)
      const danger = parseInt(match[2], 10)
      expect(count).toBeGreaterThanOrEqual(2)
      expect(count).toBeLessThanOrEqual(8)
      expect(danger).toBe(count * 10)
    }
  })

  it('should support math expressions in table-level shared', () => {
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Math Shared Test',
        namespace: 'test.mathshared',
        version: '1.0.0',
        specVersion: '1.2',
      },
      tables: [
        {
          id: 'mathTable',
          name: 'Math Table',
          type: 'simple',
          shared: {
            base: '10',
            doubled: '{{math:$base * 2}}',
            final: '{{math:$doubled + 5}}',
          },
          entries: [{ value: 'Result: {{$final}}' }],
        },
      ],
    }

    engine.loadCollection(doc, 'math-shared-test')
    const result = engine.roll('mathTable', 'math-shared-test')

    // base=10, doubled=20, final=25
    expect(result.text).toBe('Result: 25')
  })
})

// ============================================================================
// Conditionals Unit Tests
// ============================================================================

describe('Conditionals - evaluateWhenClause', () => {
  let context: GenerationContext

  beforeEach(() => {
    context = createTestContext()
  })

  it('should evaluate simple equality', () => {
    setSharedVariable(context, 'size', 'large')
    expect(evaluateWhenClause('$size == "large"', context)).toBe(true)
    expect(evaluateWhenClause('$size == "small"', context)).toBe(false)
  })

  it('should evaluate inequality', () => {
    setSharedVariable(context, 'size', 'large')
    expect(evaluateWhenClause('$size != "small"', context)).toBe(true)
    expect(evaluateWhenClause('$size != "large"', context)).toBe(false)
  })

  it('should evaluate numeric comparisons', () => {
    setSharedVariable(context, 'level', 10)
    expect(evaluateWhenClause('$level > 5', context)).toBe(true)
    expect(evaluateWhenClause('$level < 5', context)).toBe(false)
    expect(evaluateWhenClause('$level >= 10', context)).toBe(true)
    expect(evaluateWhenClause('$level <= 10', context)).toBe(true)
  })

  it('should evaluate contains operator', () => {
    setSharedVariable(context, 'name', 'Fire Dragon')
    expect(evaluateWhenClause('$name contains "Dragon"', context)).toBe(true)
    expect(evaluateWhenClause('$name contains "Ice"', context)).toBe(false)
  })

  it('should evaluate matches operator (regex)', () => {
    setSharedVariable(context, 'name', 'Fire Dragon')
    expect(evaluateWhenClause('$name matches "^Fire"', context)).toBe(true)
    expect(evaluateWhenClause('$name matches "Dragon$"', context)).toBe(true)
    expect(evaluateWhenClause('$name matches "^Ice"', context)).toBe(false)
  })

  it('should evaluate logical AND', () => {
    setSharedVariable(context, 'size', 'large')
    setSharedVariable(context, 'type', 'dragon')
    expect(evaluateWhenClause('$size == "large" && $type == "dragon"', context)).toBe(true)
    expect(evaluateWhenClause('$size == "small" && $type == "dragon"', context)).toBe(false)
  })

  it('should evaluate logical OR', () => {
    setSharedVariable(context, 'size', 'large')
    setSharedVariable(context, 'type', 'dragon')
    expect(evaluateWhenClause('$size == "small" || $type == "dragon"', context)).toBe(true)
    expect(evaluateWhenClause('$size == "small" || $type == "goblin"', context)).toBe(false)
  })

  it('should evaluate NOT operator', () => {
    setSharedVariable(context, 'hidden', 'false')
    expect(evaluateWhenClause('!$hidden == "true"', context)).toBe(true)
  })

  it('should evaluate placeholder references', () => {
    setPlaceholders(context, 'creature', { size: 'huge' })
    expect(evaluateWhenClause('@creature.size == "huge"', context)).toBe(true)
  })
})

// ============================================================================
// Conditionals - applyConditionals Tests
// ============================================================================

describe('Conditionals - applyConditionals', () => {
  let context: GenerationContext

  beforeEach(() => {
    context = createTestContext()
  })

  it('should append text when condition matches', () => {
    setSharedVariable(context, 'type', 'fire')

    const conditionals: Conditional[] = [
      { when: '$type == "fire"', action: 'append', value: ' (burning)' },
    ]

    const result = applyConditionals(conditionals, 'Dragon', context, (p) => p)
    expect(result).toBe('Dragon (burning)')
  })

  it('should prepend text when condition matches', () => {
    setSharedVariable(context, 'rarity', 'legendary')

    const conditionals: Conditional[] = [
      { when: '$rarity == "legendary"', action: 'prepend', value: 'Ancient ' },
    ]

    const result = applyConditionals(conditionals, 'Dragon', context, (p) => p)
    expect(result).toBe('Ancient Dragon')
  })

  it('should replace text when condition matches', () => {
    setSharedVariable(context, 'size', 'huge')

    const conditionals: Conditional[] = [
      { when: '$size == "huge"', action: 'replace', target: 'Dragon', value: 'Giant Dragon' },
    ]

    const result = applyConditionals(conditionals, 'Fire Dragon', context, (p) => p)
    expect(result).toBe('Fire Giant Dragon')
  })

  it('should set variable when condition matches', () => {
    setSharedVariable(context, 'level', 10)

    const conditionals: Conditional[] = [
      { when: '$level >= 10', action: 'setVariable', target: 'isBoss', value: 'true' },
    ]

    applyConditionals(conditionals, 'Monster', context, (p) => p)
    expect(resolveVariable(context, 'isBoss')).toBe('true')
  })

  it('should not apply conditional when condition does not match', () => {
    setSharedVariable(context, 'type', 'ice')

    const conditionals: Conditional[] = [
      { when: '$type == "fire"', action: 'append', value: ' (burning)' },
    ]

    const result = applyConditionals(conditionals, 'Dragon', context, (p) => p)
    expect(result).toBe('Dragon')
  })

  it('should apply multiple conditionals in order', () => {
    setSharedVariable(context, 'size', 'huge')
    setSharedVariable(context, 'type', 'fire')

    const conditionals: Conditional[] = [
      { when: '$size == "huge"', action: 'prepend', value: 'Ancient ' },
      { when: '$type == "fire"', action: 'append', value: ' - breathes fire' },
    ]

    const result = applyConditionals(conditionals, 'Dragon', context, (p) => p)
    expect(result).toBe('Ancient Dragon - breathes fire')
  })
})

// ============================================================================
// Conditionals Integration Tests
// ============================================================================

describe('Conditionals - Engine Integration', () => {
  let engine: RandomTableEngine

  beforeEach(() => {
    engine = new RandomTableEngine()
    engine.loadCollection(conditionalsDocument, 'conditionals-test')
  })

  it('should apply conditionals after rolling', () => {
    // Roll many times until we get a dragon
    let dragonResult = null
    for (let i = 0; i < 100; i++) {
      const result = engine.roll('creatures', 'conditionals-test')
      if (result.text.includes('Dragon')) {
        dragonResult = result
        break
      }
    }

    // Dragon should have conditionals applied (huge size and fire type)
    expect(dragonResult).not.toBeNull()
    if (dragonResult) {
      expect(dragonResult.text).toContain('(Ancient)')
      expect(dragonResult.text).toContain('breathes fire')
    }
  })
})

// ============================================================================
// Namespace Resolution Tests
// ============================================================================

describe('Namespace Resolution', () => {
  let engine: RandomTableEngine

  beforeEach(() => {
    engine = new RandomTableEngine()
    engine.loadCollection(namespaceDoc1, 'fantasy')
    engine.loadCollection(namespaceDoc2, 'scifi')
  })

  it('should resolve table references with namespace prefix', () => {
    // crossRef table uses {{fantasy.core.races}} and {{races}}
    const results = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const result = engine.roll('crossRef', 'scifi')
      results.add(result.text)
    }

    // Should contain fantasy races followed by scifi races
    let hasFantasyRace = false
    let hasScifiRace = false

    for (const text of results) {
      if (text.includes('Elf') || text.includes('Dwarf') || text.includes('Human')) {
        hasFantasyRace = true
      }
      if (text.includes('Android') || text.includes('Cyborg') || text.includes('Alien')) {
        hasScifiRace = true
      }
    }

    expect(hasFantasyRace).toBe(true)
    expect(hasScifiRace).toBe(true)
  })

  it('should resolve local table without namespace', () => {
    const results = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const result = engine.roll('races', 'scifi')
      results.add(result.text)
    }

    // Should only contain scifi races
    expect(results.has('Android') || results.has('Cyborg') || results.has('Alien')).toBe(true)
    expect(results.has('Elf')).toBe(false)
    expect(results.has('Dwarf')).toBe(false)
  })

  it('should allow same table ID in different namespaces', () => {
    // Both collections have a 'races' table
    const fantasyResult = engine.roll('races', 'fantasy')
    const scifiResult = engine.roll('races', 'scifi')

    expect(['Elf', 'Dwarf', 'Human']).toContain(fantasyResult.text)
    expect(['Android', 'Cyborg', 'Alien']).toContain(scifiResult.text)
  })
})
