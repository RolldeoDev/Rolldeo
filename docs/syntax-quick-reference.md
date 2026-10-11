# Syntax Quick Reference

This reference follows Rolldeo's supported local v1.0 profile. New namespaces use at least two dot-separated segments; legacy single-segment namespaces remain readable with a warning. `tables` is required and may be empty for template-only or static-variable collections.

## Table References

| Syntax | Description |
|--------|-------------|
| `{{tableName}}` | Roll once on table |
| `{{alias.tableName}}` | Roll on table from imported file |
| `{{namespace.tableName}}` | Roll on namespaced table |
| `{{3*tableName}}` | Roll 3 times |
| `{{3*unique*tableName}}` | Roll 3 times, no duplicates |
| `{{3*tableName\|", "}}` | Roll 3 times, custom separator |
| `{{tableName#instance}}` | Named instance |
| `{{$count*tableName}}` | Use shared variable as count |

Unqualified references resolve locally. Declared aliases are authoritative; otherwise qualified references use the longest exact namespace prefix. Duplicate exact namespaces error rather than choosing by load order.

## Roll Again

*In entry values only*

| Syntax | Description |
|--------|-------------|
| `{{again}}` | Roll once more on this table |
| `{{2*again}}` | Roll 2 more times |
| `{{2*unique*again}}` | Roll 2 more times, no duplicates |
| `{{dice:1d4*again}}` | Roll 1d4 times on this table |
| `{{2*again\|" and "}}` | Roll 2 more times with custom separator |
| `{{2*unique*again\|"; "}}` | Roll 2 unique with custom separator |

## Dice

| Syntax | Description |
|--------|-------------|
| `{{dice:3d6}}` | Roll 3d6 |
| `{{dice:4d6k3}}` | Roll 4d6, keep highest 3 |
| `{{dice:2d6kl1}}` | Roll 2d6, keep lowest 1 |
| `{{dice:1d6!}}` | Exploding d6 |
| `{{dice:2d8+5}}` | Roll 2d8, add 5 |
| `{{dice:1d4*tableName}}` | Roll 1d4, roll that many times on table |

## Math Expressions

| Syntax | Description |
|--------|-------------|
| `{{math:$a + $b}}` | Add two variables |
| `{{math:$a - $b}}` | Subtract variables |
| `{{math:$a * $b}}` | Multiply variables |
| `{{math:$a / $b}}` | Integer division (rounds toward zero) |
| `{{math:($a + $b) * 2}}` | Grouping with parentheses |
| `{{math:dice:2d6 + $mod}}` | Inline dice with variable |
| `{{math:@hd * 4 + 10}}` | Using placeholders |

## Variables & Placeholders

| Syntax | Description |
|--------|-------------|
| `{{$variableName}}` | Static or shared variable |
| `{{$alias.variableName}}` | Variable from imported file |
| `{{@placeholder.property}}` | Placeholder property |
| `{{@self.description}}` | Current entry's description |
| `{{@self.value}}` | Current entry's raw value string |

## Roll Capture

| Syntax | Description |
|--------|-------------|
| `{{3*table >> $var}}` | Capture 3 rolls into $var |
| `{{3*unique*table >> $var}}` | Capture 3 unique rolls |
| `{{$n*table >> $var}}` | Variable count capture |
| `{{dice:1d4*table >> $var}}` | Dice count capture |
| `{{3*table >> $var\|silent}}` | Capture without output |
| `{{3*table >> $var\|", "}}` | Capture with custom separator |

## Capture Access

| Syntax | Description |
|--------|-------------|
| `{{$var}}` | All values (comma-separated) |
| `{{$var\|"; "}}` | All values (custom separator) |
| `{{$var.count}}` | Number of items captured |
| `{{$var[0]}}` | First item's value |
| `{{$var[-1]}}` | Last item's value |
| `{{$var[0].@prop}}` | First item's @prop from sets |

## Property Aggregation

