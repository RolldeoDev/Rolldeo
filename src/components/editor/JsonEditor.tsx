/**
 * JsonEditor Component
 *
 * A Monaco-based JSON editor with schema validation for Random Table Spec v1.0.
 * Provides syntax highlighting, error markers, and auto-completion.
 */

import { jsonDefaults } from '@/lib/monaco'
import { useRef, useCallback, useEffect, useState } from 'react'
import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import type { editor, MarkerSeverity } from 'monaco-editor'
import { useUIStore } from '@/stores/uiStore'
import { Loader2 } from 'lucide-react'

interface MonacoMarker {
  startLineNumber: number
  startColumn: number
  message: string
  severity: typeof MarkerSeverity[keyof typeof MarkerSeverity]
}

// Import the JSON schema
import schema from '@/../public/schemas/random-table-spec-v1.0.json'

export interface JsonEditorProps {
  /** The JSON content as a string */
  value: string
  /** Called when the content changes */
  onChange: (value: string) => void
  /** Called when validation errors change */
  onValidationChange?: (errors: ValidationError[]) => void
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** Optional height (default: 500px) */
  height?: string | number
  /** Optional filename for display */
  filename?: string
}

export interface ValidationError {
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info'
}

export function JsonEditor({
  value,
  onChange,
  onValidationChange,
  readOnly = false,
  height = 500,
  filename = 'table-collection.json',
}: JsonEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const markerSubscription = useRef<{ dispose: () => void } | null>(null)
  useEffect(() => () => markerSubscription.current?.dispose(), [])
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)
  const theme = useUIStore(state => state.theme)
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  useEffect(() => {
    if (theme !== 'system') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => setSystemDark(mediaQuery.matches)
    updateSystemTheme()
    mediaQuery.addEventListener('change', updateSystemTheme)
    return () => mediaQuery.removeEventListener('change', updateSystemTheme)
  }, [theme])
  const monacoTheme = theme === 'dark' || (theme === 'system' && systemDark) ? 'vs-dark' : 'vs'

  // Configure Monaco with JSON schema on mount
  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco


    // Configure JSON language with our schema
    jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [
        {
          uri: 'https://rolldeo.com/schemas/random-table-spec-v1.0.json',
          fileMatch: ['*'],
          schema: schema,
        },
      ],
      allowComments: false,
      schemaValidation: 'error',
      enableSchemaRequest: false,
    })

    // Set up validation error listener
    const model = editor.getModel()
    if (model) {
      const updateMarkers = () => {
        const markers = monaco.editor.getModelMarkers({ resource: model.uri }) as MonacoMarker[]
        const errors: ValidationError[] = markers.map((marker: MonacoMarker) => ({
          line: marker.startLineNumber,
          column: marker.startColumn,
          message: marker.message,
          severity:
            marker.severity === monaco.MarkerSeverity.Error
              ? 'error'
              : marker.severity === monaco.MarkerSeverity.Warning
                ? 'warning'
                : 'info',
        }))
        onValidationChange?.(errors)
      }

      markerSubscription.current?.dispose()
      markerSubscription.current = monaco.editor.onDidChangeMarkers((resources: import('monaco-editor').Uri[]) => {
        if (resources.some(resource => resource.toString() === model.uri.toString())) updateMarkers()
      })
      updateMarkers()
    }

    // Focus the editor
    editor.focus()
  }, [onValidationChange])

  // Handle content changes
  const handleChange: OnChange = useCallback(
    (newValue) => {
      if (newValue !== undefined) onChange(newValue)
    },
    [onChange]
  )

  // Update editor theme when UI theme changes
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(monacoTheme)
    }
  }, [monacoTheme])

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted px-4 py-2 text-sm font-medium border-b flex items-center justify-between">
        <span>{filename}</span>
        <span className="text-xs text-muted-foreground">
          Random Table Spec v1.0
        </span>
      </div>
      <Editor
        height={height}
        language="json"
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme={monacoTheme}
        loading={
          <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading editor...</span>
          </div>
        }
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: true,
          readOnly,
          folding: true,
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          snippetSuggestions: 'inline',
        }}
      />
    </div>
  )
}


export default JsonEditor
