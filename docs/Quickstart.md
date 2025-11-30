# Random Table Quickstart Guide

Get up and running with random tables in under 10 minutes.

---

## Your First Table

Every random table file needs two things: **metadata** (information about the file) and at least one **table**. Here's the simplest possible example:

```json
{
  "metadata": {
    "name": "My First Table",
    "namespace": "myproject.demo",
    "version": "1.0.0",
    "specVersion": "1.0"
  },
  "tables": [
    {
      "id": "loot",
      "name": "What's in the Chest?",
      "type": "simple",
      "entries": [
        { "value": "Gold coins" },
        { "value": "A rusty dagger" },
        { "value": "Empty!" },
        { "value": "A rolled-up map" }
      ]
    }
  ]
}
```

Save this as a `.json` file and load it into your roller engine. Each entry has an equal chance of being selected (25% each).

---

## Adding Weights

Want some results to appear more often? Add `weight` to your entries:

```json
"entries": [
  { "value": "Gold coins", "weight": 4 },
  { "value": "A rusty dagger", "weight": 2 },
  { "value": "Empty!", "weight": 3 },
  { "value": "A rolled-up map", "weight": 1 }
]
```

Higher weight = more likely. In this example:
- Gold coins: 40% (4 out of 10)
- Empty: 30% (3 out of 10)  
- Rusty dagger: 20% (2 out of 10)
- Map: 10% (1 out of 10)

**Tip:** If you don't specify a weight, it defaults to 1.

---

## Rolling Dice

Use `{{dice:XdY}}` to roll dice inside your results:

```json
{ "value": "{{dice:2d6*10}} gold pieces" }
```

This rolls 2d6 and multiplies by 10, giving you results like "70 gold pieces" or "120 gold pieces".

**Common dice patterns:**

| Syntax | What it does |
|--------|--------------|
| `{{dice:1d20}}` | Roll a d20 |
| `{{dice:3d6}}` | Roll 3d6 |
| `{{dice:2d6+5}}` | Roll 2d6, add 5 |
| `{{dice:4d6k3}}` | Roll 4d6, keep highest 3 |
| `{{dice:1d6!}}` | Exploding d6 (6s roll again) |

---

## Referencing Other Tables

Tables can reference each other using `{{tableName}}`:

```json
{
  "tables": [
    {
      "id": "treasure",
      "name": "Treasure",
      "type": "simple",
      "entries": [
        { "value": "A {{weaponType}} worth {{dice:2d6*10}} gold" },
        { "value": "{{dice:3d6}} gems" },
        { "value": "Nothing valuable" }
      ]
    },
    {
      "id": "weaponType",
      "name": "Weapon Type",
      "type": "simple",
      "entries": [
        { "value": "sword" },
        { "value": "axe" },
        { "value": "spear" }
      ]
    }
  ]
}
```

Rolling on "treasure" might give you: "A sword worth 80 gold"

---

## Multiple Rolls

Need multiple results from the same table? Use `{{N*tableName}}`:

```json
{ "value": "You find: {{3*itemTable}}" }
```

This rolls three times on `itemTable`, giving results like: "You find: gold ring, silver bracelet, emerald"

**Want unique results?** Add `unique`:

```json
{ "value": "{{3*unique*itemTable}}" }
```

This ensures no duplicates.

**Custom separators:**

```json
{ "value": "{{3*itemTable|\" and \"}}" }
```

Result: "gold ring and silver bracelet and emerald"

---

## Using Ranges (d100 Tables)

If you're converting traditional tables with ranges like "01-30: Goblin", use the `range` property:

```json
"entries": [
  { "value": "Goblin", "range": [1, 30] },
  { "value": "Orc", "range": [31, 60] },
  { "value": "Troll", "range": [61, 85] },
  { "value": "Dragon!", "range": [86, 100] }
]
```

The engine automatically converts ranges to weights—you don't need to do any math.

---

## Templates: Combining Multiple Tables

Templates let you create complex outputs that pull from multiple tables:

```json
{
  "templates": [
    {
      "id": "npcDescription",
      "name": "NPC Generator",
      "pattern": "A {{npcRace}} {{npcOccupation}} with {{npcTrait}} and {{npcTrait}}."
    }
  ]
}
```

Result: "A dwarf blacksmith with a loud laugh and a missing finger."

---

## Variables: Reusing Values

Sometimes you need the same random value to appear multiple times. Use the `shared` block:

```json
{
  "shared": {
    "creatureCount": "{{dice:2d4}}"
  },
  "templates": [
    {
      "id": "encounter",
      "pattern": "You see {{$creatureCount}} goblins. If you fight, you'll face all {{$creatureCount}} of them."
    }
  ]
}
```

The `$` prefix references a variable. The dice are rolled once when generation starts, then that value is used everywhere.

---