| Syntax | Description |
|--------|-------------|
| `{{collect:$var.value}}` | All values |
| `{{collect:$var.@prop}}` | All @prop values |
| `{{collect:$var.@prop\|", "}}` | Custom separator |
| `{{collect:$var.@prop\|unique}}` | Deduplicated |
| `{{collect:$var.@prop\|unique\|", "}}` | Deduplicated with separator |

## Switch Expressions

Inline conditional value selection with `switch[condition:result]` syntax.

### Standalone Switch

| Syntax | Description |
|--------|-------------|
| `{{switch[cond:result].else[fallback]}}` | Single condition with fallback |
| `{{switch[c1:r1].switch[c2:r2].else[fb]}}` | Multiple conditions (first match wins) |
| `{{switch[cond:result]}}` | No fallback (returns empty if no match) |

### Attached Switch

Apply switch to transform any expression result. Use `$` to reference the base result.

| Syntax | Description |
|--------|-------------|
| `{{dice:1d20.switch[$>=10:"hit"].else["miss"]}}` | Transform dice result |
| `{{mood.switch[$=="angry":"rage"].else["calm"]}}` | Transform table result |
| `{{$var.switch[$=="a":"A"].else[$var]}}` | Transform variable (returns base if no match) |

### Result Types

| Type | Example |
|------|---------|
| String literal | `"he"`, `"Critical Hit!"` |
| Interpolated string | `", glowing {{$color}} light"` |
| Capture property | `$race.@maleName` |
| Table reference | `{{spellBook}}` |
| Placeholder | `@creature.type` |

**Note:** Quoted strings containing `{{}}` are interpolated (like template literals).

### Condition Operators

| Operator | Description |
|----------|-------------|
| `==`, `!=` | Equality/inequality |
| `>`, `<`, `>=`, `<=` | Numeric comparison |
| `contains` | Substring match (case-insensitive) |
| `matches` | Case-insensitive RE2-compatible regex search |
| `&&`, `\|\|`, `!` | Logical AND, OR, NOT |
| `()` | Grouping |

Precedence: comparison/value atoms, then `!`, `&&`, `||`; parentheses override. Quoted `""`, `"001"`, `"$name"` and `"@name"` remain literal strings. Bare full numeric tokens become numbers; digit-prefixed text stays text. Escape matching quotes/backslashes, preserving other backslashes for regex. Equality is case-sensitive; `contains`/`matches` are case-insensitive. Malformed conditions and invalid/unsupported RE2 regex evaluate to false. Lookarounds/backreferences are unsupported; patterns over 1024 units or inputs over 100000 units throw, and matches consume the shared work budget. Root `conditionals` is unsupported; place inline switches where text should appear.

### Examples

```
{{switch[$gender=="male":"he"].switch[$gender=="female":"she"].else["they"]}}

{{dice:1d20.switch[$>=20:"Critical!"].switch[$>=10:"Hit"].else["Miss"]}}

{{switch[$gender=="male":$race.@maleName].else[$race.@femaleName]}}

{{switch[$class=="wizard" && $level>=5:{{powerSpell}}].else[{{basicSpell}}]}}
```

Static `variables` store literal strings without evaluating pattern syntax. Use `shared` for generation-time expressions. Shared declarations evaluate in order; never sort their keys or forward-reference later values.

## Shared Block

```json
"shared": {
  "count": "{{dice:2d4}}",
  "total": "{{math:$count + 5}}",
  "damage": "{{math:dice:1d8 + $strMod}}"
}
```

## Shared Variables with Property Access

Variables capture sets for property access:

```json
"shared": {
  "hero": "{{race}}",
  "enemy": "{{race}}"
}
```

| Syntax | Description |
|--------|-------------|
| `"varName": "{{table}}"` | Define shared variable |
| `{{$varName}}` | Access captured value |
| `{{$varName.@property}}` | Access captured set property |

Property access with dynamic table resolution:

- Bare IDs are literal text. Wrap a table/template reference in `{{...}}` to evaluate it.
- Plain table references preserve captured sets; mixed text/property projections use scalar output.

## Imports

```json
"imports": [
  { "path": "./file.json", "alias": "name" }
]
```

