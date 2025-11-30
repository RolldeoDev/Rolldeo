# Error Handling Audit Report

## Executive Summary

| Category | Critical | Medium | Low | Style |
|----------|----------|--------|-----|-------|
| Empty/Silent Catch | 0 | 1 | 3 | 0 |
| Error Propagation | 0 | 1 | 1 | 0 |
| User-Facing Errors | 0 | 0 | 2 | 0 |
| Async Error Handling | 0 | 0 | 1 | 0 |
| Resource Cleanup | 0 | 0 | 0 | 0 |
| **Total** | **0** | **2** | **7** | **0** |

**Overall Assessment:** The codebase has **good error handling practices** with no critical issues. A few medium-priority improvements would enhance debuggability.

---

## 1. Catch Block Analysis

### Silent/Empty Catch Blocks

#### Issue #1: Math Evaluation Silently Returns 0 ⚠️ MEDIUM

**Location:** `src/engine/core/math.ts:301-309`

```typescript
export function evaluateMath(expr: string, context: GenerationContext): number {
  try {
    const tokens = tokenize(expr)
    const parser = new MathParser(tokens, context)
    return parser.parse()
  } catch (error) {
    console.error(`Math evaluation error: ${expr}`, error)
    return 0  // ← Silent fallback
  }
}
```

**Problem:** Returns `0` on error, which could be a valid result. Caller cannot distinguish between "evaluated to 0" and "evaluation failed".

**Impact:** Medium - Could cause subtle bugs if a table calculation silently fails.

**Suggested Fix:**
```typescript
export function evaluateMath(expr: string, context: GenerationContext): number | null {
  try {
    const tokens = tokenize(expr)
    const parser = new MathParser(tokens, context)
    return parser.parse()
  } catch (error) {
    console.error(`Math evaluation error: ${expr}`, error)
    return null  // Explicit failure indicator
  }
}
```

---

#### Issue #2: Theme Initialization Swallows Parse Errors ✅ LOW (Acceptable)

**Location:** `src/stores/uiStore.ts:226-233`

```typescript
try {
  const parsed = JSON.parse(stored)
  if (parsed.state?.theme) {
    applyTheme(parsed.state.theme)
  }
} catch {
  // Ignore parse errors
}
```

**Assessment:** This is **acceptable** - corrupted localStorage shouldn't crash the app. Falls back to 'system' theme.

---

#### Issue #3: JSON Parse in Editor Silently Ignored ✅ LOW (Acceptable)

**Location:** `src/pages/EditorPage.tsx:118-120`

```typescript
try {
  const parsed = JSON.parse(value) as RandomTableDocument
  setDocument(parsed)
} catch {
  // Invalid JSON, don't update document
}
```

**Assessment:** **Acceptable** - User is actively editing JSON; showing errors on every keystroke would be annoying. Validation errors are shown separately.

---

#### Issue #4: getTableList/getTemplateList Return Empty on Error ✅ LOW (Acceptable)

**Location:** `src/stores/collectionStore.ts:305-318`

```typescript
getTableList: (collectionId) => {
  try {
    return get().engine.listTables(collectionId)
  } catch {
    return []
  }
},
```

**Assessment:** **Acceptable** - Used for UI rendering. Returning empty array is safe fallback for invalid collection IDs.

---

### Catch Blocks That Only Log

#### Issue #5: History Load Only Logs Error ⚠️ MEDIUM

**Location:** `src/stores/rollStore.ts:243-248`

```typescript
loadHistory: async () => {
  if (get().historyLoaded) return

  try {
    const history = await db.getRollHistory(100)
    set({ history, historyLoaded: true })
  } catch (error) {
    console.error('Failed to load history:', error)
    // ← No state update, no user notification
  }
},
```

**Problem:** User sees no indication that history failed to load. The `historyLoaded` flag remains false, so repeated attempts would keep failing silently.

**Suggested Fix:**
```typescript
loadHistory: async () => {
  if (get().historyLoaded) return

  try {
    const history = await db.getRollHistory(100)
    set({ history, historyLoaded: true })
  } catch (error) {
    console.error('Failed to load history:', error)
    set({ historyLoaded: true, historyError: 'Failed to load roll history' })
  }
},
```

---

## 2. Error Propagation Analysis

### Proper Error Re-throwing ✅

**Location:** `src/stores/rollStore.ts:174-178, 219-223`

