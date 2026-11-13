import type { MetadataRoute } from "next"

import { authorUrl, fetchAuthorSitemap, siteOrigin } from "@/lib/authors"

export const revalidate = 300

/** sitemap.xml: the author directory and every author page a search engine may list (the API decides which). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const authors = await fetchAuthorSitemap()
  return [
    { url: `${siteOrigin()}/authors`, changeFrequency: "daily", priority: 0.5 },
    ...authors.map((a) => ({
      url: authorUrl(a.slug),
      lastModified: new Date(a.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ]
}
