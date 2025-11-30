import { useEffect } from 'react'
import { useCollectionStore } from './stores/collectionStore'
import { initializeTheme } from './stores/uiStore'

/**
 * Component to initialize app state.
 * Separate from routing to work with the data router.
 */
export function AppInitializer() {
  const initialize = useCollectionStore((state) => state.initialize)

  // Initialize collections on app start
  useEffect(() => {
    initialize()
  }, [initialize])

  // Initialize theme on app start
  useEffect(() => {
    initializeTheme()
  }, [])

  return null
}
