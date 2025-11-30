# Rolldeo Codebase Summary

## Project Overview

**Rolldeo** is a Progressive Web App (PWA) for tabletop RPG enthusiasts to create, share, and roll on random tables. It's designed to work offline, can be installed on any device, and stores all data locally in IndexedDB.

### Key Value Proposition
- Digital companion for Game Masters to manage random tables
- Support for complex table generation with dice expressions, templates, variables, and conditional logic
- Offline-first PWA approach with no server required
- Both visual UI editor and raw JSON editing capabilities

---

## Tech Stack

### Frontend Framework & Build
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI framework |
| TypeScript | 5.6 | Type safety |
| Vite | 6 | Build tool & dev server |
| React Router | v6 | Client-side routing |

### State Management & Storage
| Technology | Purpose |
|------------|---------|
| Zustand v5 | Lightweight state management |
| IndexedDB (via `idb`) | Local persistent storage |
| localStorage | UI preferences via zustand middleware |

### Styling & UI
| Technology | Purpose |
|------------|---------|
| TailwindCSS v3.4 | Utility-first CSS |
| Lucide React | Icon library |
| CVA (Class Variance Authority) | Type-safe component styling |

### Core Libraries
| Library | Purpose |
|---------|---------|
| Monaco Editor | Embedded JSON editor with syntax highlighting |
| JSZip | ZIP file import/export |
| React Markdown | Documentation rendering |
| dnd-kit | Drag-and-drop support |
| TanStack React Virtual | List virtualization |
| AJV | JSON Schema validation |

### PWA & Offline
- Vite PWA Plugin for service worker generation
- Workbox for runtime caching strategies

---

## Directory Structure

```
/src
├── main.tsx                 # App entry point
├── AppInitializer.tsx       # App initialization (collections + theme)
├── index.css                # Global styles
│
├── /pages/                  # Route pages (9 components)
│   ├── HomePage.tsx         # Landing page
│   ├── RollerPage.tsx       # Main rolling interface
│   ├── EditorPage.tsx       # Collection editor
│   ├── LibraryPage.tsx      # Browse collections
│   └── Guide*.tsx           # Documentation pages
│
├── /components/             # Reusable React components
│   ├── /layout/             # App layout (header, nav)
│   ├── /roller/             # Rolling interface (14 files)
│   ├── /editor/             # Editor components (11 files)
│   ├── /guide/              # Documentation components
│   ├── /ui/                 # Basic UI components
│   └── /upload/             # File upload & import
│
├── /stores/                 # Zustand state management
│   ├── collectionStore.ts   # Collections & engine
│   ├── rollStore.ts         # Rolling state & history
│   └── uiStore.ts           # UI preferences & filters
│
├── /engine/                 # Core rolling engine
│   ├── /core/               # Main engine logic (1,934 lines)
│   ├── /dice/               # Dice parsing & rolling
│   ├── /tables/             # Table rolling implementations
│   └── /types/              # TypeScript interfaces
│
├── /services/               # Business logic & persistence
│   ├── db.ts                # IndexedDB operations
│   ├── import.ts            # JSON/ZIP import
│   └── export.ts            # JSON/ZIP export
│
├── /hooks/                  # Custom React hooks (7 files)
│
├── /lib/                    # Utility functions
│
└── /data/preloaded/         # Pre-loaded example collections
```

---

## Entry Points & Execution Flow

### Bootstrap Sequence
1. **`index.html`** → Loads `/src/main.tsx`
2. **`main.tsx`** → Sets up React Router & providers
3. **`AppInitializer.tsx`** → Loads collections from IndexedDB, initializes theme

### Route Structure
```
/ (Layout)
├── /                    → HomePage
├── /library             → LibraryPage
├── /roll                → RollerPage
├── /roll/:collectionId/:tableId → RollerPage (with params)
├── /editor              → EditorPage
├── /editor/:collectionId → EditorPage (editing)
├── /guide               → GuidePage
├── /guide/quickstart    → QuickstartPage
├── /guide/spec          → SpecPage
├── /guide/schema        → SchemaPage
└── /guide/using-rolldeo → UsingRolldeoPage
```

