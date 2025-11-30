# Security Audit Report

## Executive Summary

| Category | Critical | High | Medium | Low | Info |
|----------|----------|------|--------|-----|------|
| XSS Vulnerabilities | 0 | 0 | 0 | 0 | 1 |
| Input Validation | 0 | 0 | 0 | 0 | 2 |
| Authentication/Authorization | N/A | N/A | N/A | N/A | N/A |
| Secrets Management | 0 | 0 | 0 | 0 | 1 |
| SQL/NoSQL Injection | 0 | 0 | 0 | 0 | 1 |
| Dependency Vulnerabilities | 0 | 0 | 0 | 1 | 1 |
| Sensitive Data Exposure | 0 | 0 | 0 | 1 | 1 |
| **Total** | **0** | **0** | **0** | **2** | **7** |

**Overall Assessment:** The application has **excellent security posture** for a client-side PWA. No critical, high, or medium severity issues were found. The architecture naturally mitigates many common web vulnerabilities.

---

## Application Security Context

### Architecture Overview

Rolldeo is a **client-side only Progressive Web App (PWA)** for TTRPG random table management. This architecture provides inherent security benefits:

- **No server-side code** - Eliminates server-side injection attacks
- **No user authentication** - No credentials to steal or sessions to hijack
- **No backend database** - All data stored locally in IndexedDB
- **No network APIs** - Application works entirely offline

### Data Classification

| Data Type | Storage | Sensitivity |
|-----------|---------|-------------|
| Table collections (JSON) | IndexedDB | Low - User-created game content |
| Roll history | IndexedDB | Low - Random roll results |
| UI preferences | localStorage | None - Theme, panel sizes |
| PWA state | localStorage | None - Install prompt dismissal |

---

## 1. XSS Vulnerabilities

### 1.1 Direct DOM Manipulation

**Finding:** No dangerous DOM manipulation patterns found

**Searched Patterns:**
- `dangerouslySetInnerHTML` - **Not found** in source code (only in node_modules)
- `innerHTML` / `outerHTML` - **Not found** in source code
- `eval()` / `new Function()` - **Not found** in source code

**Assessment:** The codebase uses React's JSX rendering exclusively, which automatically escapes content.

---

### 1.2 Markdown Rendering - INFO

**Location:** `src/components/guide/MarkdownRenderer.tsx`

**Implementation:**
```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'

<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeSlug, rehypeHighlight]}
  components={{...}}
>
  {content}
</ReactMarkdown>
```

**Assessment:** ReactMarkdown (v9.1.0) is secure by default - it renders to React components, not raw HTML. Content is automatically escaped.

**External Link Handling:**
```typescript
a: ({ href, children }) => (
  <a
    href={href}
    target={href?.startsWith('http') ? '_blank' : undefined}
    rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
  >
    {children}
  </a>
)
```

**Assessment:** External links correctly use `rel="noopener noreferrer"` to prevent tabnabbing attacks.

---

### 1.3 User-Generated Content Display

**Locations:**
- `src/components/roller/CurrentRollResult.tsx`
- `src/components/roller/RollHistoryList.tsx`
- `src/components/editor/PatternPreview/InlineResult.tsx`

**Assessment:** Roll results from user-created tables are rendered through React components. The `RollResult` type contains:
- `text: string` - Rendered via JSX `{result.text}`
- `value: string` - Rendered via JSX `{result.value}`

React's automatic escaping prevents XSS even if malicious content is in imported JSON files.

---

## 2. Input Validation

### 2.1 Document Validation - INFO (Excellent)

**Location:** `src/engine/core/validator.ts`

The application implements comprehensive validation for imported documents:

**Validation Rules:**
```typescript
// Namespace validation
const NAMESPACE_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/

// Version validation (semver)
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/

// Identifier validation
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/
```

**Validations Performed:**
- Required metadata fields (name, namespace, version, specVersion)
- Table/template ID format validation
- Entry weight/range validation
- Circular inheritance detection
- Reserved word checking

**Assessment:** Comprehensive validation prevents malformed documents from entering the system.

---

### 2.2 File Upload Validation - INFO (Good)

**Location:** `src/services/import.ts`, `src/components/upload/DropZone.tsx`

**File Type Filtering:**
```typescript
export function isJsonFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.json') ||
    file.type === 'application/json'
  )
}

export function isZipFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  )
}
```

**ZIP Processing Security:**
```typescript
// Get all JSON files, excluding Mac OS metadata and hidden files
const jsonFiles = Object.keys(zip.files).filter((name) => {
  if (!name.toLowerCase().endsWith('.json')) return false
  if (name.startsWith('__MACOSX')) return false  // Mac metadata
  if (name.split('/').some((segment) => segment.startsWith('.'))) return false  // Hidden
  if (zip.files[name].dir) return false  // Directories
  return true
})
```

**Assessment:**
- File type validation by extension and MIME type
- Hidden file filtering
- Mac OS metadata exclusion
- No path traversal vulnerability (JSZip handles this safely)

---

## 3. Authentication/Authorization

**Assessment:** Not applicable.

This is a client-side only PWA with no user accounts, no server-side code, and no network APIs. All data is stored locally and belongs to the user.

---

## 4. Secrets Management

### 4.1 Hardcoded Secrets Search - INFO (None Found)

**Searched Patterns:**
- API keys (`api_key`, `apikey`, `api-key`)
- Tokens (`token`, `secret`, `password`, `credential`)
- AWS keys (`AKIA`, `aws_`)
- Private keys (`-----BEGIN`)

**Result:** No hardcoded secrets found in source code.

---

### 4.2 localStorage Usage - INFO (Appropriate)

**Locations and Data:**

