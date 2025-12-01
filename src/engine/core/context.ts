/**
 * Generation Context
 *
 * Manages state during a single generation run.
 * Tracks variables, placeholders, recursion depth, and unique selections.
 */

import type { EngineConfig, Sets, RollResult, CaptureVariable, CaptureItem, EntryDescription } from '../types'
import type { TraceContext } from './trace'
import { createTraceContext } from './trace'

// ============================================================================
// Types
// ============================================================================

export interface GenerationContext {
  /** Static variables (loaded from document at engine init) */
  staticVariables: Map<string, string>

  /** Shared variables (evaluated once per generation) */
  sharedVariables: Map<string, string | number>

  /** Tracks which table/template set each shared variable (for multi-roll re-evaluation) */
  sharedVariableSources: Map<string, string>

  /** Document-level shared variable names (for shadowing prevention) */
  documentSharedNames: Set<string>

  /** Placeholder values keyed by placeholder name */
  placeholders: Map<string, Sets>

  /** Current recursion depth for table rolls */
  recursionDepth: number

  /** Tracking used entries for unique selection: tableId → Set of entry IDs */
  usedEntries: Map<string, Set<string>>

  /** Instance results for {{tableId#instanceName}} syntax */
  instanceResults: Map<string, RollResult>

  /** Capture variables for roll capture system: {{N*table >> $var}} */
  captureVariables: Map<string, CaptureVariable>

  /** Capture-aware shared variables: keys starting with $ capture full roll with sets */
  captureSharedVariables: Map<string, CaptureItem>

  /** Engine configuration */
  config: EngineConfig

  /** Current table ID (for {{again}}) */
  currentTableId?: string

  /** Current entry ID (for {{again}} exclusion) */
  currentEntryId?: string

  /** Current collection ID */
  currentCollectionId?: string

  /** Optional trace context - only present when tracing is enabled */
  trace?: TraceContext

  /** Collected entry descriptions during generation */
  collectedDescriptions: EntryDescription[]
}

// ============================================================================
// Context Factory
// ============================================================================

export interface CreateContextOptions {
  /** Enable trace mode for this generation */
  enableTrace?: boolean
}

/**
 * Create a fresh generation context
 */
export function createContext(
  config: EngineConfig,
  staticVariables?: Map<string, string>,
  options?: CreateContextOptions
): GenerationContext {
  return {
    staticVariables: staticVariables ?? new Map(),
    sharedVariables: new Map(),
    sharedVariableSources: new Map(),
    documentSharedNames: new Set(),
    placeholders: new Map(),
    recursionDepth: 0,
    usedEntries: new Map(),
    instanceResults: new Map(),
    captureVariables: new Map(),
    captureSharedVariables: new Map(),
    config,
    currentTableId: undefined,
    currentEntryId: undefined,
    currentCollectionId: undefined,
    trace: options?.enableTrace ? createTraceContext() : undefined,
    collectedDescriptions: [],
  }
}

/**
 * Clone a context for nested operations
 * Used when entering a new table roll to preserve parent state
 */
export function cloneContext(ctx: GenerationContext): GenerationContext {
  return {
    staticVariables: ctx.staticVariables, // Shared reference (immutable during generation)
    sharedVariables: ctx.sharedVariables, // Shared reference
    sharedVariableSources: ctx.sharedVariableSources, // Shared reference
    documentSharedNames: ctx.documentSharedNames, // Shared reference (immutable after init)
    placeholders: new Map(ctx.placeholders), // Shallow clone for isolation
    recursionDepth: ctx.recursionDepth,
    usedEntries: ctx.usedEntries, // Shared reference for unique tracking
    instanceResults: ctx.instanceResults, // Shared reference
    captureVariables: ctx.captureVariables, // Shared reference - captures persist across nested calls
    captureSharedVariables: ctx.captureSharedVariables, // Shared reference - capture-aware shared vars persist
    config: ctx.config,
    currentTableId: ctx.currentTableId,
    currentEntryId: ctx.currentEntryId,
    currentCollectionId: ctx.currentCollectionId,
    trace: ctx.trace, // Shared reference - trace tree is built across all nested calls
    collectedDescriptions: ctx.collectedDescriptions, // Shared reference - descriptions persist across nested calls
  }
}

