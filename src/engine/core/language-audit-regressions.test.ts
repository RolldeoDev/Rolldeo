import { describe, expect, it } from 'vitest'
import { RandomTableEngine } from './index'
import { parseExpression } from './parser'
import type { RandomTableDocument, SimpleTable, Template } from '../types'

const simple = (id: string, value: string, sets: Record<string, string> = {}, description?: string): SimpleTable => ({
  id, name: id, type: 'simple', entries: [{ value, sets, description }],
})
const doc = (namespace: string, tables: SimpleTable[] = [], templates: Template[] = []): RandomTableDocument => ({
  metadata: { name: namespace, namespace, version: '1.0.0', specVersion: '1.0' }, tables, templates,
})

function engineFor(document: RandomTableDocument) {
  const engine = new RandomTableEngine()
  engine.loadCollection(document, 'main')
  return engine
}

describe('Language audit regressions', () => {
  it('keeps imported table and template identities and metadata through shared switches', () => {
    const engine = engineFor({ ...doc('review.local', [simple('color', 'LOCAL', { hex: 'LOCAL_HEX' })]),
      imports: [{ alias: 'b', path: 'review.foreign' }],
    })
    engine.loadCollection(doc('review.foreign', [simple('color', 'FOREIGN', { hex: 'FOREIGN_HEX' })], [
      { id: 'person', name: 'Person', pattern: '{{$name}}', shared: { name: 'FOREIGN_PERSON' } },
    ]), 'foreign')
    for (const expression of ['{{switch[1:{{b.color}}]}}', '{{switch[1:{{review.foreign.color}}]}}', '{{switch[1:b.color]}}']) {
      expect(engine.evaluateRawPattern('{{$chosen}}|{{$chosen.@hex}}', 'main', { shared: { chosen: expression } }).text)
        .toBe('FOREIGN|FOREIGN_HEX')
    }
    expect(engine.evaluateRawPattern('{{$chosen}}|{{$chosen.@name}}', 'main', {
      shared: { chosen: '{{switch[1:{{b.person}}]}}' },
    }).text).toBe('FOREIGN_PERSON|FOREIGN_PERSON')
  })

  it('uses ordinary property and attached switch semantics in shared variables and nested sets', () => {
    const engine = engineFor(doc('review.properties', [
      simple('parent', 'VALUE', { kind: 'PROPERTY' }),
      simple('outer', 'OUTER', { kind: '{{parent.@kind}}', switched: '{{parent.switch[$=="VALUE":"REPLACED"]}}' }),
    ]))
    for (const expression of ['{{parent.@kind}}', '{{parent.switch[$=="VALUE":"REPLACED"]}}']) {
      const direct = engine.evaluateRawPattern(expression, 'main').text
      expect(engine.evaluateRawPattern('{{$chosen}}', 'main', { shared: { chosen: expression } }).text).toBe(direct)
    }
    expect(engine.evaluateRawPattern('{{$outer.@kind}}|{{$outer.@switched}}', 'main', { shared: { outer: '{{outer}}' } }).text)
      .toBe('PROPERTY|REPLACED')
  })

  it('captures each selected entry description explicitly through nested value and set evaluations', () => {
    const engine = engineFor(doc('review.descriptions', [
      simple('child', 'CHILD', {}, 'CHILD_DESCRIPTION'),
      simple('parent', '{{child}}', {}, 'PARENT_DESCRIPTION'),
      simple('outer', 'OUTER', { nested: '{{parent}}' }, 'OUTER_DESCRIPTION'),
      simple('withoutDescription', '{{child}}'),
    ]))
    expect(engine.evaluateRawPattern('{{$chosen.@description}}', 'main', { shared: { chosen: '{{parent}}' } }).text)
      .toBe('PARENT_DESCRIPTION')
    expect(engine.evaluateRawPattern('{{1*parent >> $items|silent}}{{$items[0].@description}}', 'main').text)
      .toBe('PARENT_DESCRIPTION')
    expect(engine.evaluateRawPattern('{{$chosen.@nested.@description}}', 'main', { shared: { chosen: '{{outer}}' } }).text)
      .toBe('PARENT_DESCRIPTION')
    expect(engine.evaluateRawPattern('{{$chosen.@description}}', 'main', { shared: { chosen: '{{withoutDescription}}' } }).text)
      .toBe('')
  })

  it('inherits only active parent shared bindings and restores them after a child invocation', () => {
    const engine = engineFor(doc('review.scopes', [
      { ...simple('a', '{{$who}}'), shared: { who: 'A' } },
      { ...simple('b', '{{$who}}'), shared: { who: 'B' } },
      { ...simple('parent', '{{child}}|{{$who}}'), shared: { who: 'PARENT' } },
    ], [{ id: 'child', name: 'Child', pattern: '{{$who}}', shared: { who: 'CHILD' } }]))
    expect(engine.evaluateRawPattern('{{a}}|{{b}}|{{$who}}', 'main').text).toBe('A|B|')
    expect(engine.evaluateRawPattern('{{parent}}|{{child}}', 'main').text).toBe('PARENT|PARENT|CHILD')
  })

  it('evaluates table-local shared dice separately for repeated sibling invocations', () => {
    const engine = engineFor(doc('review.repeats', [{ ...simple('npc', '{{$name}}'), shared: { name: '{{dice:1d6}}' } }]))
    let i = 0
    const values = [0, 0, 0.99, 0, 0.5, 0]
    expect(engine.evaluateRawPattern('{{3*npc}}', 'main', { random: () => values[i++ % values.length] }).text)
      .toBe('1, 6, 4')
  })

  it('retains document shared values and restores the caller static environment after imported rolls', () => {
    const engine = engineFor({ ...doc('review.caller'), variables: { n: '3' }, shared: { label: 'GLOBAL' },
      imports: [{ alias: 'b', path: 'review.owner' }],
    })
    engine.loadCollection({ ...doc('review.owner', [simple('nested', '{{math:$n + 1}}|{{switch[$n==8:"YES"].else["NO"]}}|{{$label}}')]),
      variables: { n: '8' },
    }, 'owner')
    expect(engine.evaluateRawPattern('{{b.nested}}|{{math:$n + 1}}|{{$label}}', 'main').text).toBe('9|YES|GLOBAL|4|GLOBAL')
  })

  it('unescapes literal braces identically in previews and template rolls, including surrounding expressions', () => {
    const pattern = String.raw`\{{before\}} {{leaf}} \{{after\}}`
    const engine = engineFor(doc('review.literal', [simple('leaf', 'X')], [{ id: 'literal', name: 'Literal', pattern }]))
    expect(engine.evaluateRawPattern(pattern, 'main').text).toBe('{{before}} X {{after}}')
    expect(engine.rollTemplate('literal', 'main').text).toBe('{{before}} X {{after}}')
    expect(engine.evaluateRawPattern(String.raw`\{{only\}}`, 'main').text).toBe('{{only}}')
  })

  it('parses escaped quote separators across roll, capture, access, collect and again forms', () => {
    for (const expression of [String.raw`2*leaf|"\""`, String.raw`dice:1d2*leaf|"\""`, String.raw`2*again|"\""`,
      String.raw`2*leaf >> $items|"\""`, String.raw`$items|"\""`, String.raw`collect:$items.value|"\""`]) {
      expect(parseExpression(expression)).toMatchObject({ separator: '"' })
      if (expression.includes('again')) expect(parseExpression(expression).type).toBe('again')
    }
    const engine = engineFor(doc('review.separator', [simple('leaf', 'X')]))
    expect(engine.evaluateRawPattern(String.raw`{{2*leaf|"\""}}`, 'main').text).toBe('X"X')
    expect(parseExpression(String.raw`2*leaf| "\"#"`)).toMatchObject({ type: 'multiRoll', tableId: 'leaf', separator: '"#' })
    expect(engine.evaluateRawPattern(String.raw`{{2*leaf >> $items|silent}}{{$items|"\""}}|{{collect:$items.value|"\""}}`, 'main').text)
      .toBe('X"X|X"X')
  })

  it('resolves named instance properties inside arithmetic without rerolling the instance', () => {
    const engine = engineFor(doc('review.math.instance', [simple('size', 'Town', { population: '500' })]))
    expect(engine.evaluateRawPattern('{{size#town}}|{{math:@town.population / 10}}|{{@town.population}}|{{@town.value}}|{{switch[@town.value=="Town":"YES"].else["NO"]}}', 'main').text)
      .toBe('Town|50|500|Town|YES')
  })

  it.each(['cycle', 'stop', 'error'] as const)('delegates simple and captured unique %s overflow to engine selection', behavior => {
    const engine = engineFor({ ...doc('review.language.overflow', [{ id: 'items', name: 'Items', type: 'simple',
      entries: [{ id: 'a', value: 'A' }, { id: 'b', value: 'B' }],
    }]), metadata: { ...doc('review.language.overflow').metadata, uniqueOverflowBehavior: behavior } })
    for (const expression of ['{{5*unique*items}}', '{{5*unique*items >> $values}}']) {
      const draw = () => engine.evaluateRawPattern(expression, 'main', { random: () => 0 })
      if (behavior === 'error') expect(draw).toThrow(/Unique selection overflow/)
      else expect(draw().text).toBe(behavior === 'cycle' ? 'A, B, A, B, A' : 'A, B')
    }
  })

  it('uses interpolation resolution for indexed, deep, count and qualified condition references', () => {
    const engine = engineFor({ ...doc('review.conditions', [simple('leaf', 'X'), simple('parent', 'P', { nested: '{{leaf}}' })]),
      variables: { local: 'HERE' }, imports: [{ alias: 'b', path: 'review.foreign' }],
    })
    engine.loadCollection({ ...doc('review.foreign'), variables: { local: 'THERE' } }, 'foreign')
    const prefix = '{{2*leaf >> $items|silent}}'
    for (const condition of ['$items.count==2', '$items[0].value=="X"', '$items[-1].value=="X"',
      '$parent.@nested.value=="X"', '$b.local=="THERE"', '$review.foreign.local=="THERE"', '$local=="HERE"']) {
      expect(engine.evaluateRawPattern(`${prefix}{{switch[${condition}:"YES"].else["NO"]}}`, 'main', {
        shared: { parent: '{{parent}}' },
      }).text).toBe('YES')
    }
  })
})
