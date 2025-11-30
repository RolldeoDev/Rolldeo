# Rolldeo

*A tool for creating, sharing, and rolling on random tables for TTRPGs*

---

## The Story

When I first got into tabletop RPGs over a decade ago, I was enchanted by random tables. Using pen-and-paper procedural generation sparked something in me. The further into the hobby I went, the more fun random tables I discovered. As a GM, they became a constant source of inspiration and dopamine—each roll delivering delightful surprises.

During the 2020 shift to online play, I found myself relying more on digital tools. I loved rolling on my tables, but with materials increasingly locked in PDFs, I wished for something that could load them up and let me roll more easily. My favorite was "Worlds Without Number" - a few quick template rolls could spin up a unique town, quest, or landmark.

I've been a software engineer for nearly twenty years. I knew building a program to randomly combine table entries was trivial. But I didn't want to just build something for myself—I wanted a tool where I could share my tables with others and receive theirs in return.

So when I needed to experiment with AI code generation for my job, what better project than Rolldeo?

---

## What is Rolldeo?

Rolldeo is two things:

1. **A Progressive Web App** for creating, managing, and rolling on random tables. It works offline, can be installed on any device, and keeps your collections stored locally.

2. **An open specification** for defining random tables in JSON. The format supports everything from simple weighted lists to complex multi-table generators with dice expressions, templates, variables, and conditional logic.

---

## Try It Online

**[rolldeo.com](https://rolldeo.com)** — See Rolldeo in action. No installation required.

---

## Features

### The Roller
Browse your collections, select tables or templates, and roll with a click or keyboard shortcut. Results are formatted with full dice breakdowns, and your roll history is preserved with the ability to pin favorites.

### The Library
Import and export collections as JSON files (or ZIP archives for multiple files). Manage your tables, browse by tags, and delete what you no longer need.

### The Editor
Edit collections with a visual interface or dive into the raw JSON with Monaco Editor. Real-time schema validation catches errors as you type. Drag-and-drop reordering, insert helpers for dice and table references, and live pattern preview for templates.

### Offline PWA
Install Rolldeo as a standalone app on desktop or mobile. Everything runs locally—no server required, no internet needed after the first load.

---

## The Specification

The Random Table JSON Specification v1.0 supports:

- **Dice expressions**: `{{dice:3d6}}`, `{{dice:4d6k3}}` (keep highest), `{{dice:1d6!}}` (exploding)
- **Table references**: `{{treasureTable}}`, `{{3*unique*items}}`
- **Templates**: Combine multiple tables into cohesive outputs
- **Variables**: Define shared values that stay consistent across a generation
- **Conditionals**: Apply logic after generation based on rolled results
- **Imports**: Split large collections across multiple files

The Specification and Schema are licensed under **CC0** (public domain) to encourage maximum adoption and sharing.

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/RolldeoDev/rolldeo.git
cd rolldeo

# Install dependencies
npm install

# Start development server
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

### Other Commands

```bash
npm run build    # Build for production
npm run preview  # Preview production build
npm run test     # Run tests
npm run lint     # Check code style
```

---

## Example

Here's a simple random table collection:

```json
{
  "metadata": {
    "name": "Tavern Generator",
    "namespace": "example.tavern",
    "version": "1.0.0",
    "specVersion": "1.0",
    "description": "Generate random tavern details"
  },
  "tables": [
    {
      "id": "tavernName",
      "name": "Tavern Name",
      "type": "simple",
      "entries": [
        { "value": "The {{adjective}} {{noun}}" }
      ]
    },
    {
      "id": "adjective",
      "name": "Adjective",
      "type": "simple",
      "entries": [
        { "value": "Golden", "weight": 2 },
        { "value": "Rusty" },
        { "value": "Prancing" },
        { "value": "Sleeping" }
      ]
    },
    {
      "id": "noun",
      "name": "Noun",
      "type": "simple",
      "entries": [
        { "value": "Dragon" },
        { "value": "Griffin" },
        { "value": "Tankard" },
        { "value": "Sword" }
      ]
    }
  ],
  "templates": [
    {
      "id": "fullTavern",
      "name": "Full Tavern",
      "pattern": "**{{tavernName}}**\n\nSeating for {{dice:2d6*10}} patrons."
    }
  ]
}
```

---

## Documentation

- [Quickstart Guide](docs/Quickstart.md) — Create your first table in 10 minutes
- [Full Specification](docs/randomTableSpecV1.md) — Complete reference for all features
- [Using Rolldeo](docs/UsingRolldeo.md) — Guide to all application features
- [JSON Schema](docs/randomTableSchemaV1.json) — For editor validation and tooling

---

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast builds and HMR
- **TailwindCSS** for styling
- **Zustand** for state management
- **Monaco Editor** for JSON editing
- **PWA** with offline support via Workbox

---

## Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`npm run test && npm run lint`)
5. Commit with a clear message
6. Push to your fork and open a Pull Request

Please keep PRs focused on a single change and include a clear description of what and why.

---

## License

**Application Code**: [Apache License 2.0](LICENSE)

**Specification & Schema** (`docs/randomTableSpecV1.md`, `docs/randomTableSchemaV1.json`): [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) — Public Domain

---

The goal is to share this tool with everyone and let everyone enjoy the rush of a random table roll.
