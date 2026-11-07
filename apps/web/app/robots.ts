import type { MetadataRoute } from "next"

import { siteOrigin } from "@/lib/authors"

/**
 * robots.txt. Author pages and the directory are open to crawlers; a page that is not ready for search (no
 * recording yet, waiting for the team, suspended) carries `noindex` in its own meta, so it stays out without a
 * rule here. Account, admin and API areas are closed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/author/", "/authors"], disallow: ["/api/", "/admin", "/account", "/auth/", "/signin", "/complete-profile", "/delete-account", "/reset-password", "/forgot-password"] }],
    sitemap: `${siteOrigin()}/sitemap.xml`,
    host: siteOrigin(),
  }
}
