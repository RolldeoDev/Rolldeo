/**
 * Table Parser - Transforms raw text (copied from PDFs) into SimpleTable JSON
 *
 * Supports:
 * - d6, d20, d100 tables with sequential or range notation
 * - Multi-column PDF copies with interleaved entries
 * - Tables without numbers (weight-based)
 * - Special handling for '00' as 100 in d100 tables
 */

import type { SimpleTable, Entry } from '../engine/types'

// ============================================================================
// Types
// ============================================================================

export interface ParsedTableResult {
  success: boolean
  table?: SimpleTable
  warnings: string[]
  errors: string[]
}

export interface ParserOptions {
  defaultTableName?: string
}

interface HeaderInfo {
  dieType: number | null
  tableName: string
  remainingText: string
}

interface RawEntry {
  rangeStart: number
  rangeEnd: number
  value: string
}

// ============================================================================
// Text Normalization
// ============================================================================

/**
 * Normalize text by handling unicode characters, ligatures, and whitespace
 */
export function normalizeText(raw: string): string {
  return (
    raw
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Normalize unicode dashes to hyphen
      .replace(/[\u2013\u2014\u2212]/g, '-')
      // Normalize smart quotes to regular quotes
      .replace(/[\u2018\u2019\u201A]/g, "'")
      .replace(/[\u201C\u201D\u201E]/g, '"')
      // Handle common PDF ligatures
      .replace(/\ufb01/g, 'fi')
      .replace(/\ufb02/g, 'fl')
      .replace(/\ufb03/g, 'ffi')
      .replace(/\ufb04/g, 'ffl')
      .replace(/\ufb00/g, 'ff')
      // Normalize various space characters to regular space
      .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      // Collapse multiple spaces/tabs to single space (preserve newlines for now)
      .replace(/[^\S\n]+/g, ' ')
      // Collapse multiple newlines to single space
      .replace(/\n+/g, ' ')
      // Final trim
      .trim()
  )
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Convert a table name to camelCase ID
 * "How Dangerous Is The Feature" -> "howDangerousIsTheFeature"
 */
export function toCamelCase(name: string): string {
  // Remove special characters except spaces
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, '')

  // Split by whitespace and convert to camelCase
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0)

  if (words.length === 0) {
    return 'table'
  }

  return words
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index === 0) {
        return lower
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
}

// ============================================================================
// Header Parsing
// ============================================================================

/**
 * Parse the header to extract die type and table name
 */
