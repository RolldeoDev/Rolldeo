# Code Smells Report

## Summary

| Smell Type | Count | Severity |
|------------|-------|----------|
| Long Methods | 8 | Medium |
| Long Parameter Lists | 3 | Low |
| Duplicate Code | 5 patterns | Medium |
| Dead Code | 2 | Low |
| Data Clumps | 3 | Medium |
| Magic Numbers/Strings | 4 patterns | Low |
| Primitive Obsession | 2 | Low |

---

## 1. Long Methods/Functions (>50 lines)

### 1.1 RandomTableEngine Class - HIGH LINE COUNT

**File:** `src/engine/core/index.ts` (1,951 lines)

This file contains the core engine with many long methods:

| Method | Approx Lines | Recommendation |
|--------|--------------|----------------|
| `evaluateCaptureMultiRoll` | ~150 | Extract roll loop, trace building |
| `evaluateMultiRoll` | ~100 | Similar to captureMultiRoll, extract common |
| `resolveTableRef` | ~60 | Extract namespace resolution |
| `resolveTemplateRef` | ~60 | Nearly identical to resolveTableRef |
| `rollSimpleTableWithInheritance` | ~80 | Extract inheritance resolution |
| `createGenerationContext` | ~60 | Extract config merging |

**Suggested Refactoring:**
```typescript
// Extract common resolution logic
private resolveRef<T>(
  ref: string,
  collectionId: string,
  indexGetter: (c: LoadedCollection) => Map<string, T>
): { item: T; collectionId: string } | undefined
```

---

### 1.2 usePatternEvaluation Hook

**File:** `src/components/editor/PatternPreview/usePatternEvaluation.ts` (413 lines)

| Function | Lines | Issue |
|----------|-------|-------|
| `buildSegments` | ~150 | Complex segment building logic |
| `evaluate` (inner) | ~80 | Multiple responsibilities |

**Recommendation:** Extract `buildSegments` to a separate utility function.

---

### 1.3 TableEditor Component

**File:** `src/components/editor/TableEditor.tsx` (623 lines)

Single component handling all three table types (simple, composite, collection).

**Recommendation:** Consider splitting into:
- `SimpleTableEditor`
- `CompositeTableEditor`
- `CollectionTableEditor`

---

## 2. Long Parameter Lists (>4-5 parameters)

### 2.1 Section Component

**File:** `src/components/editor/EditorSidebar.tsx:48`

```typescript
function Section({
  title,
  icon: Icon,
  count,
  isExpanded,
  onToggle,
  onAdd,
  children,
  accentColor  // 8 parameters
}: SectionProps)
```

**Recommendation:** Group related props:
```typescript
interface SectionProps {
  header: { title: string; icon: LucideIcon; count: number; accentColor: string }
  state: { isExpanded: boolean }
  actions: { onToggle: () => void; onAdd: () => void }
  children: ReactNode
}
```

---

### 2.2 SidebarItem Component

**File:** `src/components/editor/EditorSidebar.tsx:100`

```typescript
function SidebarItem({
  label,
  id,
  isSelected,
  onClick,
  onDelete,
  canDelete = true  // 6 parameters
}: SidebarItemProps)
```

---

### 2.3 TableEditorProps

**File:** `src/components/editor/TableEditor.tsx:32-45`

```typescript
interface TableEditorProps {
  table: Table
  onChange: (table: Table) => void
  onDelete: () => void
  availableTableIds: string[]
  defaultExpanded?: boolean
  collectionId?: string  // 6 properties
}
```

---

## 3. Duplicate Code

### 3.1 Error Message Extraction Pattern - 10 INSTANCES

**Pattern:** `error instanceof Error ? error.message : 'Fallback'`

**Locations:**
- `src/services/import.ts:90, 164, 173`
- `src/pages/HomePage.tsx:146`
- `src/pages/LibraryPage.tsx:91`
- `src/pages/EditorPage.tsx:176`
- `src/stores/collectionStore.ts:161`
- `src/stores/rollStore.ts:177, 222, 252`

