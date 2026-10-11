import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { InlineResult } from './InlineResult'
import type { EvaluatedSegment } from './types'

const expression = (text: string): EvaluatedSegment => ({
  type: 'expression', text, expressionType: 'table', originalExpression: '{{names}}', startInPattern: 0, endInPattern: 9,
})

describe('Markdown preview attribution', () => {
  it.each([
    ['**Ada**', '<strong>'],
    ['[Ada](https://example.com)', 'href="https://example.com"'],
    ['Ada\n\nGrace', '<p>'],
    ['`Ada`', '<code'],
    ['- Ada\n- Grace', '<li>'],
  ])('renders %s without marker/index leakage and highlights parsed text', (text, tag) => {
    const html = renderToStaticMarkup(<InlineResult segments={[expression(text)]} />)
    expect(html).toContain(tag)
    expect(html).toContain('inline-result-expression')
    expect(html).toContain('title="Table: {{names}}"')
    expect(html).not.toMatch(/[\u2060\u200B\u200D]/)
    expect(html).not.toMatch(/>0</)
  })

  it('keeps literals outside expression highlights, including repeated equal results', () => {
    const segments: EvaluatedSegment[] = [
      { type: 'literal', text: 'Ada ', startInPattern: 0, endInPattern: 4 },
      expression('**Ada**'),
      { type: 'literal', text: ' / ', startInPattern: 13, endInPattern: 16 },
      expression('[Ada](https://example.com)'),
    ]
    const html = renderToStaticMarkup(<InlineResult segments={segments} />)
    expect(html).toContain('<p>Ada <strong><span class="inline-result-expression')
    expect(html.match(/title="Table: {{names}}"/g)).toHaveLength(2)
  })

  it('maps decoded Markdown entities and escaped syntax back to the correct source segment', () => {
    const html = renderToStaticMarkup(<InlineResult segments={[
      { type: 'literal', text: '&amp; ', startInPattern: 0, endInPattern: 6 }, expression('**A&amp;B**'),
    ]} />)
    expect(html).toContain('<p>&amp; <strong><span class="inline-result-expression')
    expect(html).toContain('>A&amp;B</span></strong>')
  })

  it('parses formatting spanning a literal/expression boundary', () => {
    const html = renderToStaticMarkup(<InlineResult segments={[
      { type: 'literal', text: '**Hello ', startInPattern: 0, endInPattern: 8 }, expression('Ada'),
      { type: 'literal', text: '**', startInPattern: 17, endInPattern: 19 },
    ]} />)
    expect(html).toContain('<strong>Hello <span class="inline-result-expression')
    expect(html).toContain('>Ada</span></strong>')
  })
})
