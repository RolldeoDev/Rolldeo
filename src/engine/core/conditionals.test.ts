/**
 * Conditionals Tests
 *
 * Tests for the condition expression evaluator used in switch expressions.
 * Covers comparison operators, logical operators, and value resolution.
 */

import { describe, it, expect } from 'vitest'
import { evaluateWhenClause } from './conditionals'
import { createContext, setPlaceholders, setSharedVariable } from './context'
import type { EngineConfig, CaptureItem } from '../types'

// ============================================================================
// Helper Functions
// ============================================================================

const defaultConfig: EngineConfig = {
  maxRecursionDepth: 50,
  maxExplodingDice: 100,
  maxInheritanceDepth: 10,
  uniqueOverflowBehavior: 'cycle',
}

function createTestContext() {
  return createContext(defaultConfig)
}

function createCaptureItem(value: string, sets: Record<string, string> = {}): CaptureItem {
  return { value, sets }
}

// ============================================================================
// Comparison Operator Tests
// ============================================================================

describe('evaluateWhenClause - equality operators', () => {
  it('should evaluate == for equal strings', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'race', { value: 'Elf' })

    expect(evaluateWhenClause('@race == Elf', ctx)).toBe(true)
    expect(evaluateWhenClause('@race == Human', ctx)).toBe(false)
  })

  it('should evaluate == for equal numbers', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('level', '5')

    expect(evaluateWhenClause('$level == 5', ctx)).toBe(true)
    expect(evaluateWhenClause('$level == 6', ctx)).toBe(false)
  })

  it('should evaluate != for not equal', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'race', { value: 'Dwarf' })

    expect(evaluateWhenClause('@race != Elf', ctx)).toBe(true)
    expect(evaluateWhenClause('@race != Dwarf', ctx)).toBe(false)
  })

  it('should handle quoted strings', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'name', { value: 'John Doe' })

    expect(evaluateWhenClause('@name == "John Doe"', ctx)).toBe(true)
    expect(evaluateWhenClause("@name == 'John Doe'", ctx)).toBe(true)
  })
})

describe('evaluateWhenClause - numeric comparisons', () => {
  it('should evaluate > greater than', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('level', '10')

    expect(evaluateWhenClause('$level > 5', ctx)).toBe(true)
    expect(evaluateWhenClause('$level > 10', ctx)).toBe(false)
    expect(evaluateWhenClause('$level > 15', ctx)).toBe(false)
  })

  it('should evaluate < less than', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('hp', '3')

    expect(evaluateWhenClause('$hp < 5', ctx)).toBe(true)
    expect(evaluateWhenClause('$hp < 3', ctx)).toBe(false)
    expect(evaluateWhenClause('$hp < 1', ctx)).toBe(false)
  })

  it('should evaluate >= greater than or equal', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('score', '10')

    expect(evaluateWhenClause('$score >= 10', ctx)).toBe(true)
    expect(evaluateWhenClause('$score >= 5', ctx)).toBe(true)
    expect(evaluateWhenClause('$score >= 15', ctx)).toBe(false)
  })

  it('should evaluate <= less than or equal', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('count', '5')

    expect(evaluateWhenClause('$count <= 5', ctx)).toBe(true)
    expect(evaluateWhenClause('$count <= 10', ctx)).toBe(true)
    expect(evaluateWhenClause('$count <= 3', ctx)).toBe(false)
  })
})

describe('evaluateWhenClause - string operators', () => {
  it('should evaluate contains (case insensitive)', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'description', { value: 'A large red dragon' })

    expect(evaluateWhenClause('@description contains dragon', ctx)).toBe(true)
    expect(evaluateWhenClause('@description contains DRAGON', ctx)).toBe(true)
    expect(evaluateWhenClause('@description contains goblin', ctx)).toBe(false)
  })

  it('should evaluate matches with regex', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'name', { value: 'Fire Sword' })

    expect(evaluateWhenClause('@name matches ^Fire', ctx)).toBe(true)
    expect(evaluateWhenClause('@name matches Sword$', ctx)).toBe(true)
    expect(evaluateWhenClause('@name matches ^Ice', ctx)).toBe(false)
  })

  it('should handle invalid regex gracefully', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'text', { value: 'test' })

    // Invalid regex should return false
    expect(evaluateWhenClause('@text matches [invalid(', ctx)).toBe(false)
  })
})

