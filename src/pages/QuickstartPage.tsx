/**
 * QuickstartPage
 *
 * Renders the Quickstart.md content with the guide layout.
 */

import { GuideLayout } from '@/components/guide'
import quickstartMd from '@/../docs/Quickstart.md?raw'

export function QuickstartPage() {
  return (
    <GuideLayout title="Getting Started" content={quickstartMd} />
  )
}

export default QuickstartPage
