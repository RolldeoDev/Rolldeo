# Syntax Quick Reference

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

## Shared Block

```json
"shared": {
  "count": "{{dice:2d4}}",
  "total": "{{math:$count + 5}}",
  "damage": "{{math:dice:1d8 + $strMod}}"
}
```

## Capture-Aware Shared Variables

Keys starting with `$` capture sets for property access:

```json
"shared": {
  "$hero": "{{race}}",
  "$enemy": "{{race}}"
}
```

| Syntax | Description |
|--------|-------------|
| `"$varName": "{{table}}"` | Define capture-aware variable |
| `{{$varName}}` | Access captured value |
| `{{$varName.@property}}` | Access captured set property |

Property access with dynamic table resolution:
- If property value is a table ID, it's rolled automatically
- If property value is a template ID, it's evaluated automatically
- Otherwise, the raw string value is returned

## Imports

```json
"imports": [
  { "path": "./file.json", "alias": "name" }
]
```

Reference with: `{{name.tableId}}`

## Entry Options

### Ranges
| Syntax | Description |
|--------|-------------|
| `"range": [1, 50]` | Equivalent to weight 50 |
| `"range": [51, 75]` | Equivalent to weight 25 |
| `"range": [99, 100]` | Equivalent to weight 2 |

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
- `null` removes inherited property

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