// ============================================================================
// Variable Resolution
// ============================================================================

/**
 * Resolve a variable by name.
 * Lookup order: shared → static
 */
export function resolveVariable(
  ctx: GenerationContext,
  name: string,
  _alias?: string
): string | number | undefined {
  // TODO: Handle alias resolution when imports are implemented
  // For now, we just look up the variable name directly

  // Check shared variables first
  if (ctx.sharedVariables.has(name)) {
    return ctx.sharedVariables.get(name)
  }

  // Then static variables
  if (ctx.staticVariables.has(name)) {
    return ctx.staticVariables.get(name)
  }

  return undefined
}

/**
 * Set a shared variable (during generation)
 * @param source - The table/template ID that set this variable (for multi-roll re-evaluation tracking)
 */
export function setSharedVariable(
  ctx: GenerationContext,
  name: string,
  value: string | number,
  source?: string
): void {
  ctx.sharedVariables.set(name, value)
  if (source) {
    ctx.sharedVariableSources.set(name, source)
  }
}

/**
 * Get the source (table/template ID) that set a shared variable
 */
export function getSharedVariableSource(ctx: GenerationContext, name: string): string | undefined {
  return ctx.sharedVariableSources.get(name)
}

/**
 * Register a document-level shared variable name (for shadowing prevention)
 */
export function registerDocumentSharedName(ctx: GenerationContext, name: string): void {
  ctx.documentSharedNames.add(name)
}

/**
 * Check if a shared variable name would shadow a document-level shared variable
 */
export function wouldShadowDocumentShared(ctx: GenerationContext, name: string): boolean {
  return ctx.documentSharedNames.has(name)
}

// ============================================================================
// Placeholder Resolution
// ============================================================================

/**
 * Get a placeholder value
 */
export function getPlaceholder(
  ctx: GenerationContext,
  name: string,
  property?: string
): string | undefined {
  const sets = ctx.placeholders.get(name)
  if (!sets) return undefined

  if (property) {
    return sets[property]
  }

  // Return the 'value' property by default
  return sets['value']
}

/**
 * Set placeholder values
 */
export function setPlaceholders(
  ctx: GenerationContext,
  name: string,
  sets: Sets
): void {
  // Deep merge with existing placeholders
  const existing = ctx.placeholders.get(name) ?? {}
  ctx.placeholders.set(name, { ...existing, ...sets })
}

/**
 * Merge placeholder sets from an entry selection
 */
export function mergePlaceholderSets(
  ctx: GenerationContext,
  tableName: string,
  sets: Sets
): void {
  // Sets are keyed by table name for @tableName.property access
  setPlaceholders(ctx, tableName, sets)
}

// ============================================================================
// Recursion Tracking
// ============================================================================

/**
 * Increment recursion depth and check limit
 * Returns true if within limit, false if exceeded
 */
export function incrementRecursion(ctx: GenerationContext): boolean {
  ctx.recursionDepth++
  return ctx.recursionDepth <= ctx.config.maxRecursionDepth
}

/**
 * Decrement recursion depth (after returning from nested call)
 */
export function decrementRecursion(ctx: GenerationContext): void {
  ctx.recursionDepth = Math.max(0, ctx.recursionDepth - 1)
}

// ============================================================================
// Unique Selection Tracking
// ============================================================================

/**
 * Get the set of used entry IDs for a table
 */
export function getUsedEntries(ctx: GenerationContext, tableId: string): Set<string> {
  if (!ctx.usedEntries.has(tableId)) {
    ctx.usedEntries.set(tableId, new Set())
  }
  return ctx.usedEntries.get(tableId)!
}

/**
 * Mark an entry as used for unique selection
 */
export function markEntryUsed(ctx: GenerationContext, tableId: string, entryId: string): void {
  getUsedEntries(ctx, tableId).add(entryId)
}

