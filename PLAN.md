# Plan: Making All Variables Content-Aware by Default

## Current State Analysis

### How It Works Today
- Variables declared **without** `$` prefix → stored as simple `string | number`
- Variables declared **with** `$` prefix → stored as `CaptureItem` with `{value, sets, description}`
- Both are accessed with `{{$varName}}` syntax in patterns
- Only `$`-prefixed variables can use property access: `{{$hero.@weapon}}`

### Key Files Involved
- `src/engine/core/evaluator.ts` - Core evaluation logic (lines 248-413)
- `src/engine/core/context.ts` - Two separate Maps for storage
- `src/engine/core/parser.ts` - Detects `$` prefix in declarations
- `src/components/editor/KeyValueEditor.tsx` - Visual highlighting
- `src/components/editor/VariablesEditor.tsx` - Key validation patterns

---

## Problem Statement

The user wants to simplify variable declaration by making all shared variables content-aware by default, removing the need to specify `$` in the key name while keeping the `$` prefix required when **referencing** variables in patterns.

**Before (current):**
```json
{
  "shared": {
    "$hero": "{{characterTable}}",    // content-aware
    "weapon": "{{weaponTable}}"       // NOT content-aware - can't use .@prop
  }
}
```
Pattern: `{{$hero.@class}}` ✓ works, `{{$weapon.@type}}` ✗ fails

**After (proposed):**
```json
{
  "shared": {
    "hero": "{{characterTable}}",     // content-aware automatically
    "weapon": "{{weaponTable}}"       // also content-aware
  }
}
```
Pattern: `{{$hero.@class}}` ✓ works, `{{$weapon.@type}}` ✓ also works

---

## Multi-Perspective Analysis

### 1. User Experience Perspective

**Pros:**
- Simpler mental model - no need to remember when to use `$`
- Fewer "why doesn't this work?" moments when trying `{{$var.@prop}}`
- More consistent - all variables behave the same way
- Reduces documentation complexity

**Cons:**
- Existing users who learned the `$` convention need to unlearn it
- Visual distinction in the editor is lost (pink highlighting for `$` vars)
- May be confusing that declaration doesn't use `$` but reference does

**Rating: +3 (net positive)**

---

### 2. Performance Perspective

**Pros:**
- Simplified code path - one evaluation method instead of two
- Removes branching logic in hot path

**Cons:**
- Every variable now stores a `CaptureItem` object instead of primitive
- Memory overhead: `{value: "5", sets: {}, description: ""}` vs just `"5"`
- More garbage collection pressure from object creation

**Analysis:**
The performance impact is likely negligible for typical use cases. Most collections have <50 variables. The `sets` Map will be empty for simple values, which is minimal overhead.

**Rating: -1 (minor negative, acceptable)**

---

### 3. Backward Compatibility Perspective

**Pros:**
- Existing `$`-prefixed variables continue to work (just with unnecessary prefix)
- Pattern references `{{$varName}}` unchanged
- No breaking changes to evaluation output

**Cons:**
- Behavior change for non-`$` variables (they gain capture ability)
- Existing files with `weapon` key can now use `{{$weapon.@type}}`
- Could surface bugs in existing patterns that accidentally use `.@prop`

**Analysis:**
This is actually a **non-breaking enhancement**. Variables that weren't content-aware gain capability they didn't have. The only risk is if users accidentally wrote `{{$weapon.@type}}` expecting it to fail gracefully (unlikely).

**Rating: +2 (backward compatible enhancement)**

---

### 4. Code Complexity Perspective

**Pros:**
- Remove branching in `evaluateSharedVariables()`
- Unify `sharedVariables` and `captureSharedVariables` Maps
- Simplify `resolveVariable()` logic
- Remove `highlightCaptureAware` prop from KeyValueEditor

**Cons:**
- Need to update type definitions
- Migration of existing code paths
- May need to keep some legacy handling for edge cases

**Estimated Changes:**
- `context.ts`: Merge Maps → ~20 lines changed
- `evaluator.ts`: Remove branching → ~50 lines simplified
- `parser.ts`: Update detection → ~10 lines
- `KeyValueEditor.tsx`: Remove highlight logic → ~30 lines removed
- `VariablesEditor.tsx`: Update key pattern → ~5 lines

**Rating: +2 (reduces complexity)**

---

### 5. Future Extensibility Perspective

**Pros:**
- Consistent foundation for future features
- No need to decide "should this be content-aware?" for new features
- Enables richer variable introspection universally

**Cons:**
- Harder to add "lightweight" variable mode later if needed
- All variables carry full metadata even when not needed

**Rating: +1 (good for future)**

---

### 6. Documentation & Learning Curve Perspective

