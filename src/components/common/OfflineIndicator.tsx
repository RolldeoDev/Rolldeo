/**
 * Offline Indicator Component
 *
 * Shows an indicator when the app is offline.
 */

import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showReconnected, setShowReconnected] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Show "reconnected" message briefly if we were previously offline
      if (wasOffline) {
        setShowReconnected(true)
        setTimeout(() => {
          setShowReconnected(false)
        }, 3000)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  // Show reconnected message
  if (showReconnected) {
    return (
      <div
        className={cn(
          'fixed top-16 left-1/2 -translate-x-1/2 z-50',
          'flex items-center gap-2 px-4 py-2 rounded-full shadow-lg',
          'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
          'text-sm font-medium',
          'animate-in fade-in slide-in-from-top-2 duration-300'
        )}
        role="status"
        aria-live="polite"
      >
        <Wifi className="h-4 w-4" />
        Back online
      </div>
    )
  }

  // Show offline indicator
  if (!isOnline) {
    return (
      <div
        className={cn(
          'fixed top-16 left-1/2 -translate-x-1/2 z-50',
          'flex items-center gap-2 px-4 py-2 rounded-full shadow-lg',
          'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
          'text-sm font-medium',
          'animate-in fade-in slide-in-from-top-2 duration-300'
        )}
        role="status"
        aria-live="polite"
      >
        <WifiOff className="h-4 w-4" />
        You're offline
      </div>
    )
  }

  return null
}
