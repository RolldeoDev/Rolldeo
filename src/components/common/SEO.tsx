/**
 * SEO Component
 *
 * Reusable component for managing page-level meta tags using react-helmet-async.
 * Handles Open Graph, Twitter Cards, and canonical URLs.
 */

import { Helmet } from 'react-helmet-async'
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE,
} from '@/lib/seo'

interface SEOProps {
  title?: string
  description?: string
  path?: string
  image?: string
  noindex?: boolean
}

export function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = DEFAULT_IMAGE,
  noindex = false,
}: SEOProps) {
  const canonicalUrl = `${SITE_URL}${path}`
  const fullImageUrl = image.startsWith('http') ? image : `${SITE_URL}${image}`

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImageUrl} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImageUrl} />
    </Helmet>
  )
}