### State Management Architecture
```
User Action
    ↓
Custom Hook (useRoller, useUIStore, etc.)
    ↓
Zustand Store Action
    ↓
Engine Method (engine.roll(), engine.rollTemplate())
    ↓
Rolling Pipeline (expression parsing, table lookup, dice)
    ↓
Result + Trace
    ↓
Update Store State → Component Re-render
    ↓
IndexedDB Persist (history, preferences)
```

---

## Core Engine (`/engine/core/index.ts`)

The `RandomTableEngine` class (1,934 lines) implements the Random Table JSON Specification v1.0.

### Key Methods
| Method | Purpose |
|--------|---------|
| `loadCollection()` | Load a collection document into engine |
| `roll(tableId, collectionId)` | Roll on a specific table |
| `rollTemplate(templateId, collectionId)` | Roll on a template |
| `evaluateRawPattern()` | Evaluate a pattern string (live preview) |
| `validate()` | Validate document against JSON schema |

### Expression Types
- `{{dice:3d6}}` - Dice expressions
- `{{tableName}}` - Table/template references
- `{{3*unique*items}}` - Multi-roll with count
- `{{$varName}}` - Variable access
- `{{@placeholder}}` - Placeholder substitution
- `{{collect:$var.@prop}}` - Aggregate captured properties

### Dice Engine (`/engine/dice/index.ts`)
Supports: `XdY`, modifiers (`+/-/*`), keep highest/lowest (`khN`, `klN`), exploding (`!`)

---

## Data Persistence

### IndexedDB Stores (`/services/db.ts`)
| Store | Purpose | Indexes |
|-------|---------|---------|
| collections | Complete table documents + metadata | namespace, preloaded, tags |
| rollHistory | Roll results per roll | collection, timestamp, pinned |
| userPreferences | Theme, selections, limits | - |

### Import/Export (`/services/`)
- **Import:** JSON files, ZIP archives with validation
- **Export:** Single JSON, multiple as ZIP, pretty-print or minified

---

## Key Features

1. **Offline-First** - All data stored locally, works without internet
2. **Specification Compliance** - Full Random Table JSON Spec v1.0 support
3. **Advanced Rolling** - Dice expressions, inheritance, conditionals, shared variables
4. **Visual & Code Editing** - Edit with UI or raw JSON (Monaco editor)
5. **Import/Export** - JSON and ZIP support for sharing
6. **Roll History** - Track and pin favorite results
7. **Trace Mode** - Debug generation with execution trace
8. **Keyboard Shortcuts** - Quick rolling and navigation
9. **Responsive Design** - Mobile, tablet, desktop support
10. **Pre-loaded Collections** - Fantasy RPG and Sci-Fi examples

---

## Build & Development

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # TypeScript compile + Vite build → /dist
npm run preview   # Preview production build
npm run test      # Run Vitest
npm run lint      # ESLint check
```

### PWA Features
- Installable on desktop/mobile
- Offline support via Workbox service worker
- Auto-updates
- Standalone display mode

---

## File Statistics
- **103** TypeScript files
- **3** main Zustand stores
- **9** page components
- **30+** reusable components
- **7** custom React hooks
- **2** pre-loaded example collections

---

## Key Files by Responsibility

| Domain | Key Files |
|--------|-----------|
| Engine | `/engine/core/index.ts`, `/engine/dice/index.ts`, `/engine/types/index.ts` |
| State | `/stores/collectionStore.ts`, `/stores/rollStore.ts`, `/stores/uiStore.ts` |
| Data | `/services/db.ts`, `/services/import.ts`, `/services/export.ts` |
| UI | `/pages/*.tsx`, `/components/**/*.tsx` |
| Config | `vite.config.ts`, `tailwind.config.js`, `tsconfig.json` |
