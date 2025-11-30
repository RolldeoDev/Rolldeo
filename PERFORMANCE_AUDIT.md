# Performance Audit Report

## Executive Summary

| Category | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| N+1 Queries | 0 | 1 | 0 | 1 |
| Missing Indexes | 0 | 0 | 0 | 1 |
| Unbounded Operations | 0 | 1 | 1 | 1 |
| Memory Leaks | 0 | 0 | 1 | 0 |
| Blocking Operations | 0 | 0 | 1 | 1 |
| Redundant Operations | 0 | 1 | 0 | 0 |
| Missing Caching | 0 | 1 | 1 | 0 |
| **Total** | **0** | **4** | **4** | **4** |

**Overall Assessment:** The application has **good performance practices** with proper use of React memoization, debouncing, and virtual lists. Several medium-priority optimizations could improve performance at scale.

---

## 1. N+1 Query Analysis

### 1.1 Sequential Database Operations in Initialization - MEDIUM

**Location:** `src/stores/collectionStore.ts:107-129`

```typescript
// Load pre-loaded collections
for (const { id, document } of preloadedCollections) {
  const existing = await db.getCollection(id)  // <-- DB call per item
  if (!existing) {
    await db.saveCollection({...})  // <-- Another DB call per item
  }
  get().loadCollection(id, document, true, 'preloaded')
}
```

**Impact:** Medium - Only runs once at initialization, affects cold start time.

**Current Behavior:** For N preloaded collections, makes up to 2N IndexedDB operations sequentially.

**Recommended Fix:**
```typescript
// Batch check existing collections first
const existingIds = new Set(
  (await db.getAllCollections()).map(c => c.id)
)

// Then only save what's missing
const toSave = preloadedCollections.filter(({ id }) => !existingIds.has(id))
await Promise.all(toSave.map(({ id, document }) =>
  db.saveCollection({...})
))
```

---

### 1.2 Import Save Loop - INFO (Acceptable)

**Location:** `src/stores/collectionStore.ts:229-255`

```typescript
saveImportedCollections: async (collections, source, pathToIdMap) => {
  for (const collection of collections) {
    await db.saveCollection({...})  // Sequential saves
    get().loadCollection(collection.id, collection.document, false, source)
  }
```

**Assessment:** Acceptable - User-initiated action, provides progress feedback. Could be parallelized but sequential provides clearer error handling.

---

## 2. Missing Database Indexes

### 2.1 IndexedDB Index Coverage - INFO (Complete)

**Location:** `src/services/db.ts:117-140`

**Current Indexes:**

| Store | Index | Used By |
|-------|-------|---------|
| collections | `by-namespace` | `getCollectionsByNamespace()` |
| collections | `by-preloaded` | Filtering preloaded |
| collections | `by-tags` | Tag filtering (multiEntry) |
| rollHistory | `by-collection` | `getRollHistoryByCollection()` |
| rollHistory | `by-timestamp` | `getRollHistory()` sorted |
| rollHistory | `by-pinned` | `getPinnedRolls()` |

**Assessment:** Index coverage is appropriate for query patterns. No missing indexes identified.

---

## 3. Unbounded Operations

### 3.1 Table Inheritance Cache - MEDIUM

**Location:** `src/engine/core/index.ts:619`

```typescript
/** Cache for resolved tables to avoid repeated inheritance resolution */
private resolvedTables: Map<string, SimpleTable> = new Map()
```

**Problem:** Cache grows unbounded. If users import many collections over time, this Map will contain entries for all tables ever resolved.

**Impact:** Medium - In typical usage (few collections), this is fine. Could grow large in edge cases.

**Recommended Fix:**
```typescript
// Option 1: LRU cache with max size
private resolvedTables: Map<string, SimpleTable> = new Map()
private readonly MAX_CACHE_SIZE = 500

private cacheResolvedTable(key: string, table: SimpleTable): void {
  if (this.resolvedTables.size >= this.MAX_CACHE_SIZE) {
    // Remove oldest entry (first key in Map)
    const firstKey = this.resolvedTables.keys().next().value
    this.resolvedTables.delete(firstKey)
  }
  this.resolvedTables.set(key, table)
}

// Option 2: Clear cache when collections change (already implemented)
clearInheritanceCache(): void {
  this.resolvedTables.clear()
}
```

---

### 3.2 History Display Limits - LOW

