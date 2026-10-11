/**
 * Random Table Engine
 *
 * Main orchestrator for loading, validating, and rolling on random tables.
 * Implements the Random Table JSON Spec v1.0.
 */

import type {
  AuthoredRandomTableDocument,
  AuthoredSimpleTable,
  AuthoredTable,
  InheritedEntryOverride,
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
  EvaluatedSets,
} from '../types'

import { validateDocument, type ValidationResult } from './validator'
import {
  createContext,
  incrementRecursion,
  decrementRecursion,
  setCurrentTable,
  setCurrentCollection,
  mergePlaceholderSets,
  registerDocumentSharedName,
  addDescription,
  setCurrentEntryDescription,
  setCurrentEntryValue,
  consumeWork,
  beginSharedScope,
  endSharedScope,
  getTableIdentity,
  getUsedEntries,
  markEntryUsed,
  type GenerationContext,
} from './context'
import { rollSimpleTable, buildWeightedPool, calculateTotalWeight } from '../tables/simple'
import { buildSourcePool } from '../tables/composite'
import { rollCollectionTable, mergeTableEntries, type CollectionSourceTable } from '../tables/collection'
import { getNormalizedProbabilities, selectWeighted } from '../tables/weights'
import {
  beginTraceNode,
  endTraceNode,
  addTraceLeaf,
  extractTrace,
  type EntrySelectMetadata,
  type CompositeSelectMetadata,
  type CollectionMergeMetadata,
} from './trace'
import {
  resolveTableRef as resolveTableRefFn,
  resolveCollectionQualifier,
  findNamespace,
  resolveTemplateRef as resolveTemplateRefFn,
} from './resolver'
import { ExpressionEvaluator } from './evaluator'

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
  resultType?: string
}

export interface TemplateInfo {
  id: string
  name: string
  description?: string
  tags?: string[]
  resultType?: string
}

export interface ImportedTableInfo extends TableInfo {
  /** Alias prefix for import reference (e.g., "names") */
  alias: string
  /** Source collection namespace */
  sourceNamespace: string
  /** Source collection name for UI display */
  sourceCollectionName: string
}

export interface ImportedTemplateInfo extends TemplateInfo {
  /** Alias prefix for import reference (e.g., "names") */
  alias: string
  /** Source collection namespace */
  sourceNamespace: string
  /** Source collection name for UI display */
  sourceCollectionName: string
}

export interface EngineOptions {
  config?: Partial<EngineConfig>
}

export interface RollOptions {
  /** Injectable random source; defaults to Math.random. */
  random?: () => number

  /** Enable trace mode to capture execution details */
  enableTrace?: boolean
}

// ============================================================================
// Engine Class
// ============================================================================

export class RandomTableEngine {
  private collections: Map<string, LoadedCollection> = new Map()
  private importDiagnostics: Array<{ collectionId: string; alias: string; code: 'IMPORT_ERROR' | 'IMPORT_CYCLE'; message: string }> = []
  private importPaths = new Map<string, string>()
  private importBindings = new Map<string, Map<string, string>>()
  private config: EngineConfig
  private evaluator: ExpressionEvaluator

  constructor(options: EngineOptions = {}) {
    this.config = {
      maxRecursionDepth: options.config?.maxRecursionDepth ?? 50,
      maxExplodingDice: options.config?.maxExplodingDice ?? 100,
      maxInheritanceDepth: options.config?.maxInheritanceDepth ?? 5,
      uniqueOverflowBehavior: options.config?.uniqueOverflowBehavior ?? 'stop',
      maxGenerationWork: options.config?.maxGenerationWork ?? 10000,
      maxOutputLength: options.config?.maxOutputLength ?? 1000000,
    }

    for (const [name, limit] of Object.entries(this.config)) {
      if (name !== 'uniqueOverflowBehavior' && (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < (name === 'maxExplodingDice' ? 0 : 1))) throw new Error(`Invalid engine limit: ${name}`)
    }
    if (this.config.maxExplodingDice > 1000) throw new Error('Invalid engine limit: maxExplodingDice (maximum 1000)')

    // Create evaluator with dependencies
    // Note: We use bind() for methods that the evaluator needs to call back to
    this.evaluator = new ExpressionEvaluator({
      resolveTableRef: (ref, collectionId) => this.resolveTableRef(ref, collectionId),
      resolveTemplateRef: (ref, collectionId) => this.resolveTemplateRef(ref, collectionId),
      rollTable: (table, context, collectionId, options) =>
        this.rollTable(table, context, collectionId, options),
      getCollection: (id) => this.getCollection(id),
      resolveCollection: (qualifier, id) => resolveCollectionQualifier(qualifier, id, { collections: this.collections }),
      getTable: (tableId, collectionId) => this.getTable(tableId, collectionId),
    })
  }

  // ==========================================================================
  // Loading
  // ==========================================================================

