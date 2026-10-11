/**
 * VariablesEditor Component
 *
 * Editor for static variables and shared (generation-time) variables.
 */

import { Info } from 'lucide-react'
import { KeyValueEditor } from './KeyValueEditor'
import type { Variables, SharedVariables, Table, Template } from '@/engine/types'
import type { TableInfo, TemplateInfo, ImportedTableInfo, ImportedTemplateInfo } from '@/engine/core'
import type { Suggestion } from '@/hooks/usePatternSuggestions'

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
  /** Suggestions for autocomplete */
  suggestions?: Suggestion[]
  /** Full table data for property lookups */
  tableMap?: Map<string, Table>
  /** Full template data for property lookups */
  templateMap?: Map<string, Template>
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
  suggestions,
  tableMap,
  templateMap,
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
            Use constants for campaign names, separators and fixed settings. Reference with {'{{$name}}'}.
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
                  Variables capture the full roll result including sets, enabling{' '}
                  <code className="px-1 bg-muted rounded">{'{{$hero.@prop}}'}</code>{' '}
                  syntax with dynamic table resolution.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Roll a shared value once per generation to reuse it throughout the result. Access properties with <code className="px-1 bg-muted rounded text-xs">{'{{$name.@prop}}'}</code>.
          </p>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">Shared values evaluate from top to bottom. Put dependencies before the values that reference them. Keep this order when editing JSON; alphabetizing keys can change the result.</p>
          <KeyValueEditor
            value={shared}
            onChange={onSharedChange}
            keyPlaceholder="Variable name"
            valuePlaceholder="Value (supports {{dice:}}, {{math:}}, etc.)"
            keyPattern="^\$?[a-zA-Z_][a-zA-Z0-9_]*$"
            keyError="Must start with optional $, then letter/underscore, alphanumeric only"
            valueSupportsExpressions
            collectionId={collectionId}
            showInsertButton
            localTables={localTables}
            localTemplates={localTemplates}
            importedTables={importedTables}
            importedTemplates={importedTemplates}
            suggestions={suggestions}
            tableMap={tableMap}
            templateMap={templateMap}
            sharedVariables={shared as Record<string, string>}
            previewSharedVariables={shared as Record<string, string>}
          />
        </div>
      </section>
    </div>
  )
}

export default VariablesEditor