// ============================================================================
// Logical Operator Tests
// ============================================================================

describe('evaluateWhenClause - logical operators', () => {
  it('should evaluate && (AND)', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('level', '10')
    setPlaceholders(ctx, 'class', { value: 'Warrior' })

    expect(evaluateWhenClause('$level > 5 && @class == Warrior', ctx)).toBe(true)
    expect(evaluateWhenClause('$level > 5 && @class == Mage', ctx)).toBe(false)
    expect(evaluateWhenClause('$level > 15 && @class == Warrior', ctx)).toBe(false)
  })

  it('should evaluate || (OR)', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'race', { value: 'Elf' })

    expect(evaluateWhenClause('@race == Elf || @race == Human', ctx)).toBe(true)
    expect(evaluateWhenClause('@race == Human || @race == Dwarf', ctx)).toBe(false)
  })

  it('should evaluate ! (NOT)', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'evil', { value: 'false' })

    expect(evaluateWhenClause('!@evil == true', ctx)).toBe(true)
  })

  it('should handle combined && and ||', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('level', '10')
    setPlaceholders(ctx, 'class', { value: 'Warrior' })
    setPlaceholders(ctx, 'race', { value: 'Elf' })

    // OR has lower precedence
    expect(evaluateWhenClause('@class == Warrior && $level > 5 || @race == Dwarf', ctx)).toBe(true)
    expect(evaluateWhenClause('@class == Mage && $level > 5 || @race == Dwarf', ctx)).toBe(false)
    expect(evaluateWhenClause('@class == Mage && $level > 5 || @race == Elf', ctx)).toBe(true)
  })
})

describe('evaluateWhenClause - parentheses', () => {
  it('should handle parentheses for grouping', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('level', '5')
    setPlaceholders(ctx, 'class', { value: 'Mage' })
    setPlaceholders(ctx, 'race', { value: 'Elf' })

    // Without parentheses: class == Mage AND (level > 10 OR race == Elf)
    // With OR lower precedence, this is: (class == Mage AND level > 10) OR race == Elf
    // But with parentheses we can control it
    expect(evaluateWhenClause('(@class == Mage || @class == Warrior) && $level > 3', ctx)).toBe(true)
    expect(evaluateWhenClause('(@class == Mage || @class == Warrior) && $level > 10', ctx)).toBe(false)
  })

  it('should handle nested parentheses', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('a', '1')
    ctx.staticVariables.set('b', '2')
    ctx.staticVariables.set('c', '3')

    expect(evaluateWhenClause('(($a == 1 && $b == 2) || $c == 5)', ctx)).toBe(true)
    expect(evaluateWhenClause('(($a == 1 && $b == 5) || $c == 3)', ctx)).toBe(true)
    expect(evaluateWhenClause('(($a == 1 && $b == 5) || $c == 5)', ctx)).toBe(false)
  })
})

// ============================================================================
// Value Resolution Tests
// ============================================================================

describe('evaluateWhenClause - value resolution', () => {
  it('should resolve @placeholder values', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'weapon', { type: 'Sword', damage: 'fire' })

    expect(evaluateWhenClause('@weapon.type == Sword', ctx)).toBe(true)
    expect(evaluateWhenClause('@weapon.damage == fire', ctx)).toBe(true)
  })

  it('should resolve $variable values', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('strength', '16')

    expect(evaluateWhenClause('$strength >= 15', ctx)).toBe(true)
  })

  it('should resolve $var.@property for shared variables', () => {
    const ctx = createTestContext()
    setSharedVariable(ctx, 'hero', createCaptureItem('Knight', { alignment: 'good' }))

    expect(evaluateWhenClause('$hero.@alignment == good', ctx)).toBe(true)
    expect(evaluateWhenClause('$hero.@alignment == evil', ctx)).toBe(false)
  })

  it('should handle literal values', () => {
    const ctx = createTestContext()

    expect(evaluateWhenClause('5 > 3', ctx)).toBe(true)
    expect(evaluateWhenClause('hello == hello', ctx)).toBe(true)
  })

  it('should treat undefined values as falsy', () => {
    const ctx = createTestContext()

    // Missing variables are treated as falsy (empty string)
    expect(evaluateWhenClause('@missing', ctx)).toBe(false)
    expect(evaluateWhenClause('$undefined', ctx)).toBe(false)
  })
})