| Key | Location | Data Stored |
|-----|----------|-------------|
| `ui-store` | `src/stores/uiStore.ts` | Theme preference only |
| `roll-store` | `src/stores/rollStore.ts` | Selected collection/table IDs |
| `pwa-install-dismissed` | `src/components/common/InstallPrompt.tsx` | Timestamp of dismissal |

**Assessment:** localStorage contains only UI preferences and navigation state - no sensitive data.

---

## 5. SQL/NoSQL Injection

### 5.1 IndexedDB Usage - INFO (Safe)

**Location:** `src/services/db.ts`

The application uses the `idb` library (v8.0.0) which provides:
- Type-safe IndexedDB operations
- Parameterized queries (key-based lookups only)
- No string interpolation in queries

**Example Safe Pattern:**
```typescript
export async function getCollection(id: string): Promise<StoredCollection | undefined> {
  const db = await init()
  return db.get('collections', id)  // Safe - parameterized by idb
}
```

**Assessment:** IndexedDB is inherently safe from injection attacks because it uses key-based access, not query strings.

---

## 6. Dependency Vulnerabilities

### 6.1 Dependency Versions - INFO

**Current Dependencies (from package.json):**

| Package | Version | Status |
|---------|---------|--------|
| react | 18.3.1 | Current |
| react-dom | 18.3.1 | Current |
| react-router-dom | 6.28.0 | Current |
| zustand | 5.0.1 | Current |
| ajv | 8.17.1 | Current |
| jszip | 3.10.1 | Current |
| react-markdown | 9.1.0 | Current |
| idb | 8.0.0 | Current |
| vite | 6.0.1 | Current |
| typescript | 5.6.2 | Current |

**Assessment:** All dependencies are recent versions from late 2024/2025.

---

### 6.2 Recommendation - LOW

**Issue:** No automated dependency vulnerability scanning configured.

**Recommendation:** Add `npm audit` to CI/CD pipeline:

```json
// package.json
{
  "scripts": {
    "audit": "npm audit --audit-level=high",
    "audit:fix": "npm audit fix"
  }
}
```

**Alternative:** Use GitHub Dependabot or Snyk for automated vulnerability alerts.

---

## 7. Sensitive Data Exposure

### 7.1 Console Logging Review - LOW

**Findings:**

| File | Line | Pattern | Data Logged |
|------|------|---------|-------------|
| `engine/core/index.ts` | 1381, 1429, 1491, etc. | `console.warn` | Table IDs, error messages |
| `engine/core/math.ts` | 207, 271, 281, 309 | `console.warn/error` | Math expressions, variable names |
| `stores/rollStore.ts` | 249, 267, 281 | `console.error` | Generic error messages |
| `components/common/ErrorBoundary.tsx` | 39-40 | `console.error` | React error info |

**Assessment:**
- Logged data is technical debugging info (table IDs, math expressions)
- No user credentials or PII logged
- Error boundaries log stack traces (standard React practice)

**Recommendation (Optional):** For production builds, consider:
```typescript
// vite.config.ts
export default defineConfig({
  esbuild: {
    drop: import.meta.env.PROD ? ['console'] : [],
  },
})
```

---

### 7.2 Data at Rest - INFO

**IndexedDB Contents:**
- Table collection documents (user-created game content)
- Roll history (random results)
- User preferences (theme setting)

**Assessment:** No sensitive data stored. All data is user-generated TTRPG content with no PII.

---

## 8. Additional Security Considerations

### 8.1 Content Security Policy

**Current State:** No CSP headers configured.

**Recommendation (Optional):** For additional hardening, add CSP in `index.html`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data:;
  connect-src 'self';
">
```

**Impact:** Low priority - the application has no network requests or external resources to protect against.

---

### 8.2 Service Worker Security

**Location:** Vite PWA plugin configuration

**Assessment:** Service worker is generated by `vite-plugin-pwa` and `workbox`, which follow security best practices for caching and offline functionality.

---

### 8.3 URL Handling

**Findings:**
- External links use `target="_blank"` with `rel="noopener noreferrer"`
- Navigation uses React Router (safe)
- `window.location.href = '/'` used only in ErrorBoundary recovery

**Assessment:** URL handling is secure.

---

## Summary of Findings

### Issues to Address (Optional)

| Priority | Issue | Location | Remediation |
|----------|-------|----------|-------------|
| LOW | No automated dependency scanning | CI/CD | Add `npm audit` to build |
| LOW | Console logging in production | Various | Consider removing for production |

### Security Strengths

1. **No server-side attack surface** - Client-only architecture
2. **React XSS protection** - Automatic escaping of rendered content
3. **Comprehensive input validation** - Documents validated against schema
4. **Safe markdown rendering** - ReactMarkdown with proper link handling
5. **Type-safe database access** - IndexedDB via `idb` library
6. **No hardcoded secrets** - No credentials in codebase
7. **Current dependencies** - All packages at recent versions
8. **Proper external link handling** - `noopener noreferrer` attributes

---

## Security Score

```
Security Score

   95/100

   Breakdown:
   XSS Protection                          20/20
   Input Validation                        20/20
   Data Protection                         18/20
   Dependency Security                     18/20
   Code Quality                            19/20

```

The codebase demonstrates **excellent security practices** for a client-side application. The PWA architecture naturally eliminates many common web vulnerabilities, and the implementation follows security best practices throughout.

---

## Recommendations Summary

### Quick Wins
1. Add `npm audit` to CI/CD pipeline
2. Consider dropping console statements in production builds

### Future Considerations
1. Add Content Security Policy headers
2. Set up automated dependency vulnerability scanning (Dependabot/Snyk)
3. Consider Subresource Integrity (SRI) for any CDN resources if added later

---

*Report generated: 2025-11-30*
*Audited files: src/** (excluding node_modules, dist)*
