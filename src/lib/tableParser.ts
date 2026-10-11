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
import { analyzeConversion } from './conversionVerification'
import { parseSelectionDice } from '../engine/tables/diceSelection'

// ============================================================================
// Types
// ============================================================================

export interface ParsedTableResult {
  success: boolean
  table?: SimpleTable
  warnings: string[]
  errors: string[]
  /** Original input, including whitespace and PDF artifacts, even when parsing fails. */
  sourceText?: string
}

export interface ParserOptions {
  defaultTableName?: string
}

interface HeaderInfo {
  dieType: number | null
  dice: string | null
  domainStart: number | null
  tableName: string
  remainingText: string
  errors: string[]
  warnings: string[]
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
  const dieMatch = firstLine.match(/^(\d*)d(%|\d+)(?:\s*([+-])\s*(\d+))?(?=\s|$)/i)
  const count = dieMatch ? Number(dieMatch[1] || 1) : 0
  const sides = dieMatch ? (dieMatch[2] === '%' ? 100 : Number(dieMatch[2])) : 0
  const modifier = dieMatch?.[3] ? Number(`${dieMatch[3]}${dieMatch[4]}`) : 0
  const dieType = dieMatch ? count * sides + modifier : null
  const domainStart = dieMatch ? count + modifier : null
  const dice = dieMatch ? `${count}d${sides}${modifier ? (modifier > 0 ? '+' : '') + modifier : ''}` : null
  const afterDie = dieMatch ? firstLine.slice(dieMatch[0].length).trim() : firstLine
  const rowPattern = /^-?\d+(?:\.\d+)?(?:--?\d+(?:\.\d+)?)?(?:\s+|$)/
  const errors: string[] = []
  const warnings: string[] = []
  if (dieMatch && /\b(?:roll again|reroll|re-roll|roll twice|roll two|advantage|disadvantage|take (?:the )?(?:highest|lowest)|keep (?:the )?(?:highest|lowest)|add \d+|subtract \d+)\b/i.test(afterDie)) {
    warnings.push('Source procedure detected in the heading; the declared dice do not execute these instructions. Review and adapt explicitly.')
  }
  if (/^\d*d(?:%|\d+|F\b)/i.test(firstLine) && !dieMatch) errors.push('Unsupported dice heading. Only NdM with a fixed integer modifier is supported; review and adapt the source explicitly.')
  if (dice) {
    try { parseSelectionDice(dice) } catch (error) { errors.push(String(error instanceof Error ? error.message : error)) }
  }
  if (dieMatch && /^(?:!|k[hl]\d|d[hl]\d|r[<>=]|advantage\b|disadvantage\b|x\s*\d|\*|[+-])/i.test(afterDie)) errors.push('Unsupported dice construct in heading. Review and adapt the source explicitly.')
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
      if (/(?:^|\s)\d+(?:-\d+)?\s+\S/.test(afterDie) && !/^\d*d(?:%|\d+)\s+/i.test(afterDie)) {
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

  return { dieType, dice, domainStart, tableName: tableName || 'Untitled Table', remainingText, errors, warnings }
}

// ============================================================================
// Entry Extraction
// ============================================================================

function extractEntries(
  text: string,
  isFlattened: boolean,
  domain: [number, number] | null
): { entries: RawEntry[]; warnings: string[]; errors: string[]; numbered: boolean } {
  const warnings: string[] = []
  const errors: string[] = []
  const entries: RawEntry[] = []
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const numberedPattern = /^(-?\d+(?:\.\d+)?)(?:-(-?\d+(?:\.\d+)?))?(?:\s+(or less|or more))?(?:\s+|$)/i
  const numbered = lines.some(line => numberedPattern.test(line))

  if (numbered) {
    for (const line of lines) {
      const match = line.match(numberedPattern)
      if (!match) {
        // PDF line wrapping may continue the previous entry, but can never
        // introduce a new numbered entry in the middle of prose.
        if (entries.length) {
          entries[entries.length - 1].value += ` ${line}`
          warnings.push('Wrapped or unnumbered text was joined to the preceding row. Check that it is continuation prose, not instructions or another column.')
          if (/\b(?:roll again|reroll|re-roll|roll twice|add \d+|subtract \d+)\b/i.test(line)) warnings.push('Source procedure detected in wrapped text; plain text does not execute it. Review and adapt explicitly.')
        }
        else errors.push('Text before the first numbered row could not be parsed. Add a newline before each actual row.')
        continue
      }
      const startToken = match[1]
      const endToken = match[2] ?? startToken
      let rangeStart = startToken === '00' ? 100 : Number(startToken)
      let rangeEnd = endToken === '00' ? 100 : Number(endToken)
      if (match[3]) {
        if (!domain || match[2] || rangeStart < domain[0] || rangeEnd > domain[1]) errors.push('Open-ended results require a known finite dice domain. Review the source instructions.')
        else if (match[3].toLowerCase() === 'or less') rangeStart = domain[0]
        else rangeEnd = domain[1]
        warnings.push('Translated an open-ended range using the fixed dice domain; check source modifiers and instructions.')
      }
      const value = line.slice(match[0].length).trim()
      if (!Number.isSafeInteger(rangeStart) || !Number.isSafeInteger(rangeEnd) || (!domain && rangeStart < 1) || rangeEnd < rangeStart) {
        errors.push(`Invalid range ${startToken}${match[2] ? `-${endToken}` : ''}: use safe integer endpoints in ascending order (positive without a dice heading).`)
      }
      // Flat copies cannot distinguish prose quantities from row markers.
      // A numeric value at the very beginning ("1 100 gold") is retained.
      if (isFlattened && /\s\d+(?:-\d+)?\s+\S/.test(value)) {
        errors.push('Ambiguous flattened table text. Add a newline before each actual row and try again; the original input must be preserved.')
      }
      if (!isFlattened && /(?:\t|\s{2,})/.test(line)) warnings.push('Possible merged columns; compare the parsed text with the source.')
      if (!isFlattened && /\s\d+(?:-\d+)?\s+\S/.test(value)) warnings.push('Numbers inside a row may be prose quantities or merged column markers; compare this row with the source.')
      if (!isFlattened && /^\d+(?:-\d+)?\s+/.test(value)) warnings.push('A numbered row begins with another number; verify that this is prose, not a merged column or wrapped continuation.')
      if (/\b(?:roll again|reroll|re-roll|roll twice|roll two|add \d+|subtract \d+)\b/i.test(value)) warnings.push('Source procedure detected in an outcome; plain text does not execute these instructions. Review and adapt explicitly.')
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
    warnings.push('No numbers detected - returning the entire text as one entry. Separate actual outcomes with newlines; prose sentences are not trusted row boundaries.')
    entries.push({ rangeStart: 1, rangeEnd: 1, value: lines[0] })
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

  const usesRanges = dieType !== null || sorted.some(raw => raw.rangeStart !== raw.rangeEnd)

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
      sourceText: typeof rawText === 'string' ? rawText : undefined,
    }
  }

  // Normalize text
  const normalized = normalizeText(rawText)

  if (!normalized) {
    return {
      success: false,
      errors: ['Text is empty after normalization'],
      warnings: [],
      sourceText: typeof rawText === 'string' ? rawText : undefined,
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
  const domain: [number, number] | null = header.domainStart !== null && header.dieType !== null ? [header.domainStart, header.dieType] : null
  const extractResult = extractEntries(header.remainingText, !normalized.includes('\n'), domain)
  warnings.push(...header.warnings, ...extractResult.warnings)
  errors.push(...header.errors, ...extractResult.errors)
  if (header.dieType !== null && (!Number.isSafeInteger(header.dieType) || !Number.isSafeInteger(header.domainStart))) {
    errors.push('Invalid die size: use a positive safe integer.')
  }
  if (extractResult.numbered && header.dieType !== null && extractResult.entries.some(entry => entry.rangeEnd > (header.dieType ?? Infinity) || entry.rangeStart < (header.domainStart ?? 1))) {
    errors.push(`Entry ranges exceed the ${header.dice} heading domain ${header.domainStart}–${header.dieType}.`)
  }
  if (errors.length) return { success: false, warnings, errors, sourceText: rawText }

  if (extractResult.entries.length === 0) {
    return {
      success: false,
      sourceText: rawText,
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
    ...(header.dice && extractResult.numbered ? { selection: { mode: 'dice' as const, dice: header.dice } } : {}),
    conversion: { kind: 'transcription', sourceText: rawText },
  }

  if (header.dice && !extractResult.numbered) warnings.push('Dice heading found without numbered results: equal weights are an unverified adaptation, not preserved dice mechanics.')
  warnings.push(...analyzeConversion(table).issues)
  if (!header.dice && extractResult.numbered) warnings.push('No dice heading detected. Range widths or equal weights are provisional; verify the source roll mechanic.')
  if (/\t| {3,}\S/.test(rawText)) warnings.push('Column spacing detected in the original copy. Check for merged columns against the source.')

  return {
    success: true,
    sourceText: rawText,
    table,
    warnings,
    errors,
  }
}
