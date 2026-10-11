import { useId } from 'react'
import type { Inputs, InputValue } from '@/engine/types'

export interface GeneratorInputsProps {
  inputs: Inputs
  values: Record<string, InputValue>
  errors: Record<string, string>
  onChange: (name: string, value: InputValue | undefined) => void
}

/** Visible controls for the context used by every roller action. */
export function GeneratorInputs({ inputs, values, errors, onChange }: GeneratorInputsProps) {
  const prefix = useId()
  if (!Object.keys(inputs).length) return null
  return <section className="border-b p-4 space-y-3" aria-label="Generator inputs">
    <h2 className="font-medium">Generator inputs</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(inputs).map(([name, definition]) => {
        const value = Object.prototype.hasOwnProperty.call(values, name) ? values[name] : definition.default
        const id = `${prefix}-${name}`
        const describedBy = [definition.description ? `${id}-help` : '', errors[name] ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
        const common = { id, 'aria-invalid': !!errors[name], 'aria-describedby': describedBy, className: 'w-full min-h-11 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' }
        return <div key={name} className="space-y-1">
          <label htmlFor={id} className="block text-sm font-medium">{definition.label || name}{definition.required ? ' (required)' : ''}</label>
          {definition.type === 'choice' || definition.type === 'boolean' ? <select {...common} value={value === undefined ? '' : definition.type === 'choice' ? String(definition.options.indexOf(String(value))) : String(value)} onChange={event => onChange(name, event.target.value === '' ? undefined : definition.type === 'boolean' ? event.target.value === 'true' : definition.options[Number(event.target.value)])}>
            <option value="">Use {definition.default === undefined ? 'no value' : `default (${String(definition.default)})`}</option>
            {(definition.type === 'boolean' ? ['true', 'false'] : definition.options).map((option, index) => <option key={index} value={definition.type === 'choice' ? String(index) : option}>{option === '' ? '(empty text)' : option}</option>)}
          </select> : <input {...common} type={definition.type === 'integer' ? 'number' : 'text'} value={typeof value === 'number' && !Number.isFinite(value) ? '' : value === undefined ? '' : String(value)} min={definition.type === 'integer' ? definition.min : undefined} max={definition.type === 'integer' ? definition.max : undefined} step={definition.type === 'integer' ? 1 : undefined} onChange={event => onChange(name, definition.type === 'integer' ? event.target.value === '' ? undefined : Number(event.target.value) : event.target.value)} />}
          {definition.description && <p id={`${id}-help`} className="text-xs text-muted-foreground">{definition.description}</p>}
          {errors[name] && <p id={`${id}-error`} className="text-sm text-destructive">{errors[name]}</p>}
        </div>
      })}
    </div>
    {!!Object.keys(errors).length && <p role="status" className="text-sm text-muted-foreground">Complete the inputs above before rolling.</p>}
  </section>
}