```typescript
} catch (error) {
  const message = error instanceof Error ? error.message : 'Roll failed'
  set({ isRolling: false, rollError: message })
  throw error  // ✅ Re-throws for caller to handle
}
```

**Assessment:** **Good** - Errors are captured for UI, then re-thrown for upstream handling.

---

### Error Type Preservation ✅

**Location:** `src/services/import.ts:87-92`

```typescript
} catch (error) {
  result.errors.push({
    fileName: file.name,
    error: error instanceof Error ? error.message : 'Unknown error reading file',
  })
}
```

**Assessment:** **Good** - Checks for Error instance, provides fallback message.

---

### Potential Error Loss Issue

#### Issue #6: Initialize Doesn't Re-throw ✅ LOW (Intentional)

**Location:** `src/stores/collectionStore.ts:153-158`

```typescript
} catch (error) {
  set({
    error: error instanceof Error ? error.message : 'Failed to initialize',
    isLoading: false,
  })
  // ← Error not re-thrown
}
```

**Assessment:** **Intentional** - Store errors are captured in state for UI display. App continues to function with partial data. This is appropriate for a PWA.

---

## 3. Error Types Analysis

### Custom Error Types

**Finding:** The codebase uses **generic `Error` objects** throughout. No custom error types are defined.

**Current Pattern:**
```typescript
throw new Error(`Collection not found: ${collectionId}`)
throw new Error(`Table not found: ${tableId}`)
throw new Error(`Recursion limit exceeded (${context.config.maxRecursionDepth})`)
```

**Recommendation:** ✅ LOW PRIORITY

For this application size, generic errors with descriptive messages are sufficient. Custom error types would add complexity without significant benefit.

However, if the engine were to be distributed as a library, consider:

```typescript
// Potential future enhancement
export class CollectionNotFoundError extends Error {
  constructor(public collectionId: string) {
    super(`Collection not found: ${collectionId}`)
    this.name = 'CollectionNotFoundError'
  }
}

export class RecursionLimitError extends Error {
  constructor(public limit: number) {
    super(`Recursion limit exceeded (${limit})`)
    this.name = 'RecursionLimitError'
  }
}
```

---

## 4. User-Facing Error Analysis

### Error Translation Quality

| Location | User Message | Developer Info | Assessment |
|----------|--------------|----------------|------------|
| Import service | `'Invalid JSON format'` | N/A | ✅ Clear |
| Import service | `'Missing required "metadata" field'` | N/A | ✅ Helpful |
| Roll store | `error.message` or `'Roll failed'` | Console log | ✅ OK |
| Collection store | `error.message` or `'Failed to initialize'` | N/A | ✅ OK |
| Editor page | `error.message` or `'Failed to save'` | N/A | ✅ OK |

### Issues Found

#### Issue #7: Engine Errors Exposed to Users ✅ LOW

**Location:** Various UI components display `rollError` state

```typescript
// rollStore.ts
const message = error instanceof Error ? error.message : 'Roll failed'
set({ isRolling: false, rollError: message })
```

Engine errors like `"Recursion limit exceeded (50)"` are shown directly to users.

**Assessment:** For a technical audience (TTRPG players using a table editor), this is **acceptable**. More technical users benefit from detailed errors.

**Potential Enhancement:**
```typescript
// Map technical errors to user-friendly messages
const userFriendlyErrors: Record<string, string> = {
  'Recursion limit exceeded': 'This table has too many nested references. Try simplifying.',
  'Collection not found': 'The referenced collection could not be loaded.',
}
```

---

## 5. Async Error Handling

### Promise Rejection Handling ✅

All async operations are properly handled with try/catch:

| Location | Pattern | Assessment |
|----------|---------|------------|
| `collectionStore.initialize()` | try/catch with state update | ✅ Good |
| `rollStore.rollOnTable()` | try/catch + re-throw | ✅ Good |
| `importJsonFile()` | try/catch with result object | ✅ Good |
| `importZipFile()` | try/catch with result object | ✅ Good |
| `HomePage.handleImport()` | try/catch/finally | ✅ Good |
| `EditorPage.handleSave()` | try/catch/finally | ✅ Good |

### Unhandled Promise Check

**Finding:** No fire-and-forget promises found. All async operations are awaited or handled.

---

#### Issue #8: pinResult/deleteHistoryItem Don't Handle Errors ✅ LOW

