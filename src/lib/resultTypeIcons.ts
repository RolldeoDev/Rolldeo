/**
 * Result Type Icons
 *
 * Shared icon mapping for resultType fields used across the application.
 * Used in roll result display and editor components.
 */

import {
  Sparkles,
  Bug,
  User,
  Users,
  Gavel,
  Gem,
  MapPin,
  Swords,
  Calendar,
  Anchor,
  AlertTriangle,
  Tag,
  Fingerprint,
  Zap,
  Mountain,
  Star,
  FileText,
  MessageCircle,
  Quote,
  BarChart3,
  Hash,
  Coins,
  Clock,
  Cloud,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Maps resultType strings to their corresponding Lucide icons */
export const RESULT_TYPE_ICONS: Record<string, LucideIcon> = {
  creature: Bug,
  npc: User,
  faction: Users,
  item: Gavel,
  loot: Gem,
  treasure: Gem,
  location: MapPin,
  encounter: Swords,
  event: Calendar,
  hook: Anchor,
  complication: AlertTriangle,
  name: Tag,
  trait: Fingerprint,
  effect: Zap,
  environment: Mountain,
  ability: Star,
  description: FileText,
  rumor: MessageCircle,
  dialogue: Quote,
  statistic: BarChart3,
  number: Hash,
  currency: Coins,
  time: Clock,
  weather: Cloud,
}

/** Result type options with labels and descriptions for UI display */
export const RESULT_TYPE_OPTIONS = [
  { value: 'creature', label: 'Creature', description: 'Monsters, animals, beings' },
  { value: 'npc', label: 'NPC', description: 'Non-player characters' },
  { value: 'faction', label: 'Faction', description: 'Organizations, groups' },
  { value: 'item', label: 'Item', description: 'Equipment, objects' },
  { value: 'loot', label: 'Loot', description: 'Treasure packages' },
  { value: 'location', label: 'Location', description: 'Places, areas' },
  { value: 'encounter', label: 'Encounter', description: 'Combat/exploration events' },
  { value: 'event', label: 'Event', description: 'Occurrences, happenings' },
  { value: 'hook', label: 'Hook', description: 'Plot hooks, adventure seeds' },
  { value: 'complication', label: 'Complication', description: 'Obstacles, problems' },
  { value: 'name', label: 'Name', description: 'Names for anything' },
  { value: 'trait', label: 'Trait', description: 'Characteristics, features' },
  { value: 'effect', label: 'Effect', description: 'Spell effects, conditions' },
  { value: 'environment', label: 'Environment', description: 'Weather, terrain' },
  { value: 'ability', label: 'Ability', description: 'Skills, powers' },
  { value: 'description', label: 'Description', description: 'Narrative text' },
  { value: 'rumor', label: 'Rumor', description: 'Information, lore' },
  { value: 'dialogue', label: 'Dialogue', description: 'Speech, conversation' },
  { value: 'statistic', label: 'Statistic', description: 'Numbers, metrics' },
  { value: 'number', label: 'Number', description: 'Pure numeric output' },
  { value: 'currency', label: 'Currency', description: 'Money, values' },
  { value: 'time', label: 'Time', description: 'Durations, timestamps' },
  { value: 'weather', label: 'Weather', description: 'Weather conditions' },
] as const

export type ResultTypeOption = (typeof RESULT_TYPE_OPTIONS)[number]

/** Returns the appropriate icon for a resultType, falling back to Sparkles */
export function getResultTypeIcon(resultType?: string): LucideIcon {
  if (!resultType) return Sparkles
  return RESULT_TYPE_ICONS[resultType.toLowerCase()] ?? Sparkles
}