Reference with: `{{name.tableId}}`. Supply dependencies in a JSON selection or ZIP bundle. Relative paths are normalized from the importing file; persisted alias bindings preserve target identities through edits and export. The engine does not fetch HTTPS imports. Inspect linking diagnostics for missing/ambiguous dependencies (`IMPORT_ERROR`) and cycles (`IMPORT_CYCLE`); using an unresolved table reference throws `REFERENCE_ERROR`.

## Entry Options

### Ranges
| Syntax | Description |
|--------|-------------|
| `"range": [1, 50]` | Equivalent to weight 50 |
| `"range": [51, 75]` | Equivalent to weight 25 |
| `"range": [99, 100]` | Equivalent to weight 2 |

Ranges use inclusive widths as relative weights. Gaps add no empty outcome; overlapping endpoints do not select multiple entries.

### Weights
| Syntax | Description |
|--------|-------------|
| `"weight": 0` | Disables entry (won't be rolled) |
| `"weight": 1` | Default weight |

### Assets
```json
"assets": {
  "image": "path/to/image.png",
  "token": "path/to/token.webp"
}
```

### Tags
```json
"tags": ["category", "subcategory", "keyword"]
```

## Result Type

| Property | Description |
|----------|-------------|
| `"resultType": "creature"` | On tables, entries, templates |

- Case-insensitive, user-definable
- Precedence: Entry > Table > Composite
- Template resultType overrides all

## Inheritance

| Syntax | Description |
|--------|-------------|
| `"extends": "parentTable"` | Single-level inheritance |
| `"extends": "alias.table"` | Cross-file inheritance |

- Multi-level supported (A > B > C)
- Property-level merging
- Only simple tables extend simple ancestors.
- In an existing inherited entry override, `null` removes optional properties or individual `sets`/`assets` keys; `value` cannot be deleted.

## Markdown in Values

| Syntax | Description |
|--------|-------------|
| `**bold**` | Bold text |
| `*italic*` or `_italic_` | Italic text |
| `` `code` `` | Inline code |
| `[text](url)` | Hyperlink |

## Escaping

| Syntax | Description |
|--------|-------------|
| `\{{` | Literal {{ |
| `\}}` | Literal }} |
| `\"` | Literal " in separator |

Invocation shared scopes inherit caller values, close on return, and evaluate independently for siblings. Selected collection-source shared values resolve in the source collection. Unique draws track qualified source outcomes per invoked table for the generation; `stop` returns available items, `cycle` refills that table's tracker, and `error` throws on exhaustion. Equal text from separate source entries is still distinct.

Dice modifiers run in this order: append exploding faces, keep high/low from all individual faces, sum, apply numeric modifier. With faces `[6, 4]`, `1d6kh1!` returns `6`. `maxExplodingDice` accepts `0`–`1000`.

Conditions support the same reference paths as interpolation, including `$items.count`, `$items[0].@hp`, deep captured properties and qualified static variables. Separators decode `\"` as a quote and `\\` as one backslash; other backslash sequences remain literal. Apply JSON escaping separately.


## Specification 1.1 Additions

Set `metadata.specVersion` to `"1.1"` for these fields. Existing 1.0 files remain valid with their original behavior.

- Source dice: `"selection": { "mode": "dice", "dice": "2d6" }` on a simple table; complete non-overlapping ranges are total lookups, not width weights. Fixed integer modifiers supported; unique/exclusions and collection pooling are unsupported.
- Inputs: root `inputs` declarations use `text`, `integer`, `choice` or `boolean`, optional defaults and `required`; integer bounds and choice options validated. Access with `{{$name}}`; supplied strings are literal.
- Conversion: table `conversion.kind` is `transcription`, `adaptation`, or `original`; optional `sourceText`/`notes` retain evidence. `reviewedContent`/`reviewedAt` record an explicit human check; edits invalidate the snapshot.
- Positive D&D ability modifier: `{{math:$abilityScore / 2 - 5}}`. Division continues to truncate toward zero.

See [the v1.1 contract](./randomTableSpecV1_1.md) and use the matching `random-table-spec-v1.1.json` schema.