  /**
   * Load a collection from a parsed document
   */
  loadCollection(input: AuthoredRandomTableDocument, id: string, isPreloaded = false): void {
    const validation = validateDocument(input)
    if (!validation.valid) throw new Error(`VALIDATION_ERROR: ${validation.errors.map(issue => issue.message).join('; ')}`)
    // Authored inheritance overrides are resolved before a table reaches selection.
    const document = input
    this.reconcileImportBindings(id, document)
    // Build table index for O(1) lookups
    const tableIndex = new Map<string, AuthoredTable>()
    for (const table of document.tables) {
      tableIndex.set(table.id, table)
    }

    // Build template index for O(1) lookups
    const templateIndex = new Map<string, Template>()
    if (document.templates) {
      for (const template of document.templates) {
        templateIndex.set(template.id, template)
      }
    }

    const collection: LoadedCollection = {
      id,
      document,
      imports: new Map(), // TODO: Implement import resolution
      isPreloaded,
      source: isPreloaded ? 'preloaded' : id,
      tableIndex,
      templateIndex,
    }

    this.collections.set(id, collection)
    this.clearInheritanceCache()
    this.resolveImports()
  }

  private reconcileImportBindings(id: string, document: AuthoredRandomTableDocument): void {
    const prior = this.collections.get(id)?.document
    const bindings = this.importBindings.get(id)
    if (!prior || !bindings) return
    for (const alias of bindings.keys()) {
      const oldPath = prior.imports?.find(imp => imp.alias === alias)?.path
      const newPath = document.imports?.find(imp => imp.alias === alias)?.path
      if (oldPath !== newPath) bindings.delete(alias)
    }
  }

