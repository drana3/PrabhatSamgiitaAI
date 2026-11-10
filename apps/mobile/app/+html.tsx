import { ScrollViewStyleReset } from "expo-router/html"
import type { PropsWithChildren } from "react"

/**
 * The web page shell. The app draws on #FAF7F2 (Light) or #121110 (Dark); before it loads, the page has no ground of its own and
 * flashes white. Giving html and body the ground of the system theme removes that flash. The in-app Light / Dark / Auto choice
 * is applied by the app after it loads (a person who chose Light on a dark system sees dark for the first moment only).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: PAGE_GROUND }} />
      </head>
      <body>{children}</body>
    </html>
  )
}

const PAGE_GROUND = `
html, body { background-color: #FAF7F2; }
@media (prefers-color-scheme: dark) { html, body { background-color: #121110; } }
`
