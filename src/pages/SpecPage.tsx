/**
 * SpecPage
 *
 * Renders the full Random Table Spec markdown with the guide layout.
 */

import { GuideLayout, DownloadButton } from '@/components/guide'
import specMd from '@/../docs/randomTableSpecV1.md?raw'

export function SpecPage() {
  return (
    <GuideLayout title="Full Specification" content={specMd}>
      {/* Download CTA at the bottom */}
      <div className="mt-12 p-6 rounded-xl bg-muted/30 border border-border/30">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold mb-1">Download Specification</h3>
            <p className="text-sm text-muted-foreground">
              Get the complete specification for offline reference.
            </p>
          </div>
          <DownloadButton
            filename="randomTableSpecV1.md"
            content={specMd}
            mimeType="text/markdown"
            label="Download Markdown"
            variant="primary"
          />
        </div>
      </div>
    </GuideLayout>
  )
}

export default SpecPage