// ============================================================================
// Truthy Value Tests
// ============================================================================

describe('evaluateWhenClause - truthy values', () => {
  it('should treat non-empty string as truthy', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'name', { value: 'Test' })

    expect(evaluateWhenClause('@name', ctx)).toBe(true)
  })

  it('should treat empty string as falsy', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'empty', { value: '' })

    expect(evaluateWhenClause('@empty', ctx)).toBe(false)
  })

  it('should treat number as truthy', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('count', '5')

    expect(evaluateWhenClause('$count', ctx)).toBe(true)
  })

  it('should treat undefined as falsy', () => {
    const ctx = createTestContext()

    expect(evaluateWhenClause('$missing', ctx)).toBe(false)
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('evaluateWhenClause - edge cases', () => {
  it('should handle empty expression', () => {
    const ctx = createTestContext()

    expect(evaluateWhenClause('', ctx)).toBe(false)
  })

  it('should handle whitespace-only expression', () => {
    const ctx = createTestContext()

    expect(evaluateWhenClause('   ', ctx)).toBe(false)
  })

  it('should handle numeric string comparison correctly', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('level', '10')

    // String comparison: "10" vs "5" (lexicographic: "10" < "5")
    // But == should still work for numeric equality
    expect(evaluateWhenClause('$level == 10', ctx)).toBe(true)
  })

  it('should handle comparison with zero', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('count', '0')

    expect(evaluateWhenClause('$count == 0', ctx)).toBe(true)
    expect(evaluateWhenClause('$count > 0', ctx)).toBe(false)
    expect(evaluateWhenClause('$count >= 0', ctx)).toBe(true)
  })

  it('should handle negative numbers', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('modifier', '-2')

    expect(evaluateWhenClause('$modifier < 0', ctx)).toBe(true)
    expect(evaluateWhenClause('$modifier >= -2', ctx)).toBe(true)
  })

  it('should handle multi-word quoted values', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'title', { value: 'Lord of the Rings' })

    expect(evaluateWhenClause('@title == "Lord of the Rings"', ctx)).toBe(true)
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('evaluateWhenClause - integration', () => {
  it('should handle complex character check', () => {
    const ctx = createTestContext()

    // Character setup
    ctx.staticVariables.set('level', '15')
    ctx.staticVariables.set('hp', '85')
    setPlaceholders(ctx, 'class', { value: 'Paladin' })
    setPlaceholders(ctx, 'alignment', { value: 'lawful good' })
    setSharedVariable(ctx, 'weapon', createCaptureItem('Holy Avenger', { type: 'sword' }))

    // Complex condition: High-level paladin with holy sword
    expect(
      evaluateWhenClause(
        '$level >= 10 && @class == Paladin && $weapon.@type == sword',
        ctx
      )
    ).toBe(true)

    // Check alignment contains "good"
    expect(
      evaluateWhenClause('@alignment contains good && $hp > 50', ctx)
    ).toBe(true)
  })

  it('should handle encounter difficulty check', () => {
    const ctx = createTestContext()

    ctx.staticVariables.set('partyLevel', '5')
    ctx.staticVariables.set('partySize', '4')
    setPlaceholders(ctx, 'monster', { cr: '8', type: 'dragon' })

    // Easy encounter: CR <= party level
    expect(evaluateWhenClause('@monster.cr <= $partyLevel', ctx)).toBe(false) // 8 > 5

    // Dragon encounter special
    expect(
      evaluateWhenClause('@monster.type == dragon && $partySize >= 4', ctx)
    ).toBe(true)
  })

  it('should handle loot table conditions', () => {
    const ctx = createTestContext()

    setPlaceholders(ctx, 'monster', { value: 'Ancient Red Dragon', rarity: 'legendary' })
    ctx.staticVariables.set('luck', '18')

    // Legendary loot: rarity is legendary OR luck >= 20
    expect(
      evaluateWhenClause('@monster.rarity == legendary || $luck >= 20', ctx)
    ).toBe(true)

    // Both conditions
    expect(
      evaluateWhenClause('@monster.rarity == legendary && $luck >= 15', ctx)
    ).toBe(true)
  })
})

// Regression coverage for typed literals and composed boolean expressions (EC-07).
describe('evaluateWhenClause - grammar and literals', () => {
  it.each([
    ['!$missing && $missing', false],
    ['!$missing || $missing', true],
    ['!1 == 1 && 0 == 1', false],
    ['!1 == 1 || 1 == 1', true],
    ['!!1 == 1', true],
    ['!!!1 == 1', false],
    ['(1 == 2) && 1 == 1 || 1 == 1', true],
    ['(1 == 1) || 1 == 2 && 1 == 2', true],
    ['1 == 2 && (1 == 1) || 1 == 1', true],
    ['!(1 == 1 || 1 == 2) && 1 == 1', false],
    ['!(1 == 2 && (1 == 1 || 1 == 2)) || 1 == 2', true],
  ])('uses NOT > AND > OR and grouping in %s', (condition, expected) => {
    expect(evaluateWhenClause(condition, createTestContext())).toBe(expected)
  })

  it('preserves quoted empty strings and their truthiness', () => {
    const ctx = createTestContext()
    expect(evaluateWhenClause('"" == ""', ctx)).toBe(true)
    expect(evaluateWhenClause('@missing == ""', ctx)).toBe(true)
    expect(evaluateWhenClause("''", ctx)).toBe(false)
    expect(evaluateWhenClause('!""', ctx)).toBe(true)
    expect(evaluateWhenClause('"0"', ctx)).toBe(true)
    expect(evaluateWhenClause('0', ctx)).toBe(false)
  })

  it('preserves numeric-looking literals instead of parsing prefixes', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'text', { value: '123abc' })
    expect(evaluateWhenClause('@text == "123abc"', ctx)).toBe(true)
    expect(evaluateWhenClause('@text == 123abc', ctx)).toBe(true)
    expect(evaluateWhenClause('123abc == 123', ctx)).toBe(false)
    expect(evaluateWhenClause('"001" == 1', ctx)).toBe(false)
    expect(evaluateWhenClause('1e2 == 100', ctx)).toBe(true)
    expect(evaluateWhenClause('-.5 < 0', ctx)).toBe(true)
  })

  it('does not resolve quoted references or interpret quoted operators', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('name', 'replaced')
    setPlaceholders(ctx, 'name', { value: 'also replaced' })
    expect(evaluateWhenClause('"$name" == "$name"', ctx)).toBe(true)
    expect(evaluateWhenClause('"$name" == $name', ctx)).toBe(false)
    expect(evaluateWhenClause("'@name' == '@name'", ctx)).toBe(true)
    expect(evaluateWhenClause("'@name' == @name", ctx)).toBe(false)
    expect(evaluateWhenClause('"! && || ( ) == contains" == "! && || ( ) == contains"', ctx)).toBe(true)
  })

  it('supports escaped quotes and backslashes without losing regex escapes', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'quote', { value: 'say "hello"' })
    setPlaceholders(ctx, 'apostrophe', { value: "it's done" })
    setPlaceholders(ctx, 'path', { value: 'C:\\temp' })
    setPlaceholders(ctx, 'digits', { value: '123' })
    expect(evaluateWhenClause(String.raw`@quote == "say \"hello\""`, ctx)).toBe(true)
    expect(evaluateWhenClause(String.raw`@apostrophe == 'it\'s done'`, ctx)).toBe(true)
    expect(evaluateWhenClause(String.raw`@path == "C:\\temp"`, ctx)).toBe(true)
    expect(evaluateWhenClause(String.raw`@digits matches "^\d+$"`, ctx)).toBe(true)
    expect(evaluateWhenClause(String.raw`@digits matches "^\\d+$"`, ctx)).toBe(true)
  })

  it('retains comparison case rules and unquoted multiword strings', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'title', { value: 'Fire Sword' })
    expect(evaluateWhenClause('@title == Fire Sword', ctx)).toBe(true)
    expect(evaluateWhenClause('@title == "fire sword"', ctx)).toBe(false)
    expect(evaluateWhenClause('@title contains "fire"', ctx)).toBe(true)
    expect(evaluateWhenClause('@title matches "^fire (sword|axe)$"', ctx)).toBe(true)
    expect(evaluateWhenClause('@title matches "[invalid("', ctx)).toBe(false)
  })

  it('accepts all whitespace and comparisons without surrounding spaces', () => {
    expect(evaluateWhenClause('1==1\n&&\t2>=1\r\n||0', createTestContext())).toBe(true)
  })

  it.each([
    '(', ')', '()', '(1', '1)', '(1) trailing', '(1)(1)',
    '!','1 &&', '|| 1', '1 || )', '0 && (',
    '1 ==', '== 1', '1 == 1 == 1', '1 = 1', '1 & 1', '1 | 1',
    '"unterminated', "'unterminated", '"unterminated\\"',
    '1 || "unterminated', '1 || (1', '1 || 1 ==',
  ])('rejects malformed or incompletely consumed syntax: %s', (condition) => {
    expect(evaluateWhenClause(condition, createTestContext())).toBe(false)
  })
})

