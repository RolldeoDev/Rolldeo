/**
 * TraceToggle Component
 *
 * Toggle checkbox for enabling trace mode on rolls.
 */

import { memo } from 'react'
import { Activity } from 'lucide-react'

interface TraceToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
}

export const TraceToggle = memo(function TraceToggle({
  enabled,
  onChange,
  disabled,
}: TraceToggleProps) {
  return (
    <label
      className={`
        flex items-center gap-2 text-sm cursor-pointer select-none
        px-3 py-1.5 rounded-lg border transition-all
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'}
        ${enabled
          ? 'text-primary border-primary/40 bg-primary/10'
          : 'text-muted-foreground border-border/50 hover:border-border'}
      `}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div
        className={`
          relative w-8 h-4 rounded-full transition-colors
          ${enabled ? 'bg-primary' : 'bg-muted-foreground/30'}
          after:content-[''] after:absolute
          after:w-3 after:h-3 after:rounded-full after:bg-white
          after:top-0.5 after:left-0.5 after:transition-transform after:shadow-sm
          ${enabled ? 'after:translate-x-4' : ''}
        `}
      />
      <Activity className="w-4 h-4" />
      <span className="font-medium">Trace</span>
    </label>
  )
})

export default TraceToggle
