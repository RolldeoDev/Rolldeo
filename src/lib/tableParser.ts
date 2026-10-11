/**
 * Table Parser - Transforms raw text (copied from PDFs) into SimpleTable JSON
 *
 * Supports:
 * - d6, d20, d100 tables with sequential or range notation
 * - Numbered PDF rows, including interleaved rows with explicit newlines
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
  errors: string[]
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
      // Preserve physical row boundaries; blank lines are harmless.
      .replace(/ *\n */g, '\n')
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
  const lines = text.split('\n').filter(line => line.trim())
  const firstLine = lines[0]
  const dieMatch = firstLine.match(/^(?:1)?d(%|\d+)(?:\s+|$)/i)
  const dieType = dieMatch ? (dieMatch[1] === '%' ? 100 : Number(dieMatch[1])) : null
  const afterDie = dieMatch ? firstLine.slice(dieMatch[0].length).trim() : firstLine
  const rowPattern = /^-?\d+(?:\.\d+)?(?:--?\d+(?:\.\d+)?)?(?:\s+|$)/
  const errors: string[] = []
  let tableName = ''
  let remainingText = text

  if (lines.length > 1) {
    // An explicit die heading or a heading immediately before numbered rows
    // identifies the name. Otherwise every physical line is an unnumbered row.
    if (dieMatch || (!rowPattern.test(firstLine) && rowPattern.test(lines[1]))) {
      tableName = afterDie
      remainingText = lines.slice(1).join('\n')
      // An inline first row in a multiline copy cannot safely be separated
      // from a numeric heading. Ask for explicit boundaries instead.
      if (/(?:^|\s)\d+(?:-\d+)?\s+\S/.test(afterDie)) {
        errors.push('Ambiguous table heading. Add a newline before each actual row and try again; the original input must be preserved.')
      }
    }
  } else {
    // Legacy one-row copies can have their heading and row on the same line.
    const entryMatch = afterDie.match(/(?:^|\s)(-?\d+(?:\.\d+)?(?:--?\d+(?:\.\d+)?)?)(?:\s+|$)/)
    if (entryMatch && entryMatch.index !== undefined) {
      tableName = afterDie.slice(0, entryMatch.index).trim()
      remainingText = afterDie.slice(entryMatch.index).trim()
    } else if (dieMatch) {
      tableName = afterDie
      remainingText = ''
    }
  }

  // Deduplicate repeated multi-column headings without changing entry text.
  if (dieType && tableName.includes(`d${dieType}`)) {
    tableName = tableName.replace(new RegExp(`d${dieType}`, 'gi'), '').replace(/\s+/g, ' ').trim()
  }
  const words = tableName.split(/\s+/)
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2
    if (words.slice(0, half).join(' ') === words.slice(half).join(' ')) {
      tableName = words.slice(0, half).join(' ')
    }
  }

  return { dieType, tableName: tableName || 'Untitled Table', remainingText, errors }
}

// ============================================================================
// Entry Extraction
// ============================================================================

function extractEntries(
  text: string,
  isFlattened: boolean
): { entries: RawEntry[]; warnings: string[]; errors: string[]; numbered: boolean } {
  const warnings: string[] = []
  const errors: string[] = []
  const entries: RawEntry[] = []
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const numberedPattern = /^(-?\d+(?:\.\d+)?)(?:-(-?\d+(?:\.\d+)?))?(?:\s+|$)/
  const numbered = lines.some(line => numberedPattern.test(line))

  if (numbered) {
    for (const line of lines) {
      const match = line.match(numberedPattern)
      if (!match) {
        // PDF line wrapping may continue the previous entry, but can never
        // introduce a new numbered entry in the middle of prose.
        if (entries.length) entries[entries.length - 1].value += ` ${line}`
        else errors.push('Text before the first numbered row could not be parsed. Add a newline before each actual row.')
        continue
      }
      const startToken = match[1]
      const endToken = match[2] ?? startToken
      const rangeStart = startToken === '00' ? 100 : Number(startToken)
      const rangeEnd = endToken === '00' ? 100 : Number(endToken)
      const value = line.slice(match[0].length).trim()
      if (!Number.isSafeInteger(rangeStart) || !Number.isSafeInteger(rangeEnd) || rangeStart < 1 || rangeEnd < rangeStart) {
        errors.push(`Invalid range ${startToken}${match[2] ? `-${endToken}` : ''}: use positive safe integers in ascending order.`)
      }
      // Flat copies cannot distinguish prose quantities from row markers.
      // A numeric value at the very beginning ("1 100 gold") is retained.
      if (isFlattened && /\s\d+(?:-\d+)?\s+\S/.test(value)) {
        errors.push('Ambiguous flattened table text. Add a newline before each actual row and try again; the original input must be preserved.')
      }
      if (value) entries.push({ rangeStart, rangeEnd, value })
      else errors.push(`Entry ${startToken} has no text`)
    }
    if (entries.some((entry, i) => i > 0 && entry.rangeStart < entries[i - 1].rangeStart)) {
      warnings.push('Detected non-sequential numbers - reordering explicit rows (may be multi-column PDF)')
    }
  } else if (lines.length > 1) {
    warnings.push('No numbers detected - using one equal-weight entry per line')
    lines.forEach((value, i) => entries.push({ rangeStart: i + 1, rangeEnd: i + 1, value }))
  } else if (lines.length) {
    const sentences = lines[0].split(/\.\s+/).map(value => value.trim()).filter(Boolean)
    if (sentences.length > 1) {
      warnings.push('No numbers detected - splitting by sentences and using equal weights')
      sentences.forEach((value, i) => entries.push({ rangeStart: i + 1, rangeEnd: i + 1, value: value.replace(/\.$/, '') }))
    } else {
      warnings.push('Could not parse entries - returning text as single entry')
      entries.push({ rangeStart: 1, rangeEnd: 1, value: lines[0] })
    }
  }
  return { entries, warnings, errors, numbered }
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

  const usesRanges = Boolean(dieType) || sorted.some(raw => raw.rangeStart !== raw.rangeEnd)

  // Convert to Entry format
  for (const raw of sorted) {
    const entry: Entry = {
      value: raw.value,
    }

    // Use range if it's meaningful (not just sequential 1,1 2,2 etc from no-number parsing)
    if (usesRanges) {
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
  const extractResult = extractEntries(header.remainingText, !normalized.includes('\n'))
  warnings.push(...extractResult.warnings)
  errors.push(...header.errors, ...extractResult.errors)
  if (header.dieType !== null && (!Number.isSafeInteger(header.dieType) || header.dieType < 1)) {
    errors.push('Invalid die size: use a positive safe integer.')
  }
  if (extractResult.numbered && header.dieType !== null && extractResult.entries.some(entry => entry.rangeEnd > (header.dieType ?? Infinity))) {
    errors.push(`Entry ranges exceed the d${header.dieType} heading.`)
  }
  if (errors.length) return { success: false, warnings, errors }

  if (extractResult.entries.length === 0) {
    return {
      success: false,
      errors: ['No entries could be extracted from text'],
      warnings,
    }
  }

  // Normalize entries
  const normalizeResult = normalizeEntries(extractResult.entries, extractResult.numbered ? header.dieType : null)
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