describe('evaluateWhenClause - bounded linear regex matching', () => {
  it('handles a nested-quantifier non-match on long input without backtracking', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'text', { value: 'a'.repeat(50000) + '!' })
    expect(evaluateWhenClause('@text matches "^(a+)+$"', ctx)).toBe(false)
    expect(ctx.budget?.work).toBeGreaterThan(390)
  })

  it('searches substrings case-insensitively using RE2 syntax', () => {
    const ctx = createTestContext()
    setPlaceholders(ctx, 'text', { value: 'The FIRE Sword, code AB123' })
    expect(evaluateWhenClause('@text matches "fire (sword|axe)"', ctx)).toBe(true)
    expect(evaluateWhenClause(String.raw`@text matches "[A-Z]{2}\d{3}$"`, ctx)).toBe(true)
    expect(evaluateWhenClause('@text matches "^fire"', ctx)).toBe(false)
  })

  it.each([
    '(?=a)a', '(?!b)a', '(?<=b)a', '(?<!b)a', String.raw`(a)\1`, '[invalid',
  ])('returns false for unsupported/malformed pattern %s', (pattern) => {
    const ctx = createTestContext()
    ctx.staticVariables.set('pattern', pattern)
    expect(evaluateWhenClause('"aa" matches $pattern', ctx)).toBe(false)
  })

  it('allows pattern/input lengths at their boundaries', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('pattern', 'a'.repeat(1024))
    setPlaceholders(ctx, 'text', { value: 'a'.repeat(100000) })
    expect(evaluateWhenClause('@text matches $pattern', ctx)).toBe(true)
  })

  it('rejects oversized patterns and inputs before regex evaluation', () => {
    const ctx = createTestContext()
    ctx.staticVariables.set('pattern', 'a'.repeat(1025))
    expect(() => evaluateWhenClause('"a" matches $pattern', ctx)).toThrow('Condition regex pattern limit exceeded (1024)')
    setPlaceholders(ctx, 'text', { value: 'a'.repeat(100001) })
    expect(() => evaluateWhenClause('@text matches "a"', ctx)).toThrow('Condition regex input limit exceeded (100000)')
  })

  it('charges repeated matches to the shared generation budget', () => {
    const ctx = createContext({ ...defaultConfig, maxGenerationWork: 2 })
    expect(evaluateWhenClause('"a" matches "a"', ctx)).toBe(true)
    expect(evaluateWhenClause('"a" matches "a"', ctx)).toBe(true)
    expect(() => evaluateWhenClause('"a" matches "a"', ctx)).toThrow('Generation work limit exceeded (2)')
  })

  it('propagates work errors even for malformed regex instead of treating them as false', () => {
    const ctx = createContext({ ...defaultConfig, maxGenerationWork: 1 })
    ctx.staticVariables.set('text', 'a'.repeat(256))
    expect(() => evaluateWhenClause('$text matches "[invalid"', ctx)).toThrow('Generation work limit exceeded (1)')
  })
})
