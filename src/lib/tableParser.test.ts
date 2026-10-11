import { describe, it, expect } from 'vitest'
import { parseTableText, normalizeText, toCamelCase } from './tableParser'

describe('normalizeText', () => {
  it('should collapse multiple whitespace', () => {
    expect(normalizeText('a   b    c')).toBe('a b c')
  })

  it('should preserve physical rows and blank lines', () => {
    expect(normalizeText('a\nb\n\nc')).toBe('a\nb\n\nc')
  })

  it('should handle Windows line endings', () => {
    expect(normalizeText('a\r\nb\r\nc')).toBe('a\nb\nc')
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
      const input = 'd6 How Dangerous\n1 Safer than usual\n2 Notable danger\n3 Site-specific peril'
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
      const input = '1d6 Weather\n1 Sunny\n2 Cloudy\n3 Rain'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('Weather')
    })

    it('should handle full d6 table', () => {
      const input =
        'd6 Random Events\n1 Nothing\n2 Merchant\n3 Bandits\n4 Storm\n5 Wildlife\n6 Discovery'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries).toHaveLength(6)
      expect(result.table?.entries[5].range).toEqual([6, 6])
    })
  })

  describe('d20 tables', () => {
    it('should parse d20 table', () => {
      const input =
        'd20 Optional Quirk\n1 Magical structures\n2 Origin legend\n3 Man-made by ancient arts'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('Optional Quirk')
      expect(result.table?.entries).toHaveLength(3)
    })
  })

  describe('d100 tables with ranges', () => {
    it('should parse range notation', () => {
      const input = 'd100 Loot\n1-30 Common item\n31-60 Uncommon\n61-90 Rare\n91-100 Legendary'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries).toHaveLength(4)
      expect(result.table?.entries[0].range).toEqual([1, 30])
      expect(result.table?.entries[3].range).toEqual([91, 100])
    })

    it('should handle 00 as 100', () => {
      const input = 'd100 Test\n91-00 Very rare item'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries[0].range).toEqual([91, 100])
    })

    it('should handle single entry with 00', () => {
      const input = 'd100 Test\n98-00 Critical'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries[0].range).toEqual([98, 100])
    })

    it('should parse complex d100 table', () => {
      const input =
        'd100 Weapon\n1-30 Sword\n31-50 Axe\n51-70 Bow\n71-85 Spear\n86-95 Dagger\n96-00 Magic weapon'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries).toHaveLength(6)
      expect(result.table?.entries[5].range).toEqual([96, 100])
    })
  })

  describe('multi-column detection', () => {
    it('should detect and reorder interleaved columns', () => {
      const input = 'd6 Test\n1 First\n4 Fourth\n2 Second\n5 Fifth\n3 Third\n6 Sixth'
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
      const input = 'Random Encounters\n1 Merchant\n2 Bandits\n3 Wildlife'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('Random Encounters')
      expect(result.table?.entries).toHaveLength(3)
    })
  })

  describe('tables without numbers', () => {
    it('preserves single-line prose rather than guessing sentence rows', () => {
      const input = 'Random Events. A merchant arrives. Storm approaches. Nothing happens.'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries).toEqual([{ value: input, weight: 1 }])
      // These should have weight instead of range since no numbers
      expect(result.warnings.some((w) => w.includes('No numbers'))).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should warn on overlapping ranges', () => {
      const input = 'd100 Test\n1-50 First\n40-80 Second\n81-100 Third'
      const result = parseTableText(input)

      expect(result.warnings.some((w) => w.includes('Overlapping'))).toBe(true)
    })

    it('should warn on gaps in ranges', () => {
      const input = 'd100 Test\n1-30 First\n50-100 Second'
      const result = parseTableText(input)

      expect(result.warnings.some((w) => w.includes('Gap'))).toBe(true)
    })

    it('should handle unicode dashes in ranges', () => {
      const input = 'd100 Test\n1–30 Entry' // en-dash
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries[0].range).toEqual([1, 30])
    })

    it('should handle smart quotes in entries', () => {
      const input = 'd6 Test\n1 "Quoted text"\n2 Normal text'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.entries[0].value).toContain('Quoted text')
    })

    it('should use default table name when provided', () => {
      const input = '1 First entry\n2 Second entry'
      const result = parseTableText(input, { defaultTableName: 'My Custom Table' })

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('My Custom Table')
      expect(result.table?.id).toBe('myCustomTable')
    })
  })

  describe('real-world examples from spec', () => {
    it('should parse "How Dangerous is the Feature" example', () => {
      const input =
        "d6 How Dangerous is the Feature?\n1 Safer than usual for someplace like it\n2 There's one notable kind of danger there\n3 It's got some site-specific flavors of peril\n4 It's unusually dangerous in several ways\n5 It will quickly kill the unprepared or unwary\n6 It's a death zone for all but the strongest"
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
        'd20 Optional Quirk of the Feature\n1 It has significant magical structures in it\n2 It has a place in the national origin legend\n3 It is entirely man-made by ancient arts\n4 Time and space sometimes slip there\n5 The magical power there attracts wizards\n6 It subtly changes those who live there\n7 It\'s holy land to a particular faith\n8 It was formerly a different kind of terrain'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('Optional Quirk of the Feature')
      expect(result.table?.entries).toHaveLength(8)
    })
  })

  describe('duplicate header handling', () => {
    it('should handle duplicated table name from multi-column headers', () => {
      const input = 'd100 Weapon d100 Weapon\n1-30 Sword\n31-60 Axe'
      const result = parseTableText(input)

      expect(result.success).toBe(true)
      expect(result.table?.name).toBe('Weapon')
    })
  })
})

