/**
 * QuickRoll Component
 *
 * Interactive "Try It Out" section for the homepage.
 * Allows users to immediately roll on NPC, Treasure, or Monster templates.
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { User, Gem, Skull, Dices, PenSquare, Loader2 } from 'lucide-react'
import { useCollectionStore } from '@/stores/collectionStore'
import type { RollResult, RandomTableDocument } from '@/engine/types'
import { QuickRollResult } from './QuickRollResult'

const COLLECTION_ID = 'rolldeo.example.core'
const REQUIRED_TEMPLATES = ['npc', 'treasure', 'monsterEncounter'] as const

type TemplateId = (typeof REQUIRED_TEMPLATES)[number]

const TEMPLATE_OPTIONS = [
  { id: 'npc' as const, label: 'NPC', icon: User },
  { id: 'treasure' as const, label: 'Treasure', icon: Gem },
  { id: 'monsterEncounter' as const, label: 'Monster', icon: Skull },
]

export function QuickRoll() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('npc')
  const [result, setResult] = useState<RollResult | null>(null)
  const [rolledTemplateName, setRolledTemplateName] = useState<string | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  const { engine, isInitialized, saveCollection, getTemplateList } = useCollectionStore()

  // Check if required templates exist and auto-reset if not
  useEffect(() => {
    if (!isInitialized || isResetting) return

    const checkAndResetTemplates = async () => {
      try {
        const templates = getTemplateList(COLLECTION_ID)
        const templateIds = templates.map((t) => t.id)
        const allExist = REQUIRED_TEMPLATES.every((id) => templateIds.includes(id))

        if (!allExist) {
          setIsResetting(true)
          // Import the bundled default and reset
          const defaultDoc = await import('@/data/preloaded/rolldeo.example.core.json')
          await saveCollection(
            COLLECTION_ID,
            defaultDoc.default as unknown as RandomTableDocument,
            'user'
          )
          setIsResetting(false)
          setResult(null)
          setError(null)
        }
      } catch (err) {
        console.error('Failed to check/reset templates:', err)
        setIsResetting(false)
      }
    }

    checkAndResetTemplates()
  }, [isInitialized, isResetting, getTemplateList, saveCollection])

  const handleRoll = useCallback(() => {
    if (!isInitialized || isRolling) return

    setIsRolling(true)
    setError(null)

    try {
      const rollResult = engine.rollTemplate(selectedTemplate, COLLECTION_ID)
      setResult(rollResult)
      // Store the template name at roll time so it doesn't change when selection changes
      const option = TEMPLATE_OPTIONS.find((o) => o.id === selectedTemplate)
      setRolledTemplateName(option?.label || selectedTemplate)
    } catch (err) {
      console.error('Roll failed:', err)
      setError(err instanceof Error ? err.message : 'Roll failed')
    } finally {
      setIsRolling(false)
    }
  }, [isInitialized, isRolling, engine, selectedTemplate])

  const handleSelectTemplate = useCallback((templateId: TemplateId) => {
    setSelectedTemplate(templateId)
    setError(null)
  }, [])

  // Don't render until initialized
  if (!isInitialized) {
    return (
      <section className="animate-slide-up stagger-2">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </div>
      </section>
    )
  }

  // Show loading state while resetting
  if (isResetting) {
    return (
      <section className="animate-slide-up stagger-2">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Resetting example collection...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="animate-slide-up stagger-2">
      {/* Roll Button */}
      <button
        onClick={handleRoll}
        disabled={isRolling}
        className={`
          btn-copper w-full flex items-center justify-center gap-3 py-4 text-lg font-bold mb-4
          ${isRolling ? 'animate-pulse' : ''}
        `}
      >
        <Dices className={`h-6 w-6 ${isRolling ? 'animate-spin' : ''}`} />
        Roll
      </button>

      {/* Template Selector - Full Width Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {TEMPLATE_OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleSelectTemplate(id)}
            className={`
              flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl
              border transition-all duration-200
              ${selectedTemplate === id
                ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                : 'border-border/50 bg-card hover:border-primary/30 hover:bg-primary/5'
              }
            `}
          >
            <Icon
              className={`h-6 w-6 sm:h-8 sm:w-8 ${
                selectedTemplate === id ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
            <span
              className={`text-xs sm:text-sm font-medium ${
                selectedTemplate === id ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 rounded-xl border border-destructive/20 bg-destructive/5">
          <p className="text-destructive text-center text-sm">{error}</p>
        </div>
      )}

      {/* Result Display */}
      {result && rolledTemplateName && (
        <div className="mb-4">
          <QuickRollResult
            result={result}
            templateName={rolledTemplateName}
            isRolling={isRolling}
            onReroll={handleRoll}
          />
        </div>
      )}

      {/* Edit CTA */}
      <div className="text-center">
        <Link
          to={`/editor/${COLLECTION_ID}`}
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <PenSquare className="h-4 w-4" />
          <span className="font-medium">Edit this collection</span>
        </Link>
      </div>
    </section>
  )
}

export default QuickRoll
