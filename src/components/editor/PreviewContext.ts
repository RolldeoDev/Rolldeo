import { createContext } from 'react'
import type { RandomTableEngine } from '@/engine/core'

export const PreviewContext = createContext<{ engine: RandomTableEngine; collectionId: string } | null>(null)