describe('mixed singleton and range imports', () => {
  it('retains every entry around a range and keeps each value separate', () => {
    const result = parseTableText('d6 Test\n1 First\n2-5 Middle\n6 Last')
    expect(result.success).toBe(true)
    expect(result.table?.entries).toEqual([
      { value: 'First', range: [1, 1] },
      { value: 'Middle', range: [2, 5] },
      { value: 'Last', range: [6, 6] },
    ])
  })

  it('orders interleaved PDF columns and handles the percentile singleton', () => {
    const result = parseTableText('d100 Mixed\n1 First\n00 Last\n2-99 Middle')
    expect(result.table?.entries).toEqual([
      { value: 'First', range: [1, 1] },
      { value: 'Middle', range: [2, 99] },
      { value: 'Last', range: [100, 100] },
    ])
    expect(result.warnings.some(warning => warning.includes('non-sequential'))).toBe(true)
  })

  it('uses consistent ranges even when the die heading is omitted', () => {
    const result = parseTableText('Test\n1 First\n2-5 Middle\n6 Last')
    expect(result.table?.entries.map(entry => entry.range)).toEqual([[1, 1], [2, 5], [6, 6]])
  })
})


it('retains mixed range entries beginning with non-ASCII text or punctuation', () => {
  const result = parseTableText('d6 Choices\n1 Étoile\n2-5 六\n6 $gold')
  expect(result.table?.entries).toEqual([
    { value: 'Étoile', range: [1, 1] },
    { value: '六', range: [2, 5] },
    { value: '$gold', range: [6, 6] },
  ])
})

