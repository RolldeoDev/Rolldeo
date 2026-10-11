import { useEffect, useId, useState, type ReactNode } from 'react'

/** Keep configured settings discoverable while leaving basic authoring uncluttered. */
export function AdvancedSettings({
  children,
  configured = [],
  hasError = false,
}: {
  children: ReactNode
  configured?: string[]
  hasError?: boolean
}) {
  const [isOpen, setIsOpen] = useState(configured.length > 0 || hasError)
  return (
    <details className="editor-collapsible" open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>
        <span className="font-medium text-sm">Advanced settings</span>
        <span className="text-xs text-muted-foreground ml-2">
          {configured.length > 0 ? `Configured: ${configured.join(', ')}` : 'Optional: IDs, properties and reusable values'}
        </span>
        {hasError && <span className="text-xs text-destructive ml-2">Needs attention</span>}
      </summary>
      <div className="editor-collapsible-content space-y-4">{children}</div>
    </details>
  )
}

/** Commit a complete list on blur, rather than deleting a separator while typing. */
export function TagsField({ value, onChange }: { value?: string[]; onChange: (value: string[] | undefined) => void }) {
  const id = useId()
  const [draft, setDraft] = useState(value?.join(', ') || '')
  useEffect(() => setDraft(value?.join(', ') || ''), [value])
  const commit = () => {
    const tags = [...new Set(draft.split(',').map(tag => tag.trim()).filter(Boolean))]
    onChange(tags.length ? tags : undefined)
  }
  return (
    <div>
      <label htmlFor={id} className="editor-label">Tags (comma separated)</label>
      <input id={id} className="editor-input" type="text" value={draft}
        onChange={event => setDraft(event.target.value)} onBlur={commit}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit() } }} />
    </div>
  )
}
