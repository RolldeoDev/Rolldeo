/** Literal dice selection: roll the source dice, then look up its total. */
import type { AuthoredSimpleTable, SimpleTable } from '../types'
import { MAX_DICE_COUNT, rollDice, type DiceResult } from '../dice'

export interface SelectionDice {
  expression: string
  count: number
  sides: number
  modifier: number
  min: number
  max: number
}

export interface DiceSelectionIssue {
  type: 'error' | 'warning'
  code: string
  message: string
  entryIndex?: number
  entryId?: string
}

/** Deliberately bounded syntax; template dice support additional operations. */
export function parseSelectionDice(expression: string): SelectionDice {
  if (typeof expression !== 'string' || expression.length > 256) throw new Error('Selection dice must be a string of at most 256 characters')
  const match = expression.replace(/\s/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i)
  if (!match) throw new Error('Selection dice must use NdM with an optional fixed +N or -N modifier')
  const count = Number(match[1] || 1)
  const sides = Number(match[2])
  const modifier = Number(match[3] || 0)
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_DICE_COUNT ||
      !Number.isSafeInteger(sides) || sides < 1 || !Number.isSafeInteger(modifier)) {
    throw new Error(`Selection dice require 1-${MAX_DICE_COUNT} dice, positive safe integer sides and a safe integer modifier`)
  }
  const baseMax = count * sides
  const min = count + modifier
  const max = baseMax + modifier
  if (!Number.isSafeInteger(baseMax) || !Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
    throw new Error('Selection dice outcomes must remain within safe integer limits')
  }
  return { count, sides, modifier, min, max, expression: `${count}d${sides}${modifier ? `${modifier > 0 ? '+' : ''}${modifier}` : ''}` }
}

/** Checks intervals without enumerating outcomes, even for very large dice. */
export function validateDiceSelection(table: AuthoredSimpleTable): DiceSelectionIssue[] {
  if (!table.selection) return []
  const issues: DiceSelectionIssue[] = []
  let dice: SelectionDice
  try {
    if (table.selection.mode !== 'dice') throw new Error('Unknown table selection mode')
    dice = parseSelectionDice(table.selection.dice)
  } catch (error) {
    return [{ type: 'error', code: 'INVALID_DICE_SELECTION', message: String(error instanceof Error ? error.message : error) }]
  }
  const intervals: { min: number; max: number; entryIndex: number }[] = []
  for (let entryIndex = 0; entryIndex < table.entries.length; entryIndex++) {
    const entry = table.entries[entryIndex]
    const issue = (code: string, message: string) => issues.push({ type: 'error', code, message, entryIndex, entryId: entry.id })
    if (entry.weight !== undefined) issue('DICE_WEIGHT_CONFLICT', 'Dice selection entries cannot specify weights')
    if (!entry.range) {
      issue('MISSING_DICE_RANGE', 'Dice selection entries require a literal outcome range')
      continue
    }
    if (!Array.isArray(entry.range) || entry.range.length !== 2) {
      issue('INVALID_DICE_RANGE', 'Dice ranges require exactly two integer endpoints')
      continue
    }
    const [min, max] = entry.range
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max || !Number.isSafeInteger(max - min + 1)) {
      issue('INVALID_DICE_RANGE', 'Dice ranges require ascending safe integer endpoints and inclusive width')
      continue
    }
    if (max < dice.min || min > dice.max) {
      issue('UNREACHABLE_DICE_RANGE', `Range ${min}-${max} cannot be reached by ${dice.expression}`)
      continue
    }
    intervals.push({ min: Math.max(min, dice.min), max: Math.min(max, dice.max), entryIndex })
  }
  intervals.sort((a, b) => a.min - b.min || a.max - b.max)
  let covered: number | undefined
  for (const interval of intervals) {
    const next = covered === undefined ? dice.min : covered + 1
    if (interval.min > next) issues.push({ type: 'error', code: 'DICE_RANGE_GAP', message: `Dice outcomes ${next}-${interval.min - 1} have no entry`, entryIndex: interval.entryIndex })
    if (covered !== undefined && interval.min <= covered) issues.push({ type: 'error', code: 'DICE_RANGE_OVERLAP', message: `Dice outcome ${interval.min} matches more than one entry`, entryIndex: interval.entryIndex })
    covered = Math.max(covered ?? interval.max, interval.max)
  }
  if (covered === undefined || covered < dice.max) issues.push({ type: 'error', code: 'DICE_RANGE_GAP', message: `Dice outcomes ${covered === undefined ? dice.min : covered + 1}-${dice.max} have no entry` })
  return issues
}

export function rollDiceSelection(table: SimpleTable, random?: () => number): { entryIndex: number; dice: DiceResult } {
  const issues = validateDiceSelection(table)
  if (issues.length) throw new Error(`DICE_SELECTION_ERROR: ${issues.map(issue => issue.message).join('; ')}`)
  if (!table.selection) throw new Error('DICE_SELECTION_ERROR: Table has no dice selection declaration')
  const parsed = parseSelectionDice(table.selection.dice)
  const dice = rollDice(parsed.expression, undefined, random)
  const entryIndex = table.entries.findIndex(entry => entry.range && dice.total >= entry.range[0] && dice.total <= entry.range[1])
  if (entryIndex < 0) throw new Error(`DICE_SELECTION_ERROR: No entry for dice total ${dice.total}`)
  return { entryIndex, dice }
}

// Exact distribution uses bounded convolution, not exponential enumeration.
// Limit both memory and work; unavailable charts never revert to range widths.
export const MAX_DICE_PROBABILITY_OUTCOMES = 100_000
export const MAX_DICE_PROBABILITY_WORK = 2_000_000

/** Probabilities in entry order, or null when bounded calculation is unavailable. */
export function getDiceEntryProbabilities(table: SimpleTable): number[] | null {
  if (!table.selection || validateDiceSelection(table).length) return null
  const dice = parseSelectionDice(table.selection.dice)
  if (dice.sides === 1) return table.entries.map(entry => entry.range && dice.min >= entry.range[0] && dice.min <= entry.range[1] ? 1 : 0)
  const width = dice.max - dice.min + 1
  if (width > MAX_DICE_PROBABILITY_OUTCOMES) return null
  if (dice.count === 1) return table.entries.map(entry => {
    const [min, max] = entry.range!
    return (Math.min(max, dice.max) - Math.max(min, dice.min) + 1) / dice.sides
  })
  if (dice.count * width * dice.sides > MAX_DICE_PROBABILITY_WORK) return null
  let distribution = [1]
  for (let rolled = 1; rolled <= dice.count; rolled++) {
    const next = new Array<number>(rolled * (dice.sides - 1) + 1).fill(0)
    for (let index = 0; index < distribution.length; index++) {
      const chance = distribution[index] / dice.sides
      for (let face = 0; face < dice.sides; face++) next[index + face] += chance
    }
    distribution = next
  }
  const probabilities = table.entries.map(entry => {
    const range = entry.range!
    let probability = 0
    for (let total = Math.max(range[0], dice.min); total <= Math.min(range[1], dice.max); total++) probability += distribution[total - dice.min]
    return probability
  })
  // Floating point convolution may accumulate a tiny rounding discrepancy.
  const total = probabilities.reduce((sum, probability) => sum + probability, 0)
  return probabilities.map(probability => probability / total)
}
