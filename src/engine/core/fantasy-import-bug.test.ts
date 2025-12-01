/**
 * Test for the bug where template references don't evaluate properly
 * when both parent and child templates have shared variables with the same name
 */

import { describe, it, expect } from 'vitest'
import { RandomTableEngine } from './index'
import type { RandomTableDocument } from '../types'

describe('Template reference with shared variables bug', () => {
  it('should properly evaluate {{fullName}} when referenced from another template', () => {
    // Simplified version of the fantasy-names scenario
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Test',
        namespace: 'test.template.bug',
        version: '1.0.0',
        specVersion: '1.0',
      },
      tables: [
        {
          id: 'race',
          name: 'Race',
          type: 'simple',
          entries: [
            {
              value: 'Elf',
              sets: {
                raceId: 'elf',
                firstNameTable: 'elfFirstNames',
              },
            },
          ],
        },
        {
          id: 'elfFirstNames',
          name: 'Elf First Names',
          type: 'simple',
          entries: [{ value: 'Aelindra' }, { value: 'Caelynn' }, { value: 'Erevan' }],
        },
      ],
      templates: [
        {
          id: 'fullName',
          name: 'Full Name',
          shared: {
            _raceInit: '{{race}}', // This rolls race and should populate placeholders
          },
          pattern: '{{@race.firstNameTable}}', // This should resolve to elfFirstNames and roll it
        },
        {
          id: 'detailedNpc',
          name: 'Detailed NPC',
          shared: {
            _raceInit: '{{race}}', // Parent also has this shared variable
          },
          pattern: 'Name: {{fullName}}', // This references fullName template
        },
      ],
    }

    const engine = new RandomTableEngine()
    engine.loadCollection(doc, 'test')

    // Roll the fullName template directly - should work
    const directResult = engine.rollTemplate('fullName', 'test')
    console.log('Direct fullName result:', directResult.text)
    expect(directResult.text).toMatch(/Aelindra|Caelynn|Erevan/)

    // Roll the detailedNpc template which references fullName - THIS IS THE BUG
    const nestedResult = engine.rollTemplate('detailedNpc', 'test')
    console.log('Nested result:', nestedResult.text)

    // The bug: fullName returns blank because the isolated context's placeholders are empty
    // Expected: "Name: Aelindra" (or Caelynn or Erevan)
    // Actual (buggy): "Name: "
    expect(nestedResult.text).toMatch(/Name: (Aelindra|Caelynn|Erevan)/)
  })

  it('should work when child template has different shared variable name', () => {
    // This should work because there's no name collision
    const doc: RandomTableDocument = {
      metadata: {
        name: 'Test',
        namespace: 'test.template.noconflict',
        version: '1.0.0',
        specVersion: '1.0',
      },
      tables: [
        {
          id: 'race',
          name: 'Race',
          type: 'simple',
          entries: [
            {
              value: 'Elf',
              sets: {
                raceId: 'elf',
                firstNameTable: 'elfFirstNames',
              },
            },
          ],
        },
        {
          id: 'elfFirstNames',
          name: 'Elf First Names',
          type: 'simple',
          entries: [{ value: 'Aelindra' }],
        },
      ],
      templates: [
        {
          id: 'fullName',
          name: 'Full Name',
          shared: {
            _childRaceInit: '{{race}}', // Different name - no collision
          },
          pattern: '{{@race.firstNameTable}}',
        },
        {
          id: 'detailedNpc',
          name: 'Detailed NPC',
          shared: {
            _parentRaceInit: '{{race}}',
          },
          pattern: 'Name: {{fullName}}',
        },
      ],
    }

    const engine = new RandomTableEngine()
    engine.loadCollection(doc, 'test')

    const result = engine.rollTemplate('detailedNpc', 'test')
    console.log('No conflict result:', result.text)
    // This should still fail because isolated context placeholders are empty
    // regardless of shared variable name collision
    expect(result.text).toBe('Name: Aelindra')
  })
})
