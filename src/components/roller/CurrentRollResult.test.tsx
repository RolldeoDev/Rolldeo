import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RandomTableEngine } from '@/engine/core'
import { CurrentRollResult } from './CurrentRollResult'

vi.mock('@/stores/uiStore', () => ({ useUIStore: (select: (state: { resultTheme: string }) => unknown) => select({ resultTheme: 'default' }) }))
const actions = { onReroll: () => {}, onShowDescriptions: () => {}, onShowSets: () => {} }

describe('failed rolls retain the successful result card', () => {
  it('keeps the prior generated text, source and trace control beside a new validation error', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection({
      metadata: { name: 'Reaction', namespace: 'test.reaction', specVersion: '1.1', version: '1.0.0' },
      inputs: { partyLevel: { type: 'integer', min: 1, max: 20, required: true } },
      tables: [{ id: 'reaction', name: 'Reaction', type: 'simple', entries: [{ value: 'Hostile' }] }],
    }, 'reaction')
    const result = engine.roll('reaction', 'reaction', { inputs: { partyLevel: 7 }, enableTrace: true })
    let error = ''
    try { engine.roll('reaction', 'reaction', { inputs: { partyLevel: 21 } }) } catch (failure) { error = (failure as Error).message }
    const markup = renderToStaticMarkup(<CurrentRollResult result={result} itemName="Reaction" isRolling={false} error={error} pinned={false} {...actions} />)
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('partyLevel')
    expect(markup).toContain('Hostile')
    expect(markup).toContain('Reaction')
    expect(markup).toContain('Show execution trace')
    expect(markup).toContain('Copy result to clipboard')
    expect(markup).toContain('Your previous result is shown below.')
  })

  it('shows the error when there is no previous result', () => {
    const markup = renderToStaticMarkup(<CurrentRollResult result={null} itemName={null} isRolling={false} error="Complete the generator inputs before rolling." pinned={false} {...actions} />)
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Complete the generator inputs')
    expect(markup).not.toContain('Your previous result')
  })
})
