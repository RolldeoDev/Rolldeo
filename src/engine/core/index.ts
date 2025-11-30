/**
 * Random Table Engine
 *
 * Main orchestrator for loading, validating, and rolling on random tables.
 * Implements the Random Table JSON Spec v1.0.
 */

import type {
  RandomTableDocument,
  Table,
  SimpleTable,
  CompositeTable,
  CollectionTable,
  Template,
  Entry,
  RollResult,
  LoadedCollection,
  EngineConfig,
  Assets,
  Sets,
  CaptureItem,
  CaptureVariable,
} from '../types'

import { rollDice } from '../dice'
import { validateDocument, type ValidationResult } from './validator'
import {
  createContext,
  incrementRecursion,
  decrementRecursion,
  setCurrentTable,
  setCurrentCollection,
  mergePlaceholderSets,
  resolveVariable,
  getPlaceholder,
  setInstance,
  getInstance,
  setSharedVariable,
  registerDocumentSharedName,
  wouldShadowDocumentShared,
  getCaptureVariable,
  setCaptureVariable,
  hasVariableConflict,
  type GenerationContext,
} from './context'
import {
  parseTemplate,
  type ExpressionToken,
} from './parser'
import { evaluateMath } from './math'
import { rollSimpleTable, buildWeightedPool, calculateTotalWeight } from '../tables/simple'
import { selectSource, buildSourcePool, calculateSourceWeight } from '../tables/composite'
import { rollCollectionTable } from '../tables/collection'
import { applyConditionals } from './conditionals'
import {
  beginTraceNode,
  endTraceNode,
  addTraceLeaf,
  extractTrace,
  type DiceRollMetadata,
  type EntrySelectMetadata,
  type VariableAccessMetadata,
  type PlaceholderAccessMetadata,
  type CompositeSelectMetadata,
  type MultiRollMetadata,
  type InstanceMetadata,
  type CollectionMergeMetadata,
  type CaptureMultiRollMetadata,
  type CaptureAccessMetadata,
  type CollectMetadata,
} from './trace'

// ============================================================================
// Types
// ============================================================================

export interface TableInfo {
  id: string
  name: string
  type: 'simple' | 'composite' | 'collection'
  description?: string
  tags?: string[]
  hidden?: boolean
  entryCount?: number
}

export interface TemplateInfo {
  id: string
  name: string
  description?: string
  tags?: string[]
}

export interface EngineOptions {
  config?: Partial<EngineConfig>
}

export interface RollOptions {
  /** Enable trace mode to capture execution details */
  enableTrace?: boolean
}

// ============================================================================
// Engine Class
// ============================================================================

export class RandomTableEngine {
  private collections: Map<string, LoadedCollection> = new Map()
  private config: EngineConfig

  constructor(options: EngineOptions = {}) {
    this.config = {
      maxRecursionDepth: options.config?.maxRecursionDepth ?? 50,
      maxExplodingDice: options.config?.maxExplodingDice ?? 100,
      maxInheritanceDepth: options.config?.maxInheritanceDepth ?? 5,
      uniqueOverflowBehavior: options.config?.uniqueOverflowBehavior ?? 'stop',
    }
  }

  // ==========================================================================
  // Loading
  // ==========================================================================

  /**
   * Load a collection from a parsed document
   */
  loadCollection(document: RandomTableDocument, id: string, isPreloaded = false): void {
    const collection: LoadedCollection = {
      id,
      document,
      imports: new Map(), // TODO: Implement import resolution
      isPreloaded,
      source: isPreloaded ? 'preloaded' : id,
    }

    this.collections.set(id, collection)
  }

  /**
   * Load a collection from JSON string
   */
  loadFromJson(json: string, id: string, isPreloaded = false): ValidationResult {
    const document = JSON.parse(json) as RandomTableDocument
    const validation = this.validate(document)

    if (validation.valid) {
      this.loadCollection(document, id, isPreloaded)
    }

    return validation
  }

  /**
   * Unload a collection
   */
  unloadCollection(id: string): boolean {
    return this.collections.delete(id)
  }

  /**
   * Check if a collection is loaded
   */
  hasCollection(id: string): boolean {
    return this.collections.has(id)
  }

  /**
   * Get a loaded collection
   */
  getCollection(id: string): LoadedCollection | undefined {
    return this.collections.get(id)
  }

  /**
   * List all loaded collections
   */
  listCollections(): Array<{ id: string; name: string; isPreloaded: boolean }> {
    return Array.from(this.collections.values()).map((c) => ({
      id: c.id,
      name: c.document.metadata.name,
      isPreloaded: c.isPreloaded,
    }))
  }

