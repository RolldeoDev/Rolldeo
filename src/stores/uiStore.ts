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
export type BrowserGroupBy = 'type' | 'tag' | 'alpha' | null
export type BrowserTab = 'tables' | 'templates'
export type EditorTab = 'metadata' | 'tables' | 'templates' | 'variables' | 'json'

interface UIState {
  // Search and filter (library page)
  searchQuery: string
  selectedTags: string[]

  // View preferences
  viewMode: 'grid' | 'list'
  showHiddenTables: boolean

  // Theme
  theme: 'light' | 'dark' | 'system'

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

  // Editor page state
  lastEditorCollectionId: string | null
  editorActiveTab: EditorTab
  editorSelectedItemId: string | null
  editorSidebarCollapsed: boolean

  // Actions - Library
  setSearchQuery: (query: string) => void
  toggleTag: (tag: string) => void
  setSelectedTags: (tags: string[]) => void
  clearTags: () => void
  clearFilters: () => void

  setViewMode: (mode: 'grid' | 'list') => void
  toggleShowHiddenTables: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void

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

  // Actions - Editor page
  setLastEditorCollectionId: (id: string | null) => void
  setEditorActiveTab: (tab: EditorTab) => void
  setEditorSelectedItemId: (id: string | null) => void
  setEditorSidebarCollapsed: (collapsed: boolean) => void
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
      isImportDialogOpen: false,
      isConflictDialogOpen: false,

      // Browser panel initial state
      browserPanelWidth: 380,
      expandedCollectionId: null,
      browserActiveTab: 'tables',
      browserViewMode: 'flat',
      browserGroupBy: null,
      browserSearchQuery: '',

      // Library page initial state
      preloadedCollectionsExpanded: false,

      // Editor page initial state
      lastEditorCollectionId: null,
      editorActiveTab: 'tables',
      editorSelectedItemId: null,
      editorSidebarCollapsed: false,

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

      // ========================================================================
      // Editor Page Actions
      // ========================================================================

      setLastEditorCollectionId: (id) => set({ lastEditorCollectionId: id }),

      setEditorActiveTab: (tab) => set({ editorActiveTab: tab }),

      setEditorSelectedItemId: (id) => set({ editorSelectedItemId: id }),

      setEditorSidebarCollapsed: (collapsed) => set({ editorSidebarCollapsed: collapsed }),
    }),
    {
      name: 'ui-store',
      // Persist only preferences, not transient UI state
      partialize: (state) => ({
        viewMode: state.viewMode,
        showHiddenTables: state.showHiddenTables,
        theme: state.theme,
        browserPanelWidth: state.browserPanelWidth,
        browserViewMode: state.browserViewMode,
        browserGroupBy: state.browserGroupBy,
        preloadedCollectionsExpanded: state.preloadedCollectionsExpanded,
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
