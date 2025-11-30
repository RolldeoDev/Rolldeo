# Consistency Audit Report

## Executive Summary

| Category | Status | Issues Found |
|----------|--------|--------------|
| File Naming | ✅ Consistent | 0 |
| Code Organization | ✅ Mostly Consistent | 1 minor |
| Import Patterns | ⚠️ Minor Inconsistencies | 3 |
| Comment Style | ✅ Consistent | 0 |
| Export Patterns | ⚠️ Inconsistent | 4 |
| Component Definitions | ⚠️ Mixed Patterns | 3 |
| Configuration | ✅ Consistent | 0 |

**Overall Assessment:** The codebase is well-organized with minor inconsistencies that don't impact functionality but could be standardized for maintainability.

---

## 1. Naming Conventions

### Dominant Patterns ✅

| Category | Convention | Examples |
|----------|------------|----------|
| Components | PascalCase | `BrowserPanel.tsx`, `EditorWorkspace.tsx` |
| Hooks | camelCase + `use` prefix | `useRoller.ts`, `useBrowserFilter.ts` |
| Stores | camelCase + `Store` suffix | `collectionStore.ts`, `rollStore.ts` |
| Services | camelCase | `db.ts`, `import.ts`, `export.ts` |
| Engine modules | camelCase | `parser.ts`, `validator.ts`, `context.ts` |
| Types/Interfaces | PascalCase | `RandomTableDocument`, `CollectionMeta` |
| Type files | `index.ts` in type folders | `engine/types/index.ts` |
| Test files | `.test.ts` suffix | `dice.test.ts`, `engine.test.ts` |

### Assessment: **CONSISTENT** ✅

No naming convention violations found. The codebase follows React/TypeScript community standards.

---

## 2. Code Organization

### Dominant Pattern ✅

```
src/
├── pages/           # Route components (PascalCase)
├── components/      # Feature-grouped subdirectories
│   ├── roller/      # Feature components + index.ts
│   ├── editor/      # Feature components + index.ts
│   ├── guide/       # Feature components + index.ts
│   ├── upload/      # Feature components + index.ts
│   └── layout/      # Layout components + index.ts
├── hooks/           # Custom hooks + index.ts
├── stores/          # Zustand stores + index.ts
├── services/        # Data services + index.ts
├── engine/          # Business logic
│   ├── core/        # Main engine
│   ├── dice/        # Dice module
│   ├── tables/      # Table rollers
│   └── types/       # Type definitions
└── lib/             # Utilities
```

### Deviation Found

| Location | Issue | Dominant Pattern | Deviation |
|----------|-------|------------------|-----------|
| `src/components/` root | Standalone components | Grouped in subdirectories | `Toast.tsx`, `ThemeSwitcher.tsx`, `ErrorBoundary.tsx`, `InstallPrompt.tsx`, `OfflineIndicator.tsx` at root level |

**Suggested Fix:** Create `src/components/common/` or `src/components/shared/` directory for these utility components:

```
src/components/
├── common/          # NEW: shared utility components
│   ├── Toast.tsx
│   ├── ThemeSwitcher.tsx
│   ├── ErrorBoundary.tsx
│   ├── InstallPrompt.tsx
│   ├── OfflineIndicator.tsx
│   └── index.ts
├── roller/
├── editor/
...
```

---

## 3. Import Patterns

### Dominant Patterns

1. **Path aliases:** `@/` for absolute imports from `src/`
2. **Relative imports:** `./` for same-directory, `../` for parent
3. **External packages:** Listed first
4. **Types:** Using `import type` for type-only imports

### Inconsistencies Found

#### Issue #1: Import Order Inconsistency

**Dominant Pattern:** Most files follow this order:
```typescript
// 1. React imports
import { useState, useCallback } from 'react'
// 2. External packages
import { X, Plus } from 'lucide-react'
// 3. Internal absolute imports (@/)
import { useCollectionStore } from '@/stores/collectionStore'
// 4. Internal relative imports
import { BrowserPanel } from './BrowserPanel'
// 5. Types (often mixed in)
import type { RollResult } from '@/engine/types'
```

**Deviations:**

| File | Issue |
|------|-------|
| `src/pages/RollerPage.tsx:15` | Mixed import from hooks: `import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks'` while other hooks imported individually |
| `src/components/roller/TraceViewer.tsx:8-29` | 20+ icon imports on separate lines (could be grouped) |
| Various files | Type imports sometimes use `import type`, sometimes inline with value imports |

