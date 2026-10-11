/**
 * Condition Expression Evaluation
 *
 * Implements condition expression parsing and evaluation for switch expressions.
 * Supports comparison operators and logical operators.
 */

import { RE2JS, RE2JSSyntaxException } from 're2js'
import type { GenerationContext } from './context'
import { resolveVariable, getPlaceholder, getSharedVariable, consumeWork } from './context'

// ============================================================================
// Types
// ============================================================================

const MAX_REGEX_PATTERN_LENGTH = 1024
const MAX_REGEX_INPUT_LENGTH = 100000

export type ConditionReferenceResolver = (ref: string) => string | number | undefined

type ComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'matches'

// ============================================================================
// Expression Parsing
// ============================================================================

type ConditionOperator = ComparisonOperator | '&&' | '||' | '!' | '(' | ')'
type ConditionToken =
  | { kind: 'value'; value: string; quoted: boolean; interpolated?: boolean }
  | { kind: 'operator'; value: ConditionOperator }

class ConditionSyntaxError extends Error {}

/** Keep quoted literals distinct from references, numbers, and operators. */
function tokenize(expr: string): ConditionToken[] {
  const tokens: ConditionToken[] = []
  let i = 0

  while (i < expr.length) {
    const char = expr[i]
    if (/\s/.test(char)) {
      i++
      continue
    }

    if (char === '"' || char === "'") {
      const quote = char
      let value = ''
      let closed = false
      i++
      while (i < expr.length) {
        const next = expr[i++]
        if (next === quote) {
          closed = true
          break
        }
        // Preserve other backslashes, including regular expression escapes.
        if (next === '\\' && (expr[i] === quote || expr[i] === '\\')) {
          value += expr[i++]
        } else {
          value += next
        }
      }
      if (!closed) throw new ConditionSyntaxError('Unterminated quoted literal')
      tokens.push({ kind: 'value', value, quoted: true })
      continue
    }

    const pair = expr.slice(i, i + 2)
    if (['&&', '||', '==', '!=', '>=', '<='].includes(pair)) {
      tokens.push({ kind: 'operator', value: pair as ConditionOperator })
      i += 2
      continue
    }
    if (['!', '>', '<', '(', ')'].includes(char)) {
      tokens.push({ kind: 'operator', value: char as ConditionOperator })
      i++
      continue
    }
    if (['=', '&', '|'].includes(char)) {
      throw new ConditionSyntaxError(`Invalid operator: ${char}`)
    }

    const start = i
    while (i < expr.length && !/[\s"'()!<>=&|]/.test(expr[i])) i++
    const value = expr.slice(start, i)
    if (value === 'contains' || value === 'matches') {
      tokens.push({ kind: 'operator', value })
    } else {
      tokens.push({ kind: 'value', value, quoted: false })
    }
  }
  return tokens
}

// ============================================================================
// Value Resolution
// ============================================================================

/**
 * Resolve a value reference from the context
 * Handles @placeholder.property, $variable, and $var.@property syntax
 */
function resolveValue(
  ref: string,
  context: GenerationContext
): string | number | undefined {
  if (ref.startsWith('@')) {
    // Placeholder: @name or @name.property
    const parts = ref.slice(1).split('.')
    const name = parts[0]
    const property = parts[1]
    return getPlaceholder(context, name, property)
  } else if (ref.startsWith('$')) {
    // Check for shared variable with property access: $var.@property
    const propMatch = ref.match(/^\$([a-zA-Z_][a-zA-Z0-9_]*)\.@([a-zA-Z_][a-zA-Z0-9_]*)$/)
    if (propMatch) {
      const varName = propMatch[1]
      const propName = propMatch[2]
      const captureShared = getSharedVariable(context, varName)
      if (captureShared) {
        // Access the property from the captured sets
        const propValue = captureShared.sets[propName]
        if (propValue !== undefined) {
          // Handle nested CaptureItem (when set value was a table reference)
          if (typeof propValue === 'object' && 'value' in propValue) {
            return propValue.value
          }
          return propValue
        }
        return undefined
      }
    }
    // Regular variable: $name
    const name = ref.slice(1)
    return resolveVariable(context, name)
  } else {
    // Literal value - try to parse as number
    const num = Number(ref)
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(ref) && Number.isFinite(num)) {
      return num
    }
    return ref
  }
}

// ============================================================================
// Comparison Evaluation
// ============================================================================

function compare(
  left: string | number | undefined,
  operator: ComparisonOperator,
  right: string | number | undefined,
  context: GenerationContext,
): boolean {
  // Handle undefined
  if (left === undefined) left = ''
  if (right === undefined) right = ''

  switch (operator) {
    case '==':
      return String(left) === String(right)

    case '!=':
      return String(left) !== String(right)

    case '>':
      return Number(left) > Number(right)

    case '<':
      return Number(left) < Number(right)

    case '>=':
      return Number(left) >= Number(right)

    case '<=':
      return Number(left) <= Number(right)

    case 'contains':
      return String(left).toLowerCase().includes(String(right).toLowerCase())

    case 'matches': {
      const pattern = String(right)
      const input = String(left)
      if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
        throw new Error(`Condition regex pattern limit exceeded (${MAX_REGEX_PATTERN_LENGTH})`)
      }
      if (input.length > MAX_REGEX_INPUT_LENGTH) {
        throw new Error(`Condition regex input limit exceeded (${MAX_REGEX_INPUT_LENGTH})`)
      }
      // RE2 avoids exponential backtracking. Charge parsing/search work to the
      // generation's shared budget before compiling, outside the syntax catch.
      consumeWork(context, Math.max(1, Math.ceil((pattern.length + input.length) / 128)))
      try {
        return RE2JS.compile(pattern, RE2JS.CASE_INSENSITIVE).matcher(input).find()
      } catch (error) {
        if (error instanceof RE2JSSyntaxException) return false
        throw error
      }
    }

    default:
      return false
  }
}

