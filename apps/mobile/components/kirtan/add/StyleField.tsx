import { TagPicker } from "@/components/kirtan/add/TagPicker"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { useT } from "@/lib/i18n"
import { normalizedWord } from "@/lib/kirtan/instruments"
import { kindHasStyle, kindRequiresStyle, similarStyle, STYLES, styleChoices, styleLabel } from "@/lib/kirtan/styles"
import type { TagValue } from "@/lib/kirtan/tags"

export type StyleValue = { styles: readonly string[]; stylesOther: readonly string[] }

/**
 * "Style": one line on the form (the compact picker), several choices (Indian style, Electronic, Acoustic guitar, African, Western) and
 * the person's own words. A Kiirtan must name at least one; the other kinds may; Baba's Audio Discourses show nothing. Holds no state:
 * the caller passes the value and takes the change. The list and the rules: lib/kirtan/styles.ts; the picker: TagPicker.tsx.
 */
export function StyleField({ theme, kind, value, onChange, invalid, errorText, disabled }: { theme: SongsTheme; kind: string; value: StyleValue; onChange: (next: StyleValue) => void; invalid?: boolean; errorText?: string | null; disabled?: boolean }) {
  const t = useT()
  if (!kindHasStyle(kind)) return null
  const required = kindRequiresStyle(kind)
  const tags: TagValue = { ids: value.styles, own: value.stylesOther }
  return (
    <TagPicker
      theme={theme}
      label={t("style.field")}
      hint={required ? t("ugc.form.style.hint") : t("style.field.hint")}
      required={required}
      invalid={invalid}
      errorText={errorText}
      disabled={disabled}
      options={styleChoices()}
      labelOf={(id) => styleLabel(id)}
      value={tags}
      onChange={(next) => onChange({ styles: next.ids, stylesOther: next.own })}
      listedFor={(word) => STYLES.find((id) => normalizedWord(word) === normalizedWord(id.replace(/_/g, " ")) || normalizedWord(word) === normalizedWord(styleLabel(id))) ?? null}
      similar={(word) => similarStyle(word)}
      testID="style-field"
    />
  )
}
