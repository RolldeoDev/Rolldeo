/**
 * QuickRollResult Component
 *
 * Simplified roll result display for the homepage Quick Roll section.
 * Shows the result text with copy and re-roll buttons.
 */

import { memo, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { RotateCcw, ClipboardCopy, Check } from 'lucide-react'
import type { RollResult } from '@/engine/types'
import { getResultTypeIcon } from '@/lib/resultTypeIcons'

interface QuickRollResultProps {
  result: RollResult
  templateName: string
  isRolling: boolean
  onReroll: () => void
}

export const QuickRollResult = memo(function QuickRollResult({
  result,
  templateName,
  isRolling,
  onReroll,
}: QuickRollResultProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!result?.text) return
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [result?.text])

  const ResultIcon = getResultTypeIcon(result.resultType)

  return (
    <div className="p-5 rounded-xl card-elevated card-result border animate-slide-up">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="icon-container icon-copper"
            title={result.resultType ? `Type: ${result.resultType}` : undefined}
          >
            <ResultIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Result</h3>
            <p className="text-sm text-muted-foreground">{templateName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            className={`p-2.5 rounded-xl transition-colors ${
              copied ? 'text-green-500' : 'hover:bg-accent'
            }`}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-5 w-5" />
            ) : (
              <ClipboardCopy className="h-5 w-5" />
            )}
          </button>
          <button
            className="p-2.5 rounded-xl hover:bg-accent transition-colors"
            title="Re-roll"
            onClick={onReroll}
            disabled={isRolling}
          >
            <RotateCcw className={`h-5 w-5 ${isRolling ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="prose-roll overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.text}</ReactMarkdown>
      </div>
    </div>
  )
})

export default QuickRollResult
