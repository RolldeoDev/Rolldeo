import type { ValidationError } from './JsonEditor'

/**
 * Formats JSON with proper indentation
 */
export function formatJson(json: string): string {
  try {
    const parsed = JSON.parse(json)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return json
  }
}

/**
 * Validates JSON and returns any parse errors
 */
export function validateJsonSyntax(json: string): ValidationError | null {
  try {
    JSON.parse(json)
    return null
  } catch (e) {
    if (e instanceof SyntaxError) {
      // Try to extract line/column from error message
      const match = e.message.match(/position (\d+)/)
      const position = match ? parseInt(match[1], 10) : 0

      // Calculate line and column from position
      const lines = json.substring(0, position).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      return {
        line,
        column,
        message: e.message,
        severity: 'error',
      }
    }
    return {
      line: 1,
      column: 1,
      message: 'Invalid JSON',
      severity: 'error',
    }
  }
}