**Suggested Fix:** Establish and document import order:
```typescript
// 1. React
// 2. External packages (alphabetized)
// 3. Internal @/ imports (stores, hooks, components, services, engine - in order)
// 4. Relative imports
// 5. Type-only imports (using `import type`)
```

#### Issue #2: Barrel Import Inconsistency

**Files using barrel imports (from index.ts):**
```typescript
// RollerPage.tsx
import { SplitPanelLayout, BrowserPanel, ResultsPanel } from '@/components/roller'
import { useKeyboardShortcuts } from '@/hooks'
```

**Files using direct imports:**
```typescript
// CollectionAccordion.tsx
import { useUIStore } from '@/stores/uiStore'  // Not from '@/stores'
import { useCollectionStore } from '@/stores/collectionStore'
```

**Suggested Fix:** Either always use barrel imports OR always use direct imports. Current mix is inconsistent.

#### Issue #3: Type Import Style

**Pattern A (explicit type import):**
```typescript
import type { RollResult } from '@/engine/types'
import type { StoredRoll } from '@/services/db'
```

**Pattern B (inline with values):**
```typescript
import { useCollectionStore, type CollectionMeta } from '@/stores/collectionStore'
```

Both are valid TypeScript, but consistency would improve readability.

---

## 4. Comment Style

### Dominant Pattern ✅ **CONSISTENT**

#### File Headers
Every file has a consistent JSDoc header:
```typescript
/**
 * Module/Component Name
 *
 * Brief description of purpose.
 * Additional details if needed.
 */
```

#### Section Dividers (Stores/Engine)
```typescript
// ============================================================================
// Section Name
// ============================================================================
```

#### Inline Comments
- Sparse but present where logic is complex
- Use `//` style
- Explain "why" not "what"

#### JSDoc on Exports
```typescript
/**
 * Format timestamp for display.
 */
export function formatTimestamp(timestamp: number): string {
```

**No inconsistencies found.** Comment style is exemplary.

---

## 5. Export Patterns

### Inconsistencies Found

#### Issue #1: Mixed Named + Default Exports

**Pattern A (Both named and default):**
```typescript
// BrowserPanel.tsx
export const BrowserPanel = memo(function BrowserPanel({...}) {...})
export default BrowserPanel

// ThemeSwitcher.tsx
export const ThemeSwitcher = memo(function ThemeSwitcher() {...})
export default ThemeSwitcher
```

**Pattern B (Named only):**
```typescript
// RollerPage.tsx
export function RollerPage() {...}
// No default export

// SplitPanelLayout.tsx
export function SplitPanelLayout({...}) {...}
export default SplitPanelLayout  // Has both
```

**Files with both exports:** ~70%
**Files with named only:** ~30%

**Suggested Fix:** Pick one pattern. Recommendation: **Named exports only** (better for tree-shaking and explicit imports):
```typescript
// Preferred
export function ComponentName() {...}
// or
export const ComponentName = memo(function ComponentName() {...})
```

#### Issue #2: Index File Export Styles

| File | Style |
|------|-------|
| `hooks/index.ts` | Named re-exports with explicit types |
| `services/index.ts` | Wildcard re-exports (`export * from`) |
| `stores/index.ts` | Mixed (exports stores + utility functions) |
| `components/editor/index.ts` | Named exports with types |
| `components/roller/index.ts` | Named exports, no types |

**services/index.ts:**
```typescript
export * from './db'
export * from './import'
// Missing: export * from './export'  ← INCONSISTENCY
```

**components/roller/index.ts:**
```typescript
export { SplitPanelLayout } from './SplitPanelLayout'
// No type exports
```

**components/editor/index.ts:**
```typescript
export { JsonEditor } from './JsonEditor'
export type { JsonEditorProps } from './JsonEditor'
// Has type exports
```

**Suggested Fix:** Standardize index files:
```typescript
// Preferred pattern for all index.ts files
export { ComponentA } from './ComponentA'
export type { ComponentAProps } from './ComponentA'

export { ComponentB } from './ComponentB'
export type { ComponentBProps } from './ComponentB'
```

#### Issue #3: Missing Export in services/index.ts

```typescript
// services/index.ts - current
export * from './db'
export * from './import'
// Missing: export.ts is not re-exported
```

**Location:** `src/services/index.ts:7-8`

**Suggested Fix:**
```typescript
export * from './db'
export * from './import'
export * from './export'  // Add this
```

#### Issue #4: TraceViewer/CaptureInspector Not in Index

```typescript
// components/roller/index.ts
// Missing exports:
// - TraceViewer
// - CaptureInspector
// - TraceToggle
```

