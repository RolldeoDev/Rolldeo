# Random Table JSON Specification v1.1

Version 1.1 adds source dice selection, generator inputs, and conversion review records to the v1.0 text-generation format. The companion [v1.0 contract](./randomTableSpecV1.md) remains the base language; this document defines the additional fields and their behavior. New collections use `metadata.specVersion: "1.1"`. Existing `"1.0"` documents remain supported without changing their selection or arithmetic semantics.

Use the separate `random-table-spec-v1.1.json` schema for 1.1 documents. The v1.0 schema intentionally rejects the new fields. Changing a collection's `metadata.version` does not change its specification version. Older engines must reject an unsupported specification version rather than silently interpreting a source dice table as weighted data.

## Source Dice Tables

A simple table may declare `selection: { "mode": "dice", "dice": "2d6" }`. The engine rolls those dice and selects the entry whose inclusive `range` contains the total. This preserves the probability distribution of the source dice.

Without `selection`, ranges retain their v1.0 meaning: inclusive widths used as relative weights. A `[7, 7]` entry is weight 1 in a weighted table; in a `2d6` source dice table it has probability 6/36. The application must identify which selection mechanic is in use.

Selection notation accepts `NdM` (or shorthand `dM`) with an optional fixed integer `+N` or `-N` modifier. Whitespace and letter case are normalized. Dice counts are 1–1000; sides, modifiers, and possible totals must remain safe integers. Formula length is at most 256 characters. Selection does not support variable modifiers, exploding dice, keep/drop, or arbitrary expressions. These are rejected rather than approximated. Product-style or digit-concatenated dice charts require deliberate adaptation: `d66` means one 66-sided die in this notation, not two d6 interpreted as tens and units. The broader template dice notation remains available for output calculations.

Each reachable total must match exactly one entry. Every entry requires a range and must be reachable; entry weights are prohibited. Ranges may extend beyond the dice's domain, but coverage and overlaps are checked within the reachable domain. Signed endpoints are allowed for native dice tables in 1.1. Weighted tables continue to require nonnegative endpoints. Missing coverage, ambiguous coverage, invalid formulas, or incompatible entry fields are validation errors.

Ordinary repeated rolls use fresh source dice on each draw. Native dice tables do not support unique draws, reroll exclusions (`again`), or pooling as collection-table sources. These operations reject generation or linked validation rather than altering the source odds. Composite tables may delegate to a native dice table. A simple child inherits its parent's selection unless it supplies a replacement selection declaration; its resolved entry pool must still satisfy the dice coverage rules.

Standalone validation cannot always resolve an inherited or imported entry pool. The engine checks the resolved pool before selection, so a document that passes structural validation may still reject generation because an inherited dice total is uncovered or ambiguous. The editor's source-review panel checks the current resolved table before recording a review.

The roller's execution trace can show the selection dice and selected entry. Probability charts calculate the dice distribution within bounded work limits; if exact calculation is unavailable, the interface says so. It must never substitute range-width probabilities for a native dice table.

## Generator Inputs

The optional root `inputs` object declares named values supplied for a generation. These values are read with ordinary variable syntax (`{{$terrain}}`, `{{$partyLevel}}`). Inputs are separate from static variables and shared rolls. Authors do not need to edit a generator's constants each time its context changes.

An input name starts with a letter and contains only letters, digits, and underscores. Names cannot be reserved words or conflict with the collection's static variables, document shared values, table shared values, or template shared values. Input names do not include a `$` prefix.

All declarations may include `label`, `description`, and `required` (default false). Supported types are:

| Type | Additional fields | Runtime value |
|------|-------------------|---------------|
| `text` | Optional string `default` | String |
| `integer` | Optional integer `default`, `min`, `max` | Safe integer within the declared bounds |
| `choice` | Required nonempty array of distinct string `options`; optional string `default` | One of the options |
| `boolean` | Optional boolean `default` | Boolean |

Declarations and defaults are validated before use. Runtime values use exact types without numeric or boolean string coercion. Unknown supplied keys and invalid values reject generation. A valid default satisfies `required`; a required input with no value or default rejects generation. An optional absent value resolves to the empty string. User strings are always literal, including strings containing `{{dice:1d6}}`; they are not executed as patterns.

Variable lookup in expressions retains the base language's text semantics. A boolean input appears as `"true"` or `"false"`; both are nonempty strings and therefore truthy in a bare switch condition. Test boolean inputs explicitly, for example `{{switch[$night=="true":"night"].else["day"]}}`, so a supplied `false` selects `day`.

The TypeScript API accepts `RollOptions.inputs` on table, template, and raw-pattern generation. Inputs are resolved per generation, without leaking into later rolls. The result's `metadata.inputs` records the resolved values for the entry-point collection. This records context, not a portable random seed or replay guarantee.