  /**
   * Load a collection from JSON string
   */
  loadFromJson(json: string, id: string, isPreloaded = false): ValidationResult {
    let document: AuthoredRandomTableDocument
    try { document = JSON.parse(json) as AuthoredRandomTableDocument }
    catch (error) {
      const issue = { severity: 'error' as const, code: 'INVALID_JSON', message: String(error) }
      return { valid: false, issues: [issue], errors: [issue], warnings: [] }
    }
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
    const deleted = this.collections.delete(id)
    this.importBindings.delete(id)
    this.clearInheritanceCache()
    this.resolveImports()
    return deleted
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
   * Update a collection's document (for live editing).
   * This updates the document and rebuilds indexes, then re-resolves imports.
   */
  updateDocument(id: string, input: AuthoredRandomTableDocument): void {
    const existing = this.collections.get(id)
    if (!existing) return
    const validation = validateDocument(input)
    if (!validation.valid) throw new Error(`VALIDATION_ERROR: ${validation.errors.map(issue => issue.message).join('; ')}`)
    const document = input
    this.reconcileImportBindings(id, document)

    this.clearInheritanceCache()

    // Rebuild table index
    const tableIndex = new Map<string, AuthoredTable>()
    for (const table of document.tables) {
      tableIndex.set(table.id, table)
    }

    // Rebuild template index
    const templateIndex = new Map<string, Template>()
    if (document.templates) {
      for (const template of document.templates) {
        templateIndex.set(template.id, template)
      }
    }

    // Update the collection in place
    existing.document = document
    existing.tableIndex = tableIndex
    existing.templateIndex = templateIndex

    // Re-resolve imports for all collections
    this.resolveImports()
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
   *
   * Resolution order:
   * 1. Try pathToIdMap lookup (for file path based imports)
   * 2. Try matching by namespace (for namespace-based imports from editor)
   * 3. Try matching by collection ID (direct ID reference)
   */
  resolveImports(
    pathToIdMap?: Map<string, string>,
    bindings?: Map<string, Map<string, string>>
  ): void {
    if (pathToIdMap) for (const [path, id] of pathToIdMap) this.importPaths.set(path, id)
    if (bindings) for (const [id, aliases] of bindings) this.importBindings.set(id, new Map(aliases))
    this.clearInheritanceCache()
    this.importDiagnostics = []
    for (const collection of this.collections.values()) {
      collection.imports.clear()
      collection.importBindingIds = new Map(this.importBindings.get(collection.id))
      for (const imp of collection.document.imports ?? []) {
        if (!collection.importBindingIds.has(imp.alias) && this.importPaths.has(imp.path)) collection.importBindingIds.set(imp.alias, this.importPaths.get(imp.path)!)
      }
      for (const imp of collection.document.imports ?? []) {
        const boundId = collection.importBindingIds?.get(imp.alias)
        const pathId = this.importPaths.get(imp.path)
        let target: LoadedCollection | undefined
        if (boundId !== undefined) target = this.collections.get(boundId)
        else if (pathId !== undefined) target = this.collections.get(pathId)
        else {
          try { target = this.collections.get(imp.path) ?? findNamespace(imp.path, { collections: this.collections }) }
          catch (error) {
            this.importDiagnostics.push({ collectionId: collection.id, alias: imp.alias, code: 'IMPORT_ERROR', message: String(error) })
            continue
          }
        }
        if (target) collection.imports.set(imp.alias, target)
        else this.importDiagnostics.push({ collectionId: collection.id, alias: imp.alias, code: 'IMPORT_ERROR', message: `Import '${imp.alias}' could not resolve '${imp.path}'` })
      }
    }
    // Diagnose dependency cycles iteratively so a long import graph cannot overflow the stack.
    for (const start of this.collections.values()) {
      const reaches = (target: LoadedCollection): boolean => {
        const pending = [target]
        const visited = new Set<string>()
        while (pending.length) {
          const collection = pending.pop()!
          if (collection.id === start.id) return true
          if (visited.has(collection.id)) continue
          visited.add(collection.id)
          pending.push(...collection.imports.values())
        }
        return false
      }
      for (const [alias, target] of start.imports) {
        if (reaches(target)) this.importDiagnostics.push({ collectionId: start.id, alias, code: 'IMPORT_CYCLE', message: `Import cycle involving '${start.id}' through '${alias}'` })
      }
    }
  }

  getImportDiagnostics(): Array<{ collectionId: string; alias: string; code: 'IMPORT_ERROR' | 'IMPORT_CYCLE'; message: string }> {
    return this.importDiagnostics.map(issue => ({ ...issue }))
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate a document
   */
  validate(document: AuthoredRandomTableDocument): ValidationResult {
    return validateDocument(document)
  }

  // ==========================================================================
  // Table Access
  // ==========================================================================

  /**
   * Get a table by ID (O(1) lookup using index)
   */
  getTable(tableId: string, collectionId?: string): AuthoredTable | undefined {
    if (collectionId) {
      const collection = this.collections.get(collectionId)
      return collection?.tableIndex.get(tableId)
    }

    // Search all collections
    for (const collection of this.collections.values()) {
      const table = collection.tableIndex.get(tableId)
      if (table) return table
    }

    return undefined
  }

  /** Effective table definition, including qualified references and inherited entries. */
  getResolvedTable(ref: string, collectionId: string): Table | undefined {
    const resolved = this.resolveTableRef(ref, collectionId)
    if (!resolved) return undefined
    return resolved.table.type === 'simple'
      ? this.resolveTableInheritance(resolved.table, resolved.collectionId)
      : resolved.table
  }

  resolveTableReference(ref: string, collectionId: string): { table: AuthoredTable; collectionId: string } | undefined {
    return this.resolveTableRef(ref, collectionId)
  }

  getResolvedCollectionId(ref: string, collectionId: string): string | undefined {
    return this.resolveTableRef(ref, collectionId)?.collectionId
  }

  /** Isolated preview preserving durable dependency identities. */
  cloneForPreview(document: AuthoredRandomTableDocument, collectionId: string): RandomTableEngine {
    const preview = new RandomTableEngine({ config: this.config })
    preview.importPaths = new Map(this.importPaths)
    preview.importBindings = new Map([...this.importBindings].map(([id, aliases]) => [id, new Map(aliases)]))
    for (const collection of this.collections.values()) {
      preview.loadCollection(collection.document, collection.id, collection.isPreloaded)
    }
    if (!preview.hasCollection(collectionId)) preview.loadCollection(document, collectionId)
    else preview.updateDocument(collectionId, document)
    preview.resolveImports()
    return preview
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
          entryCount: table.type === 'simple' ? table.entries.length : undefined,
          resultType: table.resultType,
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
   * Get a template by ID (O(1) lookup using index)
   */
  getTemplate(templateId: string, collectionId: string): Template | undefined {
    const collection = this.collections.get(collectionId)
    return collection?.templateIndex.get(templateId)
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
      resultType: t.resultType,
    }))
  }

  /**
   * List tables from a collection's imports (recursively).
   * Returns tables with their alias prefix for proper reference syntax.
   */
  listImportedTables(collectionId: string, includeHidden = true): ImportedTableInfo[] {
    const collection = this.collections.get(collectionId)
    if (!collection) return []

    const results: ImportedTableInfo[] = []
    const visited = new Set<string>()
    visited.add(collectionId) // Don't include current collection's tables

    for (const [alias, importedCollection] of collection.imports) {
      this.collectImportedTables(importedCollection, alias, includeHidden, visited, results)
    }

    return results
  }

  /**
   * List templates from a collection's imports (recursively).
   * Returns templates with their alias prefix for proper reference syntax.
   */
  listImportedTemplates(collectionId: string): ImportedTemplateInfo[] {
    const collection = this.collections.get(collectionId)
    if (!collection) return []

    const results: ImportedTemplateInfo[] = []
    const visited = new Set<string>()
    visited.add(collectionId) // Don't include current collection's templates

    for (const [alias, importedCollection] of collection.imports) {
      this.collectImportedTemplates(importedCollection, alias, visited, results)
    }

    return results
  }

  /**
   * Helper to recursively collect tables from an imported collection
   */
  private collectImportedTables(
    collection: LoadedCollection,
    alias: string,
    includeHidden: boolean,
    visited: Set<string>,
    results: ImportedTableInfo[]
  ): void {
    if (visited.has(collection.id)) return
    visited.add(collection.id)

    // Get direct tables from this imported collection
    for (const table of collection.document.tables) {
      if (!includeHidden && table.hidden) continue
      results.push({
        id: table.id,
        name: table.name,
        type: table.type,
        description: table.description,
        tags: table.tags,
        hidden: table.hidden,
        entryCount: table.type === 'simple' ? table.entries.length : undefined,
        alias,
        sourceNamespace: collection.document.metadata.namespace,
        sourceCollectionName: collection.document.metadata.name,
      })
    }

    // Recursively get from nested imports
    for (const [nestedAlias, nestedCollection] of collection.imports) {
      this.collectImportedTables(
        nestedCollection,
        `${alias}.${nestedAlias}`,
        includeHidden,
        visited,
        results
      )
    }
  }

  /**
   * Helper to recursively collect templates from an imported collection
   */
  private collectImportedTemplates(
    collection: LoadedCollection,
    alias: string,
    visited: Set<string>,
    results: ImportedTemplateInfo[]
  ): void {
    if (visited.has(collection.id)) return
    visited.add(collection.id)

    // Get direct templates from this imported collection
    if (collection.document.templates) {
      for (const template of collection.document.templates) {
        results.push({
          id: template.id,
          name: template.name,
          description: template.description,
          tags: template.tags,
          alias,
          sourceNamespace: collection.document.metadata.namespace,
          sourceCollectionName: collection.document.metadata.name,
        })
      }
    }

    // Recursively get from nested imports
    for (const [nestedAlias, nestedCollection] of collection.imports) {
      this.collectImportedTemplates(
        nestedCollection,
        `${alias}.${nestedAlias}`,
        visited,
        results
      )
    }
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

    const table = collection.tableIndex.get(tableId)
    if (!table) {
      throw new Error(`REFERENCE_ERROR: Table not found: ${tableId} in collection ${collectionId}`)
    }

    // Create generation context with optional trace
    const context = this.createGenerationContext(collection, options)
    setCurrentCollection(context, collectionId)

    // Clear descriptions collected during document-level shared variable evaluation.
    // Document-level shared variables are eagerly evaluated in createGenerationContext(),
    // but they may not be used by this specific table roll. We only want to capture
    // descriptions from table rolls that are actually part of this output.
    context.collectedDescriptions = []

    // Start root trace node
    beginTraceNode(context, 'root', `Roll: ${table.name || tableId}`, {
      raw: tableId,
      parsed: { collectionId, tableType: table.type }
    })

    // Roll on the table
    const result = this.rollTable(table, context, collectionId)
    const finalText = result.text

    // End root trace and extract
    endTraceNode(context, { value: finalText })
    const trace = extractTrace(context)

    // Extract capture variables if any were created
    const captures = context.captureVariables.size > 0
      ? Object.fromEntries(context.captureVariables)
      : undefined

    // Extract descriptions if any were collected, sorted by depth (lowest first = parent before child)
    const descriptions = context.collectedDescriptions.length > 0
      ? [...context.collectedDescriptions].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0))
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
      descriptions,
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

