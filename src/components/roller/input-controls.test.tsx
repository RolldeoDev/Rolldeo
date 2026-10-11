import React, { type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { GeneratorInputs } from './GeneratorInputs'
import { InputsEditor } from '../editor/InputsEditor'
import { resolveInputs } from '@/engine/core/inputs'
import type { Inputs } from '@/engine/types'

vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useId: () => 'input-test',
  useState: (initial: unknown) => [initial, vi.fn()],
}))
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!React.isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}
const emptyChoice = { type: 'choice' as const, options: [''], required: true }
const definitions: Inputs = { empty: emptyChoice }

describe('empty-string choices are selectable values', () => {
  it('allows the roller to explicitly select an empty option and satisfy a required input', () => {
    const onChange = vi.fn()
    const tree = GeneratorInputs({ inputs: definitions, values: {}, errors: {}, onChange })
    const select = elements(tree).find(element => element.type === 'select')!
    expect(select.props.value).toBe('')
    const options = elements(select).filter(element => element.type === 'option')
    expect(options.map(option => option.props.value)).toEqual(['', '0'])
    expect(options[1].props.children).toBe('(empty text)')
    ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: '0' } })
    expect(onChange).toHaveBeenCalledWith('empty', '')
    expect(resolveInputs(definitions, { empty: '' })).toEqual({ empty: '' })
    const selected = elements(GeneratorInputs({ inputs: definitions, values: { empty: '' }, errors: {}, onChange })).find(element => element.type === 'select')!
    expect(selected.props.value).toBe('0')
    ;(selected.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith('empty', undefined)
  })

  it('allows authoring and displaying an empty-string default separately from no default', () => {
    const onChange = vi.fn()
    const getDefault = (inputs: Inputs) => elements(InputsEditor({ inputs, onChange })).filter(element => element.type === 'select')[1]
    let select = getDefault(definitions)
    expect(select.props.value).toBe('')
    ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: '0' } })
    expect(onChange).toHaveBeenCalledWith({ empty: { ...emptyChoice, default: '' } })
    select = getDefault({ empty: { ...emptyChoice, default: '' } })
    expect(select.props.value).toBe('0')
    ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({ empty: { ...emptyChoice, default: undefined } })
  })
})
