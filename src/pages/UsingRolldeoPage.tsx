/**
 * UsingRolldeoPage
 *
 * Renders the Using Rolldeo guide with the guide layout.
 */

import { GuideLayout } from '@/components/guide'
import { SEO } from '@/components/common'
import { PAGE_SEO } from '@/lib/seo'
import usingRolldeoMd from '@/../docs/UsingRolldeo.md?raw'

export function UsingRolldeoPage() {
  return (
    <>
      <SEO {...PAGE_SEO.usingRolldeo} />
      <GuideLayout title="Using Rolldeo" content={usingRolldeoMd} />
    </>
  )
}

export default UsingRolldeoPage
