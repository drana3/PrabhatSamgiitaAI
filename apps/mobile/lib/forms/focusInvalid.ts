/**
 * "Jump to the first empty required field": the rule for every form with a Send or Upload button.
 * When the button is pressed and something required is missing, the screen scrolls to that field, puts the cursor
 * in it (when it has an input) and shows which field it is, in words, right under it.
 *
 * Pure core (no React), so it is unit tested; the hook is lib/forms/useFormFocus.ts.
 *
 *   const form = useFormFocus()
 *   <ScrollView ref={form.scrollRef} ...>
 *   <View {...form.field("title")}> <TextInput ref={form.input("title")} /> {form.error("title")} </View>
 *   onSend: if (missing.length) { form.focusFirst(missing, { title: t("err.title") }); return }
 */

/** Where the field sits: a node of the view tree (View ref) and the y reported by its own onLayout. */
type Entry = { node: unknown; layoutY: number | null; input: unknown }

/** What the registry needs from the screen: how to scroll, how to measure a node inside the scroll content. */
export type FocusDeps = {
  /** scroll the form to this y (content coordinates); never throws */
  scrollTo: (y: number) => void
  /** the y of `node` inside the scroll content, or null when it cannot be measured (then onLayout's y is used) */
  measure: (node: unknown) => Promise<number | null>
  /** called after the message to show changed, so the screen can re-render */
  changed: () => void
}

/** How far above the field the scroll stops, so the label is not glued to the top bar. */
export const FOCUS_MARGIN = 24

export type FormFocus = ReturnType<typeof createFormFocus>

export function createFormFocus(deps: FocusDeps) {
  const fields = new Map<string, Entry>()
  let shown: { key: string; message: string | null } | null = null

  const entry = (key: string): Entry => {
    let found = fields.get(key)
    if (!found) {
      found = { node: null, layoutY: null, input: null }
      fields.set(key, found)
    }
    return found
  }

  function setShown(next: { key: string; message: string | null } | null) {
    if (shown?.key === next?.key && shown?.message === next?.message) return
    shown = next
    deps.changed()
  }

  return {
    /** Props to spread on the View that holds the field: registers its node and its layout position. */
    field(key: string) {
      return {
        ref: (node: unknown) => {
          const found = entry(key)
          found.node = node
          if (!node && found.input === null) fields.delete(key)
        },
        onLayout: (event: { nativeEvent: { layout: { y: number } } }) => {
          entry(key).layoutY = event.nativeEvent.layout.y
        },
        // on the web the id also lets a screen reader and `:target` find the field
        nativeID: `field-${key}`,
      }
    },
    /** A ref callback for the field's TextInput, so the cursor can be put in it. */
    input(key: string) {
      return (node: unknown) => {
        entry(key).input = node
      }
    },
    /** The message under the field `key` right now, or null. It goes away with `clear` or when another field is shown. */
    error(key: string): string | null {
      return shown && shown.key === key ? shown.message : null
    },
    /** Clear the message (of one field, or of whatever is shown): call it when the person types in the field. */
    clear(key?: string) {
      if (!shown || (key && shown.key !== key)) return
      setShown(null)
    },
    /** Is this field registered (on screen)? */
    has(key: string): boolean {
      return fields.has(key) && fields.get(key)!.node !== null
    },
    /**
     * Go to the first of `keys` (in the order given) that is on screen: scroll to it, focus its input, show its message.
     * Keys that are not on screen are skipped. Returns the key it went to, or null when none was on screen.
     */
    async focusFirst(keys: readonly string[], messages: Readonly<Record<string, string | null | undefined>> = {}): Promise<string | null> {
      const key = keys.find((candidate) => this.has(candidate))
      if (!key) return null
      const found = fields.get(key)!
      setShown({ key, message: messages[key] ?? null })
      let y: number | null = null
      try {
        y = await deps.measure(found.node)
      } catch {
        y = null
      }
      if (y === null) y = found.layoutY
      if (y !== null) deps.scrollTo(Math.max(0, y - FOCUS_MARGIN))
      const input = found.input as { focus?: () => void } | null
      try {
        input?.focus?.()
      } catch {
        // a field that cannot take focus still got the scroll and the message
      }
      return key
    },
  }
}
