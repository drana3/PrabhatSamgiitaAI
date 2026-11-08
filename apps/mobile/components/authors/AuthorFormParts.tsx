import { useEffect, useState } from "react"
import { Platform, StyleSheet, Switch, Text, TextInput, View } from "react-native"

import { PillButton, Chip, SIDE, WEB_THUMB } from "@/components/authors/AuthorsUi"
import { AccountField } from "@/components/account/AccountUi"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { authorShareUrl } from "@/lib/authors/constants"
import { ABOUT_MAX, BIO_MAX, LINK_KINDS, MAX_LINKS, NAME_MAX, PLACE_MAX, PROFILE_LANGUAGES, SHOW_PAGE_LINK, SLUG_MAX } from "@/lib/authors/constants"
import { type Draft, type DraftErrors, settleSlug, withName, withSlug } from "@/lib/authors/draft"
import { say } from "@/lib/authors/text"
import { problemKey } from "@/lib/authors/slug"
import type { AuthorType, IncludeMode, LinkKind } from "@/lib/authors/types"
import type { SlugState } from "@/hooks/useSlugCheck"
import { useT } from "@/lib/i18n"

type Change = (draft: Draft) => void

/* ------------------------------------------------------------------ name and address */

export function SlugStatus({ theme, state, onPick }: { theme: SongsTheme; state: SlugState; onPick: (slug: string) => void }) {
  const t = useT()
  if (state.kind === "idle") return null
  if (state.kind === "checking") return <Text style={[styles.status, { color: theme.textMuted }]} accessibilityLiveRegion="polite">{t("authors.slug.checking")}</Text>
  if (state.kind === "error") return <Text style={[styles.status, { color: theme.dangerText }]} accessibilityLiveRegion="polite">{say(t, state.key)}</Text>
  if (state.kind === "ok") {
    return (
      <Text style={[styles.status, { color: theme.accentText }]} accessibilityLiveRegion="polite">
        {state.held ? t("authors.slug.held") : t("authors.slug.available")}
      </Text>
    )
  }
  return (
    <View style={styles.statusBlock} accessibilityLiveRegion="polite">
      <Text style={[styles.status, { color: theme.dangerText }]}>{say(t, problemKey(state.problem))}</Text>
      {state.suggestions.length ? (
        <View style={styles.suggest}>
          {state.suggestions.slice(0, 3).map((s) => (
            <Chip key={s} theme={theme} label={s} active={false} onPress={() => onPick(s)} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

export type FormFocusHook = ReturnType<typeof import("@/lib/forms/useFormFocus").useFormFocus>

/**
 * Name, and the link of the page. The link is made from the name and shown as a plain line; changing it is a small
 * text button, not a field. It opens by itself when the link has a problem (taken, reserved) so the person sees why.
 */
export function NameAndAddress({
  theme,
  draft,
  errors,
  touched,
  slug,
  onChange,
  slugLocked,
  form,
}: {
  theme: SongsTheme
  draft: Draft
  errors: DraftErrors
  touched: boolean
  slug: SlugState
  onChange: Change
  /** days to wait before the link can change again; 0 or undefined = free */
  slugLocked?: number
  /** the shared "jump to the first field that is wrong" helper (lib/forms) */
  form?: FormFocusHook
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const trouble = slug.kind === "problem" || slug.kind === "error" || Boolean(errors.slug && draft.slugTouched)
  const editing = !slugLocked && (open || trouble)
  const shown = authorShareUrl(draft.slug).replace(/^https?:\/\//, "")
  // With the link hidden (SHOW_PAGE_LINK) a taken link must not trap the person behind a field they cannot see:
  // the next free suggestion is taken silently; only a problem with no suggestion is shown, as a plain line.
  const hiddenSuggestion = !SHOW_PAGE_LINK && slug.kind === "problem" && slug.suggestions.length ? slug.suggestions[0] : null
  useEffect(() => {
    if (hiddenSuggestion) onChange({ ...draft, slug: hiddenSuggestion })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenSuggestion])
  return (
    <View style={styles.group}>
      <View {...(form ? form.field("name") : {})}>
        <AccountField
          ref={form ? (form.input("name") as never) : undefined}
          theme={theme}
          label={t("authors.form.name")}
          value={draft.displayName}
          onChangeText={(v) => {
            form?.clear("name")
            onChange(withName(draft, v))
          }}
          maxLength={NAME_MAX}
          autoCapitalize="words"
          autoCorrect={false}
          aside={`${draft.displayName.length}/${NAME_MAX}`}
          hint={t("authors.form.nameHint")}
          error={touched && errors.name ? t(errors.name === "too_short" ? "authors.error.name_too_short" : "authors.error.name_too_long") : null}
        />
      </View>
      {!SHOW_PAGE_LINK ? (
        <View {...(form ? form.field("slug") : {})}>{slug.kind === "problem" || slug.kind === "error" ? <SlugStatus theme={theme} state={slug} onPick={(s) => onChange({ ...draft, slug: s })} /> : null}</View>
      ) : (
        <View style={styles.linkBlock} {...(form ? form.field("slug") : {})}>
          {editing ? null : <Text style={[styles.label, { color: theme.textBody }]}>{t("authors.form.slug")}</Text>}
          <Text style={[styles.note, { color: theme.textMuted }]}>{t("authors.form.linkHelp")}</Text>
          {editing ? (
            <>
              <AccountField
                ref={form ? (form.input("slug") as never) : undefined}
                theme={theme}
                label={t("authors.form.slug")}
                value={draft.slug}
                onChangeText={(v) => onChange(withSlug(draft, v))}
                onBlur={() => onChange(settleSlug(draft))}
                maxLength={SLUG_MAX}
                autoCapitalize="none"
                autoCorrect={false}
                hint={t("authors.form.slugHint")}
              />
              <Text style={[styles.preview, { color: theme.textBody }]} selectable>
                {shown}
              </Text>
              <SlugStatus theme={theme} state={slug} onPick={(s) => onChange(withSlug(draft, s))} />
              {!trouble ? <PillButton theme={theme} tone="quiet" label={t("authors.form.linkKeep")} onPress={() => setOpen(false)} /> : null}
            </>
          ) : (
            <>
              <Text style={[styles.preview, { color: draft.slug ? theme.textHeading : theme.textMuted }]} selectable accessibilityLabel={draft.slug ? shown : t("authors.form.linkEmpty")}>
                {draft.slug ? shown : t("authors.form.linkEmpty")}
              </Text>
              {draft.slug ? <SlugStatus theme={theme} state={slug} onPick={(s) => onChange(withSlug(draft, s))} /> : null}
              {slugLocked ? (
                <Text style={[styles.note, { color: theme.textMuted }]}>{t("authors.form.slugWait", { count: slugLocked })}</Text>
              ) : !draft.slug ? null : (
                <KPress accessibilityRole="button" onPress={() => setOpen(true)} pressedScale={0.97} style={styles.changeLink} hitSlop={12}>
                  <Text style={[styles.changeText, { color: theme.accentText }]}>{t("authors.form.linkChange")}</Text>
                </KPress>
              )}
            </>
          )}
        </View>
      )}
    </View>
  )
}

/* ------------------------------------------------------------------ about */

function MultiField({
  theme,
  label,
  value,
  onChangeText,
  max,
  lines,
  hint,
  error,
  inputRef,
}: {
  theme: SongsTheme
  label: string
  value: string
  onChangeText: (v: string) => void
  max: number
  lines: number
  hint?: string | null
  error?: string | null
  inputRef?: (node: unknown) => void
}) {
  const [focused, setFocused] = useState(false)
  const border = error ? theme.dangerText : focused ? theme.accentBright : theme.line
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textBody }]}>{label}</Text>
        <Text style={[styles.aside, { color: value.length > max ? theme.dangerText : theme.textMuted }]}>{`${value.length}/${max}`}</Text>
      </View>
      <TextInput
        ref={inputRef as never}
        accessibilityLabel={label}
        multiline
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={theme.textMuted}
        selectionColor={theme.accentBright}
        textAlignVertical="top"
        style={[
          styles.multi,
          { minHeight: lines * 24 + 24, backgroundColor: theme.card, borderColor: border, color: theme.textHeading, borderWidth: focused || error ? 2 : 1 },
          Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null,
        ]}
      />
      {error ? <Text style={[styles.note, { color: theme.dangerText }]} accessibilityRole="alert">{error}</Text> : hint ? <Text style={[styles.note, { color: theme.textMuted }]}>{hint}</Text> : null}
    </View>
  )
}

export function AboutFields({ theme, draft, errors, onChange, form }: { theme: SongsTheme; draft: Draft; errors: DraftErrors; onChange: Change; form?: FormFocusHook }) {
  const t = useT()
  const type = (value: AuthorType) => onChange({ ...draft, authorType: value })
  const toggleLanguage = (code: string) =>
    onChange({ ...draft, languages: draft.languages.includes(code) ? draft.languages.filter((l) => l !== code) : [...draft.languages, code] })
  return (
    <View style={styles.group}>
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.textBody }]}>{t("authors.form.type")}</Text>
        <View style={styles.chips}>
          <Chip theme={theme} label={t("authors.type.solo")} active={draft.authorType === "solo"} onPress={() => type("solo")} />
          <Chip theme={theme} label={t("authors.type.group")} active={draft.authorType === "group"} onPress={() => type("group")} />
        </View>
      </View>
      <View {...(form ? form.field("bio") : {})}>
      <MultiField
        inputRef={form?.input("bio")}
        theme={theme}
        label={t("authors.form.bio")}
        value={draft.bio}
        onChangeText={(v) => onChange({ ...draft, bio: v })}
        max={BIO_MAX}
        lines={3}
        hint={t("authors.form.bioHint")}
        error={errors.bio ? t("authors.error.too_long") : null}
      />
      </View>
      <View {...(form ? form.field("about") : {})}>
      <MultiField
        inputRef={form?.input("about")}
        theme={theme}
        label={t("authors.form.about")}
        value={draft.about}
        onChangeText={(v) => onChange({ ...draft, about: v })}
        max={ABOUT_MAX}
        lines={6}
        error={errors.about ? t("authors.error.too_long") : null}
      />
      </View>
      <View style={styles.two} {...(form ? form.field("place") : {})}>
        <View style={styles.half}>
          <AccountField ref={form ? (form.input("place") as never) : undefined} theme={theme} label={t("authors.form.country")} value={draft.country} onChangeText={(v) => onChange({ ...draft, country: v })} maxLength={PLACE_MAX} error={errors.place ? t("authors.error.too_long") : null} />
        </View>
        <View style={styles.half}>
          <AccountField theme={theme} label={t("authors.form.city")} value={draft.city} onChangeText={(v) => onChange({ ...draft, city: v })} maxLength={PLACE_MAX} />
        </View>
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.textBody }]}>{t("authors.form.languages")}</Text>
        <View style={styles.chips}>
          {PROFILE_LANGUAGES.map((code) => (
            <Chip key={code} theme={theme} label={say(t, `authors.language.${code}`)} active={draft.languages.includes(code)} onPress={() => toggleLanguage(code)} />
          ))}
        </View>
      </View>
      <AccountField
        theme={theme}
        label={t("authors.form.claim")}
        value={draft.claimedName}
        onChangeText={(v) => onChange({ ...draft, claimedName: v })}
        maxLength={120}
        autoCorrect={false}
        hint={t("authors.form.claimHint")}
      />
    </View>
  )
}

