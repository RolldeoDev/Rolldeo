import { rollDice, type DiceResult } from '../dice'
import { consumeWork, type GenerationContext } from './context'
import { addTraceLeaf, type DiceRollMetadata } from './trace'

/** Ordinary expression dice share generation budgets and trace every physical roll. */
export function rollExpressionDice(expression: string, context: GenerationContext): DiceResult {
  const result = rollDice(expression, { maxExplodingDice: context.config.maxExplodingDice }, () => {
    // Charge before invoking the random source, including explosions and discarded dice.
    consumeWork(context)
    return context.random ? context.random() : Math.random()
  })
  const modifierMatch = expression.match(/([+\-*])(\d+)$/)
  const modifier = modifierMatch ? {
    operator: modifierMatch[1] as '+' | '-' | '*', value: Number(modifierMatch[2]),
  } : undefined
  addTraceLeaf(context, 'dice_roll', `Dice: ${expression}`, { raw: expression }, { value: result.total }, {
    type: 'dice', expression: result.expression, rolls: result.rolls, kept: result.kept, modifier,
    exploded: result.rolls.length > Number(expression.match(/^(\d+)d/i)?.[1] ?? 1),
    breakdown: result.breakdown,
  } as DiceRollMetadata)
  return result
}