// ============================================================================
// Expression Evaluation
// ============================================================================

/**
 * Evaluate a when-clause expression (used by switch expressions)
 */
export function evaluateWhenClause(
  when: string,
  context: GenerationContext,
  resolveReference?: ConditionReferenceResolver,
  interpolations?: ReadonlyMap<string, string>,
): boolean {
  try {
    const tokens = tokenize(when)
    // Tokenize authored syntax first. Insert evaluated operands as data so their
    // quotes, operators, and reference-like text cannot change the expression.
    for (const token of tokens) {
      if (token.kind !== 'value') continue
      for (const [marker, value] of interpolations ?? []) {
        if (token.value.includes(marker)) {
          token.value = token.value.split(marker).join(value)
          token.interpolated = true
        }
      }
    }
    if (tokens.length === 0) return false
    return new ConditionParser(tokens, context, resolveReference).parse()
  } catch (error) {
    // Conditions have historically returned false for malformed syntax.
    if (error instanceof ConditionSyntaxError) return false
    throw error
  }
}

/** Comparisons/values form atoms; NOT > AND > OR, with explicit grouping. */
class ConditionParser {
  private position = 0

  constructor(
    private readonly tokens: ConditionToken[],
    private readonly context: GenerationContext,
    private readonly resolveReference?: ConditionReferenceResolver,
  ) {}

  parse(): boolean {
    const result = this.parseOr()
    if (this.position !== this.tokens.length) {
      throw new ConditionSyntaxError('Unexpected trailing condition tokens')
    }
    return result
  }

  private consume(operator: ConditionOperator): boolean {
    const token = this.tokens[this.position]
    if (token?.kind !== 'operator' || token.value !== operator) return false
    this.position++
    return true
  }

  private parseOr(): boolean {
    let result = this.parseAnd()
    while (this.consume('||')) {
      // Always parse the right side, even when the left determines the result.
      const right = this.parseAnd()
      result = result || right
    }
    return result
  }

  private parseAnd(): boolean {
    let result = this.parseUnary()
    while (this.consume('&&')) {
      const right = this.parseUnary()
      result = result && right
    }
    return result
  }

  private parseUnary(): boolean {
    let negate = false
    while (this.consume('!')) negate = !negate
    const result = this.parseAtom()
    return negate ? !result : result
  }

  private parseAtom(): boolean {
    if (this.consume('(')) {
      const result = this.parseOr()
      if (!this.consume(')')) throw new ConditionSyntaxError('Missing closing parenthesis')
      return result
    }

    const left = this.readValue()
    const operator = this.tokens[this.position]
    if (operator?.kind !== 'operator' || !this.isComparison(operator.value)) {
      return Boolean(this.resolve(left))
    }
    this.position++
    const right = this.readValue()

    // Retain the original API's support for an unquoted multiword RHS.
    // A single quoted token is always resolved as a literal, including "".
    const words = [right.value]
    while (this.tokens[this.position]?.kind === 'value') {
      words.push(this.readValue().value)
    }
    const rightValue = words.length === 1 ? this.resolve(right) : words.join(' ')
    return compare(this.resolve(left), operator.value, rightValue, this.context)
  }

  private readValue(): Extract<ConditionToken, { kind: 'value' }> {
    const token = this.tokens[this.position]
    if (token?.kind !== 'value') throw new ConditionSyntaxError('Expected condition value')
    this.position++
    return token
  }

  private resolve(token: Extract<ConditionToken, { kind: 'value' }>): string | number | undefined {
    if (token.quoted) return token.value
    if (token.interpolated) {
      const number = Number(token.value)
      return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token.value) && Number.isFinite(number)
        ? number : token.value
    }
    if (this.resolveReference && (token.value.startsWith('$') || token.value.startsWith('@'))) {
      return this.resolveReference(token.value)
    }
    return resolveValue(token.value, this.context)
  }

  private isComparison(operator: ConditionOperator): operator is ComparisonOperator {
    return ['==', '!=', '>', '<', '>=', '<=', 'contains', 'matches'].includes(operator)
  }
}