/* ------------------------------------------------------------------ links */

export function LinksEditor({ theme, draft, errors, onChange, form }: { theme: SongsTheme; draft: Draft; errors: DraftErrors; onChange: Change; form?: FormFocusHook }) {
  const t = useT()
  const setLink = (index: number, patch: Partial<{ kind: LinkKind; url: string }>) =>
    onChange({ ...draft, links: draft.links.map((l, i) => (i === index ? { ...l, ...patch } : l)) })
  const cycle = (index: number) => {
    const current = draft.links[index]
    if (!current) return
    const at = LINK_KINDS.indexOf(current.kind)
    setLink(index, { kind: LINK_KINDS[(at + 1) % LINK_KINDS.length] as LinkKind })
  }
  return (
    <View style={styles.group} {...(form ? form.field("links") : {})}>
      <Text style={[styles.label, { color: theme.textBody }]}>{t("authors.form.links")}</Text>
      <Text style={[styles.note, { color: theme.textMuted }]}>{t("authors.form.linksHint")}</Text>
      {draft.links.map((link, index) => (
        <View key={index} style={styles.linkRow}>
          <KPress
            accessibilityRole="button"
            accessibilityLabel={t("authors.form.linkKind", { kind: say(t, `authors.link.${link.kind}`) })}
            onPress={() => cycle(index)}
            pressedScale={0.95}
            style={[styles.kindButton, { borderColor: theme.line, backgroundColor: theme.card }]}
          >
            <Text style={[styles.kindText, { color: theme.textHeading }]}>{say(t, `authors.link.${link.kind}`)}</Text>
          </KPress>
          <View style={styles.linkField}>
            <AccountField
              theme={theme}
              label={t("authors.form.linkUrl")}
              value={link.url}
              onChangeText={(v) => setLink(index, { url: v })}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              maxLength={300}
            />
          </View>
          <KPress
            accessibilityRole="button"
            accessibilityLabel={t("authors.form.linkRemove")}
            onPress={() => onChange({ ...draft, links: draft.links.filter((_, i) => i !== index) })}
            pressedScale={0.9}
            style={styles.remove}
          >
            <Text style={[styles.removeText, { color: theme.dangerText }]}>×</Text>
          </KPress>
        </View>
      ))}
      {errors.links ? <Text style={[styles.note, { color: theme.dangerText }]} accessibilityRole="alert">{t(errors.links === "too_many" ? "authors.error.link_count" : "authors.error.link_url")}</Text> : null}
      {draft.links.length < MAX_LINKS ? (
        <PillButton theme={theme} tone="line" label={t("authors.form.linkAdd")} onPress={() => onChange({ ...draft, links: [...draft.links, { kind: "website", url: "" }] })} />
      ) : null}
    </View>
  )
}

