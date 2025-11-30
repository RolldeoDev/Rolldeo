/**
 * SchemaPage
 *
 * JSON Schema reference page with syntax-highlighted schema viewer.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, ExternalLink, FileJson } from 'lucide-react'
import { GuideLayout, DownloadButton } from '@/components/guide'
import schemaJson from '@/../docs/randomTableSchemaV1.json?raw'

// Parse schema for display
const schema = JSON.parse(schemaJson)

// Generate simple markdown content for the schema page
const schemaOverview = `
# JSON Schema Reference

The Random Table JSON Schema provides validation for your table collection files. Use this schema with your IDE or validation tools to ensure your files are correctly formatted.

## Schema Info

- **$schema**: ${schema.$schema}
- **$id**: ${schema.$id || 'N/A'}
- **Title**: ${schema.title || 'Random Table Collection'}

## Using the Schema

### In VS Code

Add this to your \`.vscode/settings.json\`:

\`\`\`json
{
  "json.schemas": [
    {
      "fileMatch": ["*.table.json", "*-tables.json"],
      "url": "./randomTableSchemaV1.json"
    }
  ]
}
\`\`\`

### In JSON Files

Add a \`$schema\` property to your JSON files:

\`\`\`json
{
  "$schema": "https://rolldeo.app/schemas/randomTableSchemaV1.json",
  "metadata": { ... },
  "tables": [ ... ]
}
\`\`\`

## Schema Structure

The schema defines the following top-level properties:

| Property | Required | Description |
|----------|----------|-------------|
| \`metadata\` | Yes | Collection metadata (name, namespace, version) |
| \`imports\` | No | External file imports |
| \`tables\` | Yes | Array of table definitions |
| \`templates\` | No | Template patterns for complex outputs |
| \`conditionals\` | No | Post-processing conditionals |
| \`variables\` | No | Static variables |
| \`shared\` | No | Lazy-evaluated shared variables |

---

## Full Schema

Below is the complete JSON Schema. Click "Copy" to copy it to your clipboard or download for local use.
`

export function SchemaPage() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(schemaJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <GuideLayout title="Schema Reference" content={schemaOverview}>
      {/* Schema Viewer */}
      <div className="mt-8">
        {/* Actions bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileJson className="h-4 w-4" />
            <span>randomTableSchemaV1.json</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </button>
            <DownloadButton
              filename="randomTableSchemaV1.json"
              content={schemaJson}
              mimeType="application/json"
              label="Download"
              variant="primary"
            />
          </div>
        </div>

        {/* Schema code block */}
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg bg-[#1e1e1e] p-4 text-sm max-h-[600px] overflow-y-auto">
            <code className="language-json text-gray-300">
              {JSON.stringify(schema, null, 2)}
            </code>
          </pre>
        </div>
      </div>

      {/* Additional Resources */}
      <div className="mt-12 p-6 rounded-xl bg-muted/30 border border-border/30">
        <h3 className="font-semibold mb-4">Related Resources</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/guide/spec"
            className="flex items-center gap-3 p-4 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <FileJson className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium">Full Specification</div>
              <div className="text-sm text-muted-foreground">
                Human-readable documentation
              </div>
            </div>
          </Link>
          <a
            href="https://json-schema.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
          >
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ExternalLink className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium">JSON Schema Docs</div>
              <div className="text-sm text-muted-foreground">
                Learn more about JSON Schema
              </div>
            </div>
          </a>
        </div>
      </div>
    </GuideLayout>
  )
}

export default SchemaPage