/**
 * Check if an entry has been used
 */
export function isEntryUsed(ctx: GenerationContext, tableId: string, entryId: string): boolean {
  return getUsedEntries(ctx, tableId).has(entryId)
}

/**
 * Clear used entries for a table (reset unique pool)
 */
export function clearUsedEntries(ctx: GenerationContext, tableId: string): void {
  ctx.usedEntries.delete(tableId)
}

// ============================================================================
// Instance Tracking
// ============================================================================

/**
 * Store an instance result
 */
export function setInstance(ctx: GenerationContext, name: string, result: RollResult): void {
  ctx.instanceResults.set(name, result)
}

/**
 * Get an instance result
 */
export function getInstance(ctx: GenerationContext, name: string): RollResult | undefined {
  return ctx.instanceResults.get(name)
}

// ============================================================================
// Capture Variable Resolution
// ============================================================================

/**
 * Get a capture variable by name
 */
export function getCaptureVariable(
  ctx: GenerationContext,
  name: string
): CaptureVariable | undefined {
  return ctx.captureVariables.get(name)
}

/**
 * Set a capture variable.
 * Returns true if overwriting an existing variable (for warning purposes)
 */
export function setCaptureVariable(
  ctx: GenerationContext,
  name: string,
  variable: CaptureVariable
): boolean {
  const exists = ctx.captureVariables.has(name)
  ctx.captureVariables.set(name, variable)
  return exists
}

/**
 * Check if a name conflicts with existing variables
 * Returns the type of conflict or null if no conflict
 */
export function hasVariableConflict(
  ctx: GenerationContext,
  name: string
): 'capture' | 'captureShared' | 'shared' | 'static' | null {
  if (ctx.captureVariables.has(name)) return 'capture'
  if (ctx.captureSharedVariables.has(name)) return 'captureShared'
  if (ctx.sharedVariables.has(name)) return 'shared'
  if (ctx.staticVariables.has(name)) return 'static'
  return null
}

// ============================================================================
// Capture-Aware Shared Variables
// ============================================================================

/**
 * Get a capture-aware shared variable by name.
 * These are shared variables with keys starting with $ that capture full roll results with sets.
 */
export function getCaptureSharedVariable(
  ctx: GenerationContext,
  name: string
): CaptureItem | undefined {
  return ctx.captureSharedVariables.get(name)
}

/**
 * Set a capture-aware shared variable.
 * The name should NOT include the $ prefix (stripped during evaluation).
 */
export function setCaptureSharedVariable(
  ctx: GenerationContext,
  name: string,
  item: CaptureItem
): void {
  ctx.captureSharedVariables.set(name, item)
}

/**
 * Check if a capture-aware shared variable exists
 */
export function hasCaptureSharedVariable(
  ctx: GenerationContext,
  name: string
): boolean {
  return ctx.captureSharedVariables.has(name)
}

// ============================================================================
// Current Roll State
// ============================================================================

/**
 * Set the current table being rolled (for {{again}})
 */
export function setCurrentTable(
  ctx: GenerationContext,
  tableId: string,
  entryId?: string
): void {
  ctx.currentTableId = tableId
  ctx.currentEntryId = entryId
}

/**
 * Set the current collection
 */
export function setCurrentCollection(ctx: GenerationContext, collectionId: string): void {
  ctx.currentCollectionId = collectionId
}

// ============================================================================
// Description Collection
// ============================================================================

/**
 * Add an entry description to the collection.
 * Called when an entry with a description is selected during a roll.
 * The depth parameter tracks how deep in the recursion this description was captured,
 * allowing descriptions to be sorted from highest level (parent) to lowest level (child).
 */
export function addDescription(
  ctx: GenerationContext,
  tableName: string,
  tableId: string,
  rolledValue: string,
  description: string,
  depth?: number
): void {
  ctx.collectedDescriptions.push({
    tableName,
    tableId,
    rolledValue,
    description,
    depth: depth ?? ctx.recursionDepth,
  })
}