## Quick Reference

| What you want | Syntax |
|---------------|--------|
| Roll on a table | `{{tableName}}` |
| Roll dice | `{{dice:3d6}}` |
| Roll multiple times | `{{3*tableName}}` |
| Unique results | `{{3*unique*tableName}}` |
| Use a variable | `{{$variableName}}` |
| Custom separator | `{{3*tableName\|" and "}}` |

---

## What's Next?

This guide covers the basics. The full specification includes:

- **Imports:** Split tables across multiple files
- **Inheritance:** Create table variations without duplicating entries
- **Conditionals:** Add logic based on rolled results
- **Placeholders:** Pass data between tables dynamically
- **ResultTypes:** Classify outputs for different handling
- **Assets:** Attach images, tokens, and sounds to entries

See the [Random Table JSON Template Specification v1.0](./randomTableSpecV1.md) for complete documentation.

---

## Complete Starter Example

Here's a ready-to-use file you can copy and modify:

```json
{
  "metadata": {
    "name": "Dungeon Loot Tables",
    "namespace": "myproject.loot",
    "version": "1.0.0",
    "specVersion": "1.0",
    "author": "Your Name",
    "description": "Random loot for dungeon exploration"
  },
  "shared": {
    "lootQuality": "{{qualityRoll}}"
  },
  "tables": [
    {
      "id": "qualityRoll",
      "name": "Loot Quality",
      "type": "simple",
      "entries": [
        { "value": "poor", "weight": 3 },
        { "value": "average", "weight": 5 },
        { "value": "good", "weight": 2 }
      ]
    },
    {
      "id": "chestContents",
      "name": "Chest Contents",
      "type": "simple",
      "entries": [
        { "value": "{{dice:2d6*10}} gold pieces", "weight": 4 },
        { "value": "A {{$lootQuality}} {{weaponType}}", "weight": 3 },
        { "value": "{{dice:1d4}} healing potions", "weight": 2 },
        { "value": "**Mimic!** It attacks!", "weight": 1 }
      ]
    },
    {
      "id": "weaponType",
      "name": "Weapon Type",
      "type": "simple",
      "entries": [
        { "value": "longsword" },
        { "value": "battle axe" },
        { "value": "shortbow" },
        { "value": "warhammer" },
        { "value": "dagger" }
      ]
    }
  ],
  "templates": [
    {
      "id": "lootHaul",
      "name": "Complete Loot Description",
      "pattern": "Inside the chest you find: {{2*unique*chestContents|\" and \"}}."
    }
  ]
}
```

**Sample outputs:**
- "Inside the chest you find: 80 gold pieces and A good longsword."
- "Inside the chest you find: 2 healing potions and **Mimic!** It attacks!."
- "Inside the chest you find: A average battle axe and 50 gold pieces."

---

## Example Downloads

Ready to see these concepts in action? Download these comprehensive example packs:

### [fantasyExample.zip](./examples/fantasyExample.zip)

A complete high fantasy toolkit for dungeon crawling adventures:

| File | Description | Features Demonstrated |
|------|-------------|----------------------|
| **Monsters.json** | Creatures from common beasts to legendary dragons | Weights, `sets`, `defaultSets`, `type: collection`, `type: composite`, hidden helper tables, templates |
| **Treasure.json** | Loot including coins, gems, weapons, and magic items | Dice expressions, shared variables, table references, gem quality modifiers, cursed items |
| **Environments.json** | Dungeons, taverns, wilderness, and urban locations | Multiple rolls, unique selections, custom separators, location atmosphere |
| **Encounters.json** | Combat, social, and quest encounters | Imports, composite tables, NPC generation, quest hooks, encounter twists |

### [sciFiExample.zip](./examples/sciFiExample.zip)

A comprehensive sci-fi worldbuilding system for space exploration:

| File | Description | Features Demonstrated |
|------|-------------|----------------------|
| **Aliens.json** | Alien species with physical and cultural traits | `conditionals`, template-level shared variables, capture syntax, species naming |
| **Ships.json** | Starships from fighters to battleships | Ranges (d100 style), `extends` inheritance, ship systems, fleet generation with captures |
| **Planets.json** | Planets with environments, resources, and hazards | Imports, star classification, colonization status, native life, multi-world comparison |
| **Encounters.json** | Space encounters combining all modules | Multiple imports, complex captures, combat/peaceful variants, full scenario generation |

These examples demonstrate **every feature** in the specification, from basic tables to advanced captures and conditionals. Import them, study them, remix them!

---

## Happy Creating!

Whether you're crafting treasure hoards for a fantasy dungeon, generating alien species for a space opera, or building something entirely your own—Rollify is here to help bring randomness and creativity to your games.

Download the examples, experiment with the syntax, and let the dice decide the rest. May your rolls be ever in your favor!
