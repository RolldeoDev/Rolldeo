/**
 * UI Store
 *
 * Manages UI preferences, search/filter state, and view options.
 * Persists preferences to localStorage.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================================================
// Types
// ============================================================================

export type BrowserViewMode = 'flat' | 'grouped'
export type BrowserGroupBy = 'resultType' | 'tag' | 'alpha' | null
export type BrowserTab = 'tables' | 'templates'
export type EditorTab = 'metadata' | 'tables' | 'templates' | 'variables' | 'json'
export type LibraryViewMode = 'grid' | 'grouped'
export type NamespaceDepth = 1 | 2
export type ResultTheme = 'default' | 'ttrpg'

interface UIState {
  // Search and filter (library page)
  searchQuery: string
  selectedTags: string[]

  // View preferences
  viewMode: 'grid' | 'list'
  showHiddenTables: boolean

  // Theme
  theme: 'light' | 'dark' | 'system'

  // Result theme (roller page only)
  resultTheme: ResultTheme

  // Modals
  isImportDialogOpen: boolean
  isConflictDialogOpen: boolean

  // Browser panel state (roller page)
  browserPanelWidth: number
  expandedCollectionId: string | null  // Single expanded collection (accordion behavior)
  browserActiveTab: BrowserTab
  browserViewMode: BrowserViewMode
  browserGroupBy: BrowserGroupBy
  browserSearchQuery: string

  // Library page state
  preloadedCollectionsExpanded: boolean
  libraryViewMode: LibraryViewMode
  libraryGroupDepth: NamespaceDepth
  libraryNamespaceFilter: string | null
  libraryExpandedNamespaces: string[]  // Which namespace groups are expanded

  // Roller page namespace filter
  rollerNamespaceFilter: string | null
  rollerCollectionSearchQuery: string

  // Roller page publisher accordion
  expandedPublisherId: string | null  // Single expanded publisher group (accordion behavior)

  // Editor page state
  lastEditorCollectionId: string | null
  editorActiveTab: EditorTab
  editorSelectedItemId: string | null
  editorSidebarCollapsed: boolean
  editorFocusedItemId: string | null      // Item with focused field (highest priority)
  editorLastExplicitItemId: string | null // Last explicitly clicked item (fallback)

  // Actions - Library
  setSearchQuery: (query: string) => void
  toggleTag: (tag: string) => void
  setSelectedTags: (tags: string[]) => void
  clearTags: () => void
  clearFilters: () => void

  setViewMode: (mode: 'grid' | 'list') => void
  toggleShowHiddenTables: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setResultTheme: (resultTheme: ResultTheme) => void

  openImportDialog: () => void
  closeImportDialog: () => void
  openConflictDialog: () => void
  closeConflictDialog: () => void

  // Actions - Browser panel
  setBrowserPanelWidth: (width: number) => void
  toggleCollectionExpanded: (id: string) => void  // Accordion: only one open at a time
  setExpandedCollectionId: (id: string | null) => void  // Direct setter for URL navigation
  setBrowserActiveTab: (tab: BrowserTab) => void
  setBrowserViewMode: (mode: BrowserViewMode) => void
  setBrowserGroupBy: (groupBy: BrowserGroupBy) => void
  setBrowserSearchQuery: (query: string) => void
  clearBrowserFilters: () => void

  // Actions - Library page
  togglePreloadedCollections: () => void
  setLibraryViewMode: (mode: LibraryViewMode) => void
  setLibraryGroupDepth: (depth: NamespaceDepth) => void
  setLibraryNamespaceFilter: (namespace: string | null) => void
  toggleLibraryNamespaceExpanded: (namespace: string) => void
  setLibraryExpandedNamespaces: (namespaces: string[]) => void
  clearLibraryFilters: () => void

  // Actions - Roller page namespace filter
  setRollerNamespaceFilter: (namespace: string | null) => void
  setRollerCollectionSearchQuery: (query: string) => void
  clearRollerCollectionFilters: () => void

  // Actions - Roller page publisher accordion
  togglePublisherExpanded: (publisherId: string) => void
  setExpandedPublisherId: (publisherId: string | null) => void

  // Actions - Editor page
  setLastEditorCollectionId: (id: string | null) => void
  setEditorActiveTab: (tab: EditorTab) => void
  setEditorSelectedItemId: (id: string | null) => void
  setEditorSidebarCollapsed: (collapsed: boolean) => void
  setEditorFocusedItemId: (id: string | null) => void
  setEditorLastExplicitItemId: (id: string | null) => void
}

// ============================================================================
// Store
// ============================================================================

export const useUIStore = create<UIState>()(
  persist(
    (set, _get) => ({
      // Initial state
      searchQuery: '',
      selectedTags: [],
      viewMode: 'grid',
      showHiddenTables: false,
      theme: 'system',
      resultTheme: 'default',
      isImportDialogOpen: false,
      isConflictDialogOpen: false,

      // Browser panel initial state
      browserPanelWidth: 380,
      expandedCollectionId: null,
      browserActiveTab: 'templates',
      browserViewMode: 'flat',
      browserGroupBy: null,
      browserSearchQuery: '',

      // Library page initial state
      preloadedCollectionsExpanded: false,
      libraryViewMode: 'grid',
      libraryGroupDepth: 1,
      libraryNamespaceFilter: null,
      libraryExpandedNamespaces: [],

      // Roller page namespace filter initial state
      rollerNamespaceFilter: null,
      rollerCollectionSearchQuery: '',

      // Roller page publisher accordion initial state
      expandedPublisherId: null,

      // Editor page initial state
      lastEditorCollectionId: null,
      editorActiveTab: 'tables',
      editorSelectedItemId: null,
      editorSidebarCollapsed: false,
      editorFocusedItemId: null,
      editorLastExplicitItemId: null,

      // ========================================================================
      // Search and Filter Actions
      // ========================================================================

      setSearchQuery: (query) => set({ searchQuery: query }),

      toggleTag: (tag) =>
        set((state) => ({
          selectedTags: state.selectedTags.includes(tag)
            ? state.selectedTags.filter((t) => t !== tag)
            : [...state.selectedTags, tag],
        })),

      setSelectedTags: (tags) => set({ selectedTags: tags }),

      clearTags: () => set({ selectedTags: [] }),

      clearFilters: () => set({ searchQuery: '', selectedTags: [] }),

      // ========================================================================
      // View Preference Actions
      // ========================================================================

      setViewMode: (mode) => set({ viewMode: mode }),

      toggleShowHiddenTables: () =>
        set((state) => ({ showHiddenTables: !state.showHiddenTables })),

      setTheme: (theme) => set({ theme }),

      setResultTheme: (resultTheme) => set({ resultTheme }),

      // ========================================================================
      // Modal Actions
      // ========================================================================

      openImportDialog: () => set({ isImportDialogOpen: true }),
      closeImportDialog: () => set({ isImportDialogOpen: false }),
      openConflictDialog: () => set({ isConflictDialogOpen: true }),
      closeConflictDialog: () => set({ isConflictDialogOpen: false }),

      // ========================================================================
      // Browser Panel Actions
      // ========================================================================

      setBrowserPanelWidth: (width) => set({ browserPanelWidth: width }),

      // Accordion behavior: toggle single collection, close if already open
      toggleCollectionExpanded: (id) =>
        set((state) => ({
          expandedCollectionId: state.expandedCollectionId === id ? null : id,
          // Reset search when switching collections
          browserSearchQuery: state.expandedCollectionId === id ? state.browserSearchQuery : '',
        })),

      // Direct setter for URL navigation (e.g., /roll?collection=xyz)
      setExpandedCollectionId: (id) =>
        set({
          expandedCollectionId: id,
          browserSearchQuery: '', // Reset search when navigating
        }),

      setBrowserActiveTab: (tab) => set({ browserActiveTab: tab }),

      setBrowserViewMode: (mode) => set({ browserViewMode: mode }),

      setBrowserGroupBy: (groupBy) => set({ browserGroupBy: groupBy }),

      setBrowserSearchQuery: (query) => set({ browserSearchQuery: query }),

      clearBrowserFilters: () =>
        set({ browserSearchQuery: '', browserGroupBy: null }),

      // ========================================================================
      // Library Page Actions
      // ========================================================================

      togglePreloadedCollections: () =>
        set((state) => ({ preloadedCollectionsExpanded: !state.preloadedCollectionsExpanded })),

      setLibraryViewMode: (mode) => set({ libraryViewMode: mode }),

      setLibraryGroupDepth: (depth) => set({ libraryGroupDepth: depth }),

      setLibraryNamespaceFilter: (namespace) => set({ libraryNamespaceFilter: namespace }),

      toggleLibraryNamespaceExpanded: (namespace) =>
        set((state) => ({
          libraryExpandedNamespaces: state.libraryExpandedNamespaces.includes(namespace)
            ? state.libraryExpandedNamespaces.filter((n) => n !== namespace)
            : [...state.libraryExpandedNamespaces, namespace],
        })),

      setLibraryExpandedNamespaces: (namespaces) => set({ libraryExpandedNamespaces: namespaces }),

      clearLibraryFilters: () =>
        set({
          searchQuery: '',
          selectedTags: [],
          libraryNamespaceFilter: null,
        }),

      // ========================================================================
      // Roller Page Namespace Filter Actions
      // ========================================================================

      setRollerNamespaceFilter: (namespace) => set({ rollerNamespaceFilter: namespace }),

      setRollerCollectionSearchQuery: (query) => set({ rollerCollectionSearchQuery: query }),

      clearRollerCollectionFilters: () =>
        set({
          rollerNamespaceFilter: null,
          rollerCollectionSearchQuery: '',
        }),

      // ========================================================================
      // Roller Page Publisher Accordion Actions
      // ========================================================================

      // Accordion behavior: toggle single publisher, close if already open
      togglePublisherExpanded: (publisherId) =>
        set((state) => ({
          expandedPublisherId: state.expandedPublisherId === publisherId ? null : publisherId,
        })),

      // Direct setter for programmatic expansion
      setExpandedPublisherId: (publisherId) => set({ expandedPublisherId: publisherId }),

      // ========================================================================
      // Editor Page Actions
      // ========================================================================

      setLastEditorCollectionId: (id) => set({ lastEditorCollectionId: id }),

      setEditorActiveTab: (tab) => set({ editorActiveTab: tab }),

      setEditorSelectedItemId: (id) => set({ editorSelectedItemId: id }),

      setEditorSidebarCollapsed: (collapsed) => set({ editorSidebarCollapsed: collapsed }),

      setEditorFocusedItemId: (id) => set({ editorFocusedItemId: id }),

      setEditorLastExplicitItemId: (id) => set({ editorLastExplicitItemId: id }),
    }),
    {
      name: 'ui-store',
      // Persist only preferences, not transient UI state
      partialize: (state) => ({
        viewMode: state.viewMode,
        showHiddenTables: state.showHiddenTables,
        theme: state.theme,
        resultTheme: state.resultTheme,
        browserPanelWidth: state.browserPanelWidth,
        browserViewMode: state.browserViewMode,
        browserGroupBy: state.browserGroupBy,
        preloadedCollectionsExpanded: state.preloadedCollectionsExpanded,
        // Library organization preferences
        libraryViewMode: state.libraryViewMode,
        libraryGroupDepth: state.libraryGroupDepth,
        libraryExpandedNamespaces: state.libraryExpandedNamespaces,
        // Roller page publisher accordion
        expandedPublisherId: state.expandedPublisherId,
        // Editor state persistence
        lastEditorCollectionId: state.lastEditorCollectionId,
        editorActiveTab: state.editorActiveTab,
        editorSelectedItemId: state.editorSelectedItemId,
        editorSidebarCollapsed: state.editorSidebarCollapsed,
      }),
    }
  )
)

// ============================================================================
// Theme Utilities
// ============================================================================

/**
 * Apply the current theme to the document.
 */
export function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const root = document.documentElement

  // Remove both classes first
  root.classList.remove('light', 'dark')

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(prefersDark ? 'dark' : 'light')
    root.style.colorScheme = prefersDark ? 'dark' : 'light'
  } else {
    root.classList.add(theme)
    root.style.colorScheme = theme
  }
}

/**
 * Initialize theme based on stored preference.
 */
export function initializeTheme(): void {
  const stored = localStorage.getItem('ui-store')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (parsed.state?.theme) {
        applyTheme(parsed.state.theme)
      }
    } catch {
      // Ignore parse errors
    }
  } else {
    applyTheme('system')
  }
}
