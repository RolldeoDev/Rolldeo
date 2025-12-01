import { describe, it, expect } from 'vitest'
import { parseTableText, normalizeText, toCamelCase } from './tableParser'

describe('normalizeText', () => {
  it('should collapse multiple whitespace', () => {
    expect(normalizeText('a   b    c')).toBe('a b c')
  })

  it('should collapse newlines to spaces', () => {
    expect(normalizeText('a\nb\n\nc')).toBe('a b c')
  })

  it('should handle Windows line endings', () => {
    expect(normalizeText('a\r\nb\r\nc')).toBe('a b c')
  })

  it('should normalize unicode dashes', () => {
    expect(normalizeText('1–30')).toBe('1-30') // en-dash
    expect(normalizeText('1—30')).toBe('1-30') // em-dash
  })

  it('should normalize smart quotes', () => {
    expect(normalizeText('"quoted"')).toBe('"quoted"')
    expect(normalizeText("it's")).toBe("it's")
  })

  it('should handle PDF ligatures', () => {
    expect(normalizeText('\ufb01nd')).toBe('find') // fi ligature
    expect(normalizeText('\ufb02ight')).toBe('flight') // fl ligature
  })

  it('should handle non-breaking spaces', () => {
    expect(normalizeText('a\u00A0b')).toBe('a b')
  })

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeText('  hello world  ')).toBe('hello world')
  })
})

describe('toCamelCase', () => {
  it('should convert simple phrase to camelCase', () => {
    expect(toCamelCase('How Dangerous')).toBe('howDangerous')
  })

  it('should handle longer phrases', () => {
    expect(toCamelCase('How Dangerous Is The Feature')).toBe('howDangerousIsTheFeature')
  })

  it('should handle single word', () => {
    expect(toCamelCase('Weapon')).toBe('weapon')
  })

  it('should remove special characters', () => {
    expect(toCamelCase("What's the Weather?")).toBe('whatsTheWeather')
  })

  it('should handle multiple spaces', () => {
    expect(toCamelCase('Random   Encounters')).toBe('randomEncounters')
  })

  it('should return "table" for empty string', () => {
    expect(toCamelCase('')).toBe('table')
  })

  it('should handle numbers in name', () => {
    expect(toCamelCase('D100 Loot Table')).toBe('d100LootTable')
  })
})