**Suggested Fix:** Add missing exports to `components/roller/index.ts`

---

## 6. Component Definition Patterns

### Inconsistencies Found

#### Pattern A: memo() with named function
```typescript
// BrowserPanel.tsx, ThemeSwitcher.tsx
export const BrowserPanel = memo(function BrowserPanel({...}) {...})
```

#### Pattern B: Regular function declaration
```typescript
// RollerPage.tsx, EditorWorkspace.tsx
export function RollerPage() {...}
export function EditorWorkspace({...}) {...}
```

#### Pattern C: Class component (ErrorBoundary only)
```typescript
// ErrorBoundary.tsx
export class ErrorBoundary extends Component<...> {...}
```

### Distribution

| Pattern | Count | Files |
|---------|-------|-------|
| `memo()` wrapper | ~15 | BrowserPanel, ThemeSwitcher, CollectionAccordion, etc. |
| Regular function | ~25 | Pages, EditorWorkspace, SplitPanelLayout, etc. |
| Class component | 1 | ErrorBoundary (required for error boundaries) |

### Suggested Guidelines

1. **Use `memo()`** for:
   - Components receiving props that rarely change
   - Components in lists
   - Components with expensive renders

2. **Use regular functions** for:
   - Pages (always re-render on navigation)
   - Simple wrapper components
   - Components that always need fresh data

3. **Class components** only for:
   - Error boundaries (required by React)

---

## 7. Configuration Patterns

### Consistent Patterns ✅

| Config | Pattern | Location |
|--------|---------|----------|
| TypeScript | `tsconfig.json` with path aliases | Root |
| Vite | `vite.config.ts` | Root |
| Tailwind | `tailwind.config.js` | Root |
| PostCSS | `postcss.config.js` | Root |
| ESLint | `.eslintrc.cjs` | Root (if exists) |

**No inconsistencies found in configuration files.**

---

## 8. Props Interface Naming

### Dominant Pattern ✅ **CONSISTENT**

```typescript
interface ComponentNameProps {
  /** Prop description */
  propName: type
}
```

All components follow this convention. Examples:
- `BrowserPanelProps`
- `EditorWorkspaceProps`
- `SplitPanelLayoutProps`
- `ToastProviderProps`

---

## 9. Type vs Interface Usage

### Dominant Pattern ✅ **CONSISTENT**

| Use Case | Convention | Example |
|----------|------------|---------|
| Object shapes | `interface` | `interface RollState {...}` |
| Union types | `type` | `type ToastType = 'success' \| 'error'` |
| Function types | `type` | `type Handler = () => void` |
| Mapped types | `type` | `type NodeIcons = Record<string, Component>` |

**No inconsistencies found.**

---

## Summary of Issues to Fix

### High Priority (Breaking Patterns)

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 1 | Missing export in services/index.ts | `src/services/index.ts` | Add `export * from './export'` |

### Medium Priority (Consistency)

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 2 | Mixed named/default exports | Multiple components | Remove default exports, use named only |
| 3 | Missing roller component exports | `src/components/roller/index.ts` | Add TraceViewer, CaptureInspector, TraceToggle |
| 4 | Inconsistent index file styles | All index.ts files | Standardize on named exports + types |

### Low Priority (Style)

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 5 | Standalone utility components | `src/components/` root | Move to `src/components/common/` |
| 6 | Import order varies | Multiple files | Add ESLint import-order rule |
| 7 | Mixed type import styles | Multiple files | Prefer `import type` for type-only |
| 8 | Inconsistent memo() usage | Components | Document when to use memo() |

---

## Recommended ESLint Rules

Add these rules to enforce consistency:

```javascript
// .eslintrc.cjs additions
{
  "rules": {
    // Import ordering
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "type"],
      "newlines-between": "always",
      "alphabetize": { "order": "asc" }
    }],

    // Prefer named exports
    "import/no-default-export": "warn",

    // Consistent type imports
    "@typescript-eslint/consistent-type-imports": ["error", {
      "prefer": "type-imports"
    }]
  }
}
```

---

## Conclusion

The Rolldeo codebase demonstrates **good overall consistency** with a few areas for improvement:

1. **Strengths:**
   - Consistent naming conventions
   - Excellent comment/documentation style
   - Clean type definitions
   - Well-organized directory structure

2. **Areas to Improve:**
   - Standardize export patterns (named only)
   - Complete barrel exports in index files
   - Enforce import ordering with ESLint
   - Group standalone components into `common/` directory

**Consistency Score: 8/10**
