/** Literal, collection-scoped inputs for one generation. */
import type { InputDefinition, Inputs, InputValue, LoadedCollection } from '../types'
import type { GenerationContext } from './context'

export class InputError extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super(`INPUT_ERROR: ${Object.entries(errors).map(([name, message]) => `${name}: ${message}`).join('; ')}`)
    this.name = 'InputError'
  }
}

export function inputValueError(definition: InputDefinition, value: unknown): string | undefined {
  switch (definition.type) {
    case 'text': return typeof value === 'string' ? undefined : 'Enter text.'
    case 'boolean': return typeof value === 'boolean' ? undefined : 'Choose true or false.'
    case 'choice': return typeof value === 'string' && definition.options.includes(value) ? undefined : 'Choose one of the listed options.'
    case 'integer':
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) return 'Enter a whole number.'
      if (definition.min !== undefined && value < definition.min) return `Enter ${definition.min} or greater.`
      if (definition.max !== undefined && value > definition.max) return `Enter ${definition.max} or less.`
      return undefined
  }
}

/** No coercion: defaults count as supplied, and absent optional values are reserved empty literals. */
export function resolveInputs(definitions: Inputs = {}, supplied: Record<string, InputValue> = {}): Record<string, InputValue> {
  const errors: Record<string, string> = Object.create(null)
  const values: Record<string, InputValue> = Object.create(null)
  for (const name of Object.keys(supplied)) {
    if (!Object.prototype.hasOwnProperty.call(definitions, name)) errors[name] = 'Unknown input.'
  }
  for (const [name, definition] of Object.entries(definitions)) {
    const suppliedHere = Object.prototype.hasOwnProperty.call(supplied, name)
    const value = suppliedHere ? supplied[name] : definition.default
    if (value === undefined) {
      if (definition.required) errors[name] = 'This input is required.'
      else values[name] = ''
    } else {
      const error = inputValueError(definition, value)
      if (error) errors[name] = error
      else values[name] = value
    }
  }
  if (Object.keys(errors).length) throw new InputError(errors)
  return values
}

/** Imported declarations use only their defaults, never root-supplied values. */
export function ensureCollectionInputs(context: GenerationContext, collection: LoadedCollection): Record<string, InputValue> {
  context.inputValues ??= new Map()
  let values = context.inputValues.get(collection.id)
  if (!values) {
    values = resolveInputs(collection.document.inputs)
    context.inputValues.set(collection.id, values)
  }
  return values
}