function parseHeader(text: string): HeaderInfo {
  // Pattern to match die notation at the start: d6, d20, d100, d%, 1d6, etc.
  // Followed by table name, ending at first number (but not part of die notation)
  const diePatterns = [
    // d% or d100 at start
    /^(?:1)?d(%|100)\s+/i,
    // d followed by number
    /^(?:1)?d(\d+)\s+/i,
  ]

  let dieType: number | null = null
  let afterDie = text

  // Try to extract die type
  for (const pattern of diePatterns) {
    const match = text.match(pattern)
    if (match) {
      const dieValue = match[1]
      if (dieValue === '%') {
        dieType = 100
      } else {
        dieType = parseInt(dieValue, 10)
      }
      afterDie = text.slice(match[0].length)
      break
    }
  }

  // Now extract table name - everything up to the first number pattern
  // that looks like an entry (standalone number or range like "1-30")
  const entryStartPattern = /(?:^|\s)(\d+(?:-\d+)?)\s/
  const entryMatch = afterDie.match(entryStartPattern)

  let tableName: string
  let remainingText: string

  if (entryMatch && entryMatch.index !== undefined) {
    // Table name is everything before the first entry number
    const nameEndIndex = entryMatch.index
    tableName = afterDie.slice(0, nameEndIndex).trim()
    remainingText = afterDie.slice(nameEndIndex).trim()
  } else {
    // No entry numbers found - the whole thing might be the table name
    // or there might be entries without numbers
    tableName = afterDie.trim()
    remainingText = ''
  }

  // Handle case where table name might be duplicated (multi-column header)
  // e.g., "d100 Weapon d100 Weapon" -> just "Weapon"
  if (dieType && tableName.includes(`d${dieType}`)) {
    // Remove duplicate die notation from name
    tableName = tableName
      .replace(new RegExp(`d${dieType}`, 'gi'), '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // If name has duplicated words at start and middle, dedupe
  // e.g., "Weapon d100 Weapon" already cleaned to "Weapon Weapon"
  const words = tableName.split(/\s+/)
  if (words.length >= 2) {
    const half = Math.floor(words.length / 2)
    const firstHalf = words.slice(0, half).join(' ')
    const secondHalf = words.slice(half, half * 2).join(' ')
    if (firstHalf === secondHalf) {
      tableName = firstHalf
    }
  }

  return {
    dieType,
    tableName: tableName || 'Untitled Table',
    remainingText: remainingText || afterDie,
  }
}

// ============================================================================
// Entry Extraction
// ============================================================================

/**
 * Extract entries from text, handling various formats
 */
function extractEntries(
  text: string,
  _dieType: number | null
): { entries: RawEntry[]; warnings: string[] } {
  const warnings: string[] = []
  const entries: RawEntry[] = []

  // Try range format first (for d100 tables): "1-30 Entry text 31-60 Other entry"
  const rangePattern = /(\d+)-(\d+)\s+/g
  const rangeMatches = [...text.matchAll(rangePattern)]

  if (rangeMatches.length > 0) {
    // Range format detected
    for (let i = 0; i < rangeMatches.length; i++) {
      const match = rangeMatches[i]
      let rangeStart = parseInt(match[1], 10)
      let rangeEnd = parseInt(match[2], 10)

      // Handle "00" as 100
      if (match[2] === '00' || rangeEnd === 0) {
        rangeEnd = 100
      }
      if (match[1] === '00' || rangeStart === 0) {
        // "00" at start position (rare but possible)
        rangeStart = 100
      }

      // Get value text - from end of this match to start of next match (or end)
      const valueStart = match.index! + match[0].length
      const valueEnd =
        i < rangeMatches.length - 1 ? rangeMatches[i + 1].index! : text.length

      const value = text.slice(valueStart, valueEnd).trim()

      if (value) {
        entries.push({ rangeStart, rangeEnd, value })
      }
    }

    // Sort by range start
    entries.sort((a, b) => a.rangeStart - b.rangeStart)

    return { entries, warnings }
  }

  // Try sequential number format: "1 Entry one 2 Entry two 3 Entry three"
  // Match standalone numbers followed by text (letters, quotes, or other starting chars)
  const seqPattern = /(?:^|\s)(\d+)\s+(?=[A-Za-z"'])/g
  const seqMatches = [...text.matchAll(seqPattern)]

  if (seqMatches.length > 0) {
    // Check if numbers are sequential or interleaved (multi-column)
    const numbers = seqMatches.map((m) => parseInt(m[1], 10))
    const isSequential = numbers.every(
      (n, i) => i === 0 || n === numbers[i - 1] + 1
    )

    // Extract entries with their positions
    const rawEntries: { num: number; value: string; index: number }[] = []

    for (let i = 0; i < seqMatches.length; i++) {
      const match = seqMatches[i]
      let num = parseInt(match[1], 10)

      // Handle "00" as 100
      if (match[1] === '00') {
        num = 100
      }

      const valueStart = match.index! + match[0].length
      const valueEnd =
        i < seqMatches.length - 1 ? seqMatches[i + 1].index! : text.length

      const value = text.slice(valueStart, valueEnd).trim()

      if (value) {
        rawEntries.push({ num, value, index: match.index! })
      }
    }

    // If not sequential, try to detect multi-column interleave and reorder
    if (!isSequential && rawEntries.length > 2) {
      warnings.push(
        'Detected non-sequential numbers - attempting to reorder (may be multi-column PDF)'
      )
      // Sort by number to get proper order
      rawEntries.sort((a, b) => a.num - b.num)
    }

    // Convert to RawEntry format with ranges
    for (const entry of rawEntries) {
      entries.push({
        rangeStart: entry.num,
        rangeEnd: entry.num,
        value: entry.value,
      })
    }

    return { entries, warnings }
  }

  // No numbers found - try splitting by sentences/periods
  const sentences = text
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (sentences.length > 1) {
    warnings.push('No numbers detected - splitting by sentences and using equal weights')
    for (let i = 0; i < sentences.length; i++) {
      // For no-number tables, we'll use weight instead of range
      // But we still need rangeStart for ordering, so use index + 1
      entries.push({
        rangeStart: i + 1,
        rangeEnd: i + 1,
        value: sentences[i].replace(/\.$/, '').trim(),
      })
    }
    return { entries, warnings }
  }

  // Last resort: split by newlines or just return the whole thing as one entry
  warnings.push('Could not parse entries - returning text as single entry')
  entries.push({
    rangeStart: 1,
    rangeEnd: 1,
    value: text.trim(),
  })

  return { entries, warnings }
}

// ============================================================================
// Entry Normalization
// ============================================================================

/**
 * Normalize entries and detect issues
 */
function normalizeEntries(
  rawEntries: RawEntry[],
  dieType: number | null
): { entries: Entry[]; warnings: string[] } {
  const warnings: string[] = []
  const entries: Entry[] = []

  // Sort by range start
  const sorted = [...rawEntries].sort((a, b) => a.rangeStart - b.rangeStart)

  // Check for gaps and overlaps
  let lastEnd = 0
  for (const raw of sorted) {
    // Check for gap
    if (raw.rangeStart > lastEnd + 1 && lastEnd > 0) {
      warnings.push(`Gap detected in ranges: ${lastEnd + 1} to ${raw.rangeStart - 1}`)
    }

    // Check for overlap
    if (raw.rangeStart <= lastEnd && lastEnd > 0) {
      warnings.push(
        `Overlapping ranges detected at ${raw.rangeStart} (previous ended at ${lastEnd})`
      )
    }

    lastEnd = raw.rangeEnd
  }

  // Convert to Entry format
  for (const raw of sorted) {
    const entry: Entry = {
      value: raw.value,
    }

    // Use range if it's meaningful (not just sequential 1,1 2,2 etc from no-number parsing)
    if (raw.rangeStart !== raw.rangeEnd || dieType) {
      entry.range = [raw.rangeStart, raw.rangeEnd]
    } else {
      // For non-ranged tables, use weight
      entry.weight = 1
    }

    entries.push(entry)
  }

  return { entries, warnings }
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse raw text into a SimpleTable
 */
export function parseTableText(
  rawText: string,
  options: ParserOptions = {}
): ParsedTableResult {
  const warnings: string[] = []
  const errors: string[] = []

  // Validate input
  if (!rawText || typeof rawText !== 'string') {
    return {
      success: false,
      errors: ['No text provided'],
      warnings: [],
    }
  }

  // Normalize text
  const normalized = normalizeText(rawText)

  if (!normalized) {
    return {
      success: false,
      errors: ['Text is empty after normalization'],
      warnings: [],
    }
  }

  // Parse header
  const header = parseHeader(normalized)

  // Use default name if provided and header name is generic
  const tableName =
    header.tableName === 'Untitled Table' && options.defaultTableName
      ? options.defaultTableName
      : header.tableName

  // Extract entries
  const extractResult = extractEntries(header.remainingText || normalized, header.dieType)
  warnings.push(...extractResult.warnings)

  if (extractResult.entries.length === 0) {
    return {
      success: false,
      errors: ['No entries could be extracted from text'],
      warnings,
    }
  }

  // Normalize entries
  const normalizeResult = normalizeEntries(extractResult.entries, header.dieType)
  warnings.push(...normalizeResult.warnings)

  // Build table
  const table: SimpleTable = {
    id: toCamelCase(tableName),
    name: tableName,
    type: 'simple',
    entries: normalizeResult.entries,
  }

  return {
    success: true,
    table,
    warnings,
    errors,
  }
}
