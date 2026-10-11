import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Layout } from './components/layout/Layout'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { RollerPage } from './pages/RollerPage'
const EditorPage = lazy(() => import('./pages/EditorPage'))
const GuidePage = lazy(() => import('./pages/GuidePage'))
const QuickstartPage = lazy(() => import('./pages/QuickstartPage'))
const SpecPage = lazy(() => import('./pages/SpecPage'))
const SchemaPage = lazy(() => import('./pages/SchemaPage'))
const UsingRolldeoPage = lazy(() => import('./pages/UsingRolldeoPage'))
import { ErrorBoundary, ToastProvider } from './components/common'
import { AppInitializer } from './AppInitializer'
import { RouterAwareComponents } from './components/common/RouterAwareComponents'
import './index.css'

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
      { path: 'editor', element: <Suspense fallback={<p role="status">Loading editor...</p>}><EditorPage /></Suspense> },
      { path: 'editor/:collectionId', element: <Suspense fallback={<p role="status">Loading editor...</p>}><EditorPage /></Suspense> },
      { path: 'guide', element: <Suspense fallback={<p role="status">Loading guide...</p>}><GuidePage /></Suspense> },
      { path: 'guide/quickstart', element: <Suspense fallback={<p role="status">Loading guide...</p>}><QuickstartPage /></Suspense> },
      { path: 'guide/spec', element: <Suspense fallback={<p role="status">Loading guide...</p>}><SpecPage /></Suspense> },
      { path: 'guide/schema', element: <Suspense fallback={<p role="status">Loading guide...</p>}><SchemaPage /></Suspense> },
      { path: 'guide/using-rolldeo', element: <Suspense fallback={<p role="status">Loading guide...</p>}><UsingRolldeoPage /></Suspense> },
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
