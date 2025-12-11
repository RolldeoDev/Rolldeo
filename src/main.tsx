import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Layout } from './components/layout/Layout'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { RollerPage } from './pages/RollerPage'
import { EditorPage } from './pages/EditorPage'
import { GuidePage } from './pages/GuidePage'
import { QuickstartPage } from './pages/QuickstartPage'
import { SpecPage } from './pages/SpecPage'
import { SchemaPage } from './pages/SchemaPage'
import { UsingRolldeoPage } from './pages/UsingRolldeoPage'
import { ErrorBoundary, ToastProvider, InstallPrompt, OfflineIndicator, CommandPalette } from './components/common'
import { AppInitializer } from './AppInitializer'
import './index.css'

// Wrapper component that renders inside RouterProvider for components needing router context
function RouterAwareComponents() {
  return (
    <>
      <CommandPalette />
      <InstallPrompt />
      <OfflineIndicator />
    </>
  )
}

// Add router-aware components as a child route that always renders
const routerWithComponents = createBrowserRouter([
  {
    path: '/',
    element: (
      <>
        <Layout />
        <RouterAwareComponents />
      </>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'roll', element: <RollerPage /> },
      { path: 'roll/:collectionId/:tableId', element: <RollerPage /> },
      { path: 'editor', element: <EditorPage /> },
      { path: 'editor/:collectionId', element: <EditorPage /> },
      { path: 'guide', element: <GuidePage /> },
      { path: 'guide/quickstart', element: <QuickstartPage /> },
      { path: 'guide/spec', element: <SpecPage /> },
      { path: 'guide/schema', element: <SchemaPage /> },
      { path: 'guide/using-rolldeo', element: <UsingRolldeoPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <ErrorBoundary>
        <ToastProvider>
          <AppInitializer />
          <RouterProvider router={routerWithComponents} />
        </ToastProvider>
      </ErrorBoundary>
    </HelmetProvider>
  </StrictMode>,
)
