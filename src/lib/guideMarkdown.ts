import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import { toString } from 'hast-util-to-string'
import type { RootContent } from 'hast'

export interface Heading {
  id: string
  text: string
  level: number
}

const headingProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)

/** Use the rendered Markdown tree, including inline formatting and duplicate IDs. */
export function extractHeadings(markdown: string): Heading[] {
  const tree = headingProcessor.runSync(headingProcessor.parse(markdown))
  const headings: Heading[] = []
  function walk(node: RootContent) {
    if (node.type !== 'element') return
    if (/^h[1-3]$/.test(node.tagName)) {
      headings.push({
        id: String(node.properties.id),
        text: toString(node),
        level: Number(node.tagName[1]),
      })
    }
    node.children.forEach(walk)
  }
  tree.children.forEach(walk)
  return headings
}

const documentRoutes: Record<string, string> = {
  'randomtablespecv1.md': '/guide/spec',
  'randomtablespecv1_1.md': '/guide/spec',
  'quickstart.md': '/guide/quickstart',
  'usingrolldeo.md': '/guide/using-rolldeo',
  'random-table-spec-v1.0.json': '/schemas/random-table-spec-v1.0.json',
  'random-table-spec-v1.1.json': '/guide/schema',
}

export function guideLink(href?: string): string | undefined {
  if (!href || /^(?:[a-z]+:|\/\/|#|\/schemas\/)/i.test(href)) return href
  const [path, hash] = href.split('#', 2)
  const route = documentRoutes[path.split('/').pop()!.toLowerCase()]
  return route ? `${route}${hash ? `#${hash}` : ''}` : href
}
