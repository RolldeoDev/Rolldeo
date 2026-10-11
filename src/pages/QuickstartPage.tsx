/**
 * QuickstartPage
 *
 * Renders the Quickstart.md content with the guide layout.
 */

import { GuideLayout } from '@/components/guide'
import { SEO } from '@/components/common'
import { PAGE_SEO } from '@/lib/seo'
import quickstartMd from '@/../docs/Quickstart.md?raw'

export function QuickstartPage() {
  return (
    <>
      <SEO {...PAGE_SEO.quickstart} />
      <GuideLayout title="Getting Started" content={quickstartMd} />
    </>
  )
}

export default QuickstartPage