**Recommended Fix:**
```typescript
// src/lib/utils.ts
export function getErrorMessage(error: unknown, fallback = 'An error occurred'): string {
  return error instanceof Error ? error.message : fallback
}
```

---

### 3.2 Document Metadata Extraction - 5 LOCATIONS

**Pattern:** Extracting `name, namespace, version, description, tags` from `document.metadata`

**Locations:**
- `src/stores/collectionStore.ts:120-124` (initialize)
- `src/stores/collectionStore.ts:179-183` (loadCollection)
- `src/stores/collectionStore.ts:242-245` (saveImportedCollections)
- `src/stores/collectionStore.ts:282-286` (saveCollection)

**Current Code:**
```typescript
name: document.metadata.name,
namespace: document.metadata.namespace,
version: document.metadata.version,
description: document.metadata.description,
tags: document.metadata.tags || [],
```

**Recommended Fix:**
```typescript
// src/lib/utils.ts
export function extractMetadata(document: RandomTableDocument) {
  const { name, namespace, version, description, tags } = document.metadata
  return { name, namespace, version, description, tags: tags || [] }
}

// Usage
await db.saveCollection({
  id,
  document,
  ...extractMetadata(document),
  // ... other fields
})
```

---

### 3.3 resolveTableRef / resolveTemplateRef Duplication

**Files:** `src/engine/core/index.ts:731-805` and `src/engine/core/index.ts:812-877`

These two methods have nearly identical structure:
1. Check for namespace/alias format
2. Check imports
3. Fall back to namespace matching
4. Search all collections

**Recommendation:** Create generic `resolveRef<T>()` method.

---

### 3.4 Button Styling Patterns

**Pattern:** `px-4 py-2 rounded-xl` with variations

**Locations:** 20+ occurrences across pages and components

**Examples:**
```typescript
// HomePage.tsx:267
className="btn-primary flex items-center gap-2"

// EditorPage.tsx:263
className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium"

// EditorPage.tsx:284
className="flex items-center gap-2 px-4 py-2 border border-border/50 rounded-xl..."
```

**Recommendation:** Already have `btn-primary` in CSS, add more button variants:
```css
/* index.css */
.btn-secondary {
  @apply px-4 py-2 font-medium rounded-xl border border-border/50
         hover:bg-accent transition-all;
}

.btn-ghost {
  @apply px-4 py-2 font-medium rounded-xl hover:bg-accent/50 transition-all;
}
```

---

### 3.5 Percentage Calculation Pattern

**Pattern:** `${(probability * 100).toFixed(2)}%`

**Locations:**
- `src/engine/tables/simple.ts:240`
- `src/engine/tables/collection.ts:237`
- `src/engine/tables/composite.ts:113`

**Recommended Fix:**
```typescript
// src/lib/utils.ts
export function formatPercentage(probability: number, decimals = 2): string {
  return `${(probability * 100).toFixed(decimals)}%`
}
```

---

## 4. Dead Code

### 4.1 TODO Comments (Unimplemented Features)

**Locations:**
- `src/engine/core/index.ts:145` - `// TODO: Implement import resolution`
- `src/engine/core/context.ts:126` - `// TODO: Handle alias resolution`

**Impact:** Low - These indicate planned features, not dead code.

---

### 4.2 Excessive Explanatory Comments

Many comments simply restate what the code does:

```typescript
// src/pages/RollerPage.tsx
// Ensure collections are loaded
// Expand the collection from URL on mount
// Track selected item and its collection
// Get table/template info for the selected item
```

**Recommendation:** Remove obvious comments, keep only those explaining "why" not "what".

---

## 5. Data Clumps

### 5.1 Collection/Table ID Pair

**Pattern:** `collectionId` and `tableId` (or `templateId`) always appear together

**Locations:** Throughout the codebase (12+ occurrences)

**Recommended Fix:**
```typescript
// src/engine/types/index.ts
export interface TableReference {
  collectionId: string
  tableId: string
}

export interface TemplateReference {
  collectionId: string
  templateId: string
}
```

---

### 5.2 Document Metadata Fields

**Pattern:** `name, namespace, version, description, tags` always extracted together

