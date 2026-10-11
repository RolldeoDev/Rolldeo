/**
 * Document Validator
 *
 * Validates RandomTableDocument structure and references.
 * Performs both schema validation and semantic validation.
 */

import Ajv, { type ErrorObject } from 'ajv'
import documentSchema from '../../../public/schemas/random-table-spec-v1.0.json'
import documentSchema11 from '../../../public/schemas/random-table-spec-v1.1.json'
import { parseSelectionDice, validateDiceSelection } from '../tables/diceSelection'
import { getConversionReviewStatus } from '../../lib/conversionVerification'

import type {
  AuthoredRandomTableDocument as RandomTableDocument,
  AuthoredTable as Table,
  AuthoredSimpleTable as SimpleTable,
  CompositeTable,
  CollectionTable,
  Template,
} from '../types'

// ============================================================================
// Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  severity: ValidationSeverity
  code: string
  message: string
  path?: string // JSON path to the problematic element
  suggestion?: string
}

export interface ValidationOptions {
  /** Resolve in the originating table's collection, including external ancestors. */
  resolveTable?: (reference: string, originatingTable?: Table) => Table | undefined
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

// ============================================================================
// Reserved Words
// ============================================================================

const RESERVED_WORDS = new Set([
  'dice',
  'unique',
  'again',
  'true',
  'false',
  'null',
  'and',
  'or',
  'not',
  'contains',
  'matches',
  'shared',
  'math',
])

// ============================================================================
// Patterns
// ============================================================================

const NAMESPACE_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/
// Variable names can optionally start with $ for context-sensitive variables
const VARIABLE_NAME_PATTERN = /^\$?[a-zA-Z_][a-zA-Z0-9_]*$/

// ============================================================================
// Main Validator
// ============================================================================

/**
 * Validate a RandomTableDocument
 */
const checkStructure = new Ajv({ allErrors: true, strict: false, strictNumbers: true, validateFormats: false }).compile(documentSchema)
const checkStructure11 = new Ajv({ allErrors: true, strict: false, strictNumbers: true, validateFormats: false }).compile(documentSchema11)

/** Structural phase only: safe for loading before dependencies are available. */
export function validateDocumentStructure(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = []
  const version = input && typeof input === 'object' && 'metadata' in input
    ? (input.metadata as { specVersion?: unknown } | undefined)?.specVersion : undefined
  const check = version === '1.1' ? checkStructure11 : checkStructure
  if (!check(input)) for (const error of check.errors ?? []) issues.push(structuralIssue(error, input))
  return resultFromIssues(issues)
}

/** Validate unknown authored input structurally before running local semantic checks. */
export function validateDocument(input: unknown, options: ValidationOptions = {}): ValidationResult {
  const issues: ValidationIssue[] = []
  const structure = validateDocumentStructure(input)
  if (!structure.valid) return structure
  // AJV established the shapes required by the semantic phase; authored overrides may omit value.
  const doc = input as RandomTableDocument

  // Validate metadata
  validateMetadata(doc, issues)

  // Build table registry for reference checking
  const tableIds = new Set<string>()
  const templateIds = new Set<string>()

  for (const table of doc.tables) {
    if (tableIds.has(table.id)) issues.push({ severity: 'error', code: 'DUPLICATE_TABLE_ID', message: `Duplicate table ID: ${table.id}`, path: 'tables' })
    tableIds.add(table.id)
  }

  for (const template of doc.templates ?? []) {
    if (templateIds.has(template.id)) issues.push({ severity: 'error', code: 'DUPLICATE_TEMPLATE_ID', message: `Duplicate template ID: ${template.id}`, path: 'templates' })
    templateIds.add(template.id)
  }

  // Validate tables
  for (let i = 0; i < doc.tables.length; i++) {
    validateTable(doc.tables[i], `tables[${i}]`, tableIds, issues)
    if (getConversionReviewStatus(doc.tables[i]) === 'stale') issues.push({ severity: 'warning', code: 'STALE_CONVERSION_REVIEW', message: 'Table content has changed since its source conversion was reviewed. Review it again against the source.', path: `tables[${i}].conversion` })
  }

  // Validate templates
  for (let i = 0; i < (doc.templates ?? []).length; i++) {
    validateTemplate(doc.templates![i], `templates[${i}]`, tableIds, issues)
  }

  // Validate variables
  if (doc.variables) {
    validateVariables(doc.variables, 'variables', issues)
  }

  // Validate shared
  if (doc.shared) {
    validateVariables(doc.shared, 'shared', issues)
  }

  validateSharedNames(doc, issues)
  validateInputs(doc, issues)
  validateOverrides(doc.tables, options, issues)
  {
    const tableMap = new Map(doc.tables.map((table) => [table.id, table]))
    doc.tables.forEach((table, tableIndex) => {
      if (table.type === 'simple' && effectiveSelectionMode(table, tableMap, options) === 'weighted') {
        table.entries.forEach((entry, entryIndex) => {
          if (entry.range && (entry.range[0] < 0 || entry.range[1] < 0)) issues.push({ severity: 'error', code: 'INVALID_RANGE', message: 'Weighted table ranges must have nonnegative endpoints. Signed endpoints require native dice selection.', path: `tables[${tableIndex}].entries[${entryIndex}].range` })
        })
      }
      const references = table.type === 'composite' ? table.sources.map((source) => source.tableId) : table.type === 'collection' ? table.collections : []
      references.forEach((reference) => {
        const source = reference.includes('.') ? options.resolveTable?.(reference, table) : tableMap.get(reference)
        if (reference.includes('.') && options.resolveTable && !source) issues.push({ severity: 'error', code: table.type === 'composite' ? 'INVALID_SOURCE' : 'INVALID_COLLECTION', message: `Unresolved linked table: ${reference}`, path: `tables[${tableIndex}]` })
        if (table.type === 'collection' && source && source.type !== 'simple') issues.push({ severity: 'error', code: 'INVALID_COLLECTION_SOURCE_TYPE', message: `Collection source must be a simple table: ${reference} is ${source.type}`, path: `tables[${tableIndex}].collections` })
        if (table.type === 'collection' && source?.type === 'simple' && hasDiceSelection(source, tableMap, options)) issues.push({ severity: 'error', code: 'DICE_COLLECTION_UNSUPPORTED', message: `Collection pooling cannot preserve native dice selection: ${reference}. Use a composite table to delegate the roll.`, path: `tables[${tableIndex}].collections` })
      })
    })
  }

  for (let i = 0; i < (doc.imports ?? []).length; i++) {
    const item = doc.imports![i]
    validateIdentifier(item.alias, `imports[${i}].alias`, 'Import alias', issues)
    if (doc.imports!.slice(0, i).some((previous) => previous.alias === item.alias)) {
      issues.push({ severity: 'error', code: 'DUPLICATE_IMPORT_ALIAS', message: `Duplicate import alias: ${item.alias}`, path: `imports[${i}].alias` })
    }
  }

  // Check for ID collisions between tables and templates
  for (const tableId of tableIds) {
    if (templateIds.has(tableId)) {
      issues.push({
        severity: 'warning',
        code: 'ID_COLLISION',
        message: `Table and template share the same ID: ${tableId}`,
        suggestion: 'Consider using unique IDs to avoid confusion',
      })
    }
  }

  // Check for circular inheritance
  validateInheritance(doc.tables, doc.metadata.maxInheritanceDepth ?? 5, options, issues)

  return resultFromIssues(issues)
}

function resultFromIssues(issues: ValidationIssue[]): ValidationResult {
  const errors = issues.filter((issue) => issue.severity === 'error')
  return { valid: errors.length === 0, issues, errors, warnings: issues.filter((issue) => issue.severity === 'warning') }
}

/** Preserve actionable semantic codes at structural boundaries. */
function structuralIssue(error: ErrorObject, input: unknown): ValidationIssue {
  const segments = error.instancePath.split('/').slice(1).map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
  const missing = error.keyword === 'required' ? String(error.params.missingProperty) : undefined
  const key = missing ?? segments[segments.length - 1]
  let value: unknown = input
  for (const segment of segments) value = value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined
  let code = 'INVALID_STRUCTURE'
  if (key === 'namespace') code = missing || value === '' ? 'MISSING_NAMESPACE' : 'INVALID_NAMESPACE'
  else if (key === 'version') code = missing || value === '' ? 'MISSING_VERSION' : 'INVALID_VERSION'
  else if (key === 'specVersion') code = 'INVALID_SPEC_VERSION'
  else if (key === 'name') code = segments[0] === 'tables' ? 'MISSING_TABLE_NAME' : segments[0] === 'templates' ? 'MISSING_TEMPLATE_NAME' : 'MISSING_NAME'
  else if (key === 'id') code = missing || value === '' ? 'MISSING_ID' : typeof value === 'string' && RESERVED_WORDS.has(value.toLowerCase()) ? 'RESERVED_WORD' : 'INVALID_ID'
  else if (key === 'pattern') code = 'MISSING_PATTERN'
  else if (key === 'value') code = 'MISSING_VALUE'
  else if (key === 'weight') code = 'INVALID_WEIGHT'
  else if (key === 'range' || segments.includes('range')) code = 'INVALID_RANGE'
  else if (key?.startsWith('max')) code = 'INVALID_CONFIG'
  else if (error.keyword === 'minItems') code = key === 'entries' ? 'EMPTY_ENTRIES' : key === 'sources' ? 'EMPTY_SOURCES' : key === 'collections' ? 'EMPTY_COLLECTIONS' : code
  else if (error.keyword === 'not' && segments.includes('entries')) code = 'WEIGHT_RANGE_CONFLICT'
  if (error.keyword === 'propertyNames' || error.keyword === 'pattern' && (segments.includes('variables') || segments.includes('shared'))) {
    const name = String(error.params.propertyName ?? error.propertyName ?? '')
    code = RESERVED_WORDS.has(name.replace(/^\$/, '').toLowerCase()) ? 'RESERVED_WORD' : 'INVALID_VARIABLE_NAME'
  }
  if (error.keyword === 'additionalProperties' && error.params.additionalProperty === 'conditionals') {
    return { severity: 'error', code: 'OBSOLETE_CONDITIONALS', message: 'Root conditionals are unsupported. Migrate rules to inline switch expressions.', path: 'conditionals' }
  }
  if (error.keyword === 'additionalProperties' && error.params.additionalProperty === 'extends' && value && typeof value === 'object' && (value as { type?: string }).type !== 'simple') {
    return { severity: 'error', code: 'UNSUPPORTED_INHERITANCE', message: 'Only simple tables support extends', path: `${segments.join('.')}.extends` }
  }
  if (segments.includes('sets') || segments.includes('defaultSets')) code = 'INVALID_SET_NAME'
  if (segments[0] === 'inputs') code = 'INVALID_INPUT_DEFINITION'
  const path = [...segments, ...(missing ? [missing] : [])].map((segment) => /^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`).join('').replace(/^\./, '')
  return { severity: 'error', code, message: `${path || 'Document'} ${error.message ?? 'is invalid'}`, path }
}

function normalizedNames(values: Record<string, string> | undefined): string[] {
  return Object.keys(values ?? {}).map((name) => name.replace(/^\$/, ''))
}

function hasDiceSelection(table: Table, local: Map<string, Table>, options: ValidationOptions): boolean {
  return effectiveSelectionMode(table, local, options) === 'dice'
}

/** Unknown imported ancestry is settled during linked validation, not guessed weighted. */
function effectiveSelectionMode(table: Table, local: Map<string, Table>, options: ValidationOptions): 'dice' | 'weighted' | undefined {
  const seen = new Set<Table>()
  const localTables = new Set(local.values())
  let current: Table | undefined = table
  while (current?.type === 'simple' && !seen.has(current)) {
    if (current.selection) return 'dice'
    seen.add(current)
    if (!current.extends) return 'weighted'
    current = localTables.has(current) && !current.extends.includes('.')
      ? local.get(current.extends) : options.resolveTable?.(current.extends, current)
  }
  return undefined
}

function validateInputs(doc: RandomTableDocument, issues: ValidationIssue[]): void {
  const otherNames = new Set([
    ...normalizedNames(doc.variables), ...normalizedNames(doc.shared),
    ...doc.tables.flatMap((table) => normalizedNames(table.shared)),
    ...(doc.templates ?? []).flatMap((template) => normalizedNames(template.shared)),
  ])
  for (const [name, input] of Object.entries(doc.inputs ?? {})) {
    const path = `inputs.${name}`
    if (RESERVED_WORDS.has(name.toLowerCase())) issues.push({ severity: 'error', code: 'RESERVED_WORD', message: `Input name is a reserved word: ${name}`, path })
    if (otherNames.has(name)) issues.push({ severity: 'error', code: 'INPUT_NAME_CONFLICT', message: `Input ${name} conflicts with a static or shared variable declaration`, path })
    if (input.type === 'integer') {
      if (input.min !== undefined && input.max !== undefined && input.min > input.max) issues.push({ severity: 'error', code: 'INVALID_INPUT_BOUNDS', message: 'Input minimum cannot exceed maximum', path })
      if (input.default !== undefined && (input.min !== undefined && input.default < input.min || input.max !== undefined && input.default > input.max)) issues.push({ severity: 'error', code: 'INVALID_INPUT_DEFAULT', message: 'Input default must be within its bounds', path: `${path}.default` })
    }
    if (input.type === 'choice' && input.default !== undefined && !input.options.includes(input.default)) issues.push({ severity: 'error', code: 'INVALID_INPUT_DEFAULT', message: 'Choice default must be one of its options', path: `${path}.default` })
  }
}

function validateSharedNames(doc: RandomTableDocument, issues: ValidationIssue[]): void {
  const staticNames = new Set(normalizedNames(doc.variables))
  const globalNames = new Set(staticNames)
  const check = (values: Record<string, string> | undefined, outer: Set<string>, path: string) => {
    const local = new Set<string>()
    for (const key of Object.keys(values ?? {})) {
      const name = key.replace(/^\$/, '')
      if (local.has(name) || outer.has(name)) issues.push({ severity: 'error', code: 'SHARED_SHADOW', message: `Shared name ${key} duplicates or shadows ${name}`, path: `${path}.${key}` })
      local.add(name)
    }
  }
  check(doc.variables, new Set(), 'variables')
  check(doc.shared, staticNames, 'shared')
  normalizedNames(doc.shared).forEach((name) => globalNames.add(name))
  doc.tables.forEach((table, index) => check(table.shared, globalNames, `tables[${index}].shared`))
  doc.templates?.forEach((template, index) => check(template.shared, globalNames, `templates[${index}].shared`))
}

function validateOverrides(tables: Table[], options: ValidationOptions, issues: ValidationIssue[]): void {
  const tableMap = new Map(tables.map((table) => [table.id, table]))
  const localTables = new Set(tables)
  const resolve = (reference: string, owner: Table) => localTables.has(owner) && !reference.includes('.') ? tableMap.get(reference) : options.resolveTable?.(reference, owner)
  const inheritedIds = (table: Table): Set<string> | undefined => {
    const seen = new Set<Table>()
    const ids = new Set<string>()
    let current: Table | undefined = table
    // Iterative traversal also keeps malformed long chains from overflowing the validator stack.
    while (current) {
      if (seen.has(current)) return undefined
      seen.add(current)
      if (current.type !== 'simple') return undefined
      if (current.type === 'simple') {
        const ownerId = current.id
        current.entries.forEach((entry, index) => ids.add(entry.id ?? `${ownerId}${String(index).padStart(3, '0')}`))
      }
      if (!current.extends) return ids
      current = resolve(current.extends, current)
    }
    return undefined // Linked validation can settle unavailable ancestors later.
  }
  tables.forEach((table, index) => {
    if (!table.extends) return
    const parent = resolve(table.extends, table)
    if (!parent) {
      if (options.resolveTable && table.extends.includes('.')) issues.push({ severity: 'error', code: 'INVALID_EXTENDS', message: `Extends references unknown table: ${table.extends}`, path: `tables[${index}].extends` })
      return
    }
    if (table.type !== 'simple') return
    const ids = inheritedIds(parent)
    table.entries.forEach((entry, entryIndex) => {
      const generatedId = `${table.id}${entryIndex.toString().padStart(3, '0')}`
      if (!entry.id && ids?.has(generatedId)) issues.push({ severity: 'error', code: 'INVALID_OVERRIDE_TARGET', message: `Entry must specify an explicit ID to override inherited entry: ${generatedId}`, path: `tables[${index}].entries[${entryIndex}]` })
      const deletesProperty = Object.values(entry).some((value) => value === null || typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).some((item) => item === null))
      if ((entry.value === undefined || deletesProperty) && ids && (!entry.id || !ids.has(entry.id))) issues.push({ severity: 'error', code: 'INVALID_OVERRIDE_TARGET', message: `Value-less entries and null deletions must override an inherited ID: ${entry.id ?? '(missing)'}`, path: `tables[${index}].entries[${entryIndex}]` })
    })
  })
}

// ============================================================================
// Metadata Validation
// ============================================================================

function validateMetadata(doc: RandomTableDocument, issues: ValidationIssue[]): void {
  const meta = doc.metadata

  // Required fields
  if (!meta.name || meta.name.trim() === '') {
    issues.push({
      severity: 'error',
      code: 'MISSING_NAME',
      message: 'Metadata name is required',
      path: 'metadata.name',
    })
  }

  if (!meta.namespace) {
    issues.push({
      severity: 'error',
      code: 'MISSING_NAMESPACE',
      message: 'Metadata namespace is required',
      path: 'metadata.namespace',
    })
  } else if (!NAMESPACE_PATTERN.test(meta.namespace)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_NAMESPACE',
      message: `Invalid namespace format: ${meta.namespace}`,
      path: 'metadata.namespace',
      suggestion: 'Use dot-separated segments (e.g., "fantasy.core")',
    })
  }

  if (meta.namespace && !meta.namespace.includes('.')) {
    issues.push({ severity: 'warning', code: 'LEGACY_NAMESPACE', message: `Legacy namespace ${meta.namespace} has one segment; use at least two dot-separated segments for new collections.`, path: 'metadata.namespace', suggestion: 'Migrate to a publisher.collection namespace and update references.' })
  }

  if (!meta.version) {
    issues.push({
      severity: 'error',
      code: 'MISSING_VERSION',
      message: 'Metadata version is required',
      path: 'metadata.version',
    })
  } else if (!VERSION_PATTERN.test(meta.version)) {
    issues.push({
      severity: 'warning',
      code: 'INVALID_VERSION',
      message: `Version should follow semver format: ${meta.version}`,
      path: 'metadata.version',
      suggestion: 'Use semantic versioning (e.g., "1.0.0")',
    })
  }

  if (meta.specVersion !== '1.0' && meta.specVersion !== '1.1') {
    issues.push({
      severity: 'error',
      code: 'INVALID_SPEC_VERSION',
      message: `Unsupported spec version: ${meta.specVersion}`,
      path: 'metadata.specVersion',
      suggestion: 'Use specVersion "1.0" or "1.1"',
    })
  }

  // Optional field validation
  if (meta.maxRecursionDepth !== undefined && meta.maxRecursionDepth < 1) {
    issues.push({
      severity: 'error',
      code: 'INVALID_CONFIG',
      message: 'maxRecursionDepth must be at least 1',
      path: 'metadata.maxRecursionDepth',
    })
  }

  if (meta.maxExplodingDice !== undefined && (meta.maxExplodingDice < 0 || meta.maxExplodingDice > 1000)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_CONFIG',
      message: 'maxExplodingDice must be an integer from 0 through 1000',
      path: 'metadata.maxExplodingDice',
    })
  }

  if (meta.maxInheritanceDepth !== undefined && meta.maxInheritanceDepth < 1) {
    issues.push({
      severity: 'error',
      code: 'INVALID_CONFIG',
      message: 'maxInheritanceDepth must be at least 1',
      path: 'metadata.maxInheritanceDepth',
    })
  }
}

// ============================================================================
// Table Validation
// ============================================================================

function validateTable(
  table: Table,
  path: string,
  tableIds: Set<string>,
  issues: ValidationIssue[]
): void {
  // Validate ID
  validateIdentifier(table.id, `${path}.id`, 'Table', issues)

  // Validate name
  if (!table.name || table.name.trim() === '') {
    issues.push({
      severity: 'error',
      code: 'MISSING_TABLE_NAME',
      message: 'Table name is required',
      path: `${path}.name`,
    })
  }

  // Validate extends reference
  if (table.extends) {
    const extendsId = table.extends.split('.').pop() // Handle alias.tableId
    if (extendsId && !tableIds.has(extendsId) && !table.extends.includes('.')) {
      issues.push({
        severity: 'error',
        code: 'INVALID_EXTENDS',
        message: `Extends references unknown table: ${table.extends}`,
        path: `${path}.extends`,
      })
    }
  }

  // Type-specific validation
  if (table.type === 'simple') {
    validateSimpleTable(table as SimpleTable, path, issues)
  } else if (table.type === 'composite') {
    validateCompositeTable(table as CompositeTable, path, tableIds, issues)
  } else if (table.type === 'collection') {
    validateCollectionTable(table as CollectionTable, path, tableIds, issues)
  }

  // Validate table-level shared variables
  if (table.shared) {
    validateVariables(table.shared, `${path}.shared`, issues)
  }
}

function validateSimpleTable(
  table: SimpleTable,
  path: string,
  issues: ValidationIssue[]
): void {
  if (!table.entries || table.entries.length === 0) {
    issues.push({
      severity: 'error',
      code: 'EMPTY_ENTRIES',
      message: 'Simple table must have at least one entry',
      path: `${path}.entries`,
    })
    return
  }

  const entryIds = new Set<string>()

  // Inherited tables are checked on their fully resolved entries at runtime.
  if (table.selection && table.extends) {
    try { parseSelectionDice(table.selection.dice) }
    catch (error) { issues.push({ severity: 'error', code: 'INVALID_DICE_SELECTION', message: String(error instanceof Error ? error.message : error), path: `${path}.selection` }) }
  }
  if (table.selection && !table.extends) {
    for (const diagnostic of validateDiceSelection(table)) {
      issues.push({ severity: diagnostic.type, code: diagnostic.code, message: diagnostic.message, path: diagnostic.entryIndex === undefined ? `${path}.selection` : `${path}.entries[${diagnostic.entryIndex}]` })
    }
  }

  for (let i = 0; i < table.entries.length; i++) {
    const entry = table.entries[i]
    const entryPath = `${path}.entries[${i}]`

    // Check for duplicate entry IDs
    const effectiveId = entry.id ?? `${table.id}${String(i).padStart(3, '0')}`
    if (entryIds.has(effectiveId)) issues.push({ severity: 'error', code: 'DUPLICATE_ENTRY_ID', message: `Duplicate effective entry ID: ${effectiveId}`, path: `${entryPath}.id` })
    entryIds.add(effectiveId)
    if (entry.id) {
      // Validate entry ID format
      validateIdentifier(entry.id, `${entryPath}.id`, 'Entry', issues)
    }

    // Check for both weight and range
    if (entry.weight != null && entry.range != null) {
      issues.push({
        severity: 'error',
        code: 'WEIGHT_RANGE_CONFLICT',
        message: 'Entry cannot have both weight and range',
        path: entryPath,
        suggestion: 'Use either weight or range, not both',
      })
    }

    // Validate weight
    if (entry.weight != null && entry.weight < 0) {
      issues.push({
        severity: 'error',
        code: 'INVALID_WEIGHT',
        message: `Entry weight cannot be negative: ${entry.weight}`,
        path: `${entryPath}.weight`,
      })
    }

    // Validate range
    if (entry.range) {
      if (entry.range.length !== 2) {
        issues.push({
          severity: 'error',
          code: 'INVALID_RANGE',
          message: 'Range must be a two-element array [min, max]',
          path: `${entryPath}.range`,
        })
      } else if (entry.range[0] > entry.range[1]) {
        issues.push({
          severity: 'error',
          code: 'INVALID_RANGE',
          message: `Range min (${entry.range[0]}) cannot exceed max (${entry.range[1]})`,
          path: `${entryPath}.range`,
        })
      } else if (!Number.isSafeInteger(entry.range[1] - entry.range[0] + 1)) {
        issues.push({ severity: 'error', code: 'INVALID_RANGE', message: 'Inclusive range width must be a safe integer', path: `${entryPath}.range` })
      }
    }

    // Validate value
    // Value is required UNLESS the table extends another and this entry has an ID
    // (which means it's overriding an inherited entry's weight/tags without changing value)
    const isInheritedOverride = table.extends && entry.id
    if (!entry.value && entry.value !== '' && !isInheritedOverride) {
      issues.push({
        severity: 'error',
        code: 'MISSING_VALUE',
        message: 'Entry value is required',
        path: `${entryPath}.value`,
      })
    }
  }

  // Check if all entries are disabled
  // Skip this check if the table extends another - the parent table may provide
  // active entries that aren't visible in the child's override list
  if (!table.extends) {
    const hasActiveEntries = table.entries.some((e) => {
      const weight = e.range ? e.range[1] - e.range[0] + 1 : (e.weight ?? 1)
      return weight > 0
    })

    if (!hasActiveEntries) {
      issues.push({
        severity: 'error',
        code: 'NO_ACTIVE_ENTRIES',
        message: 'Table has no entries with positive weight',
        path: `${path}.entries`,
      })
    }
  }
}

function validateCompositeTable(
  table: CompositeTable,
  path: string,
  tableIds: Set<string>,
  issues: ValidationIssue[]
): void {
  if (!table.sources || table.sources.length === 0) {
    issues.push({
      severity: 'error',
      code: 'EMPTY_SOURCES',
      message: 'Composite table must have at least one source',
      path: `${path}.sources`,
    })
    return
  }

  if (!table.extends && !table.sources.some((source) => (source.weight ?? 1) > 0)) issues.push({ severity: 'error', code: 'NO_ACTIVE_SOURCES', message: 'Composite table has no sources with positive weight', path: `${path}.sources` })

  for (let i = 0; i < table.sources.length; i++) {
    const source = table.sources[i]
    const sourcePath = `${path}.sources[${i}]`

    // Check if source table exists (local reference only)
    const sourceId = source.tableId.split('.').pop()
    if (sourceId && !tableIds.has(sourceId) && !source.tableId.includes('.')) {
      issues.push({
        severity: 'error',
        code: 'INVALID_SOURCE',
        message: `Source references unknown table: ${source.tableId}`,
        path: `${sourcePath}.tableId`,
      })
    }

    // Validate weight
    if (source.weight !== undefined && source.weight < 0) {
      issues.push({
        severity: 'error',
        code: 'INVALID_WEIGHT',
        message: `Source weight cannot be negative: ${source.weight}`,
        path: `${sourcePath}.weight`,
      })
    }
  }
}

function validateCollectionTable(
  table: CollectionTable,
  path: string,
  tableIds: Set<string>,
  issues: ValidationIssue[]
): void {
  if (!table.collections || table.collections.length === 0) {
    issues.push({
      severity: 'error',
      code: 'EMPTY_COLLECTIONS',
      message: 'Collection table must reference at least one table',
      path: `${path}.collections`,
    })
    return
  }

  for (let i = 0; i < table.collections.length; i++) {
    const collectionId = table.collections[i]

    // Check if collection table exists (local reference only)
    const localId = collectionId.split('.').pop()
    if (localId && !tableIds.has(localId) && !collectionId.includes('.')) {
      issues.push({
        severity: 'error',
        code: 'INVALID_COLLECTION',
        message: `Collection references unknown table: ${collectionId}`,
        path: `${path}.collections[${i}]`,
      })
    }
  }
}

// ============================================================================
// Template Validation
// ============================================================================

function validateTemplate(
  template: Template,
  path: string,
  _tableIds: Set<string>,
  issues: ValidationIssue[]
): void {
  validateIdentifier(template.id, `${path}.id`, 'Template', issues)

  if (!template.name || template.name.trim() === '') {
    issues.push({
      severity: 'error',
      code: 'MISSING_TEMPLATE_NAME',
      message: 'Template name is required',
      path: `${path}.name`,
    })
  }

  if (!template.pattern && template.pattern !== '') {
    issues.push({
      severity: 'error',
      code: 'MISSING_PATTERN',
      message: 'Template pattern is required',
      path: `${path}.pattern`,
    })
  }

  // Validate template-level shared variables
  if (template.shared) {
    validateVariables(template.shared, `${path}.shared`, issues)
  }

  // Note: We could validate table references in patterns here,
  // but that would require parsing the pattern. Deferred for now.
}

// ============================================================================
// Variable Validation
// ============================================================================

function validateVariables(
  variables: Record<string, string>,
  path: string,
  issues: ValidationIssue[]
): void {
  for (const name of Object.keys(variables)) {
    if (!VARIABLE_NAME_PATTERN.test(name)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_VARIABLE_NAME',
        message: `Invalid variable name: ${name}`,
        path: `${path}.${name}`,
        suggestion:
          'Variable names must start with a letter (or $ for context-sensitive variables) and contain only alphanumeric characters and underscores',
      })
    }

    // Check reserved words (strip $ prefix for comparison)
    const nameWithoutPrefix = name.startsWith('$') ? name.slice(1) : name
    if (RESERVED_WORDS.has(nameWithoutPrefix.toLowerCase())) {
      issues.push({
        severity: 'error',
        code: 'RESERVED_WORD',
        message: `Variable name is a reserved word: ${name}`,
        path: `${path}.${name}`,
      })
    }
  }
}

// ============================================================================
// Inheritance Validation
// ============================================================================

function validateInheritance(
  tables: Table[], maxDepth: number, options: ValidationOptions, issues: ValidationIssue[]
): void {
  const tableMap = new Map(tables.map((table) => [table.id, table]))
  const localTables = new Set(tables)
  for (const [index, table] of tables.entries()) {
    const chain = new Set<Table>()
    let current: Table | undefined = table
    let depth = 0
    while (current?.extends) {
      if (chain.has(current)) {
        issues.push({ severity: 'error', code: 'CIRCULAR_INHERITANCE', message: `Circular inheritance detected involving table: ${current.id}`, path: 'tables' })
        break
      }
      chain.add(current)
      depth += 1
      if (depth > maxDepth) {
        issues.push({ severity: 'error', code: 'INHERITANCE_DEPTH_LIMIT', message: `Inheritance depth exceeds maxInheritanceDepth (${maxDepth}) for table: ${table.id}`, path: 'tables' })
        break
      }
      const reference: string = current.extends
      const parent: Table | undefined = localTables.has(current) && !reference.includes('.')
        ? tableMap.get(reference) : options.resolveTable?.(reference, current)
      if (!parent && options.resolveTable) {
        issues.push({ severity: 'error', code: 'INVALID_EXTENDS', message: `Missing inheritance ancestor: ${reference}`, path: 'tables' })
      }
      if (parent && parent.type !== current.type) {
        issues.push({ severity: 'error', code: 'INHERITANCE_TYPE_MISMATCH', message: `Inherited table must have the same type: ${current.id} extends ${reference}`, path: `tables[${index}].extends` })
        break
      }
      current = parent
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function validateIdentifier(
  id: string,
  path: string,
  type: string,
  issues: ValidationIssue[]
): void {
  if (!id || id.trim() === '') {
    issues.push({
      severity: 'error',
      code: 'MISSING_ID',
      message: `${type} ID is required`,
      path,
    })
    return
  }

  if (id.includes('.')) {
    issues.push({
      severity: 'error',
      code: 'INVALID_ID',
      message: `${type} ID cannot contain periods: ${id}`,
      path,
      suggestion: 'Use underscores or camelCase instead',
    })
  }

  if (!IDENTIFIER_PATTERN.test(id)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_ID',
      message: `Invalid ${type} ID format: ${id}`,
      path,
      suggestion: 'IDs must start with a letter and contain only alphanumeric characters and underscores',
    })
  }

  if (RESERVED_WORDS.has(id.toLowerCase())) {
    issues.push({
      severity: 'error',
      code: 'RESERVED_WORD',
      message: `${type} ID is a reserved word: ${id}`,
      path,
    })
  }
}