  /**
   * Resolve import aliases for collections based on a path-to-ID mapping.
   * This wires up the imports map for each collection that has an imports array.
   * Call this after loading all collections from a ZIP file.
   */
  resolveImports(pathToIdMap: Map<string, string>): void {
    for (const collection of this.collections.values()) {
      // Skip collections without imports
      if (!collection.document.imports || collection.document.imports.length === 0) {
        continue
      }

      // Clear existing imports (in case of re-resolution)
      collection.imports.clear()

      for (const imp of collection.document.imports) {
        // Try to find the target collection ID from the path mapping
        // The pathToIdMap contains entries for full paths, filenames, and ./prefixed versions
        const targetId = pathToIdMap.get(imp.path)

        if (targetId) {
          const targetCollection = this.collections.get(targetId)
          if (targetCollection) {
            collection.imports.set(imp.alias, targetCollection)
          }
        }
      }
    }
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate a document
   */
  validate(document: RandomTableDocument): ValidationResult {
    return validateDocument(document)
  }

  // ==========================================================================
  // Table Access
  // ==========================================================================

  /**
   * Get a table by ID
   */
  getTable(tableId: string, collectionId?: string): Table | undefined {
    if (collectionId) {
      const collection = this.collections.get(collectionId)
      return collection?.document.tables.find((t) => t.id === tableId)
    }

    // Search all collections
    for (const collection of this.collections.values()) {
      const table = collection.document.tables.find((t) => t.id === tableId)
      if (table) return table
    }

    return undefined
  }

  /**
   * List tables in a collection or all collections
   */
  listTables(collectionId?: string, includeHidden = false): TableInfo[] {
    const tables: TableInfo[] = []

    const addTables = (collection: LoadedCollection) => {
      for (const table of collection.document.tables) {
        if (!includeHidden && table.hidden) continue

        tables.push({
          id: table.id,
          name: table.name,
          type: table.type,
          description: table.description,
          tags: table.tags,
          hidden: table.hidden,
          entryCount: table.type === 'simple' ? (table as SimpleTable).entries.length : undefined,
        })
      }
    }

    if (collectionId) {
      const collection = this.collections.get(collectionId)
      if (collection) addTables(collection)
    } else {
      for (const collection of this.collections.values()) {
        addTables(collection)
      }
    }

    return tables
  }

  /**
   * Get a template by ID
   */
  getTemplate(templateId: string, collectionId: string): Template | undefined {
    const collection = this.collections.get(collectionId)
    return collection?.document.templates?.find((t) => t.id === templateId)
  }

  /**
   * List templates in a collection
   */
  listTemplates(collectionId: string): TemplateInfo[] {
    const collection = this.collections.get(collectionId)
    if (!collection?.document.templates) return []

    return collection.document.templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      tags: t.tags,
    }))
  }

  // ==========================================================================
  // Rolling
  // ==========================================================================

  /**
   * Roll on a table
   */
  roll(tableId: string, collectionId: string, options?: RollOptions): RollResult {
    const collection = this.collections.get(collectionId)
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`)
    }

    const table = collection.document.tables.find((t) => t.id === tableId)
    if (!table) {
      throw new Error(`Table not found: ${tableId} in collection ${collectionId}`)
    }

    // Create generation context with optional trace
    const context = this.createGenerationContext(collection, options)
    setCurrentCollection(context, collectionId)

    // Start root trace node
    beginTraceNode(context, 'root', `Roll: ${table.name || tableId}`, {
      raw: tableId,
      parsed: { collectionId, tableType: table.type }
    })

    // Roll on the table
    const result = this.rollTable(table, context, collectionId)

    // Apply document-level conditionals
    let finalText = result.text
    if (collection.document.conditionals && collection.document.conditionals.length > 0) {
      finalText = applyConditionals(
        collection.document.conditionals,
        result.text,
        context,
        (pattern: string) => this.evaluatePattern(pattern, context, collectionId)
      )
    }

    // End root trace and extract
    endTraceNode(context, { value: finalText })
    const trace = extractTrace(context)

    // Extract capture variables if any were created
    const captures = context.captureVariables.size > 0
      ? Object.fromEntries(context.captureVariables)
      : undefined

    return {
      text: finalText,
      resultType: result.resultType,
      assets: result.assets,
      placeholders: result.placeholders,
      metadata: {
        sourceId: tableId,
        collectionId,
        timestamp: Date.now(),
        entryId: result.entryId,
      },
      trace: trace ?? undefined,
      captures,
    }
  }

  /**
   * Roll on a template
   */
  rollTemplate(templateId: string, collectionId: string, options?: RollOptions): RollResult {
    const collection = this.collections.get(collectionId)
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`)
    }

    const template = collection.document.templates?.find((t) => t.id === templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId} in collection ${collectionId}`)
    }

    // Create generation context with optional trace
    const context = this.createGenerationContext(collection, options)
    setCurrentCollection(context, collectionId)

    // Start root trace node
    beginTraceNode(context, 'root', `Template: ${template.name || templateId}`, {
      raw: templateId,
      parsed: { collectionId, pattern: template.pattern }
    })

    // Evaluate template-level shared variables (lazy evaluation)
    if (template.shared) {
      this.evaluateTableLevelShared(template.shared, context, collectionId, templateId)
    }

    // Evaluate the template pattern
    let text = this.evaluatePattern(template.pattern, context, collectionId)

    // Apply document-level conditionals
    if (collection.document.conditionals && collection.document.conditionals.length > 0) {
      text = applyConditionals(
        collection.document.conditionals,
        text,
        context,
        (pattern: string) => this.evaluatePattern(pattern, context, collectionId)
      )
    }

    // End root trace and extract
    endTraceNode(context, { value: text })
    const trace = extractTrace(context)

    // Extract capture variables if any were created
    const captures = context.captureVariables.size > 0
      ? Object.fromEntries(context.captureVariables)
      : undefined

    return {
      text,
      resultType: template.resultType,
      metadata: {
        sourceId: templateId,
        collectionId,
        timestamp: Date.now(),
      },
      trace: trace ?? undefined,
      captures,
    }
  }

  /**
   * Evaluate a raw pattern string within a collection context.
   * Used for live preview of patterns during editing.
   *
   * @param pattern The pattern string to evaluate (e.g., "{{tableName}} and {{dice:2d6}}")
   * @param collectionId The collection context to evaluate within
   * @param options Optional roll options (trace, shared variables, etc.)
   * @returns RollResult with evaluated text
   */
  evaluateRawPattern(
    pattern: string,
    collectionId: string,
    options?: RollOptions & { shared?: Record<string, string> }
  ): RollResult {
    const collection = this.collections.get(collectionId)
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`)
    }

    // Create generation context with optional trace
    const context = this.createGenerationContext(collection, options)
    setCurrentCollection(context, collectionId)

    // Evaluate template/table-level shared variables if provided
    // This happens BEFORE the root trace node so they don't appear in pattern trace
    if (options?.shared) {
      this.evaluateTableLevelShared(options.shared, context, collectionId, '__preview__')
    }

    // Start root trace node
    beginTraceNode(context, 'root', 'Pattern Preview', {
      raw: pattern,
      parsed: { collectionId, pattern }
    })

    // Evaluate the pattern
    let text = this.evaluatePattern(pattern, context, collectionId)

    // Apply document-level conditionals
    if (collection.document.conditionals && collection.document.conditionals.length > 0) {
      text = applyConditionals(
        collection.document.conditionals,
        text,
        context,
        (p: string) => this.evaluatePattern(p, context, collectionId)
      )
    }

    // End root trace and extract
    endTraceNode(context, { value: text })
    const trace = extractTrace(context)

    // Extract capture variables if any were created
    const captures = context.captureVariables.size > 0
      ? Object.fromEntries(context.captureVariables)
      : undefined

    return {
      text,
      metadata: {
        sourceId: '__preview__',
        collectionId,
        timestamp: Date.now(),
      },
      trace: trace ?? undefined,
      captures,
    }
  }

  // ==========================================================================
  // Internal: Context Creation
  // ==========================================================================

  private createGenerationContext(collection: LoadedCollection, options?: RollOptions): GenerationContext {
    // Load static variables
    const staticVariables = new Map<string, string>()
    if (collection.document.variables) {
      for (const [key, value] of Object.entries(collection.document.variables)) {
        staticVariables.set(key, value)
      }
    }

    // Create context with collection-specific config
    const config: EngineConfig = {
      maxRecursionDepth: collection.document.metadata.maxRecursionDepth ?? this.config.maxRecursionDepth,
      maxExplodingDice: collection.document.metadata.maxExplodingDice ?? this.config.maxExplodingDice,
      maxInheritanceDepth: collection.document.metadata.maxInheritanceDepth ?? this.config.maxInheritanceDepth,
      uniqueOverflowBehavior: collection.document.metadata.uniqueOverflowBehavior ?? this.config.uniqueOverflowBehavior,
    }

    const context = createContext(config, staticVariables, {
      enableTrace: options?.enableTrace,
    })

    // Evaluate shared variables (once per generation)
    if (collection.document.shared) {
      // Register all document-level shared variable names first (for shadowing prevention)
      for (const name of Object.keys(collection.document.shared)) {
        registerDocumentSharedName(context, name)
      }
      // Then evaluate them
      this.evaluateSharedVariables(collection.document.shared, context, collection.id)
    }

    return context
  }

  // ==========================================================================
  // Internal: Shared Variables Evaluation
  // ==========================================================================

  /**
   * Evaluate shared variables at generation start.
   * Processed in order - later variables can reference earlier ones.
   */
  private evaluateSharedVariables(
    shared: Record<string, string>,
    context: GenerationContext,
    collectionId: string
  ): void {
    for (const [name, expression] of Object.entries(shared)) {
      // Evaluate the expression (may contain dice, math, table refs)
      const evaluated = this.evaluatePattern(expression, context, collectionId)

      // Try to parse as number, otherwise keep as string
      const numValue = parseFloat(evaluated)
      const value = !isNaN(numValue) && isFinite(numValue) ? numValue : evaluated

      setSharedVariable(context, name, value)
    }
  }

  /**
   * Evaluate table/template-level shared variables at roll time.
   * Validates that names don't shadow document-level shared variables.
   * Processed in order - later variables can reference earlier ones.
   */
  private evaluateTableLevelShared(
    shared: Record<string, string>,
    context: GenerationContext,
    collectionId: string,
    sourceId: string
  ): void {
    for (const [name, expression] of Object.entries(shared)) {
      // Check for shadowing document-level shared
      if (wouldShadowDocumentShared(context, name)) {
        throw new Error(
          `SHARED_SHADOW in ${sourceId}: Table/template-level shared variable '${name}' ` +
            `would shadow document-level shared variable. ` +
            `Document-level shared variables take precedence.`
        )
      }

      // Check for shadowing static variables
      if (context.staticVariables.has(name)) {
        throw new Error(
          `SHARED_SHADOW in ${sourceId}: Shared variable '${name}' ` +
            `would shadow static variable.`
        )
      }

      // If already set by a parent table (propagated down), skip
      // This allows nested tables to inherit shared from parent without error
      if (context.sharedVariables.has(name)) {
        continue
      }

      // Evaluate the expression
      const evaluated = this.evaluatePattern(expression, context, collectionId)

      // Try to parse as number, otherwise keep as string
      const numValue = parseFloat(evaluated)
      const value = !isNaN(numValue) && isFinite(numValue) ? numValue : evaluated

      setSharedVariable(context, name, value)
    }
  }

  // ==========================================================================
  // Internal: Table Inheritance
  // ==========================================================================

  /** Cache for resolved tables to avoid repeated inheritance resolution */
  private resolvedTables: Map<string, SimpleTable> = new Map()

  /**
   * Resolve table inheritance.
   * Merges parent entries into child, with child entries overriding by ID.
   */
  private resolveTableInheritance(
    table: SimpleTable,
    collectionId: string,
    depth: number = 0
  ): SimpleTable {
    // Check cache
    const cacheKey = `${collectionId}:${table.id}`
    const cached = this.resolvedTables.get(cacheKey)
    if (cached) return cached

    // No inheritance - return as-is
    if (!table.extends) {
      return table
    }

    // Check inheritance depth limit
    const collection = this.collections.get(collectionId)
    const maxDepth = collection?.document.metadata.maxInheritanceDepth ?? this.config.maxInheritanceDepth
    if (depth >= maxDepth) {
      throw new Error(
        `Inheritance depth limit exceeded for table '${table.id}' (max: ${maxDepth})`
      )
    }

    // Resolve parent table reference (may include namespace.tableId)
    const parentRef = table.extends
    const parentResult = this.resolveTableRef(parentRef, collectionId)

    if (!parentResult) {
      throw new Error(
        `Parent table not found: '${parentRef}' for table '${table.id}'`
      )
    }

    if (parentResult.table.type !== 'simple') {
      throw new Error(
        `Cannot extend non-simple table: '${parentRef}' (type: ${parentResult.table.type})`
      )
    }

    // Recursively resolve parent's inheritance (using parent's collection context)
    const resolvedParent = this.resolveTableInheritance(
      parentResult.table as SimpleTable,
      parentResult.collectionId,
      depth + 1
    )

    // Merge entries: parent entries first, child entries override by ID
    const mergedEntries: Entry[] = []
    const entryById = new Map<string, Entry>()

    // Add parent entries (with generated IDs if needed)
    for (let i = 0; i < resolvedParent.entries.length; i++) {
      const entry = resolvedParent.entries[i]
      const id = entry.id ?? `${resolvedParent.id}${String(i).padStart(3, '0')}`
      entryById.set(id, { ...entry, id })
    }

    // Override with child entries (merge with parent entry if same ID)
    for (let i = 0; i < table.entries.length; i++) {
      const entry = table.entries[i]
      const id = entry.id ?? `${table.id}${String(i).padStart(3, '0')}`
      const parentEntry = entryById.get(id)
      if (parentEntry) {
        // Merge child entry with parent entry (child properties override parent)
        entryById.set(id, { ...parentEntry, ...entry, id })
      } else {
        entryById.set(id, { ...entry, id })
      }
    }

    // Build final entry array
    for (const entry of entryById.values()) {
      mergedEntries.push(entry)
    }

    // Merge defaultSets: parent → child (child overrides)
    const mergedDefaultSets: Sets = {
      ...(resolvedParent.defaultSets ?? {}),
      ...(table.defaultSets ?? {}),
    }

    // Create resolved table
    const resolved: SimpleTable = {
      ...table,
      entries: mergedEntries,
      defaultSets: Object.keys(mergedDefaultSets).length > 0 ? mergedDefaultSets : undefined,
      extends: undefined, // Clear extends since we've resolved it
    }

    // Cache and return
    this.resolvedTables.set(cacheKey, resolved)
    return resolved
  }

  /**
   * Resolve a table reference that may include namespace or alias.
   * Format: tableId, alias.tableId, or namespace.tableId
   * Returns both the table and the collection ID where it was found.
   */
  private resolveTableRef(ref: string, collectionId: string): { table: Table; collectionId: string } | undefined {
    // Check for namespace/alias format (contains a dot)
    if (ref.includes('.')) {
      const parts = ref.split('.')
      if (parts.length >= 2) {
        // First part could be an alias or namespace prefix
        const aliasOrNamespace = parts[0]
        // Last part is the tableId
        const tableId = parts[parts.length - 1]

        // Check imports/aliases first (takes priority)
        const currentCollection = this.collections.get(collectionId)

        if (currentCollection?.imports.has(aliasOrNamespace)) {
          const importedCollection = currentCollection.imports.get(aliasOrNamespace)!
          const table = importedCollection.document.tables.find((t) => t.id === tableId)
          if (table) {
            return { table, collectionId: importedCollection.id }
          }
        }

        // Fall back to namespace matching
        const namespace = parts.slice(0, -1).join('.')
        for (const collection of this.collections.values()) {
          if (collection.document.metadata.namespace === namespace) {
            const table = collection.document.tables.find((t) => t.id === tableId)
            if (table) return { table, collectionId: collection.id }
          }
        }

        // Fallback: If the alias matches a document import alias but imports weren't resolved,
        // try to find the table by searching all collections for a matching tableId.
        // This handles the case where import paths couldn't be resolved to collection IDs.
        if (currentCollection?.document.imports) {
          const importDef = currentCollection.document.imports.find(imp => imp.alias === aliasOrNamespace)
          if (importDef) {
            // The import alias exists in the document, but wasn't resolved.
            // Search all other collections for this table.
            for (const collection of this.collections.values()) {
              if (collection.id !== collectionId) {
                const table = collection.document.tables.find((t) => t.id === tableId)
                if (table) {
                  return { table, collectionId: collection.id }
                }
              }
            }
          }
        }
      }
    }

    // Simple tableId - look in current collection first
    const currentCollection = this.collections.get(collectionId)
    if (currentCollection) {
      const table = currentCollection.document.tables.find((t) => t.id === ref)
      if (table) return { table, collectionId }
    }

    // Search all collections as fallback
    for (const collection of this.collections.values()) {
      const table = collection.document.tables.find((t) => t.id === ref)
      if (table) return { table, collectionId: collection.id }
    }

    return undefined
  }

  /**
   * Resolve a template reference that may include namespace or alias.
   * Format: templateId, alias.templateId, or namespace.templateId
   */
  private resolveTemplateRef(ref: string, collectionId: string): { template: Template; collectionId: string } | undefined {
    // Check for namespace/alias format (contains a dot)
    if (ref.includes('.')) {
      const parts = ref.split('.')
      if (parts.length >= 2) {
        // First part could be an alias or namespace prefix
        const aliasOrNamespace = parts[0]
        // Last part is the templateId
        const templateId = parts[parts.length - 1]

        // Check imports/aliases first (takes priority)
        const currentCollection = this.collections.get(collectionId)

        if (currentCollection?.imports.has(aliasOrNamespace)) {
          const importedCollection = currentCollection.imports.get(aliasOrNamespace)!
          const template = importedCollection.document.templates?.find((t) => t.id === templateId)
          if (template) {
            return { template, collectionId: importedCollection.id }
          }
        }

        // Fall back to namespace matching
        const namespace = parts.slice(0, -1).join('.')
        for (const collection of this.collections.values()) {
          if (collection.document.metadata.namespace === namespace) {
            const template = collection.document.templates?.find((t) => t.id === templateId)
            if (template) return { template, collectionId: collection.id }
          }
        }

        // Fallback: If the alias matches a document import alias but imports weren't resolved,
        // try to find the template by searching all collections for a matching templateId.
        // This handles the case where import paths couldn't be resolved to collection IDs.
        if (currentCollection?.document.imports) {
          const importDef = currentCollection.document.imports.find(imp => imp.alias === aliasOrNamespace)
          if (importDef) {
            // The import alias exists in the document, but wasn't resolved.
            // Search all other collections for this template.
            for (const collection of this.collections.values()) {
              if (collection.id !== collectionId) {
                const template = collection.document.templates?.find((t) => t.id === templateId)
                if (template) {
                  return { template, collectionId: collection.id }
                }
              }
            }
          }
        }
      }
    }

    // Simple templateId - look in current collection first
    const currentCollection = this.collections.get(collectionId)
    if (currentCollection) {
      const template = currentCollection.document.templates?.find((t) => t.id === ref)
      if (template) return { template, collectionId }
    }

    // Search all collections as fallback
    for (const collection of this.collections.values()) {
      const template = collection.document.templates?.find((t) => t.id === ref)
      if (template) return { template, collectionId: collection.id }
    }

    return undefined
  }

  /**
   * Clear the resolved tables cache (call when collections change)
   */
  clearInheritanceCache(): void {
    this.resolvedTables.clear()
  }

  // ==========================================================================
  // Internal: Table Rolling
  // ==========================================================================

  private rollTable(
    table: Table,
    context: GenerationContext,
    collectionId: string,
    options: { unique?: boolean; excludeIds?: Set<string> } = {}
  ): { text: string; resultType?: string; assets?: Assets; placeholders?: Sets; entryId?: string } {
    // Check recursion limit
    if (!incrementRecursion(context)) {
      throw new Error(`Recursion limit exceeded (${context.config.maxRecursionDepth})`)
    }

    // Start trace node for table roll
    beginTraceNode(context, 'table_roll', `Table: ${table.name || table.id}`, {
      raw: table.id,
      parsed: { type: table.type, name: table.name }
    })

    try {
      setCurrentTable(context, table.id)

      // Evaluate table-level shared variables (lazy evaluation)
      if (table.shared) {
        this.evaluateTableLevelShared(table.shared, context, collectionId, table.id)
      }

      let result: { text: string; resultType?: string; assets?: Assets; placeholders?: Sets; entryId?: string }

      if (table.type === 'simple') {
        result = this.rollSimple(table as SimpleTable, context, collectionId, options)
      } else if (table.type === 'composite') {
        result = this.rollComposite(table as CompositeTable, context, collectionId, options)
      } else if (table.type === 'collection') {
        result = this.rollCollection(table as CollectionTable, context, collectionId, options)
      } else {
        throw new Error(`Unknown table type: ${(table as Table).type}`)
      }

      // End trace node
      endTraceNode(context, { value: result.text })

      return result
    } catch (error) {
      // End trace node with error
      endTraceNode(context, { value: '', error: String(error) })
      throw error
    } finally {
      decrementRecursion(context)
    }
  }

  private rollSimple(
    table: SimpleTable,
    context: GenerationContext,
    collectionId: string,
    options: { unique?: boolean; excludeIds?: Set<string> }
  ): { text: string; resultType?: string; assets?: Assets; placeholders?: Sets; entryId?: string } {
    // Resolve inheritance before rolling
    const resolvedTable = this.resolveTableInheritance(table, collectionId)

    // Build pool for trace metadata (before selection)
    const pool = buildWeightedPool(resolvedTable.entries, resolvedTable.id, options.excludeIds)
    const totalWeight = calculateTotalWeight(pool)

    const selected = rollSimpleTable(resolvedTable, context, options)

    if (!selected) {
      // Trace empty selection
      addTraceLeaf(context, 'entry_select', `No entry selected`, {
        raw: table.id,
      }, {
        value: '',
      }, {
        type: 'entry_select',
        tableId: table.id,
        entryId: '',
        selectedWeight: 0,
        totalWeight,
        probability: 0,
        poolSize: pool.length,
        unique: options.unique ?? false,
        excludedIds: options.excludeIds ? Array.from(options.excludeIds) : undefined,
      } as EntrySelectMetadata)
      return { text: '' }
    }

    // Get the weight of the selected entry from the pool
    const selectedPoolEntry = pool.find(p => p.id === selected.id)
    const selectedWeight = selectedPoolEntry?.weight ?? 1

    // Add entry selection trace
    addTraceLeaf(context, 'entry_select', `Selected: ${selected.id}`, {
      raw: table.id,
      parsed: { entryValue: selected.entry.value }
    }, {
      value: selected.entry.value,
    }, {
      type: 'entry_select',
      tableId: table.id,
      entryId: selected.id,
      selectedWeight,
      totalWeight,
      probability: totalWeight > 0 ? selectedWeight / totalWeight : 0,
      poolSize: pool.length,
      unique: options.unique ?? false,
      excludedIds: options.excludeIds ? Array.from(options.excludeIds) : undefined,
    } as EntrySelectMetadata)

    // Update context with entry info
    setCurrentTable(context, table.id, selected.id)

    // Merge placeholders
    if (Object.keys(selected.mergedSets).length > 0) {
      mergePlaceholderSets(context, table.id, selected.mergedSets)
    }

    // Evaluate the entry value (may contain expressions)
    // Fallback to empty string if value is undefined (shouldn't happen with proper inheritance)
    const text = this.evaluatePattern(selected.entry.value ?? '', context, collectionId)

    return {
      text,
      resultType: selected.resultType,
      assets: selected.assets,
      placeholders: selected.mergedSets,
      entryId: selected.id,
    }
  }

  private rollComposite(
    table: CompositeTable,
    context: GenerationContext,
    collectionId: string,
    options: { unique?: boolean; excludeIds?: Set<string> }
  ): { text: string; resultType?: string; assets?: Assets; placeholders?: Sets; entryId?: string } {
    // Build source pool for trace metadata
    const sourcePool = buildSourcePool(table.sources)
    const totalSourceWeight = calculateSourceWeight(sourcePool)

    // Select which source table to roll on
    const selection = selectSource(table)
    if (!selection) {
      return { text: '' }
    }

    // Add composite select trace
    addTraceLeaf(context, 'composite_select', `Source: ${selection.sourceTableId}`, {
      raw: table.id,
      parsed: { sourceCount: table.sources.length }
    }, {
      value: selection.sourceTableId,
    }, {
      type: 'composite_select',
      sources: sourcePool.map(ws => ({
        tableId: ws.source.tableId,
        weight: ws.weight,
        probability: totalSourceWeight > 0 ? ws.weight / totalSourceWeight : 0,
      })),
      selectedTableId: selection.sourceTableId,
    } as CompositeSelectMetadata)

    // Find and roll on the source table
    const sourceTable = this.getTable(selection.sourceTableId, collectionId)
    if (!sourceTable) {
      throw new Error(`Source table not found: ${selection.sourceTableId}`)
    }

    const result = this.rollTable(sourceTable, context, collectionId, options)

    // ResultType precedence: entry → source table → composite table
    return {
      ...result,
      resultType: result.resultType ?? sourceTable.resultType ?? table.resultType,
    }
  }

  private rollCollection(
    table: CollectionTable,
    context: GenerationContext,
    collectionId: string,
    options: { unique?: boolean; excludeIds?: Set<string> }
  ): { text: string; resultType?: string; assets?: Assets; placeholders?: Sets; entryId?: string } {
    // Get source tables
    const getTables = (ids: string[]) => {
      const result: Array<{ id: string; table: SimpleTable }> = []
      for (const id of ids) {
        const t = this.getTable(id, collectionId)
        if (t && t.type === 'simple') {
          result.push({ id, table: t as SimpleTable })
        }
      }
      return result
    }

    // Get source tables for trace metadata
    const sourceTables = getTables(table.collections)

    // Calculate merged pool stats for trace
    let totalEntries = 0
    let totalWeight = 0
    for (const { table: sourceTable } of sourceTables) {
      const pool = buildWeightedPool(sourceTable.entries, sourceTable.id, options.excludeIds)
      totalEntries += pool.length
      totalWeight += calculateTotalWeight(pool)
    }

    // Add collection merge trace
    addTraceLeaf(context, 'collection_merge', `Merged ${table.collections.length} tables`, {
      raw: table.id,
      parsed: { sourceTableIds: table.collections }
    }, {
      value: `${totalEntries} entries`,
    }, {
      type: 'collection_merge',
      sourceTables: table.collections,
      totalEntries,
      totalWeight,
    } as CollectionMergeMetadata)

    const selected = rollCollectionTable(table, getTables, context, options)
    if (!selected) {
      return { text: '' }
    }

    // Add entry selection trace for collection
    addTraceLeaf(context, 'entry_select', `Selected: ${selected.id}`, {
      raw: table.id,
      parsed: { entryValue: selected.entry.value, sourceTableId: selected.sourceTableId }
    }, {
      value: selected.entry.value,
    }, {
      type: 'entry_select',
      tableId: table.id,
      entryId: selected.id,
      selectedWeight: 1, // Weight info not available from rollCollectionTable
      totalWeight,
      probability: totalWeight > 0 ? 1 / totalEntries : 0, // Approximate
      poolSize: totalEntries,
      unique: options.unique ?? false,
      excludedIds: options.excludeIds ? Array.from(options.excludeIds) : undefined,
    } as EntrySelectMetadata)

    // Update context
    setCurrentTable(context, table.id, selected.id)

    // Merge placeholders
    if (Object.keys(selected.mergedSets).length > 0) {
      mergePlaceholderSets(context, table.id, selected.mergedSets)
    }

    // Evaluate the entry value
    // Fallback to empty string if value is undefined (shouldn't happen with proper inheritance)
    const text = this.evaluatePattern(selected.entry.value ?? '', context, collectionId)

    return {
      text,
      resultType: selected.resultType,
      assets: selected.assets,
      placeholders: selected.mergedSets,
      entryId: selected.id,
    }
  }

  // ==========================================================================
  // Internal: Expression Evaluation
  // ==========================================================================

  private evaluatePattern(pattern: string, context: GenerationContext, collectionId: string): string {
    const tokens = parseTemplate(pattern)
    return tokens.map((token) => this.evaluateToken(token, context, collectionId)).join('')
  }

  private evaluateToken(token: ExpressionToken, context: GenerationContext, collectionId: string): string {
    switch (token.type) {
      case 'literal':
        return token.text

      case 'dice':
        return this.evaluateDice(token.expression, context)

      case 'math':
        return String(evaluateMath(token.expression, context))

      case 'variable':
        return this.evaluateVariable(token, context)

      case 'placeholder':
        return this.evaluatePlaceholder(token, context)

      case 'table':
        return this.evaluateTableRef(token, context, collectionId)

      case 'multiRoll':
        return this.evaluateMultiRoll(token, context, collectionId)

      case 'again':
        return this.evaluateAgain(token, context, collectionId)

      case 'instance':
        return this.evaluateInstance(token, context, collectionId)

      case 'captureMultiRoll':
        return this.evaluateCaptureMultiRoll(token, context, collectionId)

      case 'captureAccess':
        return this.evaluateCaptureAccess(token, context)

      case 'collect':
        return this.evaluateCollect(token, context)

      default:
        return ''
    }
  }

  private evaluateDice(expression: string, context: GenerationContext): string {
    const result = rollDice(expression, {
      maxExplodingDice: context.config.maxExplodingDice,
    })

    // Parse expression to extract modifier info for trace
    const modifierMatch = expression.match(/([+\-*])(\d+)$/)
    const modifier = modifierMatch ? {
      operator: modifierMatch[1] as '+' | '-' | '*',
      value: parseInt(modifierMatch[2], 10)
    } : undefined

    // Add dice roll trace with full breakdown
    addTraceLeaf(context, 'dice_roll', `Dice: ${expression}`, {
      raw: expression,
    }, {
      value: result.total,
    }, {
      type: 'dice',
      expression: result.expression,
      rolls: result.rolls,
      kept: result.kept,
      modifier,
      exploded: result.rolls.length > (parseInt(expression.match(/^(\d+)d/)?.[1] || '1', 10)),
      breakdown: result.breakdown,
    } as DiceRollMetadata)

    return String(result.total)
  }

  private evaluateVariable(
    token: { name: string; alias?: string },
    context: GenerationContext
  ): string {
    const value = resolveVariable(context, token.name, token.alias)
    const result = value !== undefined ? String(value) : ''

    // Determine variable source
    let source: 'static' | 'shared' | 'undefined' = 'undefined'
    if (context.sharedVariables.has(token.name)) {
      source = 'shared'
    } else if (context.staticVariables.has(token.name)) {
      source = 'static'
    }

    // Add variable access trace
    addTraceLeaf(context, 'variable_access', `$${token.alias ? token.alias + '.' : ''}${token.name}`, {
      raw: token.name,
      parsed: { alias: token.alias }
    }, {
      value: result,
    }, {
      type: 'variable',
      name: token.name,
      source,
    } as VariableAccessMetadata)

    return result
  }

  private evaluatePlaceholder(
    token: { name: string; property?: string },
    context: GenerationContext
  ): string {
    const value = getPlaceholder(context, token.name, token.property)
    const result = value ?? ''

    // Add placeholder access trace
    addTraceLeaf(context, 'placeholder_access', `@${token.name}${token.property ? '.' + token.property : ''}`, {
      raw: token.name,
      parsed: { property: token.property }
    }, {
      value: result,
    }, {
      type: 'placeholder',
      name: token.name,
      property: token.property,
      found: value !== undefined,
    } as PlaceholderAccessMetadata)

    return result
  }

  private evaluateTableRef(
    token: { tableId: string; alias?: string; namespace?: string },
    context: GenerationContext,
    collectionId: string
  ): string {
    // Build full reference with namespace if provided
    let ref = token.tableId
    if (token.namespace) {
      ref = `${token.namespace}.${token.tableId}`
    } else if (token.alias) {
      ref = `${token.alias}.${token.tableId}`
    }

    // Try to resolve as a table first
    const tableResult = this.resolveTableRef(ref, collectionId)
    if (tableResult) {
      // Use the collection ID where the table was found, not the original collection
      const result = this.rollTable(tableResult.table, context, tableResult.collectionId)
      return result.text
    }

    // Fall back to template lookup
    const templateResult = this.resolveTemplateRef(ref, collectionId)
    if (templateResult) {
      return this.evaluateTemplateInternal(templateResult.template, templateResult.collectionId, context)
    }

    return ''
  }

  /**
   * Internal template evaluation for cross-collection template references.
   * Used when a template is referenced via import alias.
   */
  private evaluateTemplateInternal(
    template: Template,
    collectionId: string,
    context: GenerationContext
  ): string {
    // Check recursion limit
    if (!incrementRecursion(context)) {
      throw new Error(`Recursion limit exceeded (${context.config.maxRecursionDepth})`)
    }

    try {
      // Get the collection for context
      const collection = this.collections.get(collectionId)
      if (!collection) {
        return ''
      }

      // Evaluate template-level shared variables (lazy evaluation)
      if (template.shared) {
        this.evaluateTableLevelShared(template.shared, context, collectionId, template.id)
      }

      // Evaluate the template pattern
      let text = this.evaluatePattern(template.pattern, context, collectionId)

      // Apply document-level conditionals
      if (collection.document.conditionals && collection.document.conditionals.length > 0) {
        text = applyConditionals(
          collection.document.conditionals,
          text,
          context,
          (pattern: string) => this.evaluatePattern(pattern, context, collectionId)
        )
      }

      return text
    } finally {
      decrementRecursion(context)
    }
  }

  private evaluateMultiRoll(
    token: {
      count: number | string
      diceCount?: string
      tableId: string
      unique?: boolean
      separator?: string
    },
    context: GenerationContext,
    collectionId: string
  ): string {
    // Resolve count - can be a number, variable name, or dice expression
    let count: number
    let countSource: 'literal' | 'variable' | 'dice' = 'literal'

    if (token.diceCount) {
      // Roll dice to determine count
      const diceResult = rollDice(token.diceCount, {
        maxExplodingDice: context.config.maxExplodingDice,
      })
      count = diceResult.total
      countSource = 'dice'
    } else if (typeof token.count === 'number') {
      count = token.count
      countSource = 'literal'
    } else {
      const value = resolveVariable(context, token.count)
      count = typeof value === 'number' ? value : parseInt(String(value), 10) || 1
      countSource = 'variable'
    }

    const table = this.getTable(token.tableId, collectionId)
    if (!table) {
      console.warn(`Table not found: ${token.tableId}`)
      return ''
    }

    // Start multi_roll trace node
    beginTraceNode(context, 'multi_roll', `${count}x ${token.tableId}`, {
      raw: `${token.count}*${token.tableId}`,
      parsed: { count, tableId: token.tableId, unique: token.unique }
    })

    const results: string[] = []
    const usedIds = new Set<string>()

    for (let i = 0; i < count; i++) {
      const result = this.rollTable(table, context, collectionId, {
        unique: token.unique,
        excludeIds: token.unique ? usedIds : undefined,
      })

      if (result.text) {
        results.push(result.text)
        if (result.entryId) {
          usedIds.add(result.entryId)
        }
      }
    }

    const finalResult = results.join(token.separator ?? ', ')

    // End multi_roll trace node
    endTraceNode(context, { value: finalResult }, {
      type: 'multi_roll',
      tableId: token.tableId,
      countSource,
      count,
      unique: token.unique ?? false,
      separator: token.separator ?? ', ',
    } as MultiRollMetadata)

    return finalResult
  }

  private evaluateAgain(
    token: { count?: number; unique?: boolean },
    context: GenerationContext,
    collectionId: string
  ): string {
    if (!context.currentTableId) {
      console.warn('{{again}} used outside of table context')
      return ''
    }

    const table = this.getTable(context.currentTableId, collectionId)
    if (!table) {
      return ''
    }

    // Exclude the current entry to prevent infinite loops
    const excludeIds = new Set<string>()
    if (context.currentEntryId) {
      excludeIds.add(context.currentEntryId)
    }

    const count = token.count ?? 1
    const results: string[] = []

    for (let i = 0; i < count; i++) {
      const result = this.rollTable(table, context, collectionId, {
        unique: token.unique,
        excludeIds,
      })

      if (result.text) {
        results.push(result.text)
        if (result.entryId && token.unique) {
          excludeIds.add(result.entryId)
        }
      }
    }

    return results.join(', ')
  }

  private evaluateInstance(
    token: { tableId: string; instanceName: string },
    context: GenerationContext,
    collectionId: string
  ): string {
    // Check if instance already exists
    const existing = getInstance(context, token.instanceName)
    if (existing) {
      // Add instance trace for cache hit
      addTraceLeaf(context, 'instance', `Instance: ${token.instanceName} (cached)`, {
        raw: `${token.tableId}#${token.instanceName}`,
      }, {
        value: existing.text,
        cached: true,
      }, {
        type: 'instance',
        name: token.instanceName,
        cached: true,
        tableId: token.tableId,
      } as InstanceMetadata)

      return existing.text
    }

    // Roll and store the instance
    const table = this.getTable(token.tableId, collectionId)
    if (!table) {
      console.warn(`Table not found: ${token.tableId}`)
      return ''
    }

    // Start instance trace node (new roll)
    beginTraceNode(context, 'instance', `Instance: ${token.instanceName}`, {
      raw: `${token.tableId}#${token.instanceName}`,
      parsed: { tableId: token.tableId, instanceName: token.instanceName }
    })

    const result = this.rollTable(table, context, collectionId)

    const rollResult: RollResult = {
      text: result.text,
      resultType: result.resultType,
      assets: result.assets,
      placeholders: result.placeholders,
      metadata: {
        sourceId: token.tableId,
        collectionId,
        timestamp: Date.now(),
        entryId: result.entryId,
      },
    }

    setInstance(context, token.instanceName, rollResult)

    // End instance trace node
    endTraceNode(context, { value: result.text, cached: false }, {
      type: 'instance',
      name: token.instanceName,
      cached: false,
      tableId: token.tableId,
    } as InstanceMetadata)

    return result.text
  }

  // ============================================================================
  // Capture System Evaluation
  // ============================================================================

  /**
   * Evaluate capture multi-roll: {{3*table >> $var}}
   * Captures each roll's value and resolved sets into a capture variable
   */
  private evaluateCaptureMultiRoll(
    token: {
      count: number | string
      diceCount?: string
      tableId: string
      alias?: string
      namespace?: string
      unique?: boolean
      captureVar: string
      separator?: string
      silent?: boolean
    },
    context: GenerationContext,
    collectionId: string
  ): string {
    // Check for variable name conflict
    const conflict = hasVariableConflict(context, token.captureVar)
    if (conflict) {
      console.warn(
        `Capture variable '$${token.captureVar}' overwrites existing ${conflict} variable`
      )
    }

    // Resolve count - can be a number, variable name, or dice expression
    let count: number

    if (token.diceCount) {
      // Roll dice to determine count
      const diceResult = rollDice(token.diceCount, {
        maxExplodingDice: context.config.maxExplodingDice,
      })
      count = diceResult.total
    } else if (typeof token.count === 'number') {
      count = token.count
    } else {
      const value = resolveVariable(context, token.count)
      count = typeof value === 'number' ? value : parseInt(String(value), 10) || 1
    }

    // Build full table reference with namespace if provided
    let tableRef = token.tableId
    if (token.namespace) {
      tableRef = `${token.namespace}.${token.tableId}`
    } else if (token.alias) {
      tableRef = `${token.alias}.${token.tableId}`
    }

    const tableResult = this.resolveTableRef(tableRef, collectionId)
    if (!tableResult) {
      console.warn(`Table not found: ${tableRef}`)
      return ''
    }

    const { table, collectionId: resolvedCollectionId } = tableResult

    // Start capture_multi_roll trace node
    beginTraceNode(
      context,
      'capture_multi_roll',
      `${count}x ${token.tableId} >> $${token.captureVar}`,
      {
        raw: `${token.count}*${token.tableId} >> $${token.captureVar}`,
        parsed: {
          count,
          tableId: token.tableId,
          captureVar: token.captureVar,
          unique: token.unique,
          silent: token.silent,
        },
      }
    )

    const captureItems: CaptureItem[] = []
    const results: string[] = []
    const usedIds = new Set<string>()

    for (let i = 0; i < count; i++) {
      const result = this.rollTable(table, context, resolvedCollectionId, {
        unique: token.unique,
        excludeIds: token.unique ? usedIds : undefined,
      })

      if (result.text) {
        results.push(result.text)

        // Capture the item with resolved sets
        // The sets from result.placeholders are already the merged sets
        const resolvedSets: Record<string, string> = {}
        if (result.placeholders) {
          for (const [key, value] of Object.entries(result.placeholders)) {
            // Resolve any template expressions in set values
            if (value.includes('{{')) {
              resolvedSets[key] = this.evaluatePattern(value, context, resolvedCollectionId)
            } else {
              resolvedSets[key] = value
            }
          }
        }

        captureItems.push({
          value: result.text,
          sets: resolvedSets,
        })

        if (result.entryId) {
          usedIds.add(result.entryId)
        }
      }
    }

    // Store capture variable
    const captureVariable: CaptureVariable = {
      items: captureItems,
      count: captureItems.length,
    }
    setCaptureVariable(context, token.captureVar, captureVariable)

    // Determine output
    let finalResult: string
    if (token.silent) {
      finalResult = ''
    } else {
      finalResult = results.join(token.separator ?? ', ')
    }

    // End capture_multi_roll trace node
    endTraceNode(
      context,
      { value: finalResult },
      {
        type: 'capture_multi_roll',
        tableId: token.tableId,
        captureVar: token.captureVar,
        count: captureItems.length,
        unique: token.unique ?? false,
        silent: token.silent ?? false,
        separator: token.separator ?? ', ',
        capturedItems: captureItems.map(item => ({
          value: item.value,
          sets: item.sets,
        })),
      } as CaptureMultiRollMetadata
    )

    return finalResult
  }

  /**
   * Evaluate capture access: {{$var}}, {{$var[0]}}, {{$var.count}}, {{$var[0].@prop}}
   */
  private evaluateCaptureAccess(
    token: {
      varName: string
      index?: number
      property?: string
      separator?: string
    },
    context: GenerationContext
  ): string {
    const capture = getCaptureVariable(context, token.varName)

    // Build label for trace
    let label = `$${token.varName}`
    if (token.index !== undefined) label += `[${token.index}]`
    if (token.property) label += `.${token.property.startsWith('@') ? token.property : token.property}`

    if (!capture) {
      console.warn(`Capture variable not found: $${token.varName} (forward reference?)`)
      addTraceLeaf(
        context,
        'capture_access',
        label,
        { raw: label },
        { value: '', error: 'Variable not found' },
        {
          type: 'capture_access',
          varName: token.varName,
          index: token.index,
          property: token.property ?? 'value',
          found: false,
        } as CaptureAccessMetadata
      )
      return ''
    }

    let result: string

    // Handle .count property (no index)
    if (token.property === 'count' && token.index === undefined) {
      result = String(capture.count)
      addTraceLeaf(
        context,
        'capture_access',
        label,
        { raw: label },
        { value: result },
        {
          type: 'capture_access',
          varName: token.varName,
          property: 'count',
          found: true,
          totalItems: capture.items.length,
        } as CaptureAccessMetadata
      )
      return result
    }

    // Handle indexed access
    if (token.index !== undefined) {
      // Resolve negative index
      let resolvedIndex = token.index
      if (resolvedIndex < 0) {
        resolvedIndex = capture.items.length + resolvedIndex
      }

      // Check bounds
      if (resolvedIndex < 0 || resolvedIndex >= capture.items.length) {
        console.warn(
          `Capture access out of bounds: $${token.varName}[${token.index}] ` +
            `(length: ${capture.items.length})`
        )
        addTraceLeaf(
          context,
          'capture_access',
          label,
          { raw: label },
          { value: '', error: `Index out of bounds (${capture.items.length} items)` },
          {
            type: 'capture_access',
            varName: token.varName,
            index: token.index,
            property: token.property ?? 'value',
            found: false,
            totalItems: capture.items.length,
          } as CaptureAccessMetadata
        )
        return ''
      }

      const item = capture.items[resolvedIndex]

      // Handle property access on indexed item
      if (token.property) {
        if (token.property === 'value') {
          result = item.value
        } else {
          // @property access (property stored without @)
          const propValue = item.sets[token.property]
          if (propValue === undefined) {
            console.warn(
              `Capture property not found: $${token.varName}[${token.index}].@${token.property}`
            )
          }
          result = propValue ?? ''
        }
      } else {
        // Just indexed access - return value
        result = item.value
      }

      addTraceLeaf(
        context,
        'capture_access',
        label,
        { raw: label },
        { value: result },
        {
          type: 'capture_access',
          varName: token.varName,
          index: token.index,
          property: token.property ?? 'value',
          found: true,
          totalItems: capture.items.length,
        } as CaptureAccessMetadata
      )
      return result
    }

    // Handle property access without index (on all items)
    if (token.property && token.property !== 'value' && token.property !== 'count') {
      // Collect this property from all items
      const values = capture.items.map((item) => item.sets[token.property!] ?? '')
      result = values.filter((v) => v !== '').join(token.separator ?? ', ')
    } else {
      // Handle all values (no index, property is 'value' or undefined)
      const values = capture.items.map((item) => item.value)
      result = values.join(token.separator ?? ', ')
    }

    addTraceLeaf(
      context,
      'capture_access',
      label,
      { raw: label },
      { value: result },
      {
        type: 'capture_access',
        varName: token.varName,
        property: token.property ?? 'value',
        found: true,
        totalItems: capture.items.length,
      } as CaptureAccessMetadata
    )

    return result
  }

  /**
   * Evaluate collect expression: {{collect:$var.@prop}}
   * Aggregates a property across all captured items
   */
  private evaluateCollect(
    token: {
      varName: string
      property: string
      unique?: boolean
      separator?: string
    },
    context: GenerationContext
  ): string {
    const label = `collect:$${token.varName}.${token.property}${token.unique ? '|unique' : ''}`
    const capture = getCaptureVariable(context, token.varName)

    if (!capture) {
      console.warn(`Capture variable not found: $${token.varName} (forward reference?)`)
      addTraceLeaf(
        context,
        'collect',
        label,
        { raw: label },
        { value: '', error: 'Variable not found' },
        {
          type: 'collect',
          varName: token.varName,
          property: token.property,
          unique: token.unique ?? false,
          separator: token.separator ?? ', ',
          allValues: [],
          resultValues: [],
        } as CollectMetadata
      )
      return ''
    }

    // Collect values
    let allValues: string[]

    if (token.property === 'value') {
      allValues = capture.items.map((item) => item.value)
    } else {
      // @property access (property stored without @)
      allValues = capture.items.map((item) => item.sets[token.property] ?? '')
    }

    // Filter empty strings (as per design decision)
    let resultValues = allValues.filter((v) => v !== '')

    // Apply unique modifier
    if (token.unique) {
      resultValues = [...new Set(resultValues)]
    }

    const result = resultValues.join(token.separator ?? ', ')

    addTraceLeaf(
      context,
      'collect',
      label,
      { raw: label },
      { value: result },
      {
        type: 'collect',
        varName: token.varName,
        property: token.property,
        unique: token.unique ?? false,
        separator: token.separator ?? ', ',
        allValues: allValues.filter((v) => v !== ''), // Pre-filtered values
        resultValues,
      } as CollectMetadata
    )

    return result
  }
}

// ==========================================================================
// Exports
// ==========================================================================

export { validateDocument } from './validator'
export { parseTemplate, extractExpressions } from './parser'
export { evaluateMath } from './math'
export { createContext } from './context'

// Re-export types
export type { ValidationResult, ValidationIssue } from './validator'
export type { ExpressionToken } from './parser'
export type { GenerationContext } from './context'
export type { RollTrace, TraceNode, TraceNodeType, TraceStats } from './trace'
