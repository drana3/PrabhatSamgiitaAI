import { TagPicker } from "@/components/kirtan/add/TagPicker"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { useT } from "@/lib/i18n"
import { normalizedWord } from "@/lib/kirtan/instruments"
import { kindHasMood, moodChoices, moodLabel, UPLOAD_MOODS } from "@/lib/kirtan/moods"
import type { TagValue } from "@/lib/kirtan/tags"

export type MoodValue = { moods: readonly string[]; moodsOther: readonly string[] }

/**
 * "Mood": one line on the form (the compact picker), several choices (Joyful, Meditative, Longing, Energetic, Mix) and the person's own
 * words. Never required; Baba's Audio Discourses show nothing. Holds no state. The list and the rules: lib/kirtan/moods.ts.
 */
export function MoodField({ theme, kind, value, onChange, disabled }: { theme: SongsTheme; kind: string; value: MoodValue; onChange: (next: MoodValue) => void; disabled?: boolean }) {
  const t = useT()
  if (!kindHasMood(kind)) return null
  const tags: TagValue = { ids: value.moods, own: value.moodsOther }
  return (
    <TagPicker
      theme={theme}
      label={t("mood.field")}
      hint={t("mood.field.hint")}
      disabled={disabled}
      options={moodChoices()}
      labelOf={(id) => moodLabel(id)}
      value={tags}
      onChange={(next) => onChange({ moods: next.ids, moodsOther: next.own })}
      listedFor={(word) => UPLOAD_MOODS.find((id) => normalizedWord(word) === normalizedWord(id) || normalizedWord(word) === normalizedWord(moodLabel(id))) ?? null}
      testID="mood-field"
    />
  )
}