describe('physical row preservation and safe recovery', () => {
  it('preserves numeric prose inside explicit numbered rows', () => {
    const result = parseTableText('d2 Encounter\n1 Meet 2 goblins\n2 Nothing')
    expect(result.success).toBe(true)
    expect(result.table?.entries).toEqual([
      { value: 'Meet 2 goblins', range: [1, 1] },
      { value: 'Nothing', range: [2, 2] },
    ])
  })

  it('retains numeric values at the beginning of a row, including flat single rows', () => {
    for (const input of ['d1 Treasure\n1 100 gold pieces', 'd1 Treasure 1 100 gold pieces', '1 100 gold pieces']) {
      const result = parseTableText(input)
      expect(result.success).toBe(true)
      expect(result.table?.entries[0].value).toBe('100 gold pieces')
    }
  })

  it('preserves prose across wrapped lines without treating middle numbers as rows', () => {
    const result = parseTableText('d2 Encounter\n1 Meet 2 goblins\ncarrying 3 swords.\n2 Nothing')
    expect(result.table?.entries[0].value).toBe('Meet 2 goblins carrying 3 swords.')
  })

  it('uses separate equal-weight entries for an unnumbered newline list', () => {
    for (const input of ['Apple\nBanana\nCherry', 'd3 Fruit\nApple\nBanana\nCherry']) {
      const result = parseTableText(input)
      expect(result.table?.entries).toEqual([
        { value: 'Apple', weight: 1 },
        { value: 'Banana', weight: 1 },
        { value: 'Cherry', weight: 1 },
      ])
    }
  })

  it.each([
    'd2 Encounter 1 Meet 2 goblins 2 Nothing',
    'd6 Test 1 First 2-5 Middle 6 Last',
    'd2 Treasure 1 100 gold pieces 2 Nothing',
    '1 First 2 Second',
    'd2 Encounter 1 Meet 2 goblins',
    'd2 Encounter 1 Meet 2 3 goblins',
    'd2 Encounter 1 Meet 2 goblins\n2 Nothing',
  ])('rejects flattened numeric ambiguity without returning a partial table: %s', input => {
    const original = input
    const result = parseTableText(input)
    expect(result.success).toBe(false)
    expect(result.table).toBeUndefined()
    expect(result.errors.some(error => error.includes('Add a newline before each actual row'))).toBe(true)
    expect(input).toBe(original)
  })

  it.each(['d6 Bad\n5-2 Reversed', '0 Invalid', '-1 Invalid', '1--2 Negative endpoint', '1.5 Invalid', '1-2.5 Invalid endpoint', '9007199254740992 Unsafe', 'd6 Bad\n1-9007199254740992 Unsafe', 'd6 Bad\n7 Out of bounds', 'd0 Bad\n1 Entry'])('rejects invalid ranges: %s', input => {
    const result = parseTableText(input)
    expect(result.success).toBe(false)
    expect(result.table).toBeUndefined()
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('returns an error for a numbered row without a value', () => {
    const result = parseTableText('d2 Empty\n1\n2 Second')
    expect(result.success).toBe(false)
    expect(result.table).toBeUndefined()
  })
})

describe('source dice and uncertain conversions', () => {
  it.each(['2d6', '3d6', '1d100', '2d6+2', '2d6 - 2'])('preserves supported dice headings: %s', dice => {
    const result = parseTableText(`${dice} Fixture\n2-4 Example`)
    if (dice === '2d6+2' || dice === '3d6') expect(result.success).toBe(false) // impossible totals require correction
    else {
      expect(result.success).toBe(true)
      expect(result.table?.selection?.mode).toBe('dice')
      expect(result.warnings.length).toBeGreaterThan(0) // deliberately incomplete fixture
    }
  })
  it.each(['2d6kh1 Reaction', '2d6! Reaction', 'd6*2 Reaction', '2d6+level Reaction', '2d6 + level Reaction', 'dF Reaction'])('rejects unsupported dice rather than silently using equal weights: %s', heading => {
    const result = parseTableText(`${heading}\n1 Low\n2 High`)
    expect(result.success).toBe(false)
  })
  it('flags missing leading and trailing outcomes', () => {
    const result = parseTableText('2d6 Partial\n3-11 Middle')
    expect(result.warnings).toContain('Dice outcomes 2-2 have no entry')
    expect(result.warnings).toContain('Dice outcomes 12-12 have no entry')
  })
  it('preserves the raw copy even when unsupported headings fail', () => {
    const raw = '2d6! Reaction\r\n1 Low\r\n2 High'
    expect(parseTableText(raw).sourceText).toBe(raw)
  })
  it('requires review for numeric prose, wrapped rows and source procedures', () => {
    const result = parseTableText('d2 Encounters\n1 3 goblins\ncarrying swords\n2 Roll again')
    expect(result.warnings.some(warning => warning.includes('another number'))).toBe(true)
    expect(result.warnings.some(warning => warning.includes('procedure'))).toBe(true)
    expect(result.table?.entries[0].value).toBe('3 goblins carrying swords')
  })
  it('does not translate open-ended ranges without a dice domain', () => {
    expect(parseTableText('Reaction\n2 or less Low\n3 or more High').success).toBe(false)
  })
})
