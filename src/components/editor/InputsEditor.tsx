import { useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { InputDefinition, Inputs } from '@/engine/types'

export interface InputsEditorProps { inputs: Inputs; onChange: (inputs: Inputs) => void }
const field = 'w-full min-h-11 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Declarations for user-editable generator context; expressions stay in variables. */
export function InputsEditor({ inputs, onChange }: InputsEditorProps) {
  const [newName, setNewName] = useState('')
  const prefix = useId()
  const nameError = newName && (!/^[A-Za-z][A-Za-z0-9_]*$/.test(newName) ? 'Start with a letter; use letters, numbers and underscores.' : Object.prototype.hasOwnProperty.call(inputs, newName) ? 'This input already exists.' : '')
  const update = (name: string, definition: InputDefinition) => onChange({ ...inputs, [name]: definition })
  return <section className="border rounded-lg">
    <div className="p-4 border-b bg-muted/30"><h3 className="font-medium">Generator Inputs</h3><p className="text-sm text-muted-foreground mt-1">Ask for terrain, level or other context before rolling. Reference inputs with {'{{$name}}'}. Input text is always literal.</p></div>
    <div className="p-4 space-y-4">
      {Object.entries(inputs).map(([name, definition]) => <fieldset key={name} className="rounded-md border p-3 space-y-3">
        <legend className="px-1 font-medium text-sm">{name}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Label<input className={field} value={definition.label ?? ''} onChange={event => update(name, { ...definition, label: event.target.value || undefined })} /></label>
          <label className="space-y-1 text-sm">Type<select className={field} value={definition.type} onChange={event => {
            const type = event.target.value as InputDefinition['type']
            const base = { label: definition.label, description: definition.description, required: definition.required }
            update(name, type === 'choice' ? { ...base, type, options: ['Option'] } : { ...base, type } as InputDefinition)
          }}><option value="text">Text</option><option value="integer">Whole number</option><option value="choice">Choice</option><option value="boolean">True / false</option></select></label>
        </div>
        <label className="block space-y-1 text-sm">Description<input className={field} value={definition.description ?? ''} onChange={event => update(name, { ...definition, description: event.target.value || undefined })} /></label>
        {definition.type === 'choice' && <label className="block space-y-1 text-sm">Choices (one per line)<textarea className={field} rows={3} value={definition.options.join('\n')} onChange={event => update(name, { ...definition, options: event.target.value.split('\n') })} /></label>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Default (optional)
            {definition.type === 'boolean' || definition.type === 'choice' ? <select className={field} value={definition.default === undefined ? '' : definition.type === 'choice' ? String(definition.options.indexOf(definition.default)) : String(definition.default)} onChange={event => update(name, { ...definition, default: event.target.value === '' ? undefined : definition.type === 'boolean' ? event.target.value === 'true' : definition.options[Number(event.target.value)] } as InputDefinition)}><option value="">No default</option>{(definition.type === 'boolean' ? ['true', 'false'] : definition.options).map((option, index) => <option key={index} value={definition.type === 'choice' ? String(index) : option}>{option === '' ? '(empty text)' : option}</option>)}</select> : <input className={field} type={definition.type === 'integer' ? 'number' : 'text'} step={1} value={definition.default ?? ''} onChange={event => update(name, { ...definition, default: event.target.value === '' ? undefined : definition.type === 'integer' ? Number(event.target.value) : event.target.value } as InputDefinition)} />}
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={definition.required ?? false} onChange={event => update(name, { ...definition, required: event.target.checked })} />Required</label>
        </div>
        {definition.type === 'integer' && <div className="grid gap-3 sm:grid-cols-2">{(['min', 'max'] as const).map(bound => <label key={bound} className="space-y-1 text-sm">{bound === 'min' ? 'Minimum' : 'Maximum'}<input className={field} type="number" step={1} value={definition[bound] ?? ''} onChange={event => update(name, { ...definition, [bound]: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>)}</div>}
        <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm text-destructive" onClick={() => { const remaining = { ...inputs }; delete remaining[name]; onChange(remaining) }}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete {name}</button>
      </fieldset>)}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-40"><label htmlFor={`${prefix}-new`} className="block text-sm font-medium mb-1">New input name</label><input id={`${prefix}-new`} className={field} value={newName} onChange={event => setNewName(event.target.value)} aria-invalid={!!nameError} aria-describedby={nameError ? `${prefix}-error` : undefined} />{nameError && <p id={`${prefix}-error`} className="text-sm text-destructive mt-1">{nameError}</p>}</div>
        <button type="button" disabled={!newName || !!nameError} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm disabled:opacity-50" onClick={() => { onChange({ ...inputs, [newName]: { type: 'text' } }); setNewName('') }}><Plus className="h-4 w-4" aria-hidden="true" />Add input</button>
      </div>
    </div>
  </section>
}