Supplied values apply only to the entry-point collection. An imported collection uses its own declared defaults when invoked; a missing required imported input rejects that invocation. Root input values are not automatically forwarded to imported input declarations. Caller shared scope retains its existing precedence rules; author imported generators with distinct names when their local input context must remain independent.

## Converting and Reviewing Source Material

Any table may include a `conversion` record:

| Field | Meaning |
|-------|---------|
| `kind` | Required `transcription`, `adaptation`, or `original` |
| `sourceText` | Optional preserved text used during conversion |
| `notes` | Optional decisions, deviations, or remaining instructions |
| `reviewedContent` | Optional canonical snapshot recorded after explicit human review |
| `reviewedAt` | Optional ISO date/time for that review |

Existing table `source` fields identify the book, page, section, and source URL. Source review records do not replace attribution or establish permission to redistribute content.

`transcription` identifies an intended faithful representation; `adaptation` identifies deliberate changes; `original` identifies newly authored material. These labels are declarations by the author. Neither schema acceptance nor successful generation proves fidelity to a source book.

The import preview retains the pasted source and shows parsed entries, the selection mechanic, coverage diagnostics, and probabilities when available. Authors can correct entries, record source details and decisions, then explicitly acknowledge that they checked text, dice mechanics, and instructions. An import may remain unreviewed, but it must not be displayed as reviewed automatically.

Review status is derived from the recorded snapshot. A missing snapshot means unreviewed; a matching snapshot means reviewed; a mismatch means needs review. There is no independent authoritative `verified: true` flag. Changes to content, order-sensitive shared/sets declarations, selection, source text, or conversion notes invalidate the previous review. A review marker records a human check, not independent certification of correctness.

The application canonicalizes table content for its snapshot, excluding only `reviewedContent` and `reviewedAt`; map key order is normalized except where evaluation order has meaning (`shared`, `sets`, and `defaultSets`). Snapshot matching does not verify external dependencies or the historical book text. Review those separately when references or imported libraries change.

Pasted text conversion supports a bounded set of layouts and mechanics. Unsupported dice headings and ambiguous flattened rows receive explicit diagnostics. OCR, arbitrary page layouts, multi-column procedures, external book references, and whole-book extraction still require manual interpretation. Do not treat a parsed draft as an automatically verified conversion.

## Complete Example

This synthetic example combines a literal 2d6 reaction table with an explicit context input. It is original demonstration material, not a conversion claim about a published supplement.

```json
{
  "metadata": {
    "name": "Reaction Example",
    "namespace": "example.reactions",
    "version": "1.0.0",
    "specVersion": "1.1"
  },
  "inputs": {
    "terrain": {
      "type": "choice",
      "label": "Terrain",
      "options": ["forest", "road", "ruins"],
      "default": "forest"
    },
    "partyLevel": {
      "type": "integer",
      "label": "Party level",
      "min": 1,
      "max": 20,
      "default": 3
    }
  },
  "tables": [
    {
      "id": "reaction",
      "name": "Reaction",
      "type": "simple",
      "selection": { "mode": "dice", "dice": "2d6" },
      "conversion": { "kind": "original", "notes": "Synthetic example; no source review claimed." },
      "entries": [
        { "value": "hostile", "range": [2, 5] },
        { "value": "uncertain", "range": [6, 8] },
        { "value": "friendly", "range": [9, 12] }
      ]
    }
  ],
  "templates": [
    {
      "id": "meeting",
      "name": "Meeting",
      "pattern": "In the {{$terrain}}, a {{reaction}} group meets the level {{$partyLevel}} party."
    }
  ]
}
```

For this table, hostile and friendly each have probability 10/36, and uncertain has probability 16/36. The choices and party level provide context; they do not modify the reaction roll.

## Compatibility and Scope

The 1.1 additions are opt-in. Promoting a collection to 1.1 does not automatically reinterpret existing ranges, execute static variables, change shared ordering, or change integer division. The visual editor promotes a collection when adding source selection, conversion records, or generator inputs. Switching to weighted selection leaves authoring decisions explicit; it does not silently infer replacement ranges or weights.

Arithmetic still truncates division toward zero. For positive D&D ability scores use `{{math:$abilityScore / 2 - 5}}`; dividing the positive score first produces the intended modifier for odd scores below 10 without changing the language's division rule.

The supported implementation remains a local JSON/ZIP text-generation profile. These additions do not define remote retrieval, typed character records, persistent simulation state, universal PDF extraction, or cross-implementation seeded replay.

This specification and its schema are released under CC0, like the v1.0 base contract.

---

# Base Text-Generation Contract (v1.0)

The inherited language is defined in [randomTableSpecV1.md](./randomTableSpecV1.md). The application guide and its download append that base document here. Its v1.0 examples intentionally remain valid for existing collections; for 1.1 documents, the version and additional rules above apply.
