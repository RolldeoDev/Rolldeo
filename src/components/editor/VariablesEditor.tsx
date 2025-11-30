/**
 * VariablesEditor Component
 *
 * Editor for static variables and shared (generation-time) variables.
 */

import { Info } from 'lucide-react'
import { KeyValueEditor } from './KeyValueEditor'
import type { Variables, SharedVariables } from '@/engine/types'

export interface VariablesEditorProps {
  /** Static variables (evaluated at load time) */
  variables: Variables
  /** Shared variables (evaluated at generation time) */
  shared: SharedVariables
  /** Called when variables change */
  onVariablesChange: (variables: Variables) => void
  /** Called when shared variables change */
  onSharedChange: (shared: SharedVariables) => void
}

export function VariablesEditor({
  variables,
  shared,
  onVariablesChange,
  onSharedChange,
}: VariablesEditorProps) {
  return (
    <div className="space-y-6">
      {/* Static Variables */}
      <section className="border rounded-lg">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Static Variables</h3>
            <div className="group relative">
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              <div className="absolute left-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs bg-popover border rounded-md shadow-lg">
                Static variables are evaluated once when the collection is
                loaded. Use them for constants like settings, separators, or
                campaign-specific values. Reference with {'{{$variableName}}'}.
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Constants loaded at initialization. Reference with {'{{$name}}'}.
          </p>
        </div>
        <div className="p-4">
          <KeyValueEditor
            value={variables}
            onChange={onVariablesChange}
            keyPlaceholder="Variable name"
            valuePlaceholder="Value (text only)"
            keyPattern="^[a-zA-Z_][a-zA-Z0-9_]*$"
            keyError="Must start with letter/underscore, alphanumeric only"
          />
        </div>
      </section>

      {/* Shared Variables */}
      <section className="border rounded-lg">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Shared Variables</h3>
            <div className="group relative">
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              <div className="absolute left-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs bg-popover border rounded-md shadow-lg">
                Shared variables are evaluated once at the start of each
                generation and remain constant for that run. Great for rolling
                shared values that multiple tables reference. Cannot forward-reference
                other shared variables.
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Evaluated once per generation. Supports dice and expressions.
          </p>
        </div>
        <div className="p-4">
          <KeyValueEditor
            value={shared}
            onChange={onSharedChange}
            keyPlaceholder="Variable name"
            valuePlaceholder="Value (supports {{dice:}}, {{math:}}, etc.)"
            keyPattern="^[a-zA-Z_][a-zA-Z0-9_]*$"
            keyError="Must start with letter/underscore, alphanumeric only"
            valueSupportsExpressions
          />
        </div>
      </section>
    </div>
  )
}

export default VariablesEditor