**Location:** `src/components/roller/RollHistoryList.tsx:68`

```typescript
history.slice(0, 50).map((item, index) => (
```

**Assessment:** Good - Display is capped at 50 items. However, the full history array is still passed as props.

**Minor Improvement:**
```typescript
// In parent component, slice before passing
const displayHistory = useMemo(() => history.slice(0, 50), [history])
```

---

### 3.3 History Store Cap - INFO (Well Implemented)

**Location:** `src/stores/rollStore.ts:172`

```typescript
history: [storedRoll, ...state.history].slice(0, 100),
```

**Assessment:** Good - History is properly capped at 100 entries in state. Database also has `trimHistory()` for cleanup.

---

## 4. Memory Leak Analysis

### 4.1 Event Listener Cleanup - INFO (All Proper)

All event listeners are properly cleaned up:

| Component | Listener | Cleanup |
|-----------|----------|---------|
| `useResizable.ts:94-103` | mousemove, mouseup | useEffect return |
| `useKeyboardShortcuts.ts:125-128` | keydown | useEffect return |
| `ThemeSwitcher.tsx:25-26` | mediaQuery change | useEffect return |
| `InsertDropdown.tsx:157` | mousedown | useEffect return |
| `CollectionSwitcher.tsx:104` | mousedown | useEffect return |
| `SplitPanelLayout.tsx:56` | resize | useEffect return |
| `OfflineIndicator.tsx:33-34` | online, offline | useEffect return |
| `InstallPrompt.tsx:52-53` | beforeinstallprompt | useEffect return |

---

### 4.2 Expanded Traces Set Growth - LOW

**Location:** `src/components/roller/RollHistoryList.tsx:30`

```typescript
const [expandedTraces, setExpandedTraces] = useState<Set<number>>(new Set())
```

**Problem:** If user expands many traces and history items are deleted, orphan IDs remain in the Set.

**Impact:** Low - Set only contains numbers, minimal memory impact.

**Recommended Fix:**
```typescript
// Clean up when history changes
useEffect(() => {
  setExpandedTraces(prev => {
    const historyIds = new Set(history.map(h => h.id))
    const cleaned = new Set([...prev].filter(id => historyIds.has(id)))
    return cleaned.size !== prev.size ? cleaned : prev
  })
}, [history])
```

---

## 5. Blocking Operations

### 5.1 JSON Parse/Stringify - LOW

**Locations:**
- `src/services/import.ts:196` - JSON.parse for imports
- `src/engine/core/index.ts:143` - JSON.parse in loadFromJson
- `src/services/export.ts` - JSON.stringify for exports

**Assessment:** Low impact - JSON operations are synchronous but:
- Files are typically small (KB to low MB)
- Operations are user-initiated, not continuous
- Modern browsers optimize these operations

**Future Consideration:** For very large documents, could use Web Workers:
```typescript
// worker.ts
self.onmessage = (e) => {
  const result = JSON.parse(e.data)
  self.postMessage(result)
}
```

---

### 5.2 Document Validation - INFO (Acceptable)

**Location:** `src/engine/core/validator.ts`

**Assessment:** Validation is synchronous but:
- Only runs on import/save
- Documents are small (TTRPG tables)
- Fast enough for typical document sizes

---

## 6. Redundant Operations

### 6.1 Duplicate Database Fetch - MEDIUM

**Location:** `src/stores/collectionStore.ts:276`

```typescript
saveCollection: async (id, document, source) => {
  const existing = get().collections.get(id)  // Already have this
  const now = Date.now()

  await db.saveCollection({
    id,
    document,
    // ...
    createdAt: existing ? (await db.getCollection(id))?.createdAt || now : now,  // <-- Redundant fetch!
    updatedAt: now,
  })
```

**Problem:** Fetches from database to get `createdAt` when we already know collection exists.

**Impact:** Medium - Extra IndexedDB operation on every save.

**Recommended Fix:**
```typescript
saveCollection: async (id, document, source) => {
  const existing = get().collections.get(id)
  const now = Date.now()

  // Get createdAt from existing collection in database if we need it
  // and we don't have it in memory
  let createdAt = now
  if (existing) {
    const stored = await db.getCollection(id)
    createdAt = stored?.createdAt || now
  }

  await db.saveCollection({
    // ...
    createdAt,
    updatedAt: now,
  })
```

