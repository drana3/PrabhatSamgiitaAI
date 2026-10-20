import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { isNearDuplicateProse, proseSimilarity } from "@/lib/song-meanings"

describe("isNearDuplicateProse", () => {
  it("rejects exact meaning copies", () => {
    const text = "The heart longs for the Beloved in quiet devotion."
    expect(isNearDuplicateProse(text, text)).toBe(true)
  })

  it("does not hide similar-length Marathi Central ideas that differ in wording", () => {
    // Captured from prod /songs/100/localized?language=Marathi&generate_central_idea=true
    const fixture = {
      localized_meaning:
        "संत्र्यांच्या रंगाने आणि सुगंधाने, नव्या लयीने, तुम्ही आज अवतरले आहात. हिमवादळे निर्माण करून, तुम्ही कडाक्याची थंडी आणली आहात आणि गाणी वाहून नेली आहेत. या अनपेक्षित स्पंदनांनी फुलझाडे आणि आलंबित फुले उगवलीत, आणि मनात प्रश्न उभा राहतो — या खोदलेल्या निद्रेत असणाऱ्यांचीही ही आठवण घेतली का?",
      localized_explanation:
        "आपणास आज नारिंगी रंग आणि सुवास घेऊन एक नवा ताल घेऊन येताना बघतो; थंडीच्या वेगानं वाऱ्यांनी थरथर करीत, हिमावर गाणी वाहवून टाकत आपली लीला सुरू केली आहे. या अनपेक्षित स्पंदनांनी फुलझाडे आणि आलंबित फुले उगवलीत, आणि मनात प्रश्न उभा राहतो — या खोदलेल्या निद्रेत असणाऱ्यांचीही ही आठवण घेतली का?\n\nतरीही या रात्रीच्या प्रकाशात हृदय जागे राहते.",
    }
    // Prefer live fixture when present (same shape as API).
    let meaning = fixture.localized_meaning
    let idea = fixture.localized_explanation
    try {
      const live = JSON.parse(readFileSync("/tmp/mr100.json", "utf8")) as {
        localized_meaning?: string
        localized_explanation?: string
      }
      if (live.localized_meaning && live.localized_explanation) {
        meaning = live.localized_meaning
        idea = live.localized_explanation
      }
    } catch {
      /* use embedded fixture */
    }

    const lenRatio =
      Math.min(meaning.length, idea.length) / Math.max(meaning.length, idea.length)
    // Old client gate: length ratio ≥ 0.82 ⇒ hide Central idea even when wording differs.
    expect(lenRatio).toBeGreaterThanOrEqual(0.82)
    expect(proseSimilarity(meaning, idea)).toBeLessThan(0.88)
    expect(isNearDuplicateProse(idea, meaning)).toBe(false)
  })
})
