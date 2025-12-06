/**
 * Hooks Index
 *
 * Re-exports all custom hooks for convenient imports.
 */

export { useCollections, useCollection } from './useCollections'
export type { UseCollectionsReturn } from './useCollections'

export { useRoller } from './useRoller'
export type { UseRollerReturn } from './useRoller'

export { useKeyboardShortcuts, formatShortcut } from './useKeyboardShortcuts'
export type { KeyboardShortcut, UseKeyboardShortcutsOptions } from './useKeyboardShortcuts'

export { useDebouncedValue } from './useDebouncedValue'

export { useResizable } from './useResizable'

export { useBrowserFilter } from './useBrowserFilter'
export type { BrowserItem, GroupedItems } from './useBrowserFilter'

export { usePatternSuggestions, filterSuggestions } from './usePatternSuggestions'
export type {
  Suggestion,
  SuggestionCategory,
  SuggestionColorClass,
  UsePatternSuggestionsOptions,
} from './usePatternSuggestions'

export { usePatternAutocomplete } from './usePatternAutocomplete'
export type {
  TriggerType,
  TriggerInfo,
  UsePatternAutocompleteOptions,
  UsePatternAutocompleteReturn,
} from './usePatternAutocomplete'