Or better: Store `createdAt` in `CollectionMeta` to avoid the fetch entirely.

---

## 7. Missing Caching

### 7.1 Table Lookup by ID Uses Linear Search - MEDIUM

**Location:** `src/engine/core/index.ts:233-246, 779-788`

```typescript
getTable(tableId: string, collectionId?: string): Table | undefined {
  if (collectionId) {
    const collection = this.collections.get(collectionId)
    return collection?.document.tables.find((t) => t.id === tableId)  // O(n) search
  }

  // Search all collections
  for (const collection of this.collections.values()) {
    const table = collection.document.tables.find((t) => t.id === tableId)  // O(n*m) worst case
    if (table) return table
  }
```

**Impact:** Medium - Called frequently during roll evaluation. Linear search is O(n) per call.

**Recommended Fix:**
```typescript
// Add table index on collection load
interface LoadedCollection {
  // ...
  tableIndex: Map<string, Table>  // Add this
}

loadCollection(document: RandomTableDocument, id: string, isPreloaded = false): void {
  // Build table index
  const tableIndex = new Map<string, Table>()
  for (const table of document.tables) {
    tableIndex.set(table.id, table)
  }

  const collection: LoadedCollection = {
    id,
    document,
    tableIndex,  // Add to collection
    // ...
  }
}

getTable(tableId: string, collectionId?: string): Table | undefined {
  if (collectionId) {
    return this.collections.get(collectionId)?.tableIndex.get(tableId)  // O(1)
  }
  // ...
}
```

---

### 7.2 Template Lookup Similarly - LOW

**Location:** `src/engine/core/index.ts:285-288, 848-858`

Same pattern as table lookup. Lower priority since templates are less frequently accessed.

---

## 8. What's Done Well

### 8.1 React Memoization - Excellent

Most components use `memo()`:
- `CollectionAccordion`, `CollectionAccordionItem`
- `BrowserPanel`, `BrowserListItem`
- `RollHistoryList`, `CurrentRollResult`
- `TraceViewer`, `ResizeHandle`
- `ThemeSwitcher`

### 8.2 useMemo and useCallback - Excellent

**Examples:**
```typescript
// CollectionAccordion.tsx:35
const sortedCollections = useMemo(() => {
  const collections = Array.from(collectionsMap.values())
  return collections.sort(...)
}, [collectionsMap])

// useBrowserFilter.ts:65
const allItems = useMemo((): BrowserItem[] => {...}, [tables, templates, activeTab])
```

### 8.3 Debouncing - Excellent

**Locations:**
- `useBrowserFilter.ts:62` - Search query debounced 300ms
- `useResizable.ts:85` - Width persistence debounced 500ms
- `usePatternEvaluation.ts:374` - Pattern evaluation debounced

### 8.4 Virtual List - Excellent

**Location:** `src/components/roller/VirtualizedItemList.tsx`

Uses `@tanstack/react-virtual` for efficient rendering of large lists.

### 8.5 Lazy Loading - Good

Monaco editor loads asynchronously with loading state.

---

## Performance Score

```
Performance Score

   85/100

   Breakdown:
   React Optimization             19/20
   Data Fetching                  15/20
   Caching Strategy               15/20
   Memory Management              18/20
   Rendering Efficiency           18/20

```

---

## Recommended Improvements

### Quick Wins (< 1 hour)
1. Fix redundant `db.getCollection` in `saveCollection`
2. Add cleanup for `expandedTraces` Set

### Medium Effort (1-4 hours)
1. Add table/template index Maps to `LoadedCollection`
2. Batch preloaded collection checks on initialization

### Future Consideration
1. Add LRU limit to `resolvedTables` cache
2. Consider Web Workers for large JSON operations
3. Profile actual usage patterns with React DevTools

---

## Monitoring Recommendations

1. **Add Performance Marks:**
```typescript
performance.mark('roll-start')
// ... roll operation
performance.mark('roll-end')
performance.measure('roll-duration', 'roll-start', 'roll-end')
```

2. **Track Collection Sizes:**
```typescript
console.log('Collections:', this.collections.size)
console.log('Cached tables:', this.resolvedTables.size)
```

3. **Use React DevTools Profiler** to identify render bottlenecks in production.

---

*Report generated: 2025-11-30*
*Analyzed files: src/** (stores, hooks, components, engine, services)*
