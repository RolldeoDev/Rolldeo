/**
 * Toast Notification System
 *
 * Provides toast notifications for user feedback.
 */

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// ============================================================================
// Provider
// ============================================================================

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const toast: Toast = { id, message, type, duration }
      setToasts((prev) => [...prev, toast])

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id)
        }, duration)
      }
    },
    [removeToast]
  )

  const success = useCallback(
    (message: string, duration?: number) => addToast(message, 'success', duration),
    [addToast]
  )

  const error = useCallback(
    (message: string, duration?: number) => addToast(message, 'error', duration ?? 6000),
    [addToast]
  )

  const warning = useCallback(
    (message: string, duration?: number) => addToast(message, 'warning', duration),
    [addToast]
  )

  const info = useCallback(
    (message: string, duration?: number) => addToast(message, 'info', duration),
    [addToast]
  )

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// ============================================================================
// Toast Container
// ============================================================================

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-28 md:bottom-6 right-4 md:right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

// ============================================================================
// Toast Item
// ============================================================================

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true)
    })
  }, [])

  const handleRemove = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => {
      onRemove(toast.id)
    }, 200)
  }, [onRemove, toast.id])

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }

  const Icon = icons[toast.type]

  const styles = {
    success: 'card-mint border-[hsl(var(--mint)/0.3)]',
    error: 'card-rose border-[hsl(var(--rose)/0.3)]',
    warning: 'card-amber border-[hsl(var(--amber)/0.3)]',
    info: 'card-lavender border-[hsl(var(--lavender)/0.3)]',
  }

  const iconContainerStyles = {
    success: 'icon-mint',
    error: 'icon-rose',
    warning: 'icon-amber',
    info: 'icon-lavender',
  }

  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto card-elevated flex items-start gap-3 p-4 border rounded-xl shadow-lg transition-all duration-300',
        styles[toast.type],
        isVisible && !isExiting
          ? 'opacity-100 translate-x-0 scale-100'
          : 'opacity-0 translate-x-4 scale-95'
      )}
    >
      <div className={cn('icon-container p-2', iconContainerStyles[toast.type])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="flex-1 text-sm font-medium pt-1.5 text-foreground">{toast.message}</p>
      <button
        onClick={handleRemove}
        className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )
}
