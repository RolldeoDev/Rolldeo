/**
 * Editor Components
 *
 * Visual and JSON editors for Random Table collections.
 */

export { JsonEditor, formatJson, validateJsonSyntax } from './JsonEditor'
export type { JsonEditorProps, ValidationError } from './JsonEditor'

export { MetadataEditor } from './MetadataEditor'
export type { MetadataEditorProps } from './MetadataEditor'

export { TableEditor } from './TableEditor'
export type { TableEditorProps } from './TableEditor'

export { EntryEditor } from './EntryEditor'
export type { EntryEditorProps } from './EntryEditor'

export { TemplateEditor } from './TemplateEditor'
export type { TemplateEditorProps } from './TemplateEditor'

export { VariablesEditor } from './VariablesEditor'
export type { VariablesEditorProps } from './VariablesEditor'

export { KeyValueEditor } from './KeyValueEditor'
export type { KeyValueEditorProps } from './KeyValueEditor'

// New workspace components
export { EditorWorkspace } from './EditorWorkspace'
export { EditorTabBar } from './EditorTabBar'
export type { EditorTab } from './EditorTabBar'
export { EditorSidebar } from './EditorSidebar'
export { IncludesEditor } from './IncludesEditor'
export { InsertDropdown } from './InsertDropdown'
export { SortableList } from './SortableList'
export { SortableItem } from './SortableItem'
export { CollectionSwitcher } from './CollectionSwitcher'
