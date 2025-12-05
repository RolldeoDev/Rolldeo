# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Rolldeo?

Rolldeo is a Progressive Web App for creating, managing, and rolling on random tables for TTRPGs. It works offline and implements the Random Table JSON Specification v1.0. The app allows users to define random tables in JSON with support for dice expressions, table references, templates, variables, conditionals, and imports.

## Development Commands

```bash
npm run dev      # Start development server (http://localhost:5173)
npm run build    # TypeScript check + Vite production build
npm run test     # Run Vitest tests
npm run lint     # ESLint check

# Run a specific test file
npm run test -- --run src/engine/core/parser.test.ts
```

## Architecture Overview

### Core Engine (`src/engine/`)

The Random Table Engine is the heart of the application. It parses, validates, and evaluates random table documents.

- **`types/index.ts`** - TypeScript interfaces matching the JSON specification (RandomTableDocument, Table, Entry, Template, etc.)
- **`core/index.ts`** - `RandomTableEngine` class - main orchestrator for loading collections and rolling on tables/templates
- **`core/parser.ts`** - Parses `{{...}}` expression syntax in patterns
- **`core/evaluator.ts`** - `ExpressionEvaluator` - evaluates parsed expressions (dice, table refs, variables)
- **`core/context.ts`** - `GenerationContext` - maintains state during a single generation (recursion depth, variables, trace)
- **`core/resolver.ts`** - Resolves table/template references across collections and imports
- **`core/validator.ts`** - JSON schema validation using AJV
- **`dice/index.ts`** - Dice expression parser and roller (supports keep highest/lowest, exploding dice, etc.)
- **`tables/simple.ts`** - Simple table rolling with weighted entries
- **`tables/composite.ts`** - Composite tables (select from multiple source tables)
- **`tables/collection.ts`** - Collection tables (merge entries from multiple tables)

### State Management (`src/stores/`)

Zustand stores manage application state:

- **`collectionStore.ts`** - Central store bridging `RandomTableEngine` with UI. Handles loading/saving collections, imports, and provides selectors for table/template lists
- **`rollStore.ts`** - Manages roll history, pinned rolls, current selections
- **`uiStore.ts`** - UI preferences (theme, panel sizes, etc.)

### Persistence (`src/services/`)

- **`db.ts`** - IndexedDB wrapper using `idb` library. Stores collections, roll history, and user preferences
- **`import.ts`** - Handles importing JSON files and ZIP archives
- **`export.ts`** - Exports collections to JSON/ZIP

### Pages and Routing

Routes are defined in `src/App.tsx` using React Router.

#### HomePage (`src/pages/HomePage.tsx`)
- **Route:** `/`
- Landing page with quick action cards, feature highlights, and drag-drop import zone
- Links to Roller, Library, Editor, and Guide pages

#### RollerPage (`src/pages/RollerPage.tsx`)
- **Route:** `/roll`, `/roll/:collectionId/:tableId`
- Split-panel layout for browsing and rolling on tables/templates
- **Left panel:** `BrowserPanel` - collection accordion with search/filtering
- **Right panel:** `ResultsPanel` - selected item info, current roll result, roll history
- Key components in `src/components/roller/`:
  - `SplitPanelLayout` - resizable split view
  - `CollectionAccordion` - expandable collection list
  - `CurrentRollResult` - displays roll output with trace/captures
  - `RollHistoryList` - pinnable roll history
- Uses `useRoller` hook for roll state management

#### EditorPage (`src/pages/EditorPage.tsx`)
- **Route:** `/editor`, `/editor/:collectionId`
- Full-featured collection editor with visual and JSON modes
- **Header:** Save/Export buttons, validation status, collection switcher
- **Workspace:** `EditorWorkspace` component with tabbed interface
- Key components in `src/components/editor/`:
  - `EditorWorkspace` - main editing area with sidebar
  - `EditorSidebar` - tabs for Metadata, Tables, Templates, Variables, Imports
  - `TableEditor` / `TemplateEditor` - visual editors for items
  - `JsonEditor` - Monaco-based JSON editor with schema validation
  - `PatternPreview` - live preview of pattern expressions
- Tracks dirty state and blocks navigation with unsaved changes

