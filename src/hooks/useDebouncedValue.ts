/**
 * useDebouncedValue Hook
 *
 * Returns a debounced version of the provided value.
 * Useful for search inputs to avoid excessive filtering on every keystroke.
 */

import { useState, useEffect } from 'react'

/**
 * Debounce a value by the specified delay.
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

export default useDebouncedValue