    const template = collection.templateIndex.get(templateId)
    if (!template) {
      throw new Error(`REFERENCE_ERROR: Template not found: ${templateId} in collection ${collectionId}`)
    }

    // Create generation context with optional trace
    const context = this.createGenerationContext(collection, options)
    setCurrentCollection(context, collectionId)

    // Clear descriptions collected during document-level shared variable evaluation.
    // Document-level shared variables are eagerly evaluated in createGenerationContext(),
    // but they may not be used by this specific template. We only want to capture
    // descriptions from table rolls that are actually part of this template's output.
    context.collectedDescriptions = []

    // Start root trace node
    beginTraceNode(context, 'root', `Template: ${template.name || templateId}`, {
      raw: templateId,
      parsed: { collectionId, pattern: template.pattern }
    })

    // Evaluate template-level shared variables (lazy evaluation)
    if (template.shared) {
      this.evaluator.evaluateTableLevelShared(template.shared, context, collectionId, templateId)
    }

    // Evaluate the template pattern
    const text = this.evaluator.evaluatePattern(template.pattern, context, collectionId)

    // End root trace and extract
    endTraceNode(context, { value: text })
    const trace = extractTrace(context)

    // Extract capture variables if any were created
    const captures = context.captureVariables.size > 0
      ? Object.fromEntries(context.captureVariables)
      : undefined

