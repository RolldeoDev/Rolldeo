/**
 * SpecPage
 *
 * Renders the full Random Table Spec markdown with the guide layout.
 */

import { GuideLayout, DownloadButton } from '@/components/guide'
import { SEO } from '@/components/common'
import { PAGE_SEO } from '@/lib/seo'
import { Github, Scale } from 'lucide-react'
import specMd from '@/../docs/randomTableSpecV1.md?raw'

export function SpecPage() {
  return (
    <>
      <SEO {...PAGE_SEO.spec} />
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

      {/* License & Source */}
      <div className="mt-8 p-6 rounded-xl bg-primary/5 border border-primary/20">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Scale className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">CC0 Public Domain</h3>
              <p className="text-sm text-muted-foreground">
                This specification is released under{' '}
                <a
                  href="https://creativecommons.org/publicdomain/zero/1.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  CC0 1.0 Universal
                </a>
                . Use it freely to build your own tools and engines.
              </p>
            </div>
          </div>
          <a
            href="https://github.com/RolldeoDev/rolldeo"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-2 whitespace-nowrap"
          >
            <Github className="h-4 w-4" />
            View Source
          </a>
        </div>
      </div>
      </GuideLayout>
    </>
  )
}

export default SpecPage