**See:** Section 3.2 above

---

### 5.3 Collection Storage Fields

**Pattern:** These fields appear together when saving collections:

```typescript
{
  id,
  document,
  name,
  namespace,
  version,
  description,
  tags,
  isPreloaded,
  source,
  createdAt,
  updatedAt,
}
```

**Recommendation:** Already addressed with `StoredCollection` type, but extraction could be cleaner.

---

## 6. Magic Numbers/Strings

### 6.1 History Limits

| Value | Location | Purpose |
|-------|----------|---------|
| `100` | `stores/rollStore.ts:172, 217, 246` | Max history items |
| `50` | `components/roller/RollHistoryList.tsx:33` | Display limit |
| `1000` | `services/db.ts:266` | Cleanup threshold |

**Recommended Fix:**
```typescript
// src/lib/constants.ts
export const LIMITS = {
  HISTORY_MAX: 100,
  HISTORY_DISPLAY: 50,
  HISTORY_CLEANUP_THRESHOLD: 1000,
} as const
```

---

### 6.2 Debounce Delays

| Value | Location | Purpose |
|-------|----------|---------|
| `300` | `hooks/useBrowserFilter.ts:62` | Search debounce |
| `300` | `hooks/useDebouncedValue.ts:16` | Default debounce |
| `300` | `usePatternEvaluation.ts:126` | Eval debounce |
| `500` | `hooks/useResizable.ts:39` | Persist debounce |

**Recommended Fix:**
```typescript
// src/lib/constants.ts
export const DEBOUNCE = {
  SEARCH: 300,
  INPUT: 300,
  PERSIST: 500,
} as const
```

---

### 6.3 Engine Limits

| Value | Location | Purpose |
|-------|----------|---------|
| `50` | `engine/core/index.ts:113` | Max recursion |
| `100` | `engine/core/index.ts:114` | Max exploding dice |
| `5` | `engine/core/index.ts:115` | Max inheritance |

**Status:** Already uses `EngineConfig` type with defaults in `engine/types/index.ts:322-323`. Good.

---

### 6.4 Animation Delays

```typescript
// RollHistoryList.tsx:77
style={{ animationDelay: `${index * 0.02}s` }}
```

**Recommendation:** Extract to constant if used elsewhere.

---

## 7. Primitive Obsession

### 7.1 Timestamps as Numbers

**Pattern:** Using `number` for timestamps instead of `Date`

**Locations:**
- `StoredRoll.timestamp: number`
- `StoredCollection.createdAt: number`
- `StoredCollection.updatedAt: number`

**Assessment:** Acceptable for IndexedDB storage, but could use a type alias:
```typescript
type UnixTimestamp = number
```

---

### 7.2 Source Types as Strings

**Pattern:** Using string literals for source types

```typescript
source: 'preloaded' | 'file' | 'zip' | 'user'
```

**Assessment:** This is actually good - TypeScript union types. No change needed.

---

## 8. Other Observations

### 8.1 Feature Envy - Minor

The `collectionStore` frequently accesses `document.metadata.*` properties. This is acceptable since the store is responsible for bridging the engine with persistence.

### 8.2 Shotgun Surgery Risk

Changes to `RandomTableDocument` metadata would require updates in:
- `collectionStore.ts` (4 locations)
- `db.ts` (type definitions)
- `import.ts` (validation)
- Various UI components

**Mitigation:** The `extractMetadata` helper suggested above would centralize this.

---

## Recommended Priority Actions

### High Priority (Reduce Maintenance Burden)
1. Extract `getErrorMessage()` utility (10 duplicate locations)
2. Extract `extractMetadata()` utility (5 duplicate locations)
3. Create constants file for magic numbers

### Medium Priority (Improve Readability)
1. Split `TableEditor` into type-specific components
2. Create generic `resolveRef<T>()` in engine
3. Add button variant CSS classes

### Low Priority (Nice to Have)
1. Extract `buildSegments` from `usePatternEvaluation`
2. Group props in `Section` and `SidebarItem` components
3. Create `TableReference` and `TemplateReference` types

---

*Report generated: 2025-11-30*