**Pros:**
- Simpler explanation: "Variables declared in shared, referenced with `{{$name}}`"
- No need to explain `$` prefix distinction
- Fewer edge cases to document

**Cons:**
- Need to update existing documentation
- Users reading old tutorials may be confused by `$` prefix examples

**Rating: +2 (long-term simplification)**

---

## Alternative Solutions Considered

### Alternative A: Keep Current System (Do Nothing)
**Description:** Maintain the `$` prefix opt-in system.

**Pros:**
- No migration effort
- Users can choose between simple and rich variables
- Explicit intent in variable declaration

**Cons:**
- Continued confusion about when to use `$`
- Features continue to require `$` for full functionality

**Verdict:** Does not address the core problem.

---

### Alternative B: Auto-Detect Content-Awareness at Evaluation Time
**Description:** Keep declaration syntax unchanged, but automatically upgrade variables to content-aware when:
- The expression references a table
- The variable is accessed with `.@property` syntax

**Pros:**
- Zero syntax change required
- Backward compatible
- Smart behavior based on actual usage

**Cons:**
- Complex detection logic
- Inconsistent behavior based on evaluation order
- Hard to predict which variables are content-aware
- Would require re-evaluation if usage patterns change

**Verdict:** Too magical and unpredictable. Rejected.

---

### Alternative C: Make All Variables Content-Aware (Recommended)
**Description:** Remove the `$` prefix from declaration, make all shared variables content-aware by default.

**Pros:**
- Simple, consistent mental model
- Backward compatible (enhances capability)
- Reduces code complexity
- Aligns with user expectations

**Cons:**
- Minor memory overhead
- Requires code changes across engine and UI

**Verdict:** Best balance of simplicity and capability.

---

### Alternative D: Invert the Convention (`$` for Simple Variables)
**Description:** Make content-aware the default, use `$` prefix for simple/primitive variables.

**Pros:**
- Explicit opt-out for performance-sensitive cases

**Cons:**
- Confusing - `$` in patterns vs `$` in declaration means different things
- Breaking change for existing `$` variables
- Added complexity instead of removing it

**Verdict:** More confusing than helpful. Rejected.

---

### Alternative E: New Syntax for Simple Variables
**Description:** Keep all variables content-aware, but introduce `@simple` or `!` prefix for explicitly simple variables.

**Pros:**
- Keeps escape hatch for optimization
- Default is the common case (content-aware)

**Cons:**
- Adds new syntax to learn
- Most users won't need the optimization
- Premature optimization

**Verdict:** Over-engineering. Keep it simple.

---

## Recommendation

**Proceed with Alternative C: Make All Variables Content-Aware**

### Confidence: High (8/10)

### Rationale:
1. **User benefit outweighs costs** - The UX improvement is significant
2. **Performance impact is negligible** - Object overhead is minimal for typical use
3. **Backward compatible** - Enhances capability without breaking existing files
4. **Reduces complexity** - Less code, fewer edge cases
5. **Aligns with feature trajectory** - More features rely on content-awareness

### Migration Strategy:
1. **Phase 1:** Update engine to treat all shared variables as content-aware
2. **Phase 2:** Update UI to remove `$` highlighting distinction
3. **Phase 3:** Update documentation
4. **Phase 4:** Optionally strip `$` prefix from existing files (non-breaking)

---

## Implementation Steps

### Step 1: Update Context Types
- Merge `sharedVariables` and `captureSharedVariables` into single `sharedVariables: Map<string, CaptureItem>`
- Update `CaptureItem` type if needed

### Step 2: Update Evaluator
- Remove `$` prefix detection in `evaluateSharedVariables()`
- Route all shared variables through `evaluateCaptureAwareShared()` logic
- Simplify variable resolution

### Step 3: Update Parser
- Remove `$` detection for declaration (keep for reference patterns)
- Update any pattern validation

### Step 4: Update UI Components
- Remove `highlightCaptureAware` prop and logic
- Update key validation patterns to disallow `$` prefix (or allow but strip)
- Update tooltips/help text

### Step 5: Update Tests
- Add tests for new behavior
- Verify backward compatibility with existing test files

### Step 6: Documentation
- Update variable documentation
- Add migration notes for users with `$` prefixed variables

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance regression | Low | Low | Profile before/after, optimize if needed |
| Edge case bugs | Medium | Medium | Comprehensive testing |
| User confusion | Low | Low | Clear release notes |
| Backward compatibility | Very Low | High | All existing patterns continue to work |

---

## Questions for User

1. Should the UI **strip** `$` prefix automatically if users type it, or **allow** it for backward compatibility?
2. Should we add a deprecation warning for `$` prefixed variables, or silently accept them?
3. Any specific test cases or files you want to verify still work correctly?
