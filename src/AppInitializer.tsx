import { useEffect } from 'react'
import { useCollectionStore } from './stores/collectionStore'
import { useFavoriteStore } from './stores/favoriteStore'
import { useUsageStore } from './stores/usageStore'
import { initializeTheme } from './stores/uiStore'

/**
 * Component to initialize app state.
 * Separate from routing to work with the data router.
 *
 * Note: We use getState() to access actions directly instead of extracting
 * them via selectors. This avoids infinite loops because action references
 * change on every store update, which would trigger useEffect repeatedly.
 */
export function AppInitializer() {
  // Initialize all stores on app start (runs once)
  useEffect(() => {
    useCollectionStore.getState().initialize()
    useFavoriteStore.getState().loadFavorites()
    useUsageStore.getState().loadStats()
    initializeTheme()
  }, [])

  return null
}
