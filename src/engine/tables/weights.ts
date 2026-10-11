/** Range endpoints describe an inclusive width, rather than literal dice outcomes. */
export function getWeight(entry: { weight?: number; range?: [number, number] }): number {
  if (entry.range) {
    const [min, max] = entry.range
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) return 0
    const width = max - min + 1
    return Number.isSafeInteger(width) && width > 0 ? width : 0
  }
  const weight = entry.weight ?? 1
  return Number.isFinite(weight) && weight > 0 ? weight : 0
}

/**
 * A finite total for display and serialization, saturated at Number.MAX_VALUE.
 * Ignore disabled/invalid weights as the selectors do. This total must not be
 * used to derive probabilities; normalized probabilities retain relative weights
 * even when the mathematical sum exceeds JavaScript's finite numeric range.
 */
export function getFiniteWeightTotal<T extends { weight: number }>(pool: T[]): number {
  return pool.reduce((sum, { weight }) => Number.isFinite(weight) && weight > 0
    ? Math.min(sum + weight, Number.MAX_VALUE)
    : sum, 0)
}

/** Normalize before summing, so even several Number.MAX_VALUE weights remain usable. */
export function getNormalizedProbabilities<T extends { weight: number }>(pool: T[]): number[] {
  let maximum = 0
  for (const item of pool) {
    if (Number.isFinite(item.weight) && item.weight > maximum) maximum = item.weight
  }
  if (maximum === 0) return pool.map(() => 0)
  const scaled = pool.map(({ weight }) => Number.isFinite(weight) && weight > 0 ? weight / maximum : 0)
  const total = scaled.reduce((sum, weight) => sum + weight, 0)
  return scaled.map((weight) => weight / total)
}

/** A supplied random source must obey the same [0, 1) contract as Math.random. */
export function randomUnit(random: () => number = Math.random): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('Random source must return a finite value in [0, 1)')
  }
  return value
}

export function selectWeighted<T extends { weight: number }>(
  pool: T[], random: () => number = Math.random
): T | null {
  const probabilities = getNormalizedProbabilities(pool)
  if (!probabilities.some((weight) => weight > 0)) return null
  const roll = randomUnit(random)
  let cumulative = 0
  let last: T | null = null
  for (let i = 0; i < pool.length; i++) {
    if (probabilities[i] === 0) continue
    last = pool[i]
    cumulative += probabilities[i]
    if (roll < cumulative) return pool[i]
  }
  return last // Rounding at the end of the unit interval.
}
