/**
 * App.tsx - Legacy component (not currently used)
 *
 * Note: The app now uses createBrowserRouter in main.tsx with AppInitializer.
 * This file is kept for reference but routes and initialization are handled elsewhere.
 */

import { Routes, Route } from 'react-router-dom'
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
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { InstallPrompt } from './components/InstallPrompt'
import { OfflineIndicator } from './components/OfflineIndicator'

function App() {
  // Initialization is handled by AppInitializer in main.tsx

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="roll" element={<RollerPage />} />
            <Route path="roll/:collectionId/:tableId" element={<RollerPage />} />
            <Route path="editor" element={<EditorPage />} />
            <Route path="editor/:collectionId" element={<EditorPage />} />
            <Route path="guide" element={<GuidePage />} />
            <Route path="guide/quickstart" element={<QuickstartPage />} />
            <Route path="guide/spec" element={<SpecPage />} />
            <Route path="guide/schema" element={<SchemaPage />} />
            <Route path="guide/using-rolldeo" element={<UsingRolldeoPage />} />
          </Route>
        </Routes>
        <InstallPrompt />
        <OfflineIndicator />
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
