import { setStringAsync } from "expo-clipboard"
import { Platform, Share } from "react-native"

import { authorShareUrl } from "@/lib/authors/constants"

/**
 * Share an author page: the system share sheet on a phone, the clipboard where there is none (the web preview).
 * Returns what happened so the screen can say "Link copied".
 */
export type ShareOutcome = "shared" | "copied" | "failed"

export async function shareAuthor(author: { slug: string; name: string }, intro: string): Promise<ShareOutcome> {
  const url = authorShareUrl(author.slug)
  try {
    if (Platform.OS !== "web") {
      const result = await Share.share({ message: `${intro} ${url}`.trim(), url })
      return result.action === Share.dismissedAction ? "failed" : "shared"
    }
    await setStringAsync(url)
    return "copied"
  } catch {
    try {
      await setStringAsync(url)
      return "copied"
    } catch {
      return "failed"
    }
  }
}

export async function copyAuthorLink(slug: string): Promise<boolean> {
  try {
    await setStringAsync(authorShareUrl(slug))
    return true
  } catch {
    return false
  }
}
