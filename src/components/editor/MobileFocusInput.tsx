/**
 * MobileFocusInput Component
 *
 * A wrapper that provides a focused, full-screen editing experience on mobile.
 * When tapped, the input expands to full-width with larger text and a "Done" button.
 */

import { useState, useCallback, useRef, useEffect, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileFocusInputProps {
  /** The label for the field */
  label: string
  /** Current value */
  value: string
  /** Change handler */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Whether the field is required */
  required?: boolean
  /** Additional description text */
  description?: string
  /** Input type (text, number, url, etc.) */
  type?: 'text' | 'number' | 'url' | 'email'
  /** Whether to use textarea instead of input */
  multiline?: boolean
  /** Number of rows for multiline */
  rows?: number
  /** Additional className for the trigger element */
  className?: string
  /** Minimum value for number inputs */
  min?: number
  /** Maximum value for number inputs */
  max?: number
  /** Step for number inputs */
  step?: number
  /** Pattern for validation */
  pattern?: string
  /** Whether this is disabled */
  disabled?: boolean
  /** Auto-capitalize setting */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  /** Auto-correct setting */
  autoCorrect?: 'on' | 'off'
}

export const MobileFocusInput = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  MobileFocusInputProps
>(function MobileFocusInput(
  {
    label,
    value,
    onChange,
    placeholder,
    required,
    description,
    type = 'text',
    multiline = false,
    rows = 3,
    className,
    min,
    max,
    step,
    pattern,
    disabled,
    autoCapitalize = 'sentences',
    autoCorrect = 'off',
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Sync local value with prop
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value)
    }
  }, [value, isFocused])

  const handleFocus = useCallback(() => {
    if (isMobile && !disabled) {
      setIsFocused(true)
      setLocalValue(value)
    }
  }, [isMobile, disabled, value])

  const handleDone = useCallback(() => {
    onChange(localValue)
    setIsFocused(false)
  }, [localValue, onChange])

  const handleCancel = useCallback(() => {
    setLocalValue(value)
    setIsFocused(false)
  }, [value])

  // Focus the input when overlay opens
  useEffect(() => {
    if (isFocused && inputRef.current) {
      // Small delay to ensure the overlay is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isFocused])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocused) {
        handleCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFocused, handleCancel])

  // Lock body scroll when focused
  useEffect(() => {
    if (isFocused) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isFocused])

  const inputProps = {
    value: localValue,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const newValue = e.target.value
      setLocalValue(newValue)
      // On desktop, update immediately
      if (!isMobile) {
        onChange(newValue)
      }
    },
    placeholder,
    disabled,
    autoCapitalize,
    autoCorrect,
    pattern,
    'aria-label': label,
    'aria-required': required,
  }

  // Desktop rendering - just render the input directly
  if (!isMobile) {
    const desktopClassName = cn(
      'w-full p-2 border rounded-md bg-background text-sm',
      'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    )

    if (multiline) {
      return (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          {...inputProps}
          rows={rows}
          className={cn(desktopClassName, 'resize-y')}
        />
      )
    }

    return (
      <input
        ref={ref as React.Ref<HTMLInputElement>}
        type={type}
        min={min}
        max={max}
        step={step}
        {...inputProps}
        className={desktopClassName}
      />
    )
  }

  // Mobile trigger (displays current value)
  const trigger = (
    <button
      type="button"
      onClick={handleFocus}
      disabled={disabled}
      className={cn(
        'w-full p-3 text-left text-base border rounded-xl bg-background',
        'min-h-[48px] transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
        disabled && 'opacity-50 cursor-not-allowed',
        !value && 'text-muted-foreground',
        className
      )}
    >
      {value || placeholder || `Enter ${label.toLowerCase()}...`}
    </button>
  )

  // Mobile focus overlay
  const overlay = isFocused ? (
    <div className="mobile-focus-overlay mobile-focus-expand">
      {/* Header */}
      <div className="mobile-focus-header">
        <button
          onClick={handleCancel}
          className="mobile-action-btn"
          aria-label="Cancel"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center">
          <h3 className="font-semibold">{label}</h3>
          {required && (
            <span className="text-xs text-destructive">Required</span>
          )}
        </div>
        <button
          onClick={handleDone}
          className="mobile-action-btn bg-primary/10 text-primary"
          aria-label="Done"
        >
          <Check className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="mobile-focus-content">
        {description && (
          <p className="text-sm text-muted-foreground mb-3">{description}</p>
        )}

        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            {...inputProps}
            rows={Math.max(rows, 5)}
            className={cn(
              'w-full p-4 text-lg border rounded-xl bg-card',
              'resize-none',
              'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50'
            )}
            onKeyDown={(e) => {
              // Allow cmd/ctrl + enter to submit
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                handleDone()
              }
            }}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            min={min}
            max={max}
            step={step}
            {...inputProps}
            className={cn(
              'w-full p-4 text-lg border rounded-xl bg-card',
              'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50'
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleDone()
              }
            }}
          />
        )}
      </div>

      {/* Footer with Done button */}
      <div className="mobile-focus-footer">
        <button
          onClick={handleDone}
          className="w-full py-3 px-6 bg-primary text-primary-foreground font-semibold rounded-xl"
        >
          Done
        </button>
      </div>
    </div>
  ) : null

  return (
    <>
      {trigger}
      {overlay && createPortal(overlay, document.body)}
    </>
  )
})

export default MobileFocusInput
