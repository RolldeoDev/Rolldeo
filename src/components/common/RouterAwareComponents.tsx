import { CommandPalette } from './CommandPalette'
import { InstallPrompt } from './InstallPrompt'
import { OfflineIndicator } from './OfflineIndicator'

export function RouterAwareComponents() {
  return <>
    <CommandPalette />
    <InstallPrompt />
    <OfflineIndicator />
  </>
}
