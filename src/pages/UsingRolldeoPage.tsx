/**
 * UsingRolldeoPage
 *
 * Renders the Using Rolldeo guide with the guide layout.
 */

import { GuideLayout } from '@/components/guide'
import usingRolldeoMd from '@/../docs/UsingRolldeo.md?raw'

export function UsingRolldeoPage() {
  return (
    <GuideLayout title="Using Rolldeo" content={usingRolldeoMd} />
  )
}

export default UsingRolldeoPage