describe('parseTableText', () => {
  describe('basic validation', () => {
    it('should return error for empty input', () => {
      const result = parseTableText('')
      expect(result.success).toBe(false)
      expect(result.errors).toContain('No text provided')
    })

    it('should return error for whitespace only', () => {
      const result = parseTableText('   \n\t  ')
      expect(result.success).toBe(false)
      expect(result.errors).toContain('Text is empty after normalization')
    })

    it('should return error for null/undefined', () => {
      const result = parseTableText(null as unknown as string)
      expect(result.success).toBe(false)
      expect(result.errors).toContain('No text provided')
    })
  })

  describe('d6 tables', () => {
    it('should parse simple d6 table', () => {
      const input = 'd6 How Dangerous 1 Safer than usual 2 Notable danger 3 Site-specific peril'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('How Dangerous')
      expect(result.table?.id).toBe('howDangerous')
      expect(result.table?.entries).toHaveLength(3)
      expect(result.table?.entries[0]).toEqual({
        value: 'Safer than usual',
        range: [1, 1],
      })
    })

    it('should parse d6 table with 1d6 notation', () => {
      const input = '1d6 Weather 1 Sunny 2 Cloudy 3 Rain'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('Weather')
    })

    it('should handle full d6 table', () => {
      const input =
        'd6 Random Events 1 Nothing 2 Merchant 3 Bandits 4 Storm 5 Wildlife 6 Discovery'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries).toHaveLength(6)
      expect(result.table?.entries[5].range).toEqual([6, 6])
    })
  })

  describe('d20 tables', () => {
    it('should parse d20 table', () => {
      const input =
        'd20 Optional Quirk 1 Magical structures 2 Origin legend 3 Man-made by ancient arts'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('Optional Quirk')
      expect(result.table?.entries).toHaveLength(3)
    })
  })

  describe('d100 tables with ranges', () => {
    it('should parse range notation', () => {
      const input = 'd100 Loot 1-30 Common item 31-60 Uncommon 61-90 Rare 91-100 Legendary'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries).toHaveLength(4)
      expect(result.table?.entries[0].range).toEqual([1, 30])
      expect(result.table?.entries[3].range).toEqual([91, 100])
    })

    it('should handle 00 as 100', () => {
      const input = 'd100 Test 91-00 Very rare item'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries[0].range).toEqual([91, 100])
    })

    it('should handle single entry with 00', () => {
      const input = 'd100 Test 98-00 Critical'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries[0].range).toEqual([98, 100])
    })

    it('should parse complex d100 table', () => {
      const input =
        'd100 Weapon 1-30 Sword 31-50 Axe 51-70 Bow 71-85 Spear 86-95 Dagger 96-00 Magic weapon'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries).toHaveLength(6)
      expect(result.table?.entries[5].range).toEqual([96, 100])
    })
  })

  describe('multi-column detection', () => {
    it('should detect and reorder interleaved columns', () => {
      const input = 'd6 Test 1 First 4 Fourth 2 Second 5 Fifth 3 Third 6 Sixth'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some((w) => w.includes('non-sequential'))).toBe(true)

      // Should be sorted by number
      expect(result.table?.entries[0].value).toBe('First')
      expect(result.table?.entries[1].value).toBe('Second')
      expect(result.table?.entries[2].value).toBe('Third')
      expect(result.table?.entries[3].value).toBe('Fourth')
    })
  })

  describe('tables without die prefix', () => {
    it('should parse table without die notation', () => {
      const input = 'Random Encounters 1 Merchant 2 Bandits 3 Wildlife'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('Random Encounters')
      expect(result.table?.entries).toHaveLength(3)
    })
  })

  describe('tables without numbers', () => {
    it('should split by periods', () => {
      const input = 'Random Events. A merchant arrives. Storm approaches. Nothing happens.'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries.length).toBeGreaterThanOrEqual(3)
      // These should have weight instead of range since no numbers
      expect(result.warnings.some((w) => w.includes('No numbers'))).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should warn on overlapping ranges', () => {
      const input = 'd100 Test 1-50 First 40-80 Second 81-100 Third'
      const result = parseTableText(input)

      expect(result.warnings.some((w) => w.includes('Overlapping'))).toBe(true)
    })

    it('should warn on gaps in ranges', () => {
      const input = 'd100 Test 1-30 First 50-100 Second'
      const result = parseTableText(input)

      expect(result.warnings.some((w) => w.includes('Gap'))).toBe(true)
    })

    it('should handle unicode dashes in ranges', () => {
      const input = 'd100 Test 1–30 Entry' // en-dash
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries[0].range).toEqual([1, 30])
    })

    it('should handle smart quotes in entries', () => {
      const input = 'd6 Test 1 "Quoted text" 2 Normal text'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries[0].value).toContain('Quoted text')
    })

    it('should use default table name when provided', () => {
      const input = '1 First entry 2 Second entry'
      const result = parseTableText(input, { defaultTableName: 'My Custom Table' })

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('My Custom Table')
      expect(result.table?.id).toBe('myCustomTable')
    })
  })

  describe('real-world examples from spec', () => {
    it('should parse "How Dangerous is the Feature" example', () => {
      const input =
        "d6 How Dangerous is the Feature? 1 Safer than usual for someplace like it 2 There's one notable kind of danger there 3 It's got some site-specific flavors of peril 4 It's unusually dangerous in several ways 5 It will quickly kill the unprepared or unwary 6 It's a death zone for all but the strongest"
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('How Dangerous is the Feature?')
      expect(result.table?.entries).toHaveLength(6)
      expect(result.table?.entries[0].value).toBe('Safer than usual for someplace like it')
      expect(result.table?.entries[5].value).toBe(
        "It's a death zone for all but the strongest"
      )
    })

    it('should parse "Optional Quirk of the Feature" example', () => {
      const input =
        'd20 Optional Quirk of the Feature 1 It has significant magical structures in it 2 It has a place in the national origin legend 3 It is entirely man-made by ancient arts 4 Time and space sometimes slip there 5 The magical power there attracts wizards 6 It subtly changes those who live there 7 It\'s holy land to a particular faith 8 It was formerly a different kind of terrain'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('Optional Quirk of the Feature')
      expect(result.table?.entries).toHaveLength(8)
    })
  })

  describe('duplicate header handling', () => {
    it('should handle duplicated table name from multi-column headers', () => {
      const input = 'd100 Weapon d100 Weapon 1-30 Sword 31-60 Axe'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('Weapon')
    })
  })
})
