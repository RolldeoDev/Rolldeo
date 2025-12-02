/**
 * VariablesEditor Component
 *
 * Editor for static variables and shared (generation-time) variables.
 */

import { Info } from 'lucide-react'
import { KeyValueEditor } from './KeyValueEditor'
import type { Variables, SharedVariables } from '@/engine/types'
import type { TableInfo, TemplateInfo, ImportedTableInfo, ImportedTemplateInfo } from '@/engine/core'

export interface VariablesEditorProps {
  /** Static variables (evaluated at load time) */
  variables: Variables
  /** Shared variables (evaluated at generation time) */
  shared: SharedVariables
  /** Called when variables change */
  onVariablesChange: (variables: Variables) => void
  /** Called when shared variables change */
  onSharedChange: (shared: SharedVariables) => void
  /** Collection ID for expression preview */
  collectionId?: string
  /** Local tables for insert dropdown */
  localTables?: TableInfo[]
  /** Local templates for insert dropdown */
  localTemplates?: TemplateInfo[]
  /** Imported tables for insert dropdown */
  importedTables?: ImportedTableInfo[]
  /** Imported templates for insert dropdown */
  importedTemplates?: ImportedTemplateInfo[]
}

export function VariablesEditor({
  variables,
  shared,
  onVariablesChange,
  onSharedChange,
  collectionId,
  localTables,
  localTemplates,
  importedTables,
  importedTemplates,
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
              <div className="absolute left-0 top-6 z-10 hidden group-hover:block w-72 p-2 text-xs bg-popover border rounded-md shadow-lg">
                <p className="mb-2">
                  Shared variables are evaluated once at the start of each
                  generation and remain constant for that run.
                </p>
                <p className="mb-2">
                  <strong>Capture-aware:</strong> Keys starting with{' '}
                  <code className="px-1 bg-muted rounded">$</code> (e.g., "$hero")
                  capture the full roll including sets, allowing{' '}
                  <code className="px-1 bg-muted rounded">{'{{$hero.@prop}}'}</code>{' '}
                  syntax with dynamic table resolution.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Evaluated once per generation. Use <code className="px-1 bg-muted rounded text-xs">$</code> prefix to capture sets.
          </p>
        </div>
        <div className="p-4">
          <KeyValueEditor
            value={shared}
            onChange={onSharedChange}
            keyPlaceholder="Variable name (use $ prefix to capture sets)"
            valuePlaceholder="Value (supports {{dice:}}, {{math:}}, etc.)"
            keyPattern="^\$?[a-zA-Z_][a-zA-Z0-9_]*$"
            keyError="Must start with optional $, then letter/underscore, alphanumeric only"
            valueSupportsExpressions
            collectionId={collectionId}
            highlightCaptureAware
            showInsertButton
            localTables={localTables}
            localTemplates={localTemplates}
            importedTables={importedTables}
            importedTemplates={importedTemplates}
          />
        </div>
      </section>
    </div>
  )
}

export default VariablesEditor
