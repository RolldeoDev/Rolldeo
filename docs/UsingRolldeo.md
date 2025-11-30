# Using Rolldeo

A complete guide to all the features in Rolldeo - your random table companion.

---

## Overview

Rolldeo is a web application for creating, managing, and rolling on random tables. Whether you're a game master generating encounters, a writer seeking inspiration, or a developer building procedural content, Rolldeo provides the tools you need.

### Key Features

- **Library**: Browse, import, and manage your table collections
- **Roller**: Roll on tables with full history and result tracking
- **Editor**: Create and edit collections with real-time validation
- **Offline Support**: Works without an internet connection (PWA)

---

## The Library

The Library is your central hub for managing table collections.

### Browsing Collections

When you open the Library, you'll see all available collections organized into:

- **Built-in Collections**: Pre-loaded example tables to get you started
- **Your Collections**: Tables you've created or imported

Each collection card shows:
- Collection name and description
- Number of tables and templates
- Tags for quick filtering

### Importing Collections

You can import table collections in several ways:

1. **Drag and Drop**: Drop `.json` files or `.zip` archives directly onto the upload area
2. **Click to Browse**: Click the upload area to select files from your computer
3. **Multiple Files**: Import several collections at once from a zip archive

**Supported formats:**
- Single `.json` files following the Random Table Spec
- `.zip` archives containing multiple JSON files

### Managing Collections

- **View**: Click a collection to see its tables and templates
- **Edit**: Click the edit button to modify a collection
- **Delete**: Remove collections you no longer need (built-in collections cannot be deleted)
- **Export**: Download any collection as a JSON file

---

## The Roller

The Roller is where you generate random results from your tables.

### Selecting a Table

1. Use the left panel to browse available tables
2. Collections are grouped and expandable
3. Click any table to select it for rolling
4. Templates appear in a separate section

### Rolling

Once you've selected a table:

1. Click the **Roll** button (or press `Enter`)
2. The result appears in the main panel
3. Each roll is added to your history

### Understanding Results

Results can include:
- **Plain text**: Simple string results
- **Dice expressions**: Automatically rolled (e.g., "2d6" becomes "7")
- **Nested table references**: Results from other tables
- **Formatted text**: Bold, italic, and other markdown formatting

### Roll History

Your roll history is preserved during your session:

- See all previous results with timestamps
- Results are color-coded by source table
- Click any history item to see full details
- Clear history with the trash button

### Favorites

Mark frequently-used tables as favorites:

1. Click the star icon next to any table
2. Favorites appear at the top of the table list
3. Quickly access your most-used tables

---

## The Editor

Create and modify table collections with the visual editor.

### Creating a New Collection

1. Click **Editor** in the navigation
2. You start with a blank collection template
3. Fill in the metadata (name, namespace, version)
4. Add tables, templates, and more

### Editor Tabs

The editor is organized into tabs:

| Tab | Purpose |
|-----|---------|
| **Metadata** | Collection info and imports |
| **Tables** | Define your random tables |
| **Templates** | Create complex output patterns |
| **Variables** | Set static and shared variables |
| **JSON** | View and edit raw JSON |

### Working with Tables

#### Creating Tables

1. Go to the **Tables** tab
2. Click **Add Table**
3. Choose a table type (Simple is most common)
4. Fill in the table details

#### Table Types

- **Simple**: Basic weighted entries
- **Composite**: Combines entries from multiple sources
- **Collection**: Groups entries from imported files

#### Adding Entries

Each entry can have:
- **Value**: The result text (supports `{{expressions}}`)
- **Weight**: How likely this entry is to be selected
- **Range**: Alternative to weight for d100-style tables
- **Description**: Optional notes about the entry
- **Tags**: Categorization labels

#### Drag and Drop

Reorder entries by dragging:
1. Grab the drag handle (⋮⋮) on any entry
2. Drag to the new position
3. Release to drop

### Working with Templates

Templates combine multiple tables into complex outputs.

#### Creating Templates

1. Go to the **Templates** tab
2. Click **Add Template**
3. Write your pattern using `{{tableName}}` syntax

#### Pattern Syntax

Use these expressions in your patterns:

| Syntax | Description |
|--------|-------------|
| `{{tableName}}` | Roll on a table |
| `{{dice:2d6}}` | Roll dice |
| `{{math:1+2}}` | Calculate math |
| `{{$variable}}` | Use a variable |
| `{{3*tableName}}` | Roll multiple times |
| `{{3*table >> $var}}` | Capture rolls into variable |
| `{{$var[0]}}` | Access first captured item |
| `{{$var[0].@prop}}` | Access captured item's property |
| `{{collect:$var.@prop}}` | Aggregate property from all captured items |

#### Insert Helper

Use the **Insert** dropdown to easily add references:
1. Click the dropdown next to the pattern field
2. Search for tables or templates
3. Click to insert at cursor position

#### Live Preview

The pattern preview shows:
- **Pattern**: Your raw template with syntax highlighting
- **Result**: A sample evaluation (click **Re-roll** to regenerate)

### JSON View

The JSON tab provides direct access to the collection data:

- **Syntax Highlighting**: Color-coded JSON
- **Schema Validation**: Real-time error checking
- **Format**: Auto-formats on paste
- **Sync**: Changes sync with visual editors

### Saving and Exporting

- **Save**: Press `Ctrl+S` or click **Save** to store your collection
- **Export**: Download as a `.json` file for sharing or backup
- **Unsaved Changes**: A warning appears if you try to leave with unsaved changes

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / `Cmd+S` | Save (in Editor) |
| `Enter` | Roll (in Roller) |
| `Escape` | Close dialogs |

---

## Tips & Tricks

### For Game Masters

1. **Create themed sets**: Organize tables by campaign or setting
2. **Use templates**: Build encounter generators that combine multiple tables
3. **Leverage variables**: Keep values consistent across rolls (e.g., enemy count)

### For Developers

1. **Use the JSON schema**: Import it into your IDE for autocomplete
2. **Validate before import**: The editor catches errors in real-time
3. **Export and version**: Download collections regularly for backup

### For Writers

1. **Build prompt generators**: Combine character, setting, and conflict tables
2. **Create name generators**: Use weighted entries for cultural distributions
3. **Chain tables**: Reference one table from another for complex results

---

## Troubleshooting

### Import Errors

If a file fails to import:
- Check that it's valid JSON (use a JSON validator)
- Ensure it follows the Random Table Spec
- Look for missing required fields (metadata, tables)

### Roll Errors

If a roll fails:
- Check for circular references (Table A → Table B → Table A)
- Verify table IDs match exactly (case-sensitive)
- Look for typos in `{{expressions}}`

### Editor Issues

If the editor behaves unexpectedly:
- Try switching to JSON view and back
- Check the validation errors panel
- Refresh the page if needed (changes save automatically)

---

## Getting Help

- **Quickstart Guide**: Learn the basics in 10 minutes
- **Full Specification**: Complete reference documentation
- **Schema Reference**: JSON validation schema
- **Report Issues**: [GitHub Issues](https://github.com/anthropics/claude-code/issues)

Happy rolling! 🎲