    // Extract descriptions if any were collected, sorted by depth (lowest first = parent before child)
    const descriptions = context.collectedDescriptions.length > 0
      ? [...context.collectedDescriptions].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0))
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
      descriptions,
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

    // Clear descriptions collected during document-level shared variable evaluation.
    // Document-level shared variables are eagerly evaluated in createGenerationContext(),
    // but they may not be used by this pattern preview. We only want to capture
    // descriptions from table rolls that are actually part of this output.
    context.collectedDescriptions = []

    // Evaluate template/table-level shared variables if provided
    // This happens BEFORE the root trace node so they don't appear in pattern trace
    if (options?.shared) {
      this.evaluator.evaluateTableLevelShared(options.shared, context, collectionId, '__preview__')
    }

    // Start root trace node
    beginTraceNode(context, 'root', 'Pattern Preview', {
      raw: pattern,
      parsed: { collectionId, pattern }
    })

    // Evaluate the pattern and capture individual expression outputs
    const { text, expressionOutputs } =
      this.evaluator.evaluatePatternWithOutputs(pattern, context, collectionId)

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
      expressionOutputs,
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
      maxGenerationWork: this.config.maxGenerationWork,
      maxOutputLength: this.config.maxOutputLength,
    }

    const context = createContext(config, staticVariables, {
      enableTrace: options?.enableTrace,
      random: options?.random,
    })

    // Evaluate shared variables (once per generation)
    if (collection.document.shared) {
      // Register all document-level shared variable names first (for shadowing prevention)
      for (const name of Object.keys(collection.document.shared)) {
        registerDocumentSharedName(context, name)
      }
      // Then evaluate them
      this.evaluator.evaluateSharedVariables(collection.document.shared, context, collection.id)
    }

    return context
  }

  // ==========================================================================
  // Internal: Table Inheritance
  // ==========================================================================

  /** Cache for resolved tables to avoid repeated inheritance resolution */
  private resolvedTables: Map<string, SimpleTable> = new Map()

  /** Resolve authored entry deletion and dictionary overrides into a strict runtime entry. */
  private mergeInheritedEntry(parent: Entry, child: Entry | InheritedEntryOverride, id: string): Entry {
    const merged: Record<string, unknown> = { ...parent, id }
    for (const [key, value] of Object.entries(child)) {
      if (value === null) {
        delete merged[key]
      } else if (key === 'assets' || key === 'sets') {
        const dictionary = Object.fromEntries(Object.entries((parent[key] ?? {})))
        for (const [name, item] of Object.entries(value as Record<string, string | null>)) {
          if (item === null) delete dictionary[name]
          else Object.defineProperty(dictionary, name, { value: item, enumerable: true, configurable: true, writable: true })
        }
        merged[key] = dictionary
      } else {
        Object.defineProperty(merged, key, { value, enumerable: true, configurable: true, writable: true })
      }
    }
    // Selection mode is a single choice; an explicit replacement clears the parent's mode.
    if (child.weight !== undefined && child.weight !== null) delete merged.range
    if (child.range !== undefined && child.range !== null) delete merged.weight
    if (typeof merged.value !== 'string') throw new Error(`INHERITANCE_ERROR: Entry '${id}' has no resolved value`)
    return merged as unknown as Entry
  }

  /**
   * Resolve table inheritance.
   * Merges parent entries into child, with child entries overriding by ID.
   */
  private resolveTableInheritance(
    table: AuthoredSimpleTable,
    collectionId: string,
    depth: number = 0,
    maxDepth = this.collections.get(collectionId)?.document.metadata.maxInheritanceDepth ?? this.config.maxInheritanceDepth
  ): SimpleTable {
    // Check cache
    const cacheKey = getTableIdentity(collectionId, table.id)
    const cached = this.resolvedTables.get(cacheKey)

    // No inheritance - return as-is
    if (table.extends === undefined) {
      if (table.entries.some(entry => typeof entry.value !== 'string')) throw new Error(`INHERITANCE_ERROR: Table '${table.id}' contains an unresolved override`)
      return table
    }

    // Check inheritance depth limit
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
      parentResult.table,
      parentResult.collectionId,
      depth + 1,
      maxDepth
    )

    // Walk the complete ancestry before using cache so depth cannot depend on prior rolls.
    if (cached) return cached

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
        entryById.set(id, this.mergeInheritedEntry(parentEntry, entry, id))
      } else {
        if (typeof entry.value !== 'string') throw new Error(`INHERITANCE_ERROR: Override '${id}' does not match an inherited entry`)
        if (Object.values(entry).some(value => value === null) || ['assets', 'sets'].some(key => Object.values((entry as unknown as Record<string, unknown>)[key] ?? {}).some(value => value === null))) throw new Error(`INHERITANCE_ERROR: New entry '${id}' cannot delete inherited properties`)
        entryById.set(id, { ...entry, id } as Entry)
      }
    }

    // Build final entry array
    for (const entry of entryById.values()) {
      if (typeof entry.value !== 'string') throw new Error(`INHERITANCE_ERROR: Entry '${entry.id}' has no resolved value`)
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
  private resolveTableRef(ref: string, collectionId: string): { table: AuthoredTable; collectionId: string } | undefined {
    return resolveTableRefFn(ref, collectionId, { collections: this.collections })
  }

  /**
   * Resolve a template reference that may include namespace or alias.
   * Format: templateId, alias.templateId, or namespace.templateId
   */
  private resolveTemplateRef(ref: string, collectionId: string): { template: Template; collectionId: string } | undefined {
    return resolveTemplateRefFn(ref, collectionId, { collections: this.collections })
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
    table: AuthoredTable,
    context: GenerationContext,
    collectionId: string,
    options: { unique?: boolean; excludeIds?: Set<string> } = {}
  ): { text: string; resultType?: string; assets?: Assets; placeholders?: EvaluatedSets; entryId?: string; description?: string } {
    consumeWork(context)
    const frame = {
      staticVariables: context.staticVariables,
      currentTableId: context.currentTableId,
      currentEntryId: context.currentEntryId,
      currentEntryDescription: context.currentEntryDescription,
      currentEntryValue: context.currentEntryValue,
      currentCollectionId: context.currentCollectionId,
    }
    // Check recursion limit
    if (!incrementRecursion(context)) {
      throw new Error(`Recursion limit exceeded (${context.config.maxRecursionDepth})`)
    }

    const sharedScope = beginSharedScope(context)

    // Start trace node for table roll
    beginTraceNode(context, 'table_roll', `Table: ${table.name || table.id}`, {
      raw: table.id,
      parsed: { type: table.type, name: table.name }
    })

    try {
      setCurrentTable(context, table.id)
      setCurrentCollection(context, collectionId)
      context.staticVariables = new Map(Object.entries(this.collections.get(collectionId)?.document.variables ?? {}))

      // Evaluate table-level shared variables (lazy evaluation)
      // evaluateTableLevelShared skips variables that already exist, handling inheritance
      // Invocation scopes inherit active parent values and restore sibling bindings on return.
      if (table.shared) {
        this.evaluator.evaluateTableLevelShared(table.shared, context, collectionId, table.id)
      }

      let result: { text: string; resultType?: string; assets?: Assets; placeholders?: EvaluatedSets; entryId?: string; description?: string }

      if (table.type === 'simple') {
        result = this.rollSimple(table, context, collectionId, options)
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
      endSharedScope(context, sharedScope)
      Object.assign(context, frame)
      decrementRecursion(context)
    }
  }

  private rollSimple(
    table: AuthoredSimpleTable,
    context: GenerationContext,
    collectionId: string,
    options: { unique?: boolean; excludeIds?: Set<string> }
  ): { text: string; resultType?: string; assets?: Assets; placeholders?: EvaluatedSets; entryId?: string; description?: string } {
    // Resolve inheritance before rolling
    const resolvedTable = this.resolveTableInheritance(table, collectionId)

    // Selection returns its actual eligible pool, so trace includes exclusions and refills.
    const selected = rollSimpleTable(resolvedTable, context, { ...options, trackingKey: getTableIdentity(collectionId, table.id) })
    const pool = selected?.selectionPool ?? []
    const totalWeight = calculateTotalWeight(pool)

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
    const selectedProbability = getNormalizedProbabilities(pool)[pool.findIndex(p => p.id === selected.id)] ?? 0

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
      probability: selectedProbability,
      poolSize: pool.length,
      unique: options.unique ?? false,
      excludedIds: Array.from(selected.excludedIds),
    } as EntrySelectMetadata)

    // Update context with entry info
    setCurrentTable(context, table.id, selected.id)

    // Store description and raw value in context for {{@self.description}} and {{@self.value}} access
    // Must be set BEFORE evaluating sets so they can reference these values
    setCurrentEntryDescription(context, selected.entry.description)
    setCurrentEntryValue(context, selected.entry.value)

    // Evaluate and merge placeholders
    // Set values containing {{patterns}} are evaluated at merge time for consistency
    let evaluatedSets: EvaluatedSets = selected.mergedSets
    if (Object.keys(selected.mergedSets).length > 0) {
      evaluatedSets = this.evaluator.evaluateSetValues(selected.mergedSets, context, collectionId, table.id)
      mergePlaceholderSets(context, table.id, evaluatedSets)
    }

    // Evaluate the entry value (may contain expressions)
    // Fallback to empty string if value is undefined (shouldn't happen with proper inheritance)
    const text = this.evaluator.evaluatePattern(selected.entry.value ?? '', context, collectionId)

    // Capture description if present
    let description: string | undefined
    if (selected.entry.description) {
      description = this.evaluator.evaluatePattern(
        selected.entry.description,
        context,
        collectionId
      )
      addDescription(
        context,
        resolvedTable.name,
        resolvedTable.id,
        text,
        description
      )
    }

    return {
      text,
      resultType: selected.resultType,
      assets: selected.assets,
      placeholders: evaluatedSets,
      entryId: selected.id,
      description,
    }
  }

  private rollComposite(
    table: CompositeTable,
    context: GenerationContext,
    collectionId: string,
    options: { unique?: boolean; excludeIds?: Set<string> }
  ): { text: string; resultType?: string; assets?: Assets; placeholders?: EvaluatedSets; entryId?: string; description?: string } {
    const trackingKey = getTableIdentity(collectionId, table.id)
    const excluded = new Set(options.excludeIds)
    if (options.unique) for (const id of getUsedEntries(context, trackingKey)) excluded.add(id)

    const allSources = buildSourcePool(table.sources)
    const resolveSource = (sourceId: string) => {
      const resolved = this.resolveTableRef(sourceId, collectionId)
      if (!resolved) throw new Error(`REFERENCE_ERROR: Source table not found: ${sourceId}`)
      return resolved
    }
    const eligibleSources = (exclusions: Set<string>) => allSources.filter(({ source }) => {
      const resolved = resolveSource(source.tableId)
      return this.getSelectableEntryIds(resolved.table, resolved.collectionId, new Set(), context.config.maxRecursionDepth - context.recursionDepth).some(id =>
        !exclusions.has(this.compositeEntryIdentity(resolved.collectionId, resolved.table.id, id)))
    })
    let sourcePool = excluded.size || options.unique ? eligibleSources(excluded) : allSources
    if (!sourcePool.length && options.unique) {
      const available = eligibleSources(new Set(options.excludeIds))
      if (!available.length) return { text: '' }
      if (context.config.uniqueOverflowBehavior === 'error') throw new Error(`Unique selection overflow: no more entries available in composite '${table.id}'`)
      if (context.config.uniqueOverflowBehavior !== 'cycle') return { text: '' }
      context.usedEntries.delete(trackingKey)
      excluded.clear()
      for (const id of options.excludeIds ?? []) excluded.add(id)
      sourcePool = available
    }
    const selection = selectWeighted(sourcePool, context.random)
    if (!selection) return { text: '' }
    const sourceProbabilities = getNormalizedProbabilities(sourcePool)
    addTraceLeaf(context, 'composite_select', `Source: ${selection.source.tableId}`, {
      raw: table.id,
      parsed: { sourceCount: sourcePool.length },
    }, { value: selection.source.tableId }, {
      type: 'composite_select',
      sources: sourcePool.map((ws, index) => ({ tableId: ws.source.tableId, weight: ws.weight, probability: sourceProbabilities[index] })),
      selectedTableId: selection.source.tableId,
    } as CompositeSelectMetadata)

    const { table: sourceTable, collectionId: sourceOwner } = resolveSource(selection.source.tableId)
    const childExclusions = excluded.size ? new Set(this.getSelectableEntryIds(sourceTable, sourceOwner, new Set(), context.config.maxRecursionDepth - context.recursionDepth).filter(id =>
      excluded.has(this.compositeEntryIdentity(sourceOwner, sourceTable.id, id)))) : undefined
    const result = this.rollTable(sourceTable, context, sourceOwner, { excludeIds: childExclusions })
    const entryId = result.entryId === undefined ? undefined : this.compositeEntryIdentity(sourceOwner, sourceTable.id, result.entryId)
    if (options.unique && entryId !== undefined) markEntryUsed(context, trackingKey, entryId)
    return { ...result, entryId, resultType: result.resultType ?? sourceTable.resultType ?? table.resultType }
  }

  /** Composite entry identities preserve each source's actual collection/table ownership. */
  private compositeEntryIdentity(collectionId: string, tableId: string, entryId: string): string {
    return JSON.stringify([collectionId, tableId, entryId])
  }

  /** Determine eligible source outcomes without drawing or altering generation state. */
  private getSelectableEntryIds(table: AuthoredTable, collectionId: string, ancestors = new Set<string>(), depthBudget = this.config.maxRecursionDepth): string[] {
    const key = getTableIdentity(collectionId, table.id)
    if (ancestors.size >= depthBudget) throw new Error(`Recursion limit exceeded (${this.config.maxRecursionDepth})`)
    if (ancestors.has(key)) throw new Error(`REFERENCE_ERROR: Composite source cycle involving '${table.id}'`)
    if (table.type === 'simple') return buildWeightedPool(this.resolveTableInheritance(table, collectionId).entries, table.id).map(entry => entry.id)
    if (table.type === 'collection') {
      const sources = table.collections.map(id => {
        const source = this.resolveTableRef(id, collectionId)
        if (!source || source.table.type !== 'simple') throw new Error(`REFERENCE_ERROR: Source simple table not found: ${id}`)
        return { id, table: this.resolveTableInheritance(source.table, source.collectionId), identity: getTableIdentity(source.collectionId, source.table.id) }
      })
      return mergeTableEntries(sources).entries.map(entry => entry.id)
    }
    const visited = new Set(ancestors).add(key)
    return buildSourcePool(table.sources).flatMap(({ source }) => {
      const resolved = this.resolveTableRef(source.tableId, collectionId)
      if (!resolved) throw new Error(`REFERENCE_ERROR: Source table not found: ${source.tableId}`)
      return this.getSelectableEntryIds(resolved.table, resolved.collectionId, visited, depthBudget).map(id =>
        this.compositeEntryIdentity(resolved.collectionId, resolved.table.id, id))
    })
  }

  private rollCollection(
    table: CollectionTable,
    context: GenerationContext,
    collectionId: string,
    options: { unique?: boolean; excludeIds?: Set<string> }
  ): { text: string; resultType?: string; assets?: Assets; placeholders?: EvaluatedSets; entryId?: string; description?: string } {
    // Get source tables
    const getTables = (ids: string[]) => {
      const result: CollectionSourceTable[] = []
      for (const id of ids) {
        const resolved = this.resolveTableRef(id, collectionId)
        if (!resolved || resolved.table.type !== 'simple') throw new Error(`REFERENCE_ERROR: Source simple table not found: ${id}`)
        result.push({ id, table: this.resolveTableInheritance(resolved.table, resolved.collectionId), identity: getTableIdentity(resolved.collectionId, resolved.table.id) })
      }
      return result
    }

    // Get source tables for trace metadata
    const sourceTables = getTables(table.collections)

    const selected = rollCollectionTable(table, getTables, context, { ...options, trackingKey: getTableIdentity(collectionId, table.id) })
    const mergedPool = { entries: selected?.selectionPool ?? [], totalWeight: calculateTotalWeight(selected?.selectionPool ?? []) }
    const totalEntries = mergedPool.entries.length
    const totalWeight = mergedPool.totalWeight
    const mergedProbabilities = getNormalizedProbabilities(mergedPool.entries)

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
      selectedWeight: mergedPool.entries.find(entry => entry.id === selected.id)?.weight ?? 0,
      totalWeight,
      probability: mergedProbabilities[mergedPool.entries.findIndex(entry => entry.id === selected.id)] ?? 0,
      poolSize: totalEntries,
      unique: options.unique ?? false,
      excludedIds: Array.from(selected.excludedIds),
    } as EntrySelectMetadata)

    // Update context
    setCurrentTable(context, table.id, selected.id)

    // Store description and raw value in context for {{@self.description}} and {{@self.value}} access
    // Must be set BEFORE evaluating sets so they can reference these values
    setCurrentEntryDescription(context, selected.entry.description)
    setCurrentEntryValue(context, selected.entry.value)

    const sourceResolved = this.resolveTableRef(selected.sourceTableId, collectionId)!
    const sourceOwnerId = sourceResolved.collectionId
    const sourceTable = sourceTables.find(source => source.id === selected.sourceTableId)!.table
    setCurrentCollection(context, sourceOwnerId)
    context.staticVariables = new Map(Object.entries(this.collections.get(sourceOwnerId)?.document.variables ?? {}))

    // Source-local shared definitions inherit active parent bindings and expire with this invocation.
    if (sourceTable.shared) this.evaluator.evaluateTableLevelShared(sourceTable.shared, context, sourceOwnerId, sourceTable.id)

    // Evaluate and merge placeholders
    // Set values containing {{patterns}} are evaluated at merge time for consistency
    let evaluatedSets: EvaluatedSets = selected.mergedSets
    if (Object.keys(selected.mergedSets).length > 0) {
      evaluatedSets = this.evaluator.evaluateSetValues(selected.mergedSets, context, sourceOwnerId, table.id)
      mergePlaceholderSets(context, table.id, evaluatedSets)
    }

    // Evaluate the entry value
    // Fallback to empty string if value is undefined (shouldn't happen with proper inheritance)
    const text = this.evaluator.evaluatePattern(selected.entry.value ?? '', context, sourceOwnerId)

    // Capture description if present
    let description: string | undefined
    if (selected.entry.description) {
      // Get source table name for attribution
      const tableName = sourceTable.name

      description = this.evaluator.evaluatePattern(
        selected.entry.description,
        context,
        sourceOwnerId
      )
      addDescription(
        context,
        tableName,
        selected.sourceTableId,
        text,
        description
      )
    }

    return {
      text,
      resultType: selected.resultType,
      assets: selected.assets,
      placeholders: evaluatedSets,
      entryId: selected.id,
      description,
    }
  }

}

// ==========================================================================
// Exports
// ==========================================================================

export { validateDocument, validateDocumentStructure } from './validator'
export { parseTemplate, extractExpressions } from './parser'
export { evaluateMath } from './math'
export { createContext } from './context'

// Re-export types
export type { ValidationResult, ValidationIssue, ValidationOptions } from './validator'
export type { ExpressionToken } from './parser'
export type { GenerationContext } from './context'
export type { RollTrace, TraceNode, TraceNodeType, TraceStats } from './trace'