#### LibraryPage (`src/pages/LibraryPage.tsx`)
- **Route:** `/library`
- Browse and manage collections with grid or namespace-grouped views
- `LibraryFilterBar` - search, tag filter, view mode toggle
- `CollectionCard` - displays collection metadata with actions
- `NamespaceAccordion` - groups collections by namespace
- Drag-drop import zone for adding new collections

#### GuidePage (`src/pages/GuidePage.tsx`, `SpecPage.tsx`, `QuickstartPage.tsx`)
- **Routes:** `/guide`, `/guide/quickstart`, `/guide/spec`, `/guide/using-rolldeo`
- Documentation pages rendered from markdown files in `docs/`
- Uses `MarkdownRenderer` component with syntax highlighting

### Expression Syntax

The `{{...}}` pattern syntax supports:
- `{{dice:3d6}}` - Dice expressions
- `{{tableName}}` - Table references
- `{{3*unique*tableName}}` - Multiple unique rolls
- `{{@varName}}` - Variable references
- `{{alias.tableName}}` - Cross-collection references via imports

## Engine Internals

### Key Type Definitions (`src/engine/types/index.ts`)

- **`RandomTableDocument`** - Root document structure with `metadata`, `imports`, `tables`, `templates`, `variables`, `shared`
- **`Table`** - Union of `SimpleTable | CompositeTable | CollectionTable`
- **`Entry`** - Table entry with `value`, `weight`, `range`, `description`, `sets`, `assets`
- **`Template`** - Named pattern with `id`, `name`, `pattern`, optional `shared` variables
- **`RollResult`** - Output from rolling including `text`, `resultType`, `assets`, `placeholders`, `trace`, `captures`, `descriptions`
- **`CaptureVariable`** / **`CaptureItem`** - Capture system types for `{{N*table >> $var}}` syntax

### Parser Token Types (`src/engine/core/parser.ts`)

The parser converts `{{...}}` expressions into typed tokens:

| Token Type | Example | Description |
|------------|---------|-------------|
| `DiceToken` | `{{dice:3d6}}` | Dice expression |
| `MathToken` | `{{math:@level*2}}` | Math expression |
| `TableToken` | `{{tableName}}` | Table reference |
| `VariableToken` | `{{$varName}}` | Shared variable |
| `PlaceholderToken` | `{{@prop}}` | Entry set placeholder |
| `MultiRollToken` | `{{3*unique*table}}` | Multiple rolls |
| `CaptureMultiRollToken` | `{{3*table >> $var}}` | Capture rolls |
| `CaptureAccessToken` | `{{$var[0].@prop}}` | Access captured data |
| `CollectToken` | `{{collect:$var.@prop}}` | Aggregate captured properties |
| `SwitchToken` | `{{switch[cond:result]}}` | Conditional logic |
| `AgainToken` | `{{again}}` | Re-roll current table |
| `InstanceToken` | `{{table#name}}` | Named instance reference |

### Dice Notation (`src/engine/dice/index.ts`)

Supports standard dice notation with modifiers:
- `XdY` - Roll X dice with Y sides
- `kN` / `khN` - Keep highest N dice
- `klN` - Keep lowest N dice
- `!` - Exploding dice (max value re-rolls)
- `+Z`, `-Z`, `*Z` - Arithmetic modifiers

### Evaluation Flow

1. `RandomTableEngine.roll()` or `rollTemplate()` creates a `GenerationContext`
2. Pattern strings are parsed by `parseTemplate()` into token arrays
3. `ExpressionEvaluator.evaluatePattern()` processes each token
4. Table rolls go through `rollSimpleTable()`, `selectSource()`, or `rollCollectionTable()`
5. Results are assembled with trace data, captures, and descriptions

### Table Types

- **Simple** - Weighted random selection from entries array
- **Composite** - Selects a source table first, then rolls on it
- **Collection** - Merges entries from multiple tables into one pool

## Key Patterns

### Adding a New Expression Type

1. Update parser in `src/engine/core/parser.ts` to recognize new syntax
2. Add evaluation logic in `src/engine/core/evaluator.ts`
3. Add tests in corresponding `.test.ts` file

### Working with Collections

Collections flow: JSON file → `importService.importFiles()` → `collectionStore.saveImportedCollections()` → `engine.loadCollection()` → stored in IndexedDB

The engine maintains indexes for O(1) table/template lookups and resolves cross-collection imports.

## Path Alias

`@/` is aliased to `./src/` in both Vite and TypeScript configs.
