import { describe, expect, it } from "vitest"

import { createFormFocus, FOCUS_MARGIN } from "@/lib/forms/focusInvalid"

function setup(measureTo: (node: unknown) => number | null = () => null) {
  const scrolls: number[] = []
  let renders = 0
  const form = createFormFocus({ scrollTo: (y) => scrolls.push(y), measure: async (node) => measureTo(node), changed: () => renders++ })
  const register = (key: string, layoutY: number | null = null, input: unknown = null) => {
    const props = form.field(key)
    props.ref({ key })
    if (layoutY !== null) props.onLayout({ nativeEvent: { layout: { y: layoutY } } })
    if (input) form.input(key)(input)
  }
  return { form, scrolls, register, renders: () => renders }
}

describe("focusInvalid: jump to the first empty required field", () => {
  it("goes to the first key of the list that is on screen, in the order given", async () => {
    const { form, scrolls, register } = setup()
    register("place", 600)
    register("title", 200)
    expect(await form.focusFirst(["title", "place"])).toBe("title")
    expect(scrolls).toEqual([200 - FOCUS_MARGIN])
    expect(await form.focusFirst(["place", "title"])).toBe("place")
    expect(scrolls[1]).toBe(600 - FOCUS_MARGIN)
  })

  it("skips keys that are not on screen and says null when none is", async () => {
    const { form, scrolls, register } = setup()
    register("title", 100)
    expect(await form.focusFirst(["language", "title"])).toBe("title")
    expect(await form.focusFirst(["language", "dance"])).toBeNull()
    expect(scrolls).toHaveLength(1)
  })

  it("prefers the measured position inside the scroll content over the one from onLayout", async () => {
    const { form, scrolls, register } = setup((node) => ((node as { key: string }).key === "nested" ? 900 : null))
    register("nested", 40)
    await form.focusFirst(["nested"])
    expect(scrolls).toEqual([900 - FOCUS_MARGIN])
  })

  it("never scrolls above the top, and survives a measure that throws", async () => {
    const scrolls: number[] = []
    const form = createFormFocus({ scrollTo: (y) => scrolls.push(y), measure: async () => { throw new Error("no layout") }, changed: () => {} })
    const props = form.field("title")
    props.ref({})
    props.onLayout({ nativeEvent: { layout: { y: 5 } } })
    await form.focusFirst(["title"])
    expect(scrolls).toEqual([0])
  })

  it("focuses the input of the field and shows its message under it, until it is cleared", async () => {
    const focused: string[] = []
    const { form, register, renders } = setup()
    register("title", 10, { focus: () => focused.push("title") })
    register("place", 80)
    expect(form.error("title")).toBeNull()
    await form.focusFirst(["title", "place"], { title: "Add a title.", place: "Add a place." })
    expect(focused).toEqual(["title"])
    expect(form.error("title")).toBe("Add a title.")
    expect(form.error("place")).toBeNull()
    expect(renders()).toBe(1)
    form.clear("place") // another field: nothing changes
    expect(form.error("title")).toBe("Add a title.")
    form.clear("title")
    expect(form.error("title")).toBeNull()
    await form.focusFirst(["place"], { place: "Add a place." })
    expect(form.error("place")).toBe("Add a place.")
    expect(form.error("title")).toBeNull()
    form.clear()
    expect(form.error("place")).toBeNull()
  })

  it("a field that left the screen is no longer a target", async () => {
    const { form, register } = setup()
    register("title", 100)
    form.field("title").ref(null)
    expect(form.has("title")).toBe(false)
    expect(await form.focusFirst(["title"])).toBeNull()
  })

  it("a field without an input still gets the scroll and the message", async () => {
    const { form, scrolls, register } = setup()
    register("dance", 700)
    expect(await form.focusFirst(["dance"], { dance: "Choose the dance." })).toBe("dance")
    expect(form.error("dance")).toBe("Choose the dance.")
    expect(scrolls).toEqual([700 - FOCUS_MARGIN])
  })

  it("gives the web an id per field", () => {
    const { form } = setup()
    expect(form.field("title").nativeID).toBe("field-title")
  })
})