**Location:** `src/stores/rollStore.ts:254-268`

```typescript
pinResult: async (id, pinned) => {
  await db.pinRoll(id, pinned)  // ← No try/catch
  set((state) => ({
    history: state.history.map((r) => (r.id === id ? { ...r, pinned } : r)),
  }))
},

deleteHistoryItem: async (id) => {
  await db.deleteRoll(id)  // ← No try/catch
  set((state) => ({
    history: state.history.filter((r) => r.id !== id),
  }))
},
```

**Problem:** If IndexedDB operation fails, the error propagates but UI state is not rolled back.

**Impact:** Low - IndexedDB failures are rare; optimistic updates are acceptable.

**Suggested Fix:**
```typescript
pinResult: async (id, pinned) => {
  try {
    await db.pinRoll(id, pinned)
    set((state) => ({
      history: state.history.map((r) => (r.id === id ? { ...r, pinned } : r)),
    }))
  } catch (error) {
    console.error('Failed to pin result:', error)
    // Optionally: show toast notification
  }
},
```

---

## 6. Resource Cleanup

### File/Connection Cleanup ✅

**Finding:** No resource cleanup issues found.

- **File operations** use browser APIs that auto-cleanup
- **IndexedDB** via `idb` library handles connection lifecycle
- **ZIP processing** uses JSZip which doesn't require explicit cleanup
- No WebSocket or long-lived connections exist

---

## 7. Error Boundary Coverage ✅

**Location:** `src/components/common/ErrorBoundary.tsx`

The app has a top-level ErrorBoundary that:
- Catches React rendering errors
- Logs errors to console
- Displays user-friendly fallback UI
- Provides "Try Again" and "Go Home" recovery options

**Assessment:** ✅ Excellent error boundary implementation.

---

## 8. Validation Error Handling ✅

**Location:** `src/services/import.ts:192-254`

The import service provides excellent validation with specific error messages:

```typescript
// Examples of clear validation errors
{ error: 'Document must be a JSON object' }
{ error: 'Missing required "metadata" field' }
{ error: 'Missing or invalid "metadata.name"' }
{ error: 'Missing "metadata.specVersion"' }
{ error: firstError?.message || 'Document validation failed' }
```

**Assessment:** ✅ Clear, actionable error messages.

---

## Summary of Findings

### Issues to Address

| Priority | Issue | Location | Action |
|----------|-------|----------|--------|
| MEDIUM | Math evaluation returns 0 on error | `engine/core/math.ts:306-309` | Return null or throw |
| MEDIUM | History load only logs error | `stores/rollStore.ts:246-248` | Add state error flag |
| LOW | pin/delete don't handle IndexedDB errors | `stores/rollStore.ts:254-268` | Add try/catch |
| LOW | Engine errors shown raw to users | `stores/rollStore.ts:175` | Consider mapping |

### What's Done Well ✅

1. **Consistent error message extraction:** `error instanceof Error ? error.message : 'Fallback'`
2. **Proper async/await with try/catch:** All async operations handle errors
3. **Error state management:** Stores track `error` and `isLoading` states
4. **Error boundaries:** React errors are caught at top level
5. **Validation errors:** Import service provides clear, specific errors
6. **Error propagation:** Critical errors re-thrown after capture
7. **Finally blocks:** Loading states properly reset in finally blocks

---

## Recommended Improvements

### Quick Wins (< 1 hour)

1. Add error state for history loading in `rollStore`
2. Add try/catch to `pinResult` and `deleteHistoryItem`

### Medium Effort (1-4 hours)

1. Make `evaluateMath` return `number | null` and update callers
2. Create user-friendly error message mapping for common engine errors

### Future Consideration

1. Custom error types if engine becomes a standalone library
2. Centralized error reporting/logging service
3. Error boundary per major section (Roller, Editor, Library)

---

## Error Handling Score

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   ERROR HANDLING SCORE                                                       │
│                                                                              │
│   ████████████████████████████████████████████░░░░░░░░  82/100              │
│                                                                              │
│   Breakdown:                                                                 │
│   ├── No Critical Issues                    20/20                           │
│   ├── Async Handling                        18/20                           │
│   ├── User-Facing Messages                  16/20                           │
│   ├── Error Propagation                     16/20                           │
│   └── Error Recovery                        12/20                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

The codebase demonstrates **solid error handling fundamentals** with room for minor improvements in edge case handling and user messaging.
