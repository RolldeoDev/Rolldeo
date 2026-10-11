import { describe, expect, it } from 'vitest'
import { extractHeadings, guideLink } from './guideMarkdown'

describe('guide navigation', () => {
  it('uses renderer slugs for punctuation, inline formatting, duplicates, and Unicode', () => {
    expect(extractHeadings('# Tips & Tricks\n## Tips & Tricks\n### **Crème** `brûlée`')).toEqual([
      { id: 'tips--tricks', text: 'Tips & Tricks', level: 1 },
      { id: 'tips--tricks-1', text: 'Tips & Tricks', level: 2 },
      { id: 'crème-brûlée', text: 'Crème brûlée', level: 3 },
    ])
  })

  it('ignores fenced headings and includes setext headings as the renderer does', () => {
    expect(extractHeadings('```md\n# Example\n```\n\nActual\n======')).toEqual([
      { id: 'actual', text: 'Actual', level: 1 },
    ])
  })

  it('maps known documentation links and preserves sections and external links', () => {
    expect(guideLink('./randomTableSpecV1.md#tables')).toBe('/guide/spec#tables')
    expect(guideLink('../Quickstart.md')).toBe('/guide/quickstart')
    expect(guideLink('#tables')).toBe('#tables')
    expect(guideLink('https://example.com/randomTableSpecV1.md')).toBe('https://example.com/randomTableSpecV1.md')
    expect(guideLink('/guide/examples/Starter.zip')).toBe('/guide/examples/Starter.zip')
  })

  it('keeps versioned schema downloads separate from the latest schema guide', () => {
    expect(guideLink('./randomTableSpecV1_1.md')).toBe('/guide/spec')
    expect(guideLink('./random-table-spec-v1.0.json')).toBe('/schemas/random-table-spec-v1.0.json')
    expect(guideLink('/schemas/random-table-spec-v1.0.json')).toBe('/schemas/random-table-spec-v1.0.json')
    expect(guideLink('/schemas/random-table-spec-v1.1.json')).toBe('/schemas/random-table-spec-v1.1.json')
    expect(guideLink('./random-table-spec-v1.1.json')).toBe('/guide/schema')
  })
})
