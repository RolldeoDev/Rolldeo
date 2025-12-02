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
  EvaluatedSets,
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
  getSharedVariableSource,
  registerDocumentSharedName,
  wouldShadowDocumentShared,
  getCaptureVariable,
  setCaptureVariable,
  getCaptureSharedVariable,
  setCaptureSharedVariable,
  hasVariableConflict,
  addDescription,
  beginSetEvaluation,
  endSetEvaluation,
  setCurrentEntryDescription,
  type GenerationContext,
} from './context'
import {
  parseTemplate,
  parseExpression,
  extractExpressions,
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
    // Build table index for O(1) lookups
    const tableIndex = new Map<string, Table>()
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
   * Update a collection's document (for live editing).
   * This updates the document and rebuilds indexes, then re-resolves imports.
   */
  updateDocument(id: string, document: RandomTableDocument): void {
    const existing = this.collections.get(id)
    if (!existing) return

    // Rebuild table index
    const tableIndex = new Map<string, Table>()
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
  resolveImports(pathToIdMap?: Map<string, string>): void {
    for (const collection of this.collections.values()) {
      // Skip collections without imports
      if (!collection.document.imports || collection.document.imports.length === 0) {
        continue
      }

      // Clear existing imports (in case of re-resolution)
      collection.imports.clear()

      for (const imp of collection.document.imports) {
        let targetCollection: LoadedCollection | undefined

        // 1. Try pathToIdMap lookup first (file path based imports)
        if (pathToIdMap) {
          const targetId = pathToIdMap.get(imp.path)
          if (targetId) {
            targetCollection = this.collections.get(targetId)
          }
        }

        // 2. Try matching by namespace (for namespace-based imports from editor)
        if (!targetCollection) {
          for (const candidate of this.collections.values()) {
            if (candidate.document.metadata.namespace === imp.path) {
              targetCollection = candidate
              break
            }
          }
        }

        // 3. Try matching by collection ID (direct ID reference)
        if (!targetCollection) {
          targetCollection = this.collections.get(imp.path)
        }

        if (targetCollection) {
          collection.imports.set(imp.alias, targetCollection)
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
   * Get a table by ID (O(1) lookup using index)
   */
  getTable(tableId: string, collectionId?: string): Table | undefined {
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
        entryCount: table.type === 'simple' ? (table as SimpleTable).entries.length : undefined,
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

    // Evaluate the pattern and capture individual expression outputs
    const { text: evaluatedText, expressionOutputs } =
      this.evaluatePatternWithOutputs(pattern, context, collectionId)
    let text = evaluatedText

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
   *
   * Capture-aware shared variables: Keys starting with $ (e.g., "$hero") capture
   * the full roll result including sets, enabling {{$hero.@prop}} access syntax.
   */
  private evaluateSharedVariables(
    shared: Record<string, string>,
    context: GenerationContext,
    collectionId: string
  ): void {
    for (const [name, expression] of Object.entries(shared)) {
      // Check if this is a capture-aware shared variable (starts with $)
      if (name.startsWith('$')) {
        const varName = name.slice(1) // Remove $ prefix
        this.evaluateCaptureAwareShared(varName, expression, context, collectionId)
        continue
      }

      // Regular shared variable evaluation
      const evaluated = this.evaluatePattern(expression, context, collectionId)

      // Try to parse as number, otherwise keep as string
      const numValue = parseFloat(evaluated)
      const value = !isNaN(numValue) && isFinite(numValue) ? numValue : evaluated

      setSharedVariable(context, name, value)
    }
  }

  /**
   * Evaluate a capture-aware shared variable.
   * Captures the full roll result including sets for {{$varName.@prop}} access.
   */
  private evaluateCaptureAwareShared(
    varName: string,
    expression: string,
    context: GenerationContext,
    collectionId: string
  ): void {
    // Parse the expression to check if it's a simple table reference
    const expressions = extractExpressions(expression)

    // If it's a single expression that's a table reference, capture the full result
    if (expressions.length === 1) {
      const token = parseExpression(expressions[0].expression)

      if (token.type === 'table') {
        // Resolve and roll the table, capturing the result with sets
        const tableResult = this.resolveTableRef(token.tableId, collectionId)
        if (tableResult) {
          // Track description count before roll to find new descriptions
          const descCountBefore = context.collectedDescriptions.length
          const result = this.rollTable(tableResult.table, context, tableResult.collectionId)

          // Get the first description added by this roll (the entry's own description)
          // Nested rolls may add more, but the first new one is the direct entry description
          const newDescriptions = context.collectedDescriptions.slice(descCountBefore)
          const entryDescription = newDescriptions.length > 0 ? newDescriptions[0].description : undefined

          // Sets are already evaluated at merge time in evaluateSetValues()
          // Just use the placeholders directly
          setCaptureSharedVariable(context, varName, {
            value: result.text,
            sets: result.placeholders ?? {},
            description: entryDescription,
          })
          return
        }
      }

      // Handle capture access with properties - check if it references a nested CaptureItem
      // This enables chaining: "$situation": "{{$conflict.@situation}}" where @situation is a nested CaptureItem
      // Also supports deep chaining: "$deep": "{{$conflict.@situation.@focus}}"
      if (token.type === 'captureAccess' && token.properties && token.properties.length > 0) {
        const sourceCapture = getCaptureSharedVariable(context, token.varName)
        if (sourceCapture) {
          // Check if the final property is a terminal (value/count/description)
          const lastProp = token.properties[token.properties.length - 1]
          if (lastProp !== 'value' && lastProp !== 'count' && lastProp !== 'description') {
            // Try to get the nested CaptureItem at the end of the property chain
            const nestedItem = this.getNestedCaptureItem(sourceCapture, token.properties)
            if (nestedItem) {
              // It's a nested CaptureItem - store it directly to enable further chaining
              setCaptureSharedVariable(context, varName, nestedItem)
              return
            }
          }
        }
      }
    }

    // Fallback: For complex expressions, evaluate and capture with empty sets
    // This supports patterns like "$result": "{{dice:1d6}} {{table}}"
    const evaluated = this.evaluatePattern(expression, context, collectionId)
    setCaptureSharedVariable(context, varName, {
      value: evaluated,
      sets: {},
    })
  }

  /**
   * Evaluate table/template-level shared variables at roll time.
   * Validates that names don't shadow document-level shared variables.
   * Processed in order - later variables can reference earlier ones.
   *
   * Capture-aware shared variables: Keys starting with $ (e.g., "$hero") capture
   * the full roll result including sets, enabling {{$hero.@prop}} access syntax.
   */
  private evaluateTableLevelShared(
    shared: Record<string, string>,
    context: GenerationContext,
    collectionId: string,
    sourceId: string
  ): void {
    for (const [name, expression] of Object.entries(shared)) {
      // Handle capture-aware shared variables (keys starting with $)
      if (name.startsWith('$')) {
        const varName = name.slice(1) // Remove $ prefix

        // Check for shadowing document-level shared (check with $ prefix)
        if (wouldShadowDocumentShared(context, name)) {
          throw new Error(
            `SHARED_SHADOW in ${sourceId}: Table/template-level capture-aware shared variable '${name}' ` +
              `would shadow document-level shared variable. ` +
              `Document-level shared variables take precedence.`
          )
        }

        // If already set by a parent table, skip
        if (context.captureSharedVariables.has(varName)) {
          continue
        }

        this.evaluateCaptureAwareShared(varName, expression, context, collectionId)
        continue
      }

      // Regular shared variable handling
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

      setSharedVariable(context, name, value, sourceId)
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
          const table = importedCollection.tableIndex.get(tableId)
          if (table) {
            return { table, collectionId: importedCollection.id }
          }
        }

        // Fall back to namespace matching
        const namespace = parts.slice(0, -1).join('.')
        for (const collection of this.collections.values()) {
          if (collection.document.metadata.namespace === namespace) {
            const table = collection.tableIndex.get(tableId)
            if (table) return { table, collectionId: collection.id }
          }
        }

        // Fallback: If the alias matches a document import alias but imports weren't resolved,
        // use the import's path to find the correct collection.
        if (currentCollection?.document.imports) {
          const importDef = currentCollection.document.imports.find(imp => imp.alias === aliasOrNamespace)
          if (importDef) {
            // The import alias exists in the document, but wasn't resolved.
            // Use the import's path to find the target collection by namespace or ID.
            for (const collection of this.collections.values()) {
              if (collection.id !== collectionId) {
                // Match by namespace (path is usually the namespace)
                if (collection.document.metadata.namespace === importDef.path) {
                  const table = collection.tableIndex.get(tableId)
                  if (table) {
                    return { table, collectionId: collection.id }
                  }
                }
                // Match by collection ID
                if (collection.id === importDef.path) {
                  const table = collection.tableIndex.get(tableId)
                  if (table) {
                    return { table, collectionId: collection.id }
                  }
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
      const table = currentCollection.tableIndex.get(ref)
      if (table) return { table, collectionId }
    }

    // Search all collections as fallback
    for (const collection of this.collections.values()) {
      const table = collection.tableIndex.get(ref)
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
          const template = importedCollection.templateIndex.get(templateId)
          if (template) {
            return { template, collectionId: importedCollection.id }
          }
        }

        // Fall back to namespace matching
        const namespace = parts.slice(0, -1).join('.')
        for (const collection of this.collections.values()) {
          if (collection.document.metadata.namespace === namespace) {
            const template = collection.templateIndex.get(templateId)
            if (template) return { template, collectionId: collection.id }
          }
        }

        // Fallback: If the alias matches a document import alias but imports weren't resolved,
        // use the import's path to find the correct collection.
        if (currentCollection?.document.imports) {
          const importDef = currentCollection.document.imports.find(imp => imp.alias === aliasOrNamespace)
          if (importDef) {
            // The import alias exists in the document, but wasn't resolved.
            // Use the import's path to find the target collection by namespace or ID.
            for (const collection of this.collections.values()) {
              if (collection.id !== collectionId) {
                // Match by namespace (path is usually the namespace)
                if (collection.document.metadata.namespace === importDef.path) {
                  const template = collection.templateIndex.get(templateId)
                  if (template) {
                    return { template, collectionId: collection.id }
                  }
                }
                // Match by collection ID
                if (collection.id === importDef.path) {
                  const template = collection.templateIndex.get(templateId)
                  if (template) {
                    return { template, collectionId: collection.id }
                  }
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
      const template = currentCollection.templateIndex.get(ref)
      if (template) return { template, collectionId }
    }

    // Search all collections as fallback
    for (const collection of this.collections.values()) {
      const template = collection.templateIndex.get(ref)
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
      // Clear this table's shared variables first so they get re-evaluated on each invocation
      // BUT only if they were set by this same table (multi-roll case), not by a parent (inheritance case)
      if (table.shared) {
        for (const name of Object.keys(table.shared)) {
          const source = getSharedVariableSource(context, name)
          if (source === table.id) {
            // Same table set this variable before - clear it for re-evaluation
            context.sharedVariables.delete(name)
            context.sharedVariableSources.delete(name)
          }
          // If source is different (parent table), keep the value (inheritance)
        }
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

    // Evaluate and merge placeholders
    // Set values containing {{patterns}} are evaluated at merge time for consistency
    let evaluatedSets = selected.mergedSets
    if (Object.keys(selected.mergedSets).length > 0) {
      evaluatedSets = this.evaluateSetValues(selected.mergedSets, context, collectionId, table.id)
      mergePlaceholderSets(context, table.id, evaluatedSets)
    }

    // Store description in context for {{@self.description}} access
    setCurrentEntryDescription(context, selected.entry.description)

    // Evaluate the entry value (may contain expressions)
    // Fallback to empty string if value is undefined (shouldn't happen with proper inheritance)
    const text = this.evaluatePattern(selected.entry.value ?? '', context, collectionId)

    // Clear description from context after evaluation
    setCurrentEntryDescription(context, undefined)

    // Capture description if present
    if (selected.entry.description) {
      const evaluatedDescription = this.evaluatePattern(
        selected.entry.description,
        context,
        collectionId
      )
      addDescription(
        context,
        resolvedTable.name,
        resolvedTable.id,
        text,
        evaluatedDescription
      )
    }

    return {
      text,
      resultType: selected.resultType,
      assets: selected.assets,
      placeholders: evaluatedSets,
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

    // Evaluate and merge placeholders
    // Set values containing {{patterns}} are evaluated at merge time for consistency
    let evaluatedSets = selected.mergedSets
    if (Object.keys(selected.mergedSets).length > 0) {
      evaluatedSets = this.evaluateSetValues(selected.mergedSets, context, collectionId, table.id)
      mergePlaceholderSets(context, table.id, evaluatedSets)
    }

    // Store description in context for {{@self.description}} access
    setCurrentEntryDescription(context, selected.entry.description)

    // Evaluate the entry value
    // Fallback to empty string if value is undefined (shouldn't happen with proper inheritance)
    const text = this.evaluatePattern(selected.entry.value ?? '', context, collectionId)

    // Clear description from context after evaluation
    setCurrentEntryDescription(context, undefined)

    // Capture description if present
    if (selected.entry.description) {
      // Get source table name for attribution
      const sourceTable = this.getTable(selected.sourceTableId, collectionId)
      const tableName = sourceTable?.name ?? selected.sourceTableId

      const evaluatedDescription = this.evaluatePattern(
        selected.entry.description,
        context,
        collectionId
      )
      addDescription(
        context,
        tableName,
        selected.sourceTableId,
        text,
        evaluatedDescription
      )
    }

    return {
      text,
      resultType: selected.resultType,
      assets: selected.assets,
      placeholders: evaluatedSets,
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

  /**
   * Evaluate set values that contain patterns.
   * Set values are evaluated at merge time (when entry is selected) to ensure consistency.
   * Only values containing {{}} are evaluated; plain strings are returned as-is.
   * Uses cycle detection to prevent infinite loops from self-referential sets.
   *
   * @param sets - The merged sets from the selected entry
   * @param context - The generation context
   * @param collectionId - The collection ID for table resolution
   * @param tableId - The table ID (used for cycle detection key)
   * @returns Evaluated sets with patterns resolved
   */
  private evaluateSetValues(
    sets: Sets,
    context: GenerationContext,
    collectionId: string,
    tableId: string
  ): EvaluatedSets {
    const evaluated: EvaluatedSets = {}

    for (const [key, value] of Object.entries(sets)) {
      if (value.includes('{{')) {
        // This value contains a pattern - evaluate it
        const setKey = `${tableId}.${key}`

        if (!beginSetEvaluation(context, setKey)) {
          // Cycle detected - return raw value to prevent infinite loop
          evaluated[key] = value
          continue
        }

        try {
          // Check if this is a single table reference - if so, capture full result
          // This enables nested property access like {{$parent.@child.@grandchild}}
          const expressions = extractExpressions(value)
          if (expressions.length === 1 && value.trim() === expressions[0].raw) {
            const token = parseExpression(expressions[0].expression)
            if (token.type === 'table') {
              // Roll table and capture full result including nested sets
              const tableResult = this.resolveTableRef(token.tableId, collectionId)
              if (tableResult) {
                const result = this.rollTable(tableResult.table, context, tableResult.collectionId)
                evaluated[key] = {
                  value: result.text,
                  sets: result.placeholders ?? {},
                  description: undefined,
                }
                continue
              }
            }
          }
          // Fallback: evaluate as string for complex expressions
          evaluated[key] = this.evaluatePattern(value, context, collectionId)
        } finally {
          endSetEvaluation(context, setKey)
        }
      } else {
        // Plain string value - use as-is
        evaluated[key] = value
      }
    }

    return evaluated
  }

  /**
   * Evaluate pattern and capture individual expression outputs for segment mapping.
   * Uses extractExpressions to identify expression positions and captures each output.
   */
  private evaluatePatternWithOutputs(
    pattern: string,
    context: GenerationContext,
    collectionId: string
  ): { text: string; expressionOutputs: string[] } {
    const expressions = extractExpressions(pattern)
    const expressionOutputs: string[] = []
    let result = ''
    let lastIndex = 0

    for (const expr of expressions) {
      // Add literal text before this expression
      if (expr.start > lastIndex) {
        result += pattern.slice(lastIndex, expr.start)
      }

      // Parse and evaluate the expression
      const token = parseExpression(expr.expression)
      const output = this.evaluateToken(token, context, collectionId)

      result += output
      expressionOutputs.push(output)
      lastIndex = expr.end
    }

    // Add remaining literal text
    if (lastIndex < pattern.length) {
      result += pattern.slice(lastIndex)
    }

    return { text: result, expressionOutputs }
  }

  private evaluateToken(token: ExpressionToken, context: GenerationContext, collectionId: string): string {
    switch (token.type) {
      case 'literal':
        return token.text

      case 'dice':
        return this.evaluateDice(token.expression, context)

      case 'math': {
        const result = evaluateMath(token.expression, context)
        return result !== null ? String(result) : '[math error]'
      }

      case 'variable':
        return this.evaluateVariable(token, context)

      case 'placeholder':
        return this.evaluatePlaceholder(token, context, collectionId)

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
        return this.evaluateCaptureAccess(token, context, collectionId)

      case 'collect':
        return this.evaluateCollect(token, context, collectionId)

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
    // Check capture-aware shared variables first
    const captureShared = getCaptureSharedVariable(context, token.name)
    if (captureShared) {
      // Add variable access trace
      addTraceLeaf(context, 'variable_access', `$${token.alias ? token.alias + '.' : ''}${token.name}`, {
        raw: token.name,
        parsed: { alias: token.alias }
      }, {
        value: captureShared.value,
      }, {
        type: 'variable',
        name: token.name,
        source: 'captureShared',
      } as VariableAccessMetadata)

      return captureShared.value
    }

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
    context: GenerationContext,
    collectionId: string
  ): string {
    // Handle @self placeholder for current entry properties
    if (token.name === 'self') {
      if (token.property === 'description') {
        const rawDescription = context.currentEntryDescription ?? ''
        // Evaluate any expressions in the description
        const result = rawDescription ? this.evaluatePattern(rawDescription, context, collectionId) : ''

        // Add placeholder access trace
        addTraceLeaf(context, 'placeholder_access', `@self.description`, {
          raw: 'self',
          parsed: { property: 'description' }
        }, {
          value: result,
        }, {
          type: 'placeholder',
          name: 'self',
          property: 'description',
          found: rawDescription !== '',
        } as PlaceholderAccessMetadata)

        return result
      }
      // Unknown @self property - return empty string
      return ''
    }

    // Get the placeholder value directly - no implicit table/template resolution
    // Set values containing {{patterns}} are evaluated at merge time in evaluateSetValues()
    // If you want a set value to roll a table, use explicit syntax: "nameTable": "{{elfNames}}"
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

      // Start trace node for template reference evaluation
      // This wraps the template's internal evaluations so the full result is captured
      beginTraceNode(context, 'template_ref', `Template: ${template.name || template.id}`, {
        raw: template.id,
        parsed: { collectionId, templateId: template.id, pattern: template.pattern }
      })

      // CRITICAL: Create isolated context for cross-collection template evaluation.
      // This prevents placeholders from imported templates leaking into the parent context.
      // Without isolation, table rolls in the imported collection add placeholder keys
      // that persist and pollute subsequent evaluations in the parent collection.
      //
      // We also isolate sharedVariables and sharedVariableSources so that:
      // 1. The child template's shared variables are evaluated fresh
      // 2. Side effects (like populating placeholders from table rolls) happen properly
      // 3. Parent and child can have shared variables with the same name without conflict
      const isolatedContext: GenerationContext = {
        ...context,
        placeholders: new Map(), // Fresh placeholder map - prevents leakage
        sharedVariables: new Map(context.sharedVariables), // Copy so child can add without affecting parent
        sharedVariableSources: new Map(context.sharedVariableSources), // Copy for tracking
      }

      // Evaluate template-level shared variables (lazy evaluation)
      // For isolated template contexts, we need to re-evaluate shared variables even if
      // the parent has the same name, because the side effects (populating placeholders)
      // need to happen in the isolated context.
      if (template.shared) {
        for (const name of Object.keys(template.shared)) {
          // Clear any existing value for this shared variable so it gets re-evaluated
          // in this isolated context. This ensures that table rolls populate the
          // isolated placeholders map.
          isolatedContext.sharedVariables.delete(name)
          isolatedContext.sharedVariableSources.delete(name)
        }
        this.evaluateTableLevelShared(template.shared, isolatedContext, collectionId, template.id)
      }

      // Evaluate the template pattern using isolated context
      let text = this.evaluatePattern(template.pattern, isolatedContext, collectionId)

      // Apply document-level conditionals using isolated context
      if (collection.document.conditionals && collection.document.conditionals.length > 0) {
        text = applyConditionals(
          collection.document.conditionals,
          text,
          isolatedContext,
          (pattern: string) => this.evaluatePattern(pattern, isolatedContext, collectionId)
        )
      }

      // End trace node with full template result
      endTraceNode(context, { value: text })

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

    // Try to resolve as a table first
    const table = this.getTable(token.tableId, collectionId)

    // If not a table, check if it's a template
    if (!table) {
      const templateResult = this.resolveTemplateRef(token.tableId, collectionId)
      if (templateResult) {
        // Handle template multi-roll
        return this.evaluateMultiRollTemplate(
          templateResult.template,
          templateResult.collectionId,
          count,
          countSource,
          token,
          context
        )
      }
      console.warn(`Table or template not found: ${token.tableId}`)
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

  /**
   * Handle multi-roll for templates (e.g., {{4*simpleNpc}})
   * Note: 'unique' modifier is ignored for templates since they don't have entry IDs
   */
  private evaluateMultiRollTemplate(
    template: Template,
    templateCollectionId: string,
    count: number,
    countSource: 'literal' | 'variable' | 'dice',
    token: { tableId: string; unique?: boolean; separator?: string; count: number | string },
    context: GenerationContext
  ): string {
    // Start multi_roll trace node for template
    beginTraceNode(context, 'multi_roll', `${count}x ${token.tableId} (template)`, {
      raw: `${token.count}*${token.tableId}`,
      parsed: { count, tableId: token.tableId, unique: token.unique, isTemplate: true }
    })

    const results: string[] = []

    for (let i = 0; i < count; i++) {
      const result = this.evaluateTemplateInternal(template, templateCollectionId, context)
      if (result) {
        results.push(result)
      }
    }

    const finalResult = results.join(token.separator ?? ', ')

    // End multi_roll trace node
    endTraceNode(context, { value: finalResult }, {
      type: 'multi_roll',
      tableId: token.tableId,
      countSource,
      count,
      unique: false, // unique not applicable for templates
      separator: token.separator ?? ', ',
    } as MultiRollMetadata)

    return finalResult
  }

  private evaluateAgain(
    token: { count?: number; unique?: boolean; separator?: string },
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

    return results.join(token.separator ?? ', ')
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
      // Track description count before roll to find new descriptions
      const descCountBefore = context.collectedDescriptions.length
      const result = this.rollTable(table, context, resolvedCollectionId, {
        unique: token.unique,
        excludeIds: token.unique ? usedIds : undefined,
      })

      if (result.text) {
        results.push(result.text)

        // Get the first description added by this roll (the entry's own description)
        const newDescriptions = context.collectedDescriptions.slice(descCountBefore)
        const entryDescription = newDescriptions.length > 0 ? newDescriptions[0].description : undefined

        // Sets are already evaluated at merge time in evaluateSetValues()
        // Just use the placeholders directly
        captureItems.push({
          value: result.text,
          sets: result.placeholders ?? {},
          description: entryDescription,
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
   * Also handles capture-aware shared variables: {{$hero}}, {{$hero.@prop}}
   *
   * Dynamic table resolution: When accessing a property that contains a table ID,
   * the engine will roll on that table and return the result.
   */
  private evaluateCaptureAccess(
    token: {
      varName: string
      index?: number
      properties?: string[]
      separator?: string
    },
    context: GenerationContext,
    collectionId: string
  ): string {
    // Try to get from capture variables first, then fall back to capture-aware shared variables
    const capture = getCaptureVariable(context, token.varName)
    const captureShared = getCaptureSharedVariable(context, token.varName)

    // Build label for trace
    let label = `$${token.varName}`
    if (token.index !== undefined) label += `[${token.index}]`
    if (token.properties && token.properties.length > 0) {
      label += '.' + token.properties.map((p) => `@${p}`).join('.')
    }

    // Handle capture-aware shared variables (single item, no index needed)
    if (!capture && captureShared) {
      return this.evaluateCaptureSharedAccess(token, captureShared, context, collectionId, label)
    }

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
          property: token.properties?.[0] ?? 'value',
          found: false,
        } as CaptureAccessMetadata
      )
      return ''
    }

    let result: string
    const firstProp = token.properties?.[0]

    // Handle .count property (no index)
    if (firstProp === 'count' && token.index === undefined) {
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
            property: firstProp ?? 'value',
            found: false,
            totalItems: capture.items.length,
          } as CaptureAccessMetadata
        )
        return ''
      }

      const item = capture.items[resolvedIndex]

      // Handle property chain access on indexed item
      if (token.properties && token.properties.length > 0) {
        result = this.traversePropertyChain(item, token.properties, `$${token.varName}[${token.index}]`)
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
          property: firstProp ?? 'value',
          found: true,
          totalItems: capture.items.length,
        } as CaptureAccessMetadata
      )
      return result
    }

    // Handle property access without index (on all items)
    // For chained access, we only use the first property for collecting
    if (firstProp && firstProp !== 'value' && firstProp !== 'count') {
      // Collect this property from all items
      // For chained properties, traverse each item's property chain
      const values = capture.items.map((item) => {
        if (token.properties && token.properties.length > 0) {
          return this.traversePropertyChain(item, token.properties, `$${token.varName}`)
        }
        return item.value
      })
      result = values.filter((v) => v !== '').join(token.separator ?? ', ')
    } else {
      // Handle all values (no property or property is 'value')
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
        property: firstProp ?? 'value',
        found: true,
        totalItems: capture.items.length,
      } as CaptureAccessMetadata
    )

    return result
  }

  /**
   * Traverse a chain of properties through nested CaptureItems.
   * Example: traversePropertyChain(item, ["situation", "focus"], "$conflict")
   * Returns the final string value, or empty string if chain breaks.
   */
  private traversePropertyChain(
    item: CaptureItem,
    properties: string[],
    pathPrefix: string
  ): string {
    let current: CaptureItem = item

    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i]
      const currentPath = `${pathPrefix}.@${prop}`

      // Handle special properties
      if (prop === 'value') {
        // If more properties follow, this is invalid
        if (i < properties.length - 1) {
          console.warn(`Cannot access properties after .value: ${currentPath}`)
          return ''
        }
        return current.value
      }
      if (prop === 'count') {
        // count is always terminal - capture-aware shared is always 1 item
        if (i < properties.length - 1) {
          console.warn(`Cannot access properties after .count: ${currentPath}`)
          return ''
        }
        return '1'
      }
      if (prop === 'description') {
        if (i < properties.length - 1) {
          console.warn(`Cannot access properties after .description: ${currentPath}`)
          return ''
        }
        return current.description ?? ''
      }

      // Regular property access
      const propValue = current.sets[prop]
      if (propValue === undefined) {
        console.warn(`Property not found: ${currentPath}`)
        return ''
      }

      // If this is the last property, return the value
      if (i === properties.length - 1) {
        if (typeof propValue === 'string') {
          return propValue
        } else {
          return propValue.value
        }
      }

      // Need to continue traversing - must be a nested CaptureItem
      if (typeof propValue === 'string') {
        console.warn(`Cannot chain through string property: ${currentPath}`)
        return ''
      }

      current = propValue
      pathPrefix = currentPath
    }

    return current.value
  }

  /**
   * Get a nested CaptureItem by traversing through property chain.
   * Returns null if any property in the chain is not a CaptureItem.
   * Used for storing intermediate captures in capture-aware shared variables.
   */
  private getNestedCaptureItem(item: CaptureItem, properties: string[]): CaptureItem | null {
    let current = item
    for (const prop of properties) {
      // Terminal properties can't be traversed further
      if (prop === 'value' || prop === 'count' || prop === 'description') {
        return null
      }
      const propValue = current.sets[prop]
      if (!propValue || typeof propValue === 'string') {
        return null // Not a nested CaptureItem
      }
      current = propValue
    }
    return current
  }

  /**
   * Handle access to capture-aware shared variables.
   * These are single items (not arrays), so no index is needed.
   * Supports chained property access: {{$var.@a.@b.@c}}
   */
  private evaluateCaptureSharedAccess(
    token: {
      varName: string
      index?: number
      properties?: string[]
      separator?: string
    },
    item: CaptureItem,
    context: GenerationContext,
    _collectionId: string,
    label: string
  ): string {
    let result: string

    // Handle property chain access
    if (token.properties && token.properties.length > 0) {
      result = this.traversePropertyChain(item, token.properties, `$${token.varName}`)
    } else {
      // No properties - return the value
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
        property: token.properties?.[0] ?? 'value',
        found: true,
        totalItems: 1,
        isCaptureShared: true,
      } as CaptureAccessMetadata
    )

    return result
  }

  /**
   * Evaluate collect expression: {{collect:$var.@prop}}
   * Aggregates a property across all captured items.
   * Also supports capture-aware shared variables (though collect typically makes more sense for multi-roll captures).
   */
  private evaluateCollect(
    token: {
      varName: string
      property: string
      unique?: boolean
      separator?: string
    },
    context: GenerationContext,
    _collectionId: string
  ): string {
    const label = `collect:$${token.varName}.${token.property}${token.unique ? '|unique' : ''}`
    const capture = getCaptureVariable(context, token.varName)
    const captureShared = getCaptureSharedVariable(context, token.varName)

    // Handle capture-aware shared variables (single item)
    // Sets are already evaluated at merge time, so just return the value
    if (!capture && captureShared) {
      let result: string
      if (token.property === 'value') {
        result = captureShared.value
      } else if (token.property === 'description') {
        result = captureShared.description ?? ''
      } else {
        const propValue = captureShared.sets[token.property]
        if (propValue === undefined) {
          result = ''
        } else if (typeof propValue === 'string') {
          result = propValue
        } else {
          // Nested CaptureItem - return its value string
          result = propValue.value
        }
      }

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
          allValues: [result].filter((v) => v !== ''),
          resultValues: [result].filter((v) => v !== ''),
        } as CollectMetadata
      )

      return result
    }

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

    // Collect values from captured items
    // Sets are already evaluated at merge time, so just return the values
    let allValues: string[]

    if (token.property === 'value') {
      allValues = capture.items.map((item) => item.value)
    } else if (token.property === 'description') {
      // @description access
      allValues = capture.items.map((item) => item.description ?? '')
    } else {
      // @property access (property stored without @)
      // Handle nested CaptureItems - extract the value string
      allValues = capture.items.map((item) => {
        const propValue = item.sets[token.property]
        if (propValue === undefined) return ''
        if (typeof propValue === 'string') return propValue
        return propValue.value // Nested CaptureItem
      })
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
