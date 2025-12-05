# Random Table JSON Template Specification v1.0

---

## Overview

This specification defines a JSON template format for creating configurable random table generators. The format supports simple weighted tables, composite tables, template-based text generation, mathematical operations, inline switch expressions, multi-level table inheritance, external file references, and generation-time shared variables.

---

## Table of Contents

1. [File Structure](#file-structure)
2. [Metadata Object](#1-metadata-object)
3. [Imports Array](#2-imports-array)
4. [Tables Array](#3-tables-array)
5. [Templates Array](#4-templates-array)
6. [Template Pattern Syntax](#5-template-pattern-syntax)
7. [Variables Object](#6-variables-object)
8. [Shared Block](#7-shared-block)
9. [Placeholder System](#8-placeholder-system)
10. [Table Inheritance](#9-table-inheritance)
11. [ResultType System](#10-resulttype-system)
12. [Markdown Support](#11-markdown-support)
13. [Complete Example](#12-complete-example)
14. [Processing Order](#13-processing-order)
15. [Validation Rules](#14-validation-rules)
16. [Error Handling](#15-error-handling)

---

## File Structure

```json
{
  "metadata": { ... },
  "imports": [ ... ],
  "tables": [ ... ],
  "templates": [ ... ],
  "variables": { ... },
  "shared": { ... }
}
```

All top-level properties except `metadata` and `tables` are optional. A minimal valid file requires only `metadata` and at least one table.

---

## 1. Metadata Object

Contains information about the file itself and global engine configuration.

### 1.1 Required Properties

| Property | Type | Description |
|----------|------|-------------|
| name | string | Name of the table collection |
| namespace | string | Unique namespace (e.g., `fantasy.core`) to prevent collisions |
| version | string | Semantic version number (e.g., `1.0.1`) |
| specVersion | string | The specification version this file conforms to (e.g., `1.0`) |

### 1.2 Optional Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| author | string | - | Author name or organization |
| description | string | - | Markdown-formatted description |
| instructions | string | - | Usage instructions in Markdown |
| tags | string[] | `[]` | Tags for categorizing the collection |
| created | string | - | ISO 8601 date string |
| updated | string | - | ISO 8601 date string |

### 1.3 Source Attribution

Optional properties for tracking content origin and licensing.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| source.book | string | - | Name of the source book or product |
| source.publisher | string | - | Publisher name |
| source.isbn | string | - | ISBN if applicable |
| source.url | string | - | URL to product page or official source |
| source.license | string | - | License under which content is used (e.g., `OGL 1.0a`, `CC BY 4.0`, `Original`) |
| source.copyright | string \| object | - | Copyright notice (string for simple notice, or structured object) |

#### 1.3.1 Structured Copyright Object

When more detailed copyright information is needed, `source.copyright` can be an object:

| Property | Type | Description |
|----------|------|-------------|
| copyright.year | string | Copyright year or range (e.g., `"2024"` or `"2020-2024"`) |
| copyright.holder | string | Legal entity name that holds the copyright |
| copyright.notice | string | Full copyright notice text |

**Example:**

```json
"source": {
  "copyright": {
    "year": "2024",
    "holder": "Open Design LLC",
    "notice": "© 2024 Open Design LLC. All rights reserved."
  }
}
```

### 1.4 Rights & Permissions

Optional properties for declaring intellectual property rights, usage permissions, and legal contact information. These fields help publishers protect their content while making licensing terms clear to users.

> **Note:** While this specification is open source (CC0), content created using this format remains the intellectual property of its respective copyright holders. These fields provide a standardized way to communicate ownership and usage terms.

#### 1.4.1 Rights Declaration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| rights.type | string | - | Content classification: `"proprietary"`, `"open-content"`, `"fan-content"`, or `"licensed"` |
| rights.official | boolean | `false` | Whether this is official publisher content (vs. fan-made) |
| rights.productIdentity | string[] | `[]` | List of Product Identity elements (names, characters, logos, etc.) |
| rights.trademarks | string[] | `[]` | Trademark notices (e.g., `"Rolldeo Press®"`, `"Tome of Rolldeo"`) |
| rights.compatibilityNotice | string | - | Required compatibility/non-affiliation statement |

**Rights Type Values:**

| Value | Description |
|-------|-------------|
| `proprietary` | Fully owned content with all rights reserved |
| `open-content` | Content released under an open license (OGL, CC, etc.) |
| `fan-content` | Fan-created content using publisher's IP under community policy |
| `licensed` | Third-party content used under license agreement |

#### 1.4.2 Usage Permissions

Explicit permissions for how the content may be used. All default to `false` if `rights` is specified but permissions are omitted.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| rights.permissions.commercialUse | boolean | `false` | Whether content may be used in commercial products |
| rights.permissions.modification | boolean | `false` | Whether content may be modified or adapted |
| rights.permissions.redistribution | boolean | `false` | Whether content may be redistributed |
| rights.permissions.derivativeWorks | boolean | `false` | Whether derivative works may be created |
| rights.permissions.attributionRequired | boolean | `true` | Whether attribution is required when using content |

#### 1.4.3 Legal Contact

| Property | Type | Description |
|----------|------|-------------|
| rights.contact.licensing | string | Email or URL for licensing inquiries |
| rights.contact.dmca | string | DMCA agent contact for takedown requests |
| rights.contact.general | string | General legal contact |

#### 1.4.4 Terms & Policies

| Property | Type | Description |
|----------|------|-------------|
| rights.termsUrl | string | URL to full terms of use |
| rights.communityPolicyUrl | string | URL to fan content/community use policy |

**Complete Rights Example:**

```json
"rights": {
  "type": "proprietary",
  "official": true,
  "productIdentity": [
    "Rolldeo",
    "Rolldeo Tables Collection",
    "All table names and unique entry descriptions"
  ],
  "trademarks": [
    "Rolldeo®",
    "Rolldeo Tables™"
  ],
  "compatibilityNotice": "Created for use with the Rolldeo random table roller. Compatible with any system-agnostic tabletop gaming.",
  "permissions": {
    "commercialUse": false,
    "modification": true,
    "redistribution": false,
    "derivativeWorks": true,
    "attributionRequired": true
  },
  "contact": {
    "licensing": "licensing@rolldeo.com",
    "dmca": "dmca@rolldeo.com"
  },
  "termsUrl": "https://rolldeo.com/terms",
  "communityPolicyUrl": "https://rolldeo.com/community-use"
}
```

### 1.5 Engine Configuration

These optional properties control engine behavior for this file.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| maxRecursionDepth | integer | `50` | Maximum depth for nested table/template references. Prevents infinite loops from circular references. |
| maxExplodingDice | integer | `100` | Maximum number of times exploding dice can re-roll. |
| maxInheritanceDepth | integer | `5` | Maximum depth for inheritance chains (e.g., C extends B extends A = depth 2). |
| uniqueOverflowBehavior | string | `"stop"` | Behavior when unique selection requests more entries than available. One of: `"stop"` (return what's available), `"cycle"` (restart from full pool), `"error"` (throw error). |

**Example:**

```json
{
  "metadata": {
    "name": "Fantasy Treasure Generator",
    "namespace": "fantasy.treasure",
    "version": "2.1.0",
    "specVersion": "1.0",
    "author": "Rolldeo Games",
    "description": "A comprehensive treasure generation system for fantasy RPGs.",
    "tags": ["fantasy", "treasure", "loot", "rewards"],
    "source": {
      "book": "Ultimate Treasure Guide",
      "publisher": "Example Games",
      "isbn": "978-1-234567-89-0",
      "license": "CC BY 4.0",
      "url": "https://example-games.com/treasure-guide",
      "copyright": {
        "year": "2024",
        "holder": "Rolldeo Games LLC",
        "notice": "© 2024 Rolldeo Games LLC. All rights reserved."
      }
    },
    "rights": {
      "type": "open-content",
      "official": true,
      "permissions": {
        "commercialUse": true,
        "modification": true,
        "redistribution": true,
        "derivativeWorks": true,
        "attributionRequired": true
      },
      "contact": {
        "licensing": "licensing@rolldeo-games.com"
      },
      "termsUrl": "https://rolldeo.com/license"
    },
    "maxRecursionDepth": 25,
    "maxExplodingDice": 50,
    "maxInheritanceDepth": 5,
    "uniqueOverflowBehavior": "stop"
  }
}
```

---

## 2. Imports Array

The `imports` array allows you to reference tables, templates, and variables from external JSON files. This enables modular content organization, shared libraries, and large-scale content management.

### 2.1 Import Object Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| path | string | Yes | Relative path or URL to the external JSON file |
| alias | string | Yes | Local alias used to reference content from this import. **Must be unique within the file.** |
| description | string | No | Human-readable description of what this import provides |

### 2.2 Path Resolution

Paths can be specified in several formats:

| Format           | Example                                         | Description                             |
| ---------------- | ----------------------------------------------- | --------------------------------------- |
| Relative path    | `"./creatures/undead.json"`                     | Relative to the current file's location |
| Parent directory | `"../shared/core.json"`                         | Navigate up directory tree              |
| Absolute URL     | `"https://rolldeo.com/tables/v2/monsters.json"` | Remote file (requires network access)   |

**Security Note:** Implementations SHOULD restrict remote URLs to HTTPS and MAY implement allowlists for permitted domains.

### 2.3 Referencing Imported Content

Once imported, content is referenced using the alias as a prefix:

| Reference Type | Syntax | Example |
|----------------|--------|---------|
| Table | `{{alias.tableId}}` | `{{undead.skeletons}}` |
| Template | `{{alias.templateId}}` | `{{core.npcDescription}}` |
| Variable | `{{$alias.variableName}}` | `{{$shared.defaultCurrency}}` |
| Inheritance | `"extends": "alias.tableId"` | `"extends": "core.baseTreasure"` |

### 2.4 Import Behavior

**Namespace Isolation:** Imported content retains its original namespace for provenance tracking, but is accessed locally via the alias. This prevents collisions when importing multiple files that might share table IDs.

**Transitive Imports:** If File A imports File B, and File B imports File C, File A does NOT automatically have access to File C's content. Each file must explicitly declare its own imports.

**Load Order:** Imports are resolved before any table or template processing. Circular imports (File A imports File B which imports File A) MUST be detected and rejected at load time.

**Shared Block Isolation:** The `shared` block from imported files is evaluated, but variables won't be available to any other templates or tables.

**Example:**

```json
{
  "metadata": {
    "name": "Complete Dungeon Generator",
    "namespace": "mydungeon.complete",
    "version": "1.0.0",
    "specVersion": "1.0"
  },
  "imports": [
    {
      "path": "./creatures/undead.json",
      "alias": "undead",
      "description": "Undead creature tables from the creature compendium"
    },
    {
      "path": "./creatures/beasts.json",
      "alias": "beasts",
      "description": "Beast and animal tables"
    },
    {
      "path": "../shared/treasure.json",
      "alias": "loot",
      "description": "Shared treasure generation tables"
    },
    {
      "path": "https://rolldeo.com/tables/core-v2.json",
      "alias": "core",
      "description": "Publisher's official core tables"
    }
  ],
  "tables": [
    {
      "id": "dungeonEncounter",
      "name": "Dungeon Encounter",
      "type": "composite",
      "resultType": "encounter",
      "sources": [
        { "tableId": "undead.allUndead", "weight": 3 },
        { "tableId": "beasts.dungeonBeasts", "weight": 2 },
        { "tableId": "localTraps", "weight": 1 }
      ]
    },
    {
      "id": "localTraps",
      "name": "Local Trap Table",
      "type": "simple",
      "resultType": "encounter",
      "entries": [
        { "value": "Pit trap" },
        { "value": "Poison dart" }
      ]
    }
  ],
  "templates": [
    {
      "id": "roomDescription",
      "name": "Room Description",
      "resultType": "description",
      "pattern": "This room contains {{dungeonEncounter}}. There is also {{loot.minorTreasure}}."
    }
  ]
}
```

### 2.5 Import Validation

Implementations MUST validate:

- All `path` values resolve to valid, accessible files
- All `alias` values are unique within the importing file
- No circular import chains exist
- Referenced content (`alias.tableId`) exists in the imported file
- Imported files conform to a compatible specification version
- All inheritance chains are resolvable (see Section 10)

**Error on Missing Import:** If an imported file cannot be loaded, the entire file MUST fail to load with a clear error message identifying the problematic import.

---

## 3. Tables Array

Each table object can be one of three types: **simple**, **composite**, or **collection**.

### 3.1 Common Table Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| id | string | Yes | - | Unique identifier for the table (local scope). **Must not contain periods (`.`)** |
| name | string | Yes | - | Display name for the table |
| type | string | Yes | - | One of: `"simple"`, `"composite"`, `"collection"` |
| description | string | No | - | Markdown-formatted description |
| tags | string[] | No | `[]` | Tags for organization and searching |
| hidden | boolean | No | `false` | If `true`, table won't appear in user-facing lists. **Note:** Hidden tables remain fully accessible to templates and other tables; this is purely UI guidance. |
| extends | string | No | - | ID of table to inherit from (supports `alias.tableId` and `namespace.tableId` syntax). See Section 10 for multi-level inheritance. |
| defaultSets | object | No | `{}` | Default key-value pairs applied to all entries in this table (see Section 3.8) |
| resultType | string | No | - | Classification of output type (see Section 11). Case-insensitive. |
| shared | object | No | `{}` | Table-level shared variables evaluated lazily when rolled (see Section 8.8) |

### 3.2 Table Source Attribution

Tables can include their own source attribution to track where specific tables originated, particularly useful when a file combines content from multiple sources.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| source.book | string | No | Source book name |
| source.page | integer/string | No | Page number or range (e.g., `47` or `"47-49"`) |
| source.section | string | No | Section or chapter name |
| source.url | string | No | Direct URL to source if available online |
| source.license | string | No | License for this specific table (overrides file-level) |

**Example:**

```json
{
  "id": "wanderingMonsters",
  "name": "Wandering Monsters",
  "type": "simple",
  "tags": ["encounters", "monsters", "wilderness"],
  "resultType": "creature",
  "source": {
    "book": "Monster Manual",
    "page": 147,
    "section": "Random Encounters"
  },
  "entries": [ ... ]
}
```

### 3.3 Simple Table

A basic table with weighted entries. This is the most common table type and is optimized for ease of data entry.

**Additional Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| entries | Entry[] | Yes | Array of table entries |

**Entry Object:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| id | string | No | Auto-generated | Unique ID within this table. **Required for inheritance overrides.** |
| value | string | Yes | - | The output text. Supports Markdown formatting and may contain template syntax for nested evaluation. |
| weight | number | No* | `1` | Relative probability weight. Must be `0` or greater. A weight of `0` disables the entry (see Section 3.4). |
| range | [number, number] | No* | - | A two-element array specifying an inclusive range (e.g., `[1, 5]`). Converted to weight automatically (see Section 3.4). |
| description | string | No | - | Markdown description (for documentation/UI) |
| tags | string[] | No | `[]` | Tags for this specific entry |
| sets | object | No | `{}` | Key-value pairs that set placeholder values when this entry is selected. Merges with and overrides `defaultSets`. |
| assets | object | No | `{}` | Key-value pairs mapping asset types to file paths or URLs (see Section 3.5). |
| resultType | string | No | - | Override the table's resultType for this specific entry. Case-insensitive. |

*\* An entry must have either `weight` OR `range`, but not both. If neither is specified, `weight` defaults to `1`.*

**Auto-Generated Entry IDs:**

When an entry does not specify an `id`, the engine automatically generates one using the pattern `{tableId}{NNN}` where `NNN` is a zero-padded three-digit ordinal (001-999). For example, the third entry in a table with `id: "meleeWeapons"` receives the auto-generated ID `meleeWeapons003`.

Auto-generated IDs are:
- Stable within a single file version (same entry always gets same ID)
- Suitable for internal engine use and logging
- **NOT valid for inheritance overrides** (use explicit IDs instead)

**Example (Minimal):**

```json
{
  "id": "weaponType",
  "name": "Weapon Type",
  "type": "simple",
  "resultType": "item",
  "entries": [
    { "value": "sword" },
    { "value": "axe" },
    { "value": "spear" },
    { "value": "dagger" }
  ]
}
```

**Example (With Weights, IDs, and ResultType Override):**

```json
{
  "id": "treasureContents",
  "name": "Treasure Contents",
  "type": "simple",
  "resultType": "item",
  "tags": ["treasure", "loot"],
  "entries": [
    { "id": "gold", "value": "gold coins", "weight": 3 },
    { "id": "gems", "value": "precious gems", "weight": 2 },
    { "id": "potion", "value": "healing potion", "weight": 1 },
    { "id": "mimic", "value": "**It's a Mimic!**", "weight": 0.5, "resultType": "creature" }
  ]
}
```

### 3.4 Range Syntax and Weight Conversion

The `range` property provides convenient syntax for tables that use traditional dice-roll ranges (e.g., "1-5: Goblin, 6-10: Orc"). Ranges are automatically converted to weights during parsing.

**Conversion Formula:**

```
weight = (range[1] - range[0]) + 1
```

| Range | Calculated Weight | Explanation |
|-------|-------------------|-------------|
| `[1, 5]` | 5 | Numbers 1, 2, 3, 4, 5 |
| `[6, 10]` | 5 | Numbers 6, 7, 8, 9, 10 |
| `[11, 11]` | 1 | Single number 11 |
| `[12, 20]` | 9 | Numbers 12 through 20 |

**Flexibility Features:**

The range system is intentionally forgiving to accommodate various table designs:

- **Gaps are allowed:** Ranges don't need to be continuous. A table with ranges `[1, 3]` and `[7, 10]` is valid—it simply means numbers 4-6 have no entries.
- **Overlaps are allowed:** If two entries have overlapping ranges (e.g., `[1, 5]` and `[4, 8]`), both entries receive their full calculated weight. This can be useful for "critical hit" style tables where certain results trigger multiple outcomes.
- **Zero-width ranges:** A range like `[5, 5]` is valid and equals weight 1.
- **Mixing with weights:** While a single entry cannot have both `range` and `weight`, different entries in the same table may use different systems.

**Example (d100 Encounter Table):**

```json
{
  "id": "wildernessEncounter",
  "name": "Wilderness Encounter (d100)",
  "type": "simple",
  "resultType": "encounter",
  "description": "Roll d100 for a random wilderness encounter",
  "tags": ["encounters", "wilderness", "d100"],
  "entries": [
    { "value": "Nothing eventful", "range": [1, 30] },
    { "value": "Merchant caravan", "range": [31, 45], "resultType": "npc" },
    { "value": "{{dice:1d4+1}} wolves", "range": [46, 60], "resultType": "creature" },
    { "value": "Bandits demand toll", "range": [61, 75], "resultType": "encounter" },
    { "value": "Traveling adventurers", "range": [76, 85], "resultType": "npc" },
    { "value": "{{beasts.rareCreature}}", "range": [86, 95] },
    { "value": "**Dragon sighting!**", "range": [96, 100], "resultType": "creature" }
  ]
}
```

**Weight of Zero:**

A `weight` of `0` is valid and effectively **disables** the entry from being randomly selected. The entry:
- Still exists in the table structure
- Can be referenced by ID for inheritance overrides
- Can be accessed programmatically
- Will NEVER be selected by random rolls

This is particularly useful for:
- Disabling parent entries in child tables via inheritance
- Temporarily removing entries without deleting them
- Creating "template" entries that are referenced but not rolled

**Example (Disabling via Weight):**

```json
{
  "id": "customLoot",
  "name": "Custom Loot Table",
  "type": "simple",
  "extends": "core.standardLoot",
  "entries": [
    { "id": "cursedItem", "weight": 0, "value": "Cursed Ring" },
    { "id": "newItem", "value": "Enchanted Amulet", "weight": 2 }
  ]
}
```

### 3.5 Entry Assets

The `assets` property allows entries to reference associated media files such as images, tokens, audio, or other resources. This enables integration with virtual tabletops, character sheets, and multimedia applications.

**Assets Object:**

The `assets` object uses arbitrary string keys to identify asset types. This flexibility allows different applications to define their own asset conventions.

| Common Key | Typical Use |
|------------|-------------|
| `image` | Primary illustration or artwork |
| `token` | VTT token image |
| `thumbnail` | Small preview image |
| `portrait` | Character portrait |
| `sound` | Sound effect or ambient audio |
| `music` | Background music track |
| `handout` | Player handout document |
| `statblock` | Reference to stat block file |

**Value Format:**

Asset values can be:
- **Relative paths:** `"images/goblin.png"` (relative to the JSON file)
- **Absolute URLs:** `"https://cdn.rolldeo.com/tokens/goblin.webp"`
- **Data URIs:** `"data:image/png;base64,..."` (for embedded small assets)

**Inheritance Behavior:** When a child entry overrides a parent entry, `assets` are deep-merged. Child assets override matching keys; unspecified keys are inherited from the parent.

**Example:**

```json
{
  "id": "goblin",
  "value": "Goblin",
  "weight": 3,
  "resultType": "creature",
  "tags": ["humanoid", "low-level", "common"],
  "sets": {
    "creatureType": "humanoid",
    "challengeRating": "1/4"
  },
  "assets": {
    "image": "images/creatures/goblin.png",
    "token": "tokens/goblin_token.webp",
    "portrait": "portraits/goblin_portrait.jpg",
    "sound": "sounds/goblin_cackle.mp3",
    "statblock": "statblocks/goblin.json"
  }
}
```

### 3.6 Composite Table

Selects which source table to roll on using weighted probability, then rolls once on that table. Use composite tables when you want weighted selection *between* different tables.

**When to Use:** Composite tables are ideal when you need to select from categorically different pools. For example, a "Random Encounter" table might weight toward "Common Creatures" 70% of the time, "Uncommon Creatures" 25%, and "Rare Creatures" 5%.

**Additional Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| sources | Source[] | Yes | Array of source tables to select from |

**Source Object:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| tableId | string | Yes | - | ID of the table to pull from (supports `alias.tableId` and `namespace.tableId`) |
| weight | number | No | `1` | Relative weight for selecting this source. Must be `0` or greater. Weight of `0` disables this source. |

**ResultType Behavior:** When rolling on a composite table:
1. If the selected entry has a `resultType`, use it
2. Else if the selected source table has a `resultType`, use it
3. Else if the composite table has a `resultType`, use it
4. Else resultType is undefined

**Example:**

```json
{
  "id": "randomEncounter",
  "name": "Random Encounter",
  "type": "composite",
  "resultType": "encounter",
  "tags": ["encounters", "combat", "exploration"],
  "sources": [
    { "tableId": "commonCreatures", "weight": 7 },
    { "tableId": "uncommonCreatures", "weight": 2.5 },
    { "tableId": "rareCreatures", "weight": 0.5 },
    { "tableId": "undead.allUndead", "weight": 0 }
  ]
}
```

### 3.7 Collection Table

Merges all entries from multiple tables into a single unified pool. The resulting table contains every entry from every source table, preserving original weights and entry IDs.

**When to Use:** Collection tables are for combining related tables into one master table. For example, combining "Swords", "Axes", and "Polearms" tables into an "All Melee Weapons" table.

**Additional Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| collections | string[] | Yes | Array of table IDs to combine (supports `alias.tableId` and `namespace.tableId`) |

**Entry ID Collision Handling:** If multiple source tables contain entries with the same `id`, entries are prefixed with their source table ID (e.g., `swords.longsword`, `axes.battleaxe`). Weights are preserved from the original entries.

**Example:**

```json
{
  "id": "allMeleeWeapons",
  "name": "All Melee Weapons",
  "type": "collection",
  "resultType": "item",
  "tags": ["equipment", "weapons", "melee", "combined"],
  "collections": ["swords", "axes", "polearms", "exotic.weapons"]
}
```

### 3.8 Default Sets

The `defaultSets` property allows you to define placeholder values that apply to all entries in a table. Individual entries can override these defaults using their own `sets` property.

**Merge Behavior:** Entry-level `sets` are merged with `defaultSets`. If both define the same key, the entry-level value takes precedence.

**Inheritance Behavior:** When a table extends another, `defaultSets` are deep-merged through the inheritance chain. Child tables' `defaultSets` override matching keys from ancestors.

**Example:**

```json
{
  "id": "forestCreatures",
  "name": "Forest Creatures",
  "type": "simple",
  "resultType": "creature",
  "tags": ["creatures", "forest", "wilderness"],
  "defaultSets": {
    "terrain": "forest",
    "climate": "temperate"
  },
  "entries": [
    { "value": "Wolf", "sets": { "size": "medium" }, "tags": ["beast", "predator"] },
    { "value": "Bear", "sets": { "size": "large" }, "tags": ["beast", "predator"] },
    { "value": "Snow Owl", "sets": { "size": "small", "climate": "cold" }, "tags": ["beast", "bird"] }
  ]
}
```

**Resulting placeholder values when each entry is selected:**

| Entry | @terrain | @climate | @size |
|-------|----------|----------|-------|
| Wolf | forest | temperate | medium |
| Bear | forest | temperate | large |
| Snow Owl | forest | cold | small |

---

## 4. Templates Array

Templates define text generation patterns that combine multiple tables and operations.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| name | string | Yes | Display name |
| pattern | string | Yes | Template pattern string (see Section 5). Supports Markdown. |
| description | string | No | Markdown description |
| tags | string[] | No | Tags for organization and filtering |
| resultType | string | No | Classification of output type. Overrides any resultTypes from tables used within the template. Case-insensitive. |
| shared | object | No | Template-level shared variables evaluated lazily when rolled (see Section 8.8) |

**Example:**

```json
{
  "id": "treasureDescription",
  "name": "Treasure Description",
  "resultType": "description",
  "tags": ["treasure", "description", "loot"],
  "pattern": "You find **{{dice:2d6*10}} gold pieces** and _{{itemTable}}_."
}
```

---

## 5. Template Pattern Syntax

Templates use double curly braces `{{}}` for dynamic content. To include literal `{{` or `}}` in output, escape them as `\{{` and `\}}`.

### 5.1 Syntax Reference

The following table lists all supported operations in order of parsing priority:

| Syntax                        | Description                                    | Example                       |
| ----------------------------- | ---------------------------------------------- | ----------------------------- |
| `{{tableId}}`                 | Roll once on specified table                   | `{{treasureTable}}`           |
| `{{alias.tableId}}`           | Roll on table from imported file               | `{{loot.minorTreasure}}`      |
| `{{namespace.tableId}}`       | Roll on table from specific namespace          | `{{fantasy.core.treasure}}`   |
| `{{again}}`                   | Roll once more on the current table            | `{{again}}`                   |
| `{{N*again}}`                 | Roll N times on the current table              | `{{2*again}}`                 |
| `{{N*unique*again}}`          | Roll N times on current table, no duplicates   | `{{3*unique*again}}`          |
| `{{dice:XdY}}`                | Standard dice roll                             | `{{dice:3d6}}`                |
| `{{dice:XdY+Z}}`              | Dice with arithmetic                           | `{{dice:2d8+3}}`              |
| `{{dice:XdY-Z}}`              | Dice with subtraction                          | `{{dice:2d8-1}}`              |
| `{{dice:XdY*Z}}`              | Dice with multiplication                       | `{{dice:2d6*10}}`             |
| `{{dice:XdYkH}}`              | Keep highest H dice                            | `{{dice:4d6k3}}`              |
| `{{dice:XdYkL}}`              | Keep lowest L dice                             | `{{dice:2d20kl1}}`            |
| `{{dice:XdY!}}`               | Exploding dice (max value re-rolls)            | `{{dice:1d6!}}`               |
| `{{dice:XdY!+Z}}`             | Exploding dice with modifier                   | `{{dice:1d6!+2}}`             |
| `{{N*tableId}}`               | Roll N times (with replacement)                | `{{3*itemTable}}`             |
| `{{N*unique*tableId}}`        | Roll N times (no duplicates)                   | `{{3*unique*itemTable}}`      |
| `{{dice:XdY*tableId}}`        | Roll dice for count, then roll that many times | `{{dice:1d4*treasureTable}}`  |
| `{{N*tableId\|"sep"}}`        | Multiple rolls with custom separator           | `{{3*nameTable\|", "}}`       |
| `{{N*unique*tableId\|"sep"}}` | Unique rolls with custom separator             | `{{3*unique*items\|" and "}}` |
| `{{tableId#instance}}`        | Named instance for conditional references      | `{{weapon#primary}}`          |
| `{{$variableName}}`           | Reference a stored variable (static or shared) | `{{$playerRace}}`             |
| `{{$alias.variableName}}`     | Reference a variable from imported file        | `{{$core.defaultCurrency}}`   |
| `{{@placeholder.property}}`   | Lookup property from placeholder context       | `{{@size.buildingCount}}`     |
| `{{@self.description}}`       | Access current entry's description             | `{{@self.description}}`       |
| `{{$var*tableId}}`            | Use shared variable as roll count              | `{{$monsterCount*creatures}}` |
| `{{$var*unique*tableId}}`     | Use shared variable for unique roll count      | `{{$count*unique*loot}}`      |
| `{{N*table >> $var}}`         | Capture N roll results into variable           | `{{3*items >> $loot}}`        |
| `{{N*unique*table >> $var}}`  | Capture N unique rolls into variable           | `{{3*unique*items >> $loot}}` |
| `{{N*table >> $var\|silent}}` | Capture without output                         | `{{3*items >> $loot\|silent}}`|
| `{{$var[N]}}`                 | Access captured item by index (0-based)        | `{{$loot[0]}}`                |
| `{{$var[N].@prop}}`           | Access captured item's sets property           | `{{$loot[0].@enemy}}`         |
| `{{$var.count}}`              | Get count of captured items                    | `{{$loot.count}}`             |
| `{{collect:$var.@prop}}`      | Aggregate property across all captured items   | `{{collect:$loot.@enemy}}`    |
| `{{collect:$var.@prop\|unique}}` | Aggregate with deduplication               | `{{collect:$loot.@enemy\|unique}}` |

### 5.2 The `again` Keyword

The `again` keyword enables "roll again" mechanics within a table entry's value. When processed, it rolls on the same table that contains the current entry.

**Self-Reference Safety:** When `again` is used, the entry containing it is automatically excluded from subsequent rolls to prevent infinite loops. This exclusion applies only to the immediate reroll chain, not to future independent rolls on the same table.

**Syntax Variants:**

| Syntax | Description |
|--------|-------------|
| `{{again}}` | Roll once more on this table |
| `{{N*again}}` | Roll N times on this table |
| `{{N*unique*again}}` | Roll N times, no duplicates (excluding self) |
| `{{again\|"sep"}}` | Roll again with custom separator |
| `{{N*again\|"sep"}}` | Roll N times with custom separator |
| `{{dice:XdY*again}}` | Roll dice for count, then roll that many times |

**Example: Wild Magic Surge Table**

```json
{
  "id": "wildMagic",
  "name": "Wild Magic Surge",
  "type": "simple",
  "resultType": "effect",
  "tags": ["magic", "wild-magic", "chaos"],
  "entries": [
    { "value": "You can fly for 1 minute", "tags": ["beneficial", "movement"] },
    { "value": "Your skin turns bright blue for 24 hours", "tags": ["cosmetic"] },
    { "value": "You cast *fireball* centered on yourself", "tags": ["harmful", "fire"] },
    { "value": "**Double surge!** {{2*unique*again|\" AND \"}}", "tags": ["meta", "double"] },
    { "value": "Nothing happens", "weight": 2, "tags": ["null"] }
  ]
}
```

**Possible output for "Double surge!":**
> **Double surge!** You can fly for 1 minute AND Your skin turns bright blue for 24 hours

### 5.3 Dice Notation

All dice operations must be prefixed with `dice:` to distinguish them from table references.

| Notation | Description |
|----------|-------------|
| `XdY` | Roll X dice with Y sides |
| `+Z`, `-Z`, `*Z` | Add, subtract, or multiply result by Z |
| `kN` or `khN` | Keep highest N dice |
| `klN` | Keep lowest N dice |
| `!` | Exploding (rolls of max value roll again, up to `maxExplodingDice`) |

**Examples:**
- `{{dice:3d6}}` → Roll 3d6 (result: 3-18)
- `{{dice:4d6k3}}` → Roll 4d6, keep highest 3
- `{{dice:2d10+5}}` → Roll 2d10, add 5
- `{{dice:1d6!}}` → Roll 1d6, 6s explode

### 5.4 Math Expressions

Use the `math:` prefix to perform arithmetic operations. Math expressions can combine variables, placeholders, literal numbers, and inline dice rolls.

#### 5.4.1 Basic Syntax

| Component | Syntax | Example |
|-----------|--------|---------|
| Literal integers | `N` | `5`, `-3`, `100` |
| Variables | `$varName` | `$baseValue`, `$bonus` |
| Imported variables | `$alias.varName` | `$core.multiplier` |
| Placeholders | `@placeholder.property` | `@creature.hitDice` |
| Inline dice | `dice:XdY...` | `dice:2d6`, `dice:1d4+1` |

#### 5.4.2 Operators

| Operator | Description | Precedence |
|----------|-------------|------------|
| `(` `)` | Grouping | Highest |
| `*` | Multiplication | High |
| `/` | Integer division (rounds toward zero) | High |
| `+` | Addition | Low |
| `-` | Subtraction | Low |

Operators of equal precedence are evaluated left to right.

#### 5.4.3 Examples

**Simple variable arithmetic:**
```
{{math:$base + $bonus}}
{{math:$price * $quantity}}
{{math:$total / 2}}
```

**With grouping:**
```
{{math:($strength - 10) / 2}}           → D&D-style ability modifier
{{math:($base + $bonus) * $multiplier}}
```

**With inline dice:**
```
{{math:dice:2d6 + $strMod}}             → Damage roll with modifier
{{math:dice:1d20 + $attackBonus}}       → Attack roll
{{math:$level * dice:1d8 + $conMod}}    → Hit points per level
```

**With placeholders:**
```
{{math:@creature.hd * 4 + 10}}          → Calculate HP from hit dice
{{math:@item.basePrice * $markup}}      → Dynamic pricing
```

**Complex TTRPG calculations:**
```
{{math:(dice:4d6k3 - 10) / 2}}          → Roll stats, calculate modifier
{{math:$proficiencyBonus + @weapon.attackMod + $strMod}}
```

#### 5.4.4 Type Coercion and Errors

- **Non-numeric values** coerce to `0` with a logged warning
- **Division by zero** evaluates to `0` with a logged warning
- **All results are integers**—decimal results are rounded toward zero
- Inline dice are rolled once when the math expression is evaluated

#### 5.4.5 Where Math Expressions Can Be Used

| Context | Example |
|---------|---------|
| Shared block values | `"damage": "{{math:dice:2d6 + $strMod}}"` |
| Template patterns | `"You deal {{math:$baseDamage + $bonus}} damage."` |
| Entry values | `"{{math:@creature.count * 10}} gold pieces"` |
| Conditional values | `"value": "{{math:$current + 5}}"` |

### 5.5 Multiple Rolls

Use the `*` operator to roll multiple times on a table.

| Syntax | Behavior |
|--------|----------|
| `{{3*table}}` | Roll 3 times, results joined by `, ` (default) |
| `{{3*unique*table}}` | Roll 3 times, no duplicates |
| `{{dice:1d4*table}}` | Roll 1d4 to determine count, then roll that many times |
| `{{3*table\|" and "}}` | Roll 3 times, join with ` and ` |
| `{{$count*table}}` | Use shared variable as count (must resolve to integer) |

**Separator Syntax:** Separators must be enclosed in double quotes after a pipe character. To include a literal double quote in the separator, escape it as `\"`.

**Variable as Count:** When using a shared variable as a roll count:
- The variable must resolve to a number
- Non-integer values are rounded down (toward zero)
- Values ≤ 0 result in zero rolls (empty string output)
- Non-numeric values are coerced; coercion failure results in 0

### 5.6 Unique Constraint Logic

When using `{{N*unique*tableId}}`:

1. A temporary pool is created containing all table entries with weight > 0.
2. Each selection removes that entry from the pool.
3. Weights apply to each successive draw from the remaining pool.
4. If N exceeds total available entries, behavior follows `uniqueOverflowBehavior` in metadata:
   - `"stop"` (default): Return all available entries
   - `"cycle"`: Refill pool and continue
   - `"error"`: Throw an error

### 5.7 Instance References

Use `#` to create named instances for later conditional logic:

```
{{weapon#primary}} and {{weapon#secondary}}
```

This rolls on `weapon` twice, storing results as `primary` and `secondary` instances that can be referenced in conditionals.

### 5.8 Variables and Placeholders

**Variables** (`$`) reference values from the global `variables` object (static), the `shared` block (generation-time), imported file variables, or values set by conditionals:

```
{{$defaultCurrency}}
{{$core.standardSeparator}}
{{$monsterCount}}
```

**Lookup Order:** When resolving `{{$name}}`:
1. Check shared scope (generation-time variables)
2. Check static variable scope (file-level variables)
3. If not found and within a conditional's when-clause: treat as `false`
4. Otherwise: throw `REFERENCE_ERROR`

**Placeholders** (`@`) reference contextual values set by previously rolled entries via their `sets` property:

```
{{@race.firstName}}
```

See Section 9 for details on the placeholder system.

### 5.9 Roll Capture System

The Roll Capture System enables capturing multiple roll results for later aggregation and individual access. This allows combining properties from multiple independent table rolls into unified lists.

#### 5.9.1 Capture Declaration

Use the `>>` operator to capture roll results into a named variable:

| Syntax | Description |
|--------|-------------|
| `{{N*table >> $var}}` | Roll N times, capture results into `$var` |
| `{{N*unique*table >> $var}}` | Roll N unique times, capture into `$var` |
| `{{$count*table >> $var}}` | Use shared variable for roll count |
| `{{dice:XdY*table >> $var}}` | Use dice roll for count |

**Output Control:**

| Syntax | Description |
|--------|-------------|
| `{{3*table >> $var}}` | Outputs joined values, creates capture |
| `{{3*table >> $var\|"; "}}` | Outputs with custom separator, creates capture |
| `{{3*table >> $var\|silent}}` | No output, only creates capture |

**Data Model:** A capture variable stores an ordered array of captured items:

```typescript
interface CaptureItem {
  value: string;           // The resolved output text from the roll
  sets: Record<string, string>;  // The merged sets (defaultSets + entry sets), fully resolved
}

interface CaptureVariable {
  items: CaptureItem[];
  count: number;           // items.length
}
```

#### 5.9.2 Capture Variable Access

**Basic Access:**

| Syntax | Returns | Example |
|--------|---------|---------|
| `{{$var}}` | All raw values, comma-separated | `"palace, mansion, fortress"` |
| `{{$var\|"sep"}}` | All raw values, custom separator | `"palace; mansion; fortress"` |
| `{{$var.count}}` | Number of captured items (integer) | `3` |

**Indexed Access (0-based):**

| Syntax | Returns | Example |
|--------|---------|---------|
| `{{$var[0]}}` | Raw value of first item | `"palace"` |
| `{{$var[1]}}` | Raw value of second item | `"mansion"` |
| `{{$var[-1]}}` | Raw value of last item | `"fortress"` |
| `{{$var[0].value}}` | Explicit raw value access | `"palace"` |
| `{{$var[0].@enemy}}` | The `enemy` sets property from first item | `"mad scientist"` |

**Out-of-bounds behavior:** Returns empty string with engine warning.

#### 5.9.3 Property Aggregation (collect)

The `collect:` prefix aggregates a specific property across all captured items:

| Syntax | Returns |
|--------|---------|
| `{{collect:$var.value}}` | All raw values (equivalent to `{{$var}}`) |
| `{{collect:$var.@prop}}` | All values of `@prop` from each item, comma-separated |
| `{{collect:$var.@prop\|"sep"}}` | Same, with custom separator |
| `{{collect:$var.@prop\|unique}}` | Deduplicated values, comma-separated |
| `{{collect:$var.@prop\|unique\|"sep"}}` | Deduplicated values, custom separator |

**Missing property behavior:** If an item doesn't have the requested property, it contributes an empty string to the collection.

#### 5.9.4 Example

```json
{
  "templates": [
    {
      "id": "fullSetting",
      "name": "Full Campaign Setting",
      "pattern": "## Settings\n{{dice:1d3+1*unique*settingIdeas >> $ideas}}\n\n## Enemies\n{{collect:$ideas.@enemy}}\n\n## Allies\n{{collect:$ideas.@ally}}"
    }
  ]
}
```

**Sample Output:**

```markdown
## Settings
A crumbling palace, A haunted manor, An icy fortress

## Enemies
mad scientist, vengeful spirit, frost giant

## Allies
disgraced noble, ghostly guardian, arctic ranger
```

#### 5.9.5 Capture Scope and Rules

1. **Generation Scope:** Capture variables exist in generation scope (same as shared variables)
2. **Persistence:** They persist for the entire generation run, then are discarded
3. **Namespace:** Capture variable names share namespace with shared variables (no conflicts allowed)
4. **Forward References:** A capture variable must be declared before it can be accessed
5. **Overwrite Behavior:** If a capture variable name is reused, the second capture overwrites the first (with warning)

### 5.10 Switch Expressions

Switch expressions provide inline conditional value selection within templates. They allow you to choose different outputs based on runtime conditions, all within a single expression.

#### 5.10.1 Basic Syntax

There are two forms of switch expressions:

**Standalone Switch** (no base expression):
```
{{switch[condition:result].switch[condition2:result2].else[fallback]}}
```

**Attached Switch** (transforms an expression result):
```
{{expression.switch[condition:result].else[fallback]}}
```

#### 5.10.2 Components

| Component | Description | Required |
|-----------|-------------|----------|
| `condition` | Boolean expression using variables, operators, and literals | Yes |
| `result` | Value returned if condition is true | Yes |
| `fallback` | Value returned if no condition matches (in `.else[]`) | No |

**Evaluation Order:** Switch clauses are evaluated left-to-right. The first matching condition wins.

**No Match Behavior:**
- Standalone switch: Returns empty string (with console warning)
- Attached switch: Returns the original base expression result

#### 5.10.3 Condition Syntax

Conditions support the same operators as conditionals:

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equality | `$gender=="male"` |
| `!=` | Inequality | `$type!="common"` |
| `>`, `<`, `>=`, `<=` | Numeric comparison | `$level>=5` |
| `contains` | Substring match (case-insensitive) | `$name contains "the"` |
| `matches` | Regex pattern match | `$code matches "^[A-Z]{3}$"` |
| `&&` | Logical AND | `$class=="wizard" && $level>=5` |
| `\|\|` | Logical OR | `$type=="fire" \|\| $type=="ice"` |
| `!` | Logical NOT | `!$hidden` |
| `()` | Grouping | `($a \|\| $b) && $c` |

**Implicit Subject (`$`):** In attached switch expressions, a standalone `$` (not followed by a variable name) refers to the base expression's result:

```
{{dice:1d20.switch[$>=20:"Critical!"].switch[$>=10:"Hit"].else["Miss"]}}
```

Here, `$>=20` means "the dice result is >= 20".

#### 5.10.4 Result Types

Result expressions can be:

| Type | Syntax | Example |
|------|--------|---------|
| String literal | `"text"` or `'text'` | `"he"`, `"Critical Hit!"` |
| Capture property | `$var.@property` | `$race.@maleName` |
| Table reference | `{{tableId}}` | `{{spellBook}}` |
| Placeholder | `@name.property` | `@creature.type` |

**Important:** Results require explicit paths. Use `$race.@maleName` not just `@maleName` to avoid ambiguity when multiple captures have the same property names.

#### 5.10.5 Examples

**Pronoun Selection:**
```
{{switch[$gender=="male":"he"].switch[$gender=="female":"she"].else["they"]}}
```

**Dice Outcome Transformation:**
```
{{dice:1d20.switch[$>=20:"Critical Hit!"].switch[$>=10:"Hit"].else["Miss"]}}
```

**Gender-Based Name Selection:**
```json
{
  "shared": {
    "$gender": "{{gender}}",
    "$race": "{{race}}"
  },
  "pattern": "A {{$gender}} {{$race}} named {{switch[$gender==\"male\":$race.@maleName].else[$race.@femaleName]}}"
}
```

**Complex Conditions with Nested Tables:**
```
{{switch[$class=="wizard" && $level>=5:{{powerSpells}}].else[{{basicSpells}}]}}
```

**Table Result Transformation:**
```
{{mood.switch[$=="angry":"furiously"].switch[$=="sad":"mournfully"].else["calmly"]}}
```

**Multiple Condition Chains:**
```
{{switch[$culture=="english" && $gender=="male":$race.@maleEnglishName].switch[$culture=="english" && $gender=="female":$race.@femaleEnglishName].switch[$culture=="chinese" && $gender=="male":$race.@maleChineseName].switch[$culture=="chinese" && $gender=="female":$race.@femaleChineseName].else[$race.@defaultName]}}
```

#### 5.10.6 Switch Expression Use Cases

Switch expressions are the primary mechanism for conditional logic in templates. They handle all conditional value selection inline during pattern evaluation.

**Common use cases:**
- Selecting between property values based on other variables
- Transforming expression results inline
- Gender/race/class-based name selection
- Dice outcome interpretation
- Adding conditional text (append empty string for no-match cases)
- Conditional warnings or notes based on rolled results

**Conditional text pattern:**
```
{{switch[@danger.value=="high":"\n\n*Warning: This area is dangerous.*"].else[""]}}
```

This pattern appends conditional text when the condition is met, or nothing when it's not.

#### 5.10.7 Common Pattern: Conditional Sub-Selection

One of the most powerful and common patterns in table design is selecting sub-tables based on multiple rolled factors. This applies to many scenarios:

- **Names:** Gender + culture → appropriate first name, surname
- **Encounters:** Terrain + time of day → appropriate creature/event tables
- **Loot:** Enemy type + difficulty → appropriate reward tables
- **Military:** Region (land/air/sea) → appropriate units, attacks, defenses
- **NPCs:** Faction + role → appropriate names, traits, equipment

The core concept:
1. Roll one or more "selector" tables (e.g., region, gender, faction)
2. Use switch expressions to pick sub-tables based on selector values
3. Store results in variables for reuse throughout the template
4. Each selector entry can contain sets pointing to its own sub-tables

**Example: Region-Based Military Units**

A simple example where region type determines available units:

```
{{switch[$region=="Land":{{landUnits}}].switch[$region=="Air":{{airUnits}}].switch[$region=="Sea":{{seaUnits}}].else[{{genericUnits}}]}}
```

**Example: Character Names (Gender + Culture)**

A more complex example generating names that depend on multiple factors:

**Example Setup:**

First, define your helper tables:

```json
{
  "tables": [
    {
      "id": "gender",
      "name": "Gender",
      "type": "simple",
      "hidden": true,
      "entries": [
        { "value": "male" },
        { "value": "female" }
      ]
    },
    {
      "id": "culture",
      "name": "Culture",
      "type": "simple",
      "entries": [
        { "id": "dragonborn", "value": "Dragonborn" },
        { "id": "elf", "value": "Elf" },
        { "id": "dwarf", "value": "Dwarf" }
      ]
    },
    {
      "id": "maleDragonbornNames",
      "name": "Male Dragonborn Names",
      "type": "simple",
      "hidden": true,
      "entries": [
        { "value": "Arjhan" },
        { "value": "Balasar" },
        { "value": "Kriv" }
      ]
    },
    {
      "id": "femaleDragonbornNames",
      "name": "Female Dragonborn Names",
      "type": "simple",
      "hidden": true,
      "entries": [
        { "value": "Akra" },
        { "value": "Biri" },
        { "value": "Kava" }
      ]
    },
    {
      "id": "dragonbornSurnames",
      "name": "Dragonborn Surnames",
      "type": "simple",
      "hidden": true,
      "entries": [
        { "value": "Clethtinthiallor" },
        { "value": "Daardendrian" },
        { "value": "Kerrhylon" }
      ]
    }
  ]
}
```

**Basic Pattern:** Use switch to select the gender-appropriate name table:

```
{{switch[$gender=="male":{{maleDragonbornNames}}].else[{{femaleDragonbornNames}}]}} {{dragonbornSurnames}}
```

This produces results like "Balasar Daardendrian" or "Akra Kerrhylon".

**Advanced Pattern with Variables:** Store each name part for later reference:

```json
{
  "id": "dragonbornCharacter",
  "name": "Dragonborn Character",
  "resultType": "npc",
  "shared": {
    "$gender": "{{gender}}",
    "$firstName": "{{switch[$gender==\"male\":{{maleDragonbornNames}}].else[{{femaleDragonbornNames}}]}}",
    "$surname": "{{dragonbornSurnames}}",
    "$fullName": "{{$firstName}} {{$surname}}"
  },
  "pattern": "**{{$fullName}}** is a {{$gender}} Dragonborn.\n\nRefer to {{$firstName}} by first name, or the {{$surname}} clan by surname."
}
```

This allows you to:
- Use `{{$fullName}}` anywhere you need the complete name
- Use `{{$firstName}}` or `{{$surname}}` individually
- Reference `{{$gender}}` for pronouns or other gender-specific content

**Multi-Culture Pattern:** When you have many cultures, chain switches or use culture-specific sets:

```json
{
  "shared": {
    "$gender": "{{gender}}",
    "$culture": "{{culture}}",
    "$firstName": "{{switch[$culture==\"Dragonborn\" && $gender==\"male\":{{maleDragonbornNames}}].switch[$culture==\"Dragonborn\" && $gender==\"female\":{{femaleDragonbornNames}}].switch[$culture==\"Elf\" && $gender==\"male\":{{maleElfNames}}].switch[$culture==\"Elf\" && $gender==\"female\":{{femaleElfNames}}].else[{{genericNames}}]}}",
    "$surname": "{{switch[$culture==\"Dragonborn\":{{dragonbornSurnames}}].switch[$culture==\"Elf\":{{elfSurnames}}].else[{{genericSurnames}}]}}",
    "$fullName": "{{$firstName}} {{$surname}}"
  },
  "pattern": "**{{$fullName}}** is a {{$gender}} {{$culture}}."
}
```

**Alternative: Using Sets for Cleaner Multi-Culture Support:**

For many cultures, consider putting name table references in the culture entry's sets:

```json
{
  "id": "culture",
  "name": "Culture",
  "type": "simple",
  "entries": [
    {
      "id": "dragonborn",
      "value": "Dragonborn",
      "sets": {
        "maleNames": "{{maleDragonbornNames}}",
        "femaleNames": "{{femaleDragonbornNames}}",
        "surnames": "{{dragonbornSurnames}}"
      }
    },
    {
      "id": "elf",
      "value": "Elf",
      "sets": {
        "maleNames": "{{maleElfNames}}",
        "femaleNames": "{{femaleElfNames}}",
        "surnames": "{{elfSurnames}}"
      }
    }
  ]
}
```

Then use capture-aware shared variables:

```json
{
  "shared": {
    "$gender": "{{gender}}",
    "$culture": "{{culture}}",
    "$firstName": "{{switch[$gender==\"male\":$culture.@maleNames].else[$culture.@femaleNames]}}",
    "$surname": "{{$culture.@surnames}}",
    "$fullName": "{{$firstName}} {{$surname}}"
  },
  "pattern": "**{{$fullName}}** is a {{$gender}} {{$culture}}."
}
```

This approach scales better—adding a new culture means adding one entry with its name table references, rather than updating multiple switch chains.

**More Examples of This Pattern:**

| Scenario | Selector(s) | Sets Contain | Template Access |
|----------|-------------|--------------|-----------------|
| Military units | `region` (Land/Air/Sea) | `attacks`, `defenses`, `units` | `{{$region.@units}}` |
| Encounters | `terrain`, `timeOfDay` | `dayEncounters`, `nightEncounters` | `{{switch[$time=="day":$terrain.@dayEncounters].else[...]}}` |
| Loot drops | `enemyType`, `difficulty` | `easyLoot`, `hardLoot` | `{{switch[$difficulty=="hard":$enemy.@hardLoot].else[...]}}` |
| Faction NPCs | `faction`, `role` | `leaderNames`, `soldierNames`, `spyNames` | `{{switch[$role=="leader":$faction.@leaderNames].else[...]}}` |
| Spells | `school`, `level` | `cantripSpells`, `lowSpells`, `highSpells` | `{{switch[$level=="cantrip":$school.@cantripSpells].else[...]}}` |

**Decision Guide:**
- **Few options per factor (2-3):** Use switch expressions directly
- **Many options, one factor:** Put sub-table refs in that factor's entry sets
- **Many options, multiple factors:** Combine sets approach with switch for remaining factors
- **Need extensibility:** Always prefer sets approach—adding entries is easier than updating switches

---

## 6. Variables Object

Static global variables that are loaded at engine initialization and can be referenced throughout templates using `{{$variableName}}`.

```json
"variables": {
  "defaultSeparator": ", ",
  "setting": "fantasy",
  "campaignYear": "1247"
}
```

**Static Nature:** Variables are evaluated once at file load time. They should contain static, non-generative values. While dice expressions and table references are technically permitted, they will be resolved once at load time—not per generation.

**Recommendation:** For values that should be re-evaluated each generation, use the `shared` block instead (see Section 8).

Variable names must:
- Start with a letter
- Contain only letters, numbers, and underscores
- Not conflict with reserved words (see Section 15)
- Not duplicate variable names from imported files

**Important:** Variable names and placeholder names exist in separate namespaces. A variable `$race` and a placeholder `@race` are distinct and do not conflict.

---

## 7. Shared Block

The `shared` block defines generation-time variables that are evaluated once at the start of each generation and remain constant throughout that generation run.

### 7.1 Purpose

Shared variables solve the problem of needing consistent values across a single generation. For example, if you roll for "number of monsters" and want to use that same number multiple times in a template, shared variables ensure consistency.

### 7.2 Shared Object Structure

```json
"shared": {
  "monsterCount": "{{dice:2d4}}",
  "leaderType": "{{eliteMonsterTable}}",
  "totalThreat": "{{math:$monsterCount + 5}}"
}
```

### 7.3 Evaluation Rules

1. **Order-dependent:** Shared variables are evaluated in declaration order
2. **Once per generation:** Each shared value is resolved exactly once at generation start
3. **Forward reference prohibition:** A shared variable cannot reference another shared variable that appears later in the declaration
4. **Static variable shadowing:** A shared variable cannot have the same name as a static variable (error at generation start)
5. **Imported shared isolation:** The `shared` block from imported files is NOT evaluated; only the entry-point file's shared block is processed

### 7.4 Supported Expressions

| Expression Type           | Example                            | Result Type   |
| ------------------------- | ---------------------------------- | ------------- |
| Dice expression           | `"{{dice:2d6}}"`                   | Integer       |
| Table roll                | `"{{monsterTable}}"`               | String        |
| Prior shared reference    | `"{{$previousVar}}"`               | Inherits type |
| Static variable reference | `"{{$staticVar}}"`                 | Inherits type |
| Math expression           | `"{{math:$a + $b}}"`               | Integer       |
| Math with inline dice     | `"{{math:dice:2d6 + $modifier}}"` | Integer       |

### 7.5 Math Expressions in Shared Block

Use the `{{math:...}}` syntax for arithmetic operations. This explicit syntax eliminates ambiguity and provides full expression support.

**Basic arithmetic:**
```json
"shared": {
  "baseMonsters": "{{dice:2d6}}",
  "eliteMonsters": "{{dice:1d4}}",
  "totalMonsters": "{{math:$baseMonsters + $eliteMonsters}}",
  "treasureValue": "{{math:$totalMonsters * 10}}"
}
```

If `baseMonsters` resolves to `7` and `eliteMonsters` resolves to `3`:
- `totalMonsters` = `{{math:7 + 3}}` → `10`
- `treasureValue` = `{{math:10 * 10}}` → `100`

**With grouping and inline dice:**
```json
"shared": {
  "strength": "{{dice:4d6k3}}",
  "strMod": "{{math:($strength - 10) / 2}}",
  "meleeDamage": "{{math:dice:1d8 + $strMod}}"
}
```

**TTRPG Examples:**

| Use Case | Expression |
|----------|------------|
| Ability modifier | `"{{math:($abilityScore - 10) / 2}}"` |
| Attack bonus | `"{{math:$proficiency + $strMod}}"` |
| Damage with modifier | `"{{math:dice:2d6 + $strMod}}"` |
| Scaled encounter | `"{{math:$partyLevel * 2 + dice:1d4}}"` |
| Gold reward | `"{{math:$challengeRating * 50 + dice:2d6*10}}"` |
| HP calculation | `"{{math:$level * (dice:1d10 + $conMod)}}"` |

See Section 5.4 for complete math expression syntax and operator details.

### 7.6 Using Shared Variables

Shared variables are referenced with the `$` prefix, just like static variables:

```json
{
  "pattern": "You encounter {{$monsterCount}} {{creatures}}. They carry {{$monsterCount*unique*treasure|\", \"}}."
}
```

**As Roll Multiplier:** When used as `{{$var*tableId}}`:
- The variable must resolve to a number
- Non-integer values are rounded down
- Values ≤ 0 result in zero rolls (empty string)

### 8.7 Example: Complete Shared Usage

```json
{
  "metadata": {
    "name": "Encounter Generator",
    "namespace": "encounter.gen",
    "version": "1.0.0",
    "specVersion": "1.0"
  },
  "shared": {
    "encounterSize": "{{dice:2d4}}",
    "creatureType": "{{creatureCategory}}",
    "lootMultiplier": "{{math:$encounterSize / 2}}",
    "totalXP": "{{math:$encounterSize * 50 + dice:2d6*10}}"
  },
  "tables": [
    {
      "id": "creatureCategory",
      "name": "Creature Category",
      "type": "simple",
      "entries": [
        { "value": "goblins" },
        { "value": "orcs" },
        { "value": "undead" }
      ]
    }
  ],
  "templates": [
    {
      "id": "encounter",
      "name": "Random Encounter",
      "resultType": "encounter",
      "pattern": "You encounter {{$encounterSize}} {{$creatureType}}. They have {{$lootMultiplier*treasureTable|\", \"}} treasure items worth {{math:$totalXP / 10}} gold."
    }
  ]
}
```

### 8.8 Table/Template-Level Shared Variables

In addition to document-level shared variables, you can define `shared` on individual tables and templates. These are evaluated **lazily** - only when that specific table or template is rolled.

#### 8.8.1 Syntax

```json
{
  "tables": [
    {
      "id": "scaledEncounter",
      "name": "Scaled Encounter",
      "type": "simple",
      "shared": {
        "threatLevel": "{{dice:1d6}}",
        "monsterCount": "{{math:$threatLevel + 2}}"
      },
      "entries": [
        { "value": "{{$monsterCount}} goblins attack!" },
        { "value": "A band of {{$monsterCount}} orcs approaches." }
      ]
    }
  ],
  "templates": [
    {
      "id": "dynamicEncounter",
      "name": "Dynamic Encounter",
      "shared": {
        "partyLevel": "{{dice:1d10}}",
        "dangerModifier": "{{math:$partyLevel / 2}}"
      },
      "pattern": "Danger level {{math:$dangerModifier + dice:1d6}}: {{encounterTable}}"
    }
  ]
}
```

#### 8.8.2 Evaluation Rules

1. **Lazy Evaluation**: Table/template-level shared variables are only evaluated when that specific table or template is rolled - not at generation start
2. **Order-Dependent**: Within a `shared` block, later variables can reference earlier ones
3. **Propagation**: Shared variables propagate to nested table references - if table A defines `$foo` and references table B, table B can use `$foo`
4. **Document-Level Precedence**: Document-level shared variables take precedence. Attempting to shadow a document-level shared variable throws an error
5. **No Static Shadowing**: Table/template-level shared cannot shadow static variables

#### 8.8.3 Inheritance from Parent Tables

When a table with `shared` is referenced by another table that also defines `shared`:
- The parent's shared variables are evaluated first (since it's rolled first)
- If the child table defines a variable with the same name, it is skipped (parent wins)
- This allows tables to work both standalone and when nested

```json
{
  "tables": [
    {
      "id": "parentTable",
      "type": "simple",
      "shared": { "count": "{{dice:1d4}}" },
      "entries": [{ "value": "{{$count}} items from {{childTable}}" }]
    },
    {
      "id": "childTable",
      "type": "simple",
      "shared": { "count": "{{dice:1d6}}" },
      "entries": [{ "value": "{{$count}} things" }]
    }
  ]
}
```

When rolling `parentTable`:
1. `$count` is set to 1d4 result (e.g., 3)
2. `childTable` is rolled - its `shared.count` is skipped since `$count` already exists
3. Child entry uses the parent's `$count` value (3)

When rolling `childTable` directly:
1. `$count` is set to 1d6 result (e.g., 5)
2. Entry uses 5

### 8.9 Capture-Aware Shared Variables

Shared variable keys starting with `$` are **capture-aware**: they capture the full roll result including its `sets` (placeholder values), enabling property access syntax with dynamic table resolution.

#### 8.9.1 Purpose

Capture-aware shared variables solve the problem of needing multiple independent "instances" from the same table. For example, when generating two NPCs (a hero and an enemy), each needs their own race and corresponding race-specific name:

```json
{
  "shared": {
    "$hero": "{{race}}",
    "$enemy": "{{race}}"
  },
  "pattern": "{{$hero.@firstName}} the {{$hero}} battles {{$enemy.@firstName}} the {{$enemy}}"
}
```

Without capture-aware variables, both characters would share the same placeholder values, causing both to use the same name.

#### 8.9.2 Syntax

| Syntax | Description | Example |
|--------|-------------|---------|
| `"$varName": "{{table}}"` | Define capture-aware variable in shared block | `"$hero": "{{race}}"` |
| `{{$varName}}` | Access the captured value | `{{$hero}}` → `"Elf"` |
| `{{$varName.@property}}` | Access captured set property | `{{$hero.@firstName}}` |

#### 8.9.3 How It Works

1. **Definition**: Keys in the `shared` block starting with `$` are capture-aware
2. **Capture**: When evaluated, the full roll result (value + sets) is captured
3. **Value Access**: `{{$varName}}` returns the string value
4. **Property Access**: `{{$varName.@prop}}` returns the specified set property (already evaluated if it contained a pattern)

#### 8.9.4 Example: Multi-Character Generation

```json
{
  "tables": [
    {
      "id": "race",
      "type": "simple",
      "entries": [
        { "value": "Elf", "sets": { "firstName": "{{elfNames}}", "homeland": "Forest" } },
        { "value": "Dwarf", "sets": { "firstName": "{{dwarfNames}}", "homeland": "Mountain" } }
      ]
    },
    {
      "id": "elfNames",
      "type": "simple",
      "entries": [{ "value": "Legolas" }, { "value": "Arwen" }]
    },
    {
      "id": "dwarfNames",
      "type": "simple",
      "entries": [{ "value": "Gimli" }, { "value": "Thorin" }]
    }
  ],
  "templates": [
    {
      "id": "rivals",
      "name": "Rival Characters",
      "shared": {
        "$hero": "{{race}}",
        "$enemy": "{{race}}"
      },
      "pattern": "**{{$hero.@firstName}}** the {{$hero}} from the {{$hero.@homeland}} vs **{{$enemy.@firstName}}** the {{$enemy}} from the {{$enemy.@homeland}}"
    }
  ]
}
```

**Possible Output:**
> **Legolas** the Elf from the Forest vs **Thorin** the Dwarf from the Mountain

Each character has independent:
- Race value (`Elf` vs `Dwarf`)
- First name (evaluated from `{{elfNames}}` or `{{dwarfNames}}` at selection time)
- Homeland property (`Forest` vs `Mountain`)

#### 8.9.5 Key Differences from Regular Shared Variables

| Feature | Regular Shared | Capture-Aware (`$` prefix) |
|---------|----------------|---------------------------|
| Key syntax | `"varName"` | `"$varName"` |
| Captures sets | No | Yes |
| Property access | No | Yes (`{{$var.@prop}}`) |
| Value access | `{{$varName}}` | `{{$varName}}` |

#### 8.9.6 Pattern Evaluation in Sets

Set values can contain `{{pattern}}` expressions that are evaluated when the entry is selected (at merge time). This enables dynamic content in placeholder values:

```json
{
  "sets": {
    "firstName": "{{elfFirstNames}}",     // Rolls table when entry selected
    "hp": "{{dice:2d6+10}}",               // Rolls dice when entry selected
    "description": "A {{adjective}} elf"   // Mixed literal and pattern
  }
}
```

When accessing `{{$hero.@firstName}}`:

1. The property value was already evaluated at merge time
2. The resolved string value is returned directly

This enables powerful patterns where entry sets define dynamic values that are evaluated once and then accessed consistently throughout the template.

---

## 8. Placeholder System

Placeholders enable dynamic behavior based on previously rolled results. When an entry is selected, its `sets` property (merged with any `defaultSets` from the table, and inherited values if applicable) populates a placeholder context that subsequent operations can reference.

### 9.1 Setting Placeholder Values

In a table entry, use `sets` to define key-value pairs. Values can be literal strings or contain `{{pattern}}` expressions that are evaluated when the entry is selected:

```json
{
  "id": "elfEntry",
  "value": "elf",
  "tags": ["playable", "fey"],
  "sets": {
    "race": "elf",
    "firstName": "{{elfFirstNames}}",
    "lifespan": "750"
  }
}
```

When this entry is selected:
- `@race` returns the literal value `"elf"`
- `@firstName` is evaluated by rolling the `elfFirstNames` table, returning something like `"Aelindra"`
- `@lifespan` returns the literal value `"750"`

**Pattern syntax is required for dynamic content.** A value like `"elfNames"` will be treated as a literal string, not a table reference. Use `"{{elfNames}}"` to roll a table.

**Reserved Set Names:**

The following property names are reserved and should **not** be used as keys in `sets`:

| Reserved Name | Reason |
|---------------|--------|
| `description` | Use the entry's `description` field instead. Using `description` in sets can cause unexpected behavior with `{{@self.description}}` and UI display. |

**Correct Usage:**

```json
{
  "value": "Deep One",
  "description": "A batrachian humanoid with glistening scales",
  "sets": { "origin": "ocean depths", "threat": "high" }
}
```

**Avoid:**

```json
{
  "value": "Deep One",
  "sets": { "description": "A batrachian humanoid...", "origin": "ocean depths" }
}
```

### 9.2 Using Placeholder Values

Reference placeholders in templates using `@placeholder.property` syntax:

```
A {{dice:1d100+{{@race.lifespan}}}} year old {{@race.value}}
```

**Pre-evaluated Values:**

Since set values containing `{{pattern}}` are evaluated when the entry is selected, you simply access the resolved value:

```json
{
  "sets": { "firstName": "{{elfFirstNames}}" },
  "pattern": "The elf's name is {{@race.firstName}}"
}
```

When accessed, `{{@race.firstName}}` returns the already-evaluated name (e.g., `"Aelindra"`), not the original pattern. This ensures consistent values when the same placeholder is accessed multiple times in a pattern.

### 9.3 Placeholder vs Variable Separation

| Prefix | Source | Syntax | Example |
|--------|--------|--------|---------|
| `$` | Static variables, shared variables, or `setVariable` action | `{{$varName}}` | `{{$setting}}` |
| `@` | Entry `sets` property (merged with `defaultSets` and inherited) | `{{@placeholder.property}}` | `{{@race.firstName}}` |

This separation prevents naming collisions and clarifies the source of each value.

### 9.4 The `@self` Placeholder

The `@self` placeholder provides access to properties of the current entry being evaluated. This allows an entry's value to reference its own description field.

| Syntax | Description |
|--------|-------------|
| `{{@self.description}}` | The current entry's `description` field |

**Example:**

```json
{
  "tables": [
    {
      "id": "treasures",
      "type": "simple",
      "entries": [
        {
          "value": "You found {{@self.description}}!",
          "description": "a gleaming silver sword"
        },
        {
          "value": "The chest contains {{@self.description}}.",
          "description": "{{dice:3d6*10}} gold coins"
        }
      ]
    }
  ]
}
```

**Outputs:**
- Entry 1: `You found a gleaming silver sword!`
- Entry 2: `The chest contains 90 gold coins.` (dice rolled)

**Behavior:**
- If the entry has no `description` field, `{{@self.description}}` returns an empty string
- Expressions within the description (like `{{dice:1d6}}`) are evaluated when accessed
- In nested rolls, `@self` refers to the innermost entry being evaluated

---

## 9. Table Inheritance

Tables can extend other tables using the `extends` property. The child table inherits all entries from the parent, then applies its own modifications.

### 10.1 Basic Inheritance

```json
{
  "id": "basicLoot",
  "type": "simple",
  "tags": ["loot", "base"],
  "entries": [
    { "id": "gold", "value": "Copper coins", "weight": 5 },
    { "id": "silver", "value": "Silver coins", "weight": 3 }
  ]
}
```

```json
{
  "id": "richLoot",
  "extends": "basicLoot",
  "type": "simple",
  "tags": ["loot", "wealthy"],
  "entries": [
    { "id": "gold", "value": "Gold coins", "weight": 2 },
    { "id": "gems", "value": "Precious gems", "weight": 1 }
  ]
}
```

**Result for `richLoot`:**
- `gold`: "Gold coins" (weight 2) — *overridden*
- `silver`: "Silver coins" (weight 3) — *inherited*
- `gems`: "Precious gems" (weight 1) — *added*

### 10.2 Multi-Level Inheritance

Tables can form inheritance chains where Table C extends Table B, which extends Table A.

```json
{
  "id": "baseTreasure",
  "type": "simple",
  "defaultSets": { "rarity": "common" },
  "entries": [
    { "id": "copper", "value": "Copper coins", "weight": 5 },
    { "id": "silver", "value": "Silver coins", "weight": 3 },
    { "id": "gold", "value": "Gold coins", "weight": 1 }
  ]
}
```

```json
{
  "id": "mediumTreasure",
  "extends": "baseTreasure",
  "type": "simple",
  "defaultSets": { "rarity": "uncommon" },
  "entries": [
    { "id": "copper", "weight": 3 },
    { "id": "gems", "value": "Gemstones", "weight": 2 }
  ]
}
```

```json
{
  "id": "largeTreasure",
  "extends": "mediumTreasure",
  "type": "simple",
  "defaultSets": { "rarity": "rare", "quality": "fine" },
  "entries": [
    { "id": "copper", "weight": 0 },
    { "id": "gold", "value": "Platinum coins", "weight": 3 },
    { "id": "artifacts", "value": "Ancient artifact", "weight": 1 }
  ]
}
```

**Resolution for `largeTreasure`:**

| Entry ID | Value | Weight | Source |
|----------|-------|--------|--------|
| copper | "Copper coins" | 0 | Value from baseTreasure, weight overridden by largeTreasure (disabled) |
| silver | "Silver coins" | 3 | Fully inherited from baseTreasure |
| gold | "Platinum coins" | 3 | Value and weight overridden by largeTreasure |
| gems | "Gemstones" | 2 | Inherited from mediumTreasure |
| artifacts | "Ancient artifact" | 1 | Added by largeTreasure |

**DefaultSets Resolution:**
Deep-merged from oldest ancestor to child: `{ "rarity": "rare", "quality": "fine" }`

### 10.3 Property-Level Inheritance

When overriding an entry, only explicitly specified properties are replaced. Unspecified properties are inherited from the nearest ancestor that defines them.

```json
// Parent
{
  "id": "goblin",
  "value": "Goblin",
  "weight": 3,
  "description": "A small green creature",
  "assets": { "image": "goblin.png", "token": "goblin_token.png" },
  "sets": { "hp": "7", "ac": "15" }
}

// Child override
{
  "id": "goblin",
  "weight": 5,
  "assets": { "image": "goblin_elite.png" }
}
```

**Resulting entry:**
```json
{
  "id": "goblin",
  "value": "Goblin",              // inherited
  "weight": 5,                     // overridden
  "description": "A small green creature",  // inherited
  "assets": { 
    "image": "goblin_elite.png",   // overridden
    "token": "goblin_token.png"    // inherited (deep merge)
  },
  "sets": { "hp": "7", "ac": "15" }  // inherited
}
```

**Explicit Removal:** To remove an inherited property, set it to `null`:

```json
{
  "id": "goblin",
  "description": null,   // removes the description
  "sets": null           // removes all sets
}
```

### 10.4 Inheritance Rules

1. **Explicit IDs required:** Only entries with explicit `id` values can be overridden. Attempting to override an entry without an ID produces a parse-time error.

2. **Single parent:** A table can only extend one other table (no diamond inheritance). Use collection tables for combining multiple sources.

3. **Depth limit:** Inheritance chains are limited by `maxInheritanceDepth` (default: 5). Exceeding this produces a parse-time error.

4. **Topmost wins:** The child table's values always take precedence. In a chain A→B→C, C's values override both B and A, even if B didn't override A.

5. **No circular inheritance:** If Table A extends Table B, Table B cannot extend Table A (directly or indirectly).

6. **Tags not inherited:** Each table defines its own tags. Child tables do not inherit parent tags.

7. **ResultType not inherited:** Each table defines its own resultType.

8. **Cross-file inheritance:** Tables can extend tables from imported files using `alias.tableId` syntax.

### 10.5 Cross-File and Cross-Namespace Inheritance

Tables can extend tables from imported files or other namespaces:

```json
{
  "id": "customTreasure",
  "extends": "loot.baseTreasure",
  "type": "simple",
  "entries": [ ... ]
}
```

```json
{
  "id": "customTreasure",
  "extends": "fantasy.core.baseTreasure",
  "type": "simple",
  "entries": [ ... ]
}
```

**Validation:** All ancestors in an inheritance chain must be resolvable at file load time. If any ancestor table is missing (file not imported, table doesn't exist), the engine must produce a clear error:

```
INHERITANCE_ERROR in table 'customTreasure':
  Cannot resolve parent 'loot.baseTreasure'.
  The import alias 'loot' is defined, but table 'baseTreasure' was not found.
```

---

## 10. ResultType System

The `resultType` field provides semantic classification of output, enabling consuming applications to handle different result types appropriately.

### 11.1 Properties

- **Optional:** ResultType is not required on any element
- **Case-insensitive:** `"Creature"`, `"creature"`, and `"CREATURE"` are equivalent
- **User-definable:** Any string value is valid; namespaced values are encouraged for custom types
- **Not inherited:** ResultType is not inherited through table inheritance chains

### 11.2 Default Types

The following types are recommended as a baseline vocabulary:

| Type | Description |
|------|-------------|
| `creature` | A monster, animal, or other creature |
| `npc` | A non-player character |
| `faction` | An organization, guild, or group |
| `item` | Equipment, treasure, or objects |
| `loot` | Treasure hauls or reward packages |
| `location` | Places, dungeons, or areas |
| `encounter` | Combat or exploration encounters |
| `event` | Things that happen, occurrences |
| `hook` | Plot hooks or adventure seeds |
| `complication` | Obstacles or problems |
| `name` | Character, place, or thing names |
| `trait` | Personality traits, features, or characteristics |
| `effect` | Spell effects, conditions, or outcomes |
| `environment` | Weather, terrain, or atmosphere |
| `ability` | Skills, powers, or capabilities |
| `description` | Narrative text or flavor |
| `rumor` | Information, gossip, or lore |
| `dialogue` | Speech or conversation |
| `statistic` | Numbers, stats, or metrics |
| `number` | Pure numeric output |
| `currency` | Money or value amounts |
| `time` | Durations or timestamps |
| `weather` | Weather conditions |

### 11.3 Custom Types

Publishers may define their own types using namespace conventions:

```json
"resultType": "starships/cruiser"
"resultType": "wh40k/regiment"
"resultType": "buildings/al-kazir/trade"
```

### 11.4 Precedence Rules

**For Simple Tables:**
1. Entry's `resultType` (if defined)
2. Table's `resultType` (if defined)
3. Undefined

**For Composite Tables:**
1. Selected entry's `resultType` (if defined)
2. Selected source table's `resultType` (if defined)
3. Composite table's `resultType` (if defined)
4. Undefined

**For Templates:**
1. Template's `resultType` (always used if defined)
2. Undefined (template resultType is never inherited from tables used within)

### 11.5 Engine Handling

ResultType is metadata for consuming applications. The engine:
- MUST include resultType in output when defined
- MUST NOT interpret or act upon resultType values
- MUST normalize case (lowercase recommended)

---

## 11. Markdown Support

The specification supports Markdown formatting in specific fields to enable rich text output.

### 12.1 Markdown-Enabled Fields

| Location | Field | Markdown Support |
|----------|-------|------------------|
| Metadata | `description` | Yes |
| Metadata | `instructions` | Yes |
| Table | `description` | Yes |
| Entry | `value` | Yes |
| Entry | `description` | Yes |
| Template | `pattern` | Yes |
| Template | `description` | Yes |
| Conditional | `value` | Yes |

### 12.2 Supported Markdown Syntax

Implementations SHOULD support at minimum:

| Syntax | Renders As |
|--------|------------|
| `**bold**` | **bold** |
| `*italic*` or `_italic_` | *italic* |
| `***bold italic***` | ***bold italic*** |
| `` `code` `` | `code` |
| `[link text](url)` | Hyperlink |
| `- item` or `* item` | Bullet list |
| `1. item` | Numbered list |

Implementations MAY support additional Markdown features such as headers, tables, and blockquotes.

### 12.3 Markdown in Template Output

When template syntax is embedded within Markdown, the template is resolved first, then Markdown is rendered:

```json
{
  "pattern": "You find a **{{weaponType}}** worth _{{dice:2d6*10}} gold pieces_."
}
```

**Resolved output:** `You find a **sword** worth _70 gold pieces_.`

**Rendered:** You find a **sword** worth *70 gold pieces*.

### 12.4 Escaping Markdown

To output literal Markdown characters, use standard Markdown escaping with backslashes:

```json
{
  "value": "The price is 5\\*10 = 50 gold"
}
```

**Output:** The price is 5\*10 = 50 gold

---

## 12. Complete Example

```json
{
  "metadata": {
    "name": "Fantasy Town Generator",
    "namespace": "fantasy.towns",
    "version": "2.2.0",
    "specVersion": "1.0",
    "author": "Game Master",
    "description": "Generates random fantasy town descriptions with **dynamic features** based on settlement size.",
    "tags": ["fantasy", "towns", "settlements", "worldbuilding"],
    "source": {
      "book": "Worldbuilder's Handbook",
      "publisher": "Example Games",
      "page": "45-52",
      "license": "CC BY 4.0"
    },
    "maxRecursionDepth": 30,
    "maxExplodingDice": 50,
    "maxInheritanceDepth": 5
  },
  "imports": [
    {
      "path": "./shared/names.json",
      "alias": "names",
      "description": "Shared name generation tables"
    }
  ],
  "variables": {
    "defaultSeparator": ", ",
    "era": "medieval"
  },
  "shared": {
    "featureCount": "{{dice:1d3+1}}",
    "populationModifier": "{{dice:1d20-10}}"
  },
  "tables": [
    {
      "id": "townSize",
      "name": "Town Size",
      "type": "simple",
      "resultType": "location",
      "tags": ["settlement", "size", "population"],
      "source": {
        "page": 47
      },
      "entries": [
        {
          "id": "hamlet",
          "value": "tiny hamlet",
          "range": [1, 50],
          "tags": ["tiny", "rural"],
          "sets": {
            "size": "tiny",
            "buildingCount": "{{dice:1d4+2}}",
            "population": "{{dice:2d6*10}}"
          },
          "assets": {
            "image": "images/hamlet.png",
            "token": "tokens/settlement_tiny.webp"
          }
        },
        {
          "id": "village",
          "value": "small village",
          "range": [51, 80],
          "tags": ["small", "rural"],
          "sets": {
            "size": "small",
            "buildingCount": "{{dice:2d6+5}}",
            "population": "{{dice:4d6*10}}"
          },
          "assets": {
            "image": "images/village.png",
            "token": "tokens/settlement_small.webp"
          }
        },
        {
          "id": "town",
          "value": "bustling town",
          "range": [81, 100],
          "tags": ["medium", "urban"],
          "sets": {
            "size": "medium",
            "buildingCount": "{{dice:3d6+10}}",
            "population": "{{dice:2d6*100}}"
          },
          "assets": {
            "image": "images/town.png",
            "token": "tokens/settlement_medium.webp"
          }
        }
      ]
    },
    {
      "id": "features",
      "name": "Town Features",
      "type": "simple",
      "resultType": "location",
      "tags": ["settlement", "features", "buildings"],
      "source": {
        "page": 48
      },
      "defaultSets": {
        "featureType": "building"
      },
      "entries": [
        { "value": "a lively tavern", "weight": 2, "tags": ["social", "tavern"] },
        { "value": "a skilled smithy", "weight": 1.5, "tags": ["commerce", "crafting"] },
        { "value": "a small shrine", "weight": 1, "sets": { "featureType": "religious" }, "tags": ["religious"] },
        { "value": "an open-air market", "weight": 1.5, "tags": ["commerce", "market"] },
        { "value": "a central well", "weight": 1, "sets": { "featureType": "infrastructure" }, "tags": ["infrastructure"] },
        { "value": "a grain mill", "weight": 0.5, "tags": ["industry", "food"] },
        { "value": "**multiple features:** {{2*unique*again|\" and \"}}", "weight": 0.5, "tags": ["meta", "multiple"] }
      ]
    },
    {
      "id": "sizeBasedFeatures",
      "name": "Size-Appropriate Features",
      "type": "simple",
      "hidden": true,
      "resultType": "description",
      "tags": ["settlement", "fortification", "internal"],
      "entries": [
        { "value": "surrounded by a wooden palisade", "tags": ["defense", "wall"] },
        { "value": "patrolled by a town guard", "tags": ["defense", "guards"] }
      ]
    }
  ],
  "templates": [
    {
      "id": "townDescription",
      "name": "Town Description",
      "resultType": "description",
      "tags": ["settlement", "description", "main"],
      "pattern": "A **{{townSize}}** called {{names.townName}} with approximately _{{math:@size.population + $populationModifier}} residents_ and {{@size.buildingCount}} buildings. Notable features include {{$featureCount*unique*features|\" and \"}}.{{switch[@size.size==\"medium\":\" The town is {{sizeBasedFeatures}}.\"].else[\"\"]}}"
    }
  ]
}
```

**Sample Output:**
> A **bustling town** called Millbrook with approximately *807 residents* and 21 buildings. Notable features include an open-air market and a lively tavern and a skilled smithy. The town is surrounded by a wooden palisade.

**Result metadata:**
```json
{
  "text": "A **bustling town** called Millbrook...",
  "resultType": "description"
}
```

---

## 13. Processing Order

### 14.1 Engine Instantiation (File Loading)

```
1.  PARSE primary JSON file
2.  VALIDATE JSON structure (schema validation)
3.  EXTRACT metadata
    3a. Read maxRecursionDepth (default: 50)
    3b. Read maxExplodingDice (default: 100)
    3c. Read maxInheritanceDepth (default: 5)
    3d. Read uniqueOverflowBehavior (default: "stop")
    
4.  PROCESS imports (in declaration order)
    FOR each import:
        4a. Resolve path (relative/absolute/URL)
        4b. Load and parse imported file
        4c. Recursively process that file's imports (depth-first)
        4d. CHECK for circular imports → ERROR if detected
        4e. Register imported content under alias
    END FOR
    
5.  LOAD static variables into global scope
    FOR each file (imports first, then primary):
        5a. Read "variables" object
        5b. CHECK for duplicate variable names → ERROR if collision
        5c. Store values literally (no resolution at load time)
    END FOR
    
6.  BUILD table registry
    FOR each file:
        6a. Register all tables by id
        6b. Register with namespace prefix
        6c. Register with import alias prefix (if imported)
    END FOR
    
7.  RESOLVE inheritance chains
    FOR each table with "extends":
        7a. Build ancestor chain (child → parent → grandparent → ...)
        7b. CHECK depth against maxInheritanceDepth → ERROR if exceeded
        7c. CHECK for circular inheritance → ERROR if detected
        7d. CHECK all ancestors exist → ERROR with specific missing table
        7e. CHECK all overriding entries have explicit IDs → ERROR if not
        7f. PRE-COMPUTE merged entries (optional optimization):
            - Start with oldest ancestor's entries
            - Apply each descendant's entries in order
            - For matching IDs: merge properties (child overrides parent)
            - For new IDs: add to pool
            - Deep-merge defaultSets at each level
    END FOR
    
8.  VALIDATE references
    FOR each table, template:
        8a. Parse all {{tableId}} references
        8b. CHECK each referenced table exists → ERROR if not
        8c. CHECK each {{$variable}} exists in static scope → WARN if not
    END FOR

9.  REGISTER templates
    9a. Index templates by id

10. ENGINE READY
```

### 14.2 Generation (Per-Request)

```
1.  INITIALIZE generation context
    1a. Create empty placeholder context (@)
    1b. Create empty shared variable scope
    1c. Initialize recursion depth counter = 0
    1d. Initialize used-entry tracking (for unique constraints)
    
2.  EVALUATE shared block (if present in entry-point file)
    FOR each shared variable (in declaration order):
        2a. CHECK if variable name exists in static scope → ERROR if shadows
        2b. CHECK if variable name already in shared scope → ERROR if duplicate
        2c. PARSE the value expression
        2d. RESOLVE all {{...}} expressions within the value (including {{math:...}})
        2e. CHECK for forward references to undeclared shared → ERROR
        2f. STORE result in shared scope (integer for math/dice, string otherwise)
    END FOR
    
3.  RESOLVE entry point
    IF template requested:
        → GO TO step 5 (Template Evaluation)
    IF table requested:
        → GO TO step 4 (Table Roll)
    
4.  TABLE ROLL
    4a. RESOLVE inheritance (if extends)
        - Get pre-computed merged entries, OR
        - Compute merge on-demand using ancestor chain
    4b. BUILD effective entry pool
        - Include all entries with weight > 0
        - Apply unique constraints if applicable
    4c. CHECK pool not empty → handle per uniqueOverflowBehavior
    4d. CALCULATE total weight of pool
    4e. GENERATE random number [0, totalWeight)
    4f. SELECT entry based on weight distribution
    4g. PROCESS entry sets
        - Deep-merge: ancestor defaultSets → table defaultSets → entry sets
        - Store in placeholder context under @
    4h. DETERMINE resultType
        - Use entry.resultType if defined
        - Else use table.resultType if defined
        - Else undefined
    4i. PROCESS entry value → GO TO step 6 (Expression Resolution)
    4j. RETURN resolved value + resultType + assets
    
5.  TEMPLATE EVALUATION
    5a. GET template pattern string
    5b. DETERMINE resultType (from template.resultType, overrides all)
    5c. PROCESS pattern → GO TO step 6 (Expression Resolution)
    5d. RETURN resolved pattern + resultType
    
6.  EXPRESSION RESOLUTION (for any string containing {{...}})
    6a. PARSE string for {{...}} blocks (left-to-right)
    FOR each {{...}} block:
        6b. IDENTIFY expression type:
            
            {{again}} or {{N*again}} or {{N*unique*again}}:
                - CHECK this is within an entry value → ERROR if not
                - Mark current entry as excluded
                - Roll on current table N times (or dice result times)
                - Apply unique constraint if specified
                - Join results with separator (default ", ")
                
            {{dice:XdY...}}:
                - Parse dice notation
                - Roll dice
                - Apply modifiers (kH, kL, !, +, -, *)
                - Return integer result
                
            {{math:expression}}:
                - PARSE expression for components:
                  * Literals: integers (positive or negative)
                  * Variables: $varName → resolve from shared/static scope
                  * Placeholders: @placeholder.property → resolve from context
                  * Inline dice: dice:XdY... → roll and substitute result
                  * Operators: +, -, *, /
                  * Grouping: ( )
                - EVALUATE expression with standard precedence:
                  1. Parentheses (innermost first)
                  2. * and / (left to right)
                  3. + and - (left to right)
                - HANDLE errors:
                  * Division by zero → 0 with warning
                  * Non-numeric coercion → 0 with warning
                - Return integer result (round toward zero)
                
            {{$variableName}}:
                - CHECK shared scope first
                - THEN check static variable scope
                - IF in conditional when-clause and not found → treat as false
                - ELSE if not found → ERROR: undefined variable
                - Return value
                
            {{@placeholder.property}}:
                - Lookup in placeholder context
                - Return value or empty string if not set
                
            {{$var*tableId}} or {{$var*unique*tableId}}:
                - Resolve $var to integer (round down if needed)
                - If value ≤ 0 → return empty string
                - Roll on table that many times
                - Apply unique constraint if specified
                - Join with separator
                
            {{N*tableId}} or {{N*unique*tableId}}:
                - Resolve N (literal or dice result)
                - Roll on table N times
                - Apply unique constraint if specified
                - Join with separator
                - INCREMENT recursion depth → CHECK against max
                
            {{tableId}} (simple reference):
                - Roll once on table → GO TO step 4
                - INCREMENT recursion depth → CHECK against max
                
            {{tableId#instanceName}}:
                - Roll on table
                - Store result under instance name for later reference
                - Return result

        6c. SUBSTITUTE resolved value into string
    END FOR
    6d. RETURN fully resolved string

7.  FINALIZE OUTPUT
    7a. COMPILE final resolved string
    7b. ATTACH resultType (from entry/table/template hierarchy)
    7c. ATTACH assets (from selected entry, if any)
    7d. OPTIONALLY attach generation metadata
    7e. RETURN generation result
```

### 14.3 Context Cleanup

```
1.  DISCARD generation context
    1a. Clear placeholder context
    1b. Clear shared variable scope
    1c. Clear recursion tracking
    1d. Clear unique-entry tracking
    
2.  RETAIN
    2a. Static variable scope (persists for engine lifetime)
    2b. Table registry (persists for engine lifetime)
    2c. Pre-computed inheritance merges (persists for engine lifetime)
    
3.  READY for next generation request
```

---

## 14. Validation Rules

Implementations must enforce these validation rules.

### 15.1 Identifier Rules

| Identifier Type | Rules |
|-----------------|-------|
| Table ID | Required. Unique within namespace. **Must not contain periods (`.`)**. Alphanumeric plus underscore. Cannot start with a digit. |
| Entry ID | Optional. If provided, must be unique within table. Alphanumeric plus underscore. **Required for inheritance overrides.** |
| Variable Name | Alphanumeric plus underscore. Cannot start with a digit. Unique across all loaded files. |
| Shared Variable Name | Alphanumeric plus underscore. Cannot start with a digit. Cannot shadow static variables. |
| Namespace | Dot-separated segments. Each segment alphanumeric plus underscore. |
| Import Alias | Required for imports. Unique within file. Alphanumeric plus underscore. Cannot start with a digit. **Must not contain periods (`.`)**. |

### 15.2 Auto-Generated ID Format

When entry `id` is omitted:
- Format: `{tableId}{NNN}` where `NNN` is zero-padded ordinal (001-999)
- First entry: `{tableId}001`, second: `{tableId}002`, etc.
- Maximum 999 entries per table for auto-ID (entries beyond 999 require explicit IDs)
- Auto-IDs are generated at parse time and remain stable for that file version
- **Auto-IDs cannot be used for inheritance overrides**

### 15.3 Reserved Words

The following cannot be used as table IDs, variable names, import aliases, or entry IDs:

`dice`, `unique`, `again`, `true`, `false`, `null`, `and`, `or`, `not`, `contains`, `matches`, `shared`, `math`

### 15.4 Weight and Range Validation

**Weight:**
- Must be a non-negative number (`0` or greater)
- Decimals are permitted
- Negative values are invalid and must produce a validation error
- A weight of `0` is valid but disables the entry from random selection

**Range:**
- Must be a two-element array of integers
- First element must be less than or equal to second element
- Both elements must be non-negative
- An entry cannot have both `weight` and `range` properties
- Range is converted to weight using formula: `weight = (range[1] - range[0]) + 1`

### 15.5 Reference Validation

- All `tableId` references must resolve to an existing table (local, imported via alias, or namespaced)
- All `extends` references must resolve to an existing table of the same type
- All import `path` values must resolve to accessible files
- All import `alias` values must be unique within the file
- Circular inheritance must be detected and rejected
- Circular imports must be detected and rejected
- Static variable references (`$name`) should warn if undefined at parse time
- Shared variable forward references must error at generation time
- `{{again}}` is only valid within entry `value` fields, not in templates

### 15.6 Math Expression Validation

Math expressions (`{{math:...}}`) must be validated for:

- **Balanced parentheses:** Every `(` must have a matching `)`
- **Valid operators:** Only `+`, `-`, `*`, `/` are permitted between operands
- **Valid operands:** Integers, `$variable`, `@placeholder.property`, or `dice:XdY...`
- **No empty expressions:** `{{math:}}` is invalid
- **No consecutive operators:** `{{math:$a + + $b}}` is invalid (except unary minus for negative literals)

**Runtime validation:**
- Division by zero returns `0` with a warning
- Non-numeric values coerce to `0` with a warning
- Variables and placeholders must resolve to values (unresolved → error or `0` depending on context)

### 15.7 Inheritance Validation

- Inheritance depth must not exceed `maxInheritanceDepth`
- All entries being overridden must have explicit IDs in both parent and child
- Circular inheritance chains must be detected and rejected at load time
- Missing ancestor tables must produce clear error messages identifying the missing table
- Type mismatch (extending a composite from a simple) must be rejected

### 15.8 Circular Reference Detection

The engine must detect and reject:

- **Import cycles:** File A imports File B, which imports File A
- **Inheritance cycles:** Table A extends Table B, which extends Table A
- **Template cycles:** Template A references Template B, which references Template A
- **Entry value cycles:** Entry value contains reference that eventually references itself
- **Shared variable cycles:** Shared variable A references shared variable B which references A

Detection should occur at load time (for imports, inheritance, templates) or generation start (for shared variables). The error must identify the cycle path.

**Note:** `{{again}}` is explicitly protected from infinite loops by automatically excluding the triggering entry.

### 15.9 Dice Notation Validation

Dice expressions must match the pattern:

```
dice:(\d+)d(\d+)(kl?\d+)?(!)?([+\-*]\d+)?
```

Invalid dice notation must produce a parse error with the invalid expression highlighted.

### 15.10 Schema Validation Summary

| Field | Type | Constraints |
|-------|------|-------------|
| `metadata.name` | string | Required, non-empty |
| `metadata.namespace` | string | Required, valid namespace format |
| `metadata.version` | string | Required, semver format recommended |
| `metadata.specVersion` | string | Required, must be `"1.0"` |
| `metadata.maxRecursionDepth` | integer | Optional, default `50`, minimum `1` |
| `metadata.maxExplodingDice` | integer | Optional, default `100`, minimum `1` |
| `metadata.maxInheritanceDepth` | integer | Optional, default `5`, minimum `1` |
| `metadata.source` | object | Optional |
| `metadata.tags` | string[] | Optional |
| `import.path` | string | Required |
| `import.alias` | string | Required, unique within file |
| `table.id` | string | Required, no periods, unique in namespace |
| `table.type` | string | Required, one of: `simple`, `composite`, `collection` |
| `table.resultType` | string | Optional, case-insensitive |
| `table.source` | object | Optional |
| `table.defaultSets` | object | Optional |
| `table.tags` | string[] | Optional |
| `entry.id` | string | Optional (required for inheritance), unique within table |
| `entry.value` | string | Required |
| `entry.weight` | number | Optional, default `1`, must be >= `0` |
| `entry.range` | [int, int] | Optional, mutually exclusive with weight |
| `entry.resultType` | string | Optional, case-insensitive |
| `entry.tags` | string[] | Optional |
| `entry.assets` | object | Optional |
| `source.weight` | number | Optional, default `1`, must be >= `0` |
| `template.resultType` | string | Optional, case-insensitive |
| `template.tags` | string[] | Optional |
| `conditional.tags` | string[] | Optional |
| `shared.*` | string | Values must be valid expressions |
| `variables.*` | string | Static values, resolved at load time |

---

## 15. Error Handling

Implementations should handle errors gracefully with clear messages.

### 16.1 Error Categories

| Error Type | Cause | Recommended Behavior |
|------------|-------|----------------------|
| `VALIDATION_ERROR` | Invalid JSON structure or field values | Reject file at load time |
| `IMPORT_ERROR` | Cannot load imported file | Reject file at load time |
| `IMPORT_CYCLE` | Circular import chain detected | Reject file at load time |
| `INHERITANCE_ERROR` | Missing ancestor, cycle, or depth exceeded | Reject file at load time |
| `INHERITANCE_ID_ERROR` | Override attempted on entry without explicit ID | Reject file at load time |
| `REFERENCE_ERROR` | Unknown table, variable, or placeholder | Return error marker or throw |
| `CIRCULAR_REFERENCE` | Detected cycle in templates or shared variables | Reject or return error marker |
| `RECURSION_LIMIT` | Exceeded `maxRecursionDepth` | Return partial result with error marker |
| `PARSE_ERROR` | Malformed template syntax | Return error marker with position |
| `UNIQUE_OVERFLOW` | More unique selections than entries | Follow `uniqueOverflowBehavior` setting |
| `INVALID_AGAIN` | `{{again}}` used outside of entry value | Parse error |
| `INVALID_RANGE` | Range array malformed or invalid | Reject file at load time |
| `WEIGHT_RANGE_CONFLICT` | Entry has both weight and range | Reject file at load time |
| `SHARED_FORWARD_REF` | Shared variable references undeclared shared | Error at generation start |
| `SHARED_SHADOW` | Shared variable name matches static variable | Error at generation start |
| `MATH_SYNTAX_ERROR` | Malformed math expression (unbalanced parens, invalid operator) | Return error marker with position |
| `DIVISION_BY_ZERO` | Division by zero in math expression | Return 0 with warning |
| `COERCION_FAILURE` | Non-numeric string in math expression | Coerce to 0 with warning |

### 16.2 Error Message Format

Error messages should include:
- Error type
- Location (file, import alias, table ID, entry ID, template ID, line/column if applicable)
- Description of the problem
- Suggestion for resolution (when possible)

**Examples:**

```
INHERITANCE_ERROR in table 'epicTreasure':
  Inheritance depth (6) exceeds maxInheritanceDepth (5).
  Chain: epicTreasure → largeTreasure → mediumTreasure → 
         smallTreasure → baseTreasure → coreLoot
  Consider flattening the inheritance chain or increasing maxInheritanceDepth.
```

```
INHERITANCE_ID_ERROR in table 'customMonsters':
  Cannot override entry at position 3 in parent table 'baseMonsters'.
  The parent entry does not have an explicit ID.
  Add an 'id' property to the parent entry to enable override.
```

```
SHARED_FORWARD_REF in shared block:
  Variable 'totalCount' references '$bonusCount' which is declared later.
  Move 'bonusCount' declaration before 'totalCount'.
```

```
MATH_SYNTAX_ERROR in template 'damageCalculation':
  Unbalanced parentheses in expression: {{math:($base + $bonus * 2}}
  Position: column 34
  Add closing parenthesis to complete the expression.
```

### 16.3 Graceful Degradation

When possible, the engine should:
- Continue processing other valid content
- Mark errors inline rather than failing entirely
- Log warnings for non-critical issues (e.g., unused variables, division by zero)
- Provide partial results with error markers for recoverable errors

---

## Appendix A: Quick Reference Card

```
TABLE REFERENCES
  {{tableName}}              Roll once on table
  {{alias.tableName}}        Roll on table from imported file
  {{namespace.tableName}}    Roll on namespaced table
  {{3*tableName}}            Roll 3 times
  {{3*unique*tableName}}     Roll 3 times, no duplicates
  {{3*tableName|", "}}       Roll 3 times, custom separator
  {{tableName#instance}}     Named instance
  {{$count*tableName}}       Use shared variable as count

ROLL AGAIN (in entry values only)
  {{again}}                  Roll once more on this table
  {{2*again}}                Roll 2 more times
  {{2*unique*again}}         Roll 2 more times, no duplicates
  {{dice:1d4*again}}         Roll 1d4 times on this table

DICE
  {{dice:3d6}}               Roll 3d6
  {{dice:4d6k3}}             Roll 4d6, keep highest 3
  {{dice:2d6kl1}}            Roll 2d6, keep lowest 1
  {{dice:1d6!}}              Exploding d6
  {{dice:2d8+5}}             Roll 2d8, add 5
  {{dice:1d4*tableName}}     Roll 1d4, roll that many times on table

MATH EXPRESSIONS
  {{math:$a + $b}}           Add two variables
  {{math:$a - $b}}           Subtract variables
  {{math:$a * $b}}           Multiply variables
  {{math:$a / $b}}           Integer division (rounds toward zero)
  {{math:($a + $b) * 2}}     Grouping with parentheses
  {{math:dice:2d6 + $mod}}   Inline dice with variable
  {{math:@hd * 4 + 10}}      Using placeholders

VARIABLES & PLACEHOLDERS
  {{$variableName}}          Static or shared variable
  {{$alias.variableName}}    Variable from imported file
  {{@placeholder.property}}  Placeholder property

ROLL CAPTURE
  {{3*table >> $var}}        Capture 3 rolls into $var
  {{3*unique*table >> $var}} Capture 3 unique rolls
  {{$n*table >> $var}}       Variable count capture
  {{dice:1d4*table >> $var}} Dice count capture
  {{3*table >> $var|silent}} Capture without output
  {{3*table >> $var|", "}}   Capture with custom separator

CAPTURE ACCESS
  {{$var}}                   All values (comma-separated)
  {{$var|"; "}}              All values (custom separator)
  {{$var.count}}             Number of items captured
  {{$var[0]}}                First item's value
  {{$var[-1]}}               Last item's value
  {{$var[0].@prop}}          First item's @prop from sets

PROPERTY AGGREGATION
  {{collect:$var.value}}     All values
  {{collect:$var.@prop}}     All @prop values
  {{collect:$var.@prop|", "}} Custom separator
  {{collect:$var.@prop|unique}} Deduplicated
  {{collect:$var.@prop|unique|", "}} Deduplicated with separator

SHARED BLOCK
  "shared": {
    "count": "{{dice:2d4}}",
    "total": "{{math:$count + 5}}",
    "damage": "{{math:dice:1d8 + $strMod}}"
  }

IMPORTS
  imports: [
    { "path": "./file.json", "alias": "name" }
  ]
  {{name.tableId}}           Reference imported table

RANGES (in entries)
  "range": [1, 50]           Equivalent to weight 50
  "range": [51, 75]          Equivalent to weight 25
  "range": [99, 100]         Equivalent to weight 2

RESULTTYPE
  "resultType": "creature"   On tables, entries, templates
  Case-insensitive, user-definable
  Entry → Table → Composite (precedence)
  Template resultType overrides all

INHERITANCE
  "extends": "parentTable"   Single-level
  "extends": "alias.table"   Cross-file
  Multi-level supported (A→B→C)
  Property-level merging
  Null removes inherited property

ASSETS (in entries)
  "assets": {
    "image": "path/to/image.png",
    "token": "path/to/token.webp"
  }

WEIGHT SPECIAL VALUES
  "weight": 0                Disables entry (won't be rolled)
  "weight": 1                Default weight

TAGS (on any object)
  "tags": ["category", "subcategory", "keyword"]

MARKDOWN (in value fields)
  **bold**                   Bold text
  *italic* or _italic_       Italic text
  `code`                     Inline code
  [text](url)                Hyperlink

ESCAPING
  \{{                        Literal {{
  \}}                        Literal }}
  \"                         Literal " in separator
```

---

## Appendix B: TTRPG Math Expression Patterns

Common math expression patterns for tabletop RPG generators:

### Character Statistics

```json
"shared": {
  "strength": "{{dice:4d6k3}}",
  "strMod": "{{math:($strength - 10) / 2}}",
  "proficiencyBonus": "{{math:($level - 1) / 4 + 2}}",
  "attackBonus": "{{math:$proficiencyBonus + $strMod}}"
}
```

### Combat Calculations

```json
"shared": {
  "baseDamage": "{{math:dice:1d8 + $strMod}}",
  "critDamage": "{{math:dice:2d8 + $strMod}}",
  "armorClass": "{{math:10 + $dexMod + @armor.bonus}}",
  "initiative": "{{math:dice:1d20 + $dexMod}}"
}
```

### Encounter Scaling

```json
"shared": {
  "partyLevel": "{{$inputLevel}}",
  "enemyCount": "{{math:$partySize + dice:1d4 - 2}}",
  "bossHP": "{{math:$partyLevel * 15 + dice:4d10}}",
  "xpReward": "{{math:$enemyCount * 50 * $partyLevel}}"
}
```

### Treasure and Economy

```json
"shared": {
  "baseGold": "{{math:dice:2d6 * 10}}",
  "levelMultiplier": "{{math:$dungeonLevel * $dungeonLevel}}",
  "totalGold": "{{math:$baseGold * $levelMultiplier}}",
  "gemValue": "{{math:dice:1d6 * 50 + 25}}"
}
```

### Template Usage Examples

```json
{
  "pattern": "The {{creatureType}} attacks with a {{math:dice:1d20 + $attackBonus}} to hit, dealing {{math:dice:$damageDice + $strMod}} damage on a hit."
}
```

```json
{
  "pattern": "You find a chest containing {{math:$baseGold + dice:3d6}} gold pieces and {{$gemCount*gems|\", \"}}."
}
```

### Entry Value Examples

```json
{
  "value": "A band of {{math:dice:2d4 + $partySize}} goblins",
  "sets": {
    "count": "{{math:dice:2d4 + $partySize}}",
    "totalXP": "{{math:@count * 50}}"
  }
}
```

---

## Appendix C: Default ResultTypes

The following resultType values are recommended as a common vocabulary:

```
creature    - Monsters, animals, beings
npc         - Non-player characters  
faction     - Organizations, groups
item        - Equipment, objects
loot        - Treasure packages
location    - Places, areas
encounter   - Combat/exploration events
event       - Occurrences, happenings
hook        - Plot hooks, adventure seeds
complication - Obstacles, problems
name        - Names for anything
trait       - Characteristics, features
effect      - Spell effects, conditions
environment - Weather, terrain
ability     - Skills, powers
description - Narrative text
rumor       - Information, lore
dialogue    - Speech, conversation
statistic   - Numbers, metrics
number      - Pure numeric output
currency    - Money, values
time        - Durations, timestamps
weather     - Weather conditions
```

Custom types should use namespace conventions: `"publisher/category/type"`

---

## License

This specification is released under the **CC0 1.0 Universal** (Public Domain) license.

You are free to:
- **Use** — Copy, modify, and distribute this specification
- **Build** — Create your own implementations, tools, or engines
- **Share** — Include this specification in your own projects

No attribution required, though it's always appreciated.

[View Full License](https://creativecommons.org/publicdomain/zero/1.0/)

### Content Ownership Notice

**Important:** While this specification format is public domain, the creative content within files conforming to this specification remains the intellectual property of its respective copyright holders.

- The open nature of this format **does not** grant any license to use, copy, or distribute the content contained within individual table files
- Publishers and content creators retain full copyright over their tables, entries, descriptions, and other creative works
- Always check the `source` and `rights` metadata fields to understand usage permissions for specific content
- When in doubt, contact the content's copyright holder for licensing information

This specification provides standardized fields (`rights`, `source.copyright`, `permissions`) specifically to help content creators communicate their ownership and terms clearly.

---

## Source Code

The Rolldeo application is open source under the **Apache License 2.0**.

- **GitHub Repository**: [https://github.com/RolldeoDev/rolldeo](https://github.com/RolldeoDev/rolldeo)
- **Report Issues**: [https://github.com/RolldeoDev/rolldeo/issues](https://github.com/RolldeoDev/rolldeo/issues)
- **Official Website**: [https://rolldeo.com](https://rolldeo.com)

---