/* ------------------------------------------------------------------ which uploads, statistics */

export function UploadChoices({ theme, draft, onChange }: { theme: SongsTheme; draft: Draft; onChange: Change }) {
  const t = useT()
  const mode = (value: IncludeMode) => onChange({ ...draft, includeUploads: value })
  const option = (value: IncludeMode, title: string, body: string) => {
    const active = draft.includeUploads === value
    return (
      <KPress
        key={value}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${title}. ${body}`}
        onPress={() => mode(value)}
        pressedScale={0.98}
        style={[styles.option, { backgroundColor: theme.card, borderColor: active ? theme.accentBright : theme.line, borderWidth: active ? 2 : 1 }]}
      >
        <Text style={[styles.optionTitle, { color: theme.textHeading }]}>{title}</Text>
        <Text style={[styles.optionBody, { color: theme.textBody }]}>{body}</Text>
      </KPress>
    )
  }
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: theme.textBody }]}>{t("authors.form.uploads")}</Text>
      {option("all", t("authors.uploads.all"), t("authors.uploads.allBody"))}
      {option("chosen", t("authors.uploads.chosen"), t("authors.uploads.chosenBody"))}
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={[styles.optionTitle, { color: theme.textHeading }]}>{t("authors.form.showStats")}</Text>
          <Text style={[styles.optionBody, { color: theme.textBody }]}>{t("authors.form.showStatsBody")}</Text>
        </View>
        <Switch
          accessibilityLabel={t("authors.form.showStats")}
          value={draft.showStats}
          onValueChange={(v) => onChange({ ...draft, showStats: v })}
          trackColor={{ true: theme.brand, false: theme.line }}
          thumbColor="#FFFFFF"
          {...WEB_THUMB}
        />
      </View>
    </View>
  )
}

export const FORM_SIDE = SIDE

const styles = StyleSheet.create({
  group: { gap: 14 },
  linkBlock: { gap: 8 },
  changeLink: { alignSelf: "flex-start", paddingVertical: 4 },
  changeText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20, textDecorationLine: "underline" },
  field: { gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  label: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  aside: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 19 },
  multi: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontFamily: amFonts.regular, fontSize: 16, lineHeight: 24 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  two: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  status: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  statusBlock: { gap: 8 },
  suggest: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preview: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 22 },
  linkRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  linkField: { flex: 1 },
  kindButton: { minHeight: 56, minWidth: 92, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  kindText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  remove: { width: 44, height: 56, alignItems: "center", justifyContent: "center" },
  removeText: { fontFamily: amFonts.bold, fontSize: 26, lineHeight: 28 },
  option: { borderRadius: 16, padding: 14, gap: 2 },
  optionTitle: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  optionBody: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 6 },
  switchText: { flex: 1, gap: 2 },
})
