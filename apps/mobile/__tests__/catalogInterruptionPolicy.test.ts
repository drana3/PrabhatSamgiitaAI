import { describe, expect, it } from "vitest"

import { planCatalogInterruptionAction } from "@/lib/playback/catalogInterruptionPolicy"

describe("planCatalogInterruptionAction", () => {
  it("ignores duck events when the user is not listening", () => {
    expect(
      planCatalogInterruptionAction({ paused: false, permanent: false }, false),
    ).toBe("none")
    expect(planCatalogInterruptionAction({ paused: true, permanent: true }, false)).toBe("none")
  })

  it("keeps playing through transient duck (Meet / mix)", () => {
    expect(
      planCatalogInterruptionAction({ paused: true, permanent: false }, true),
    ).toBe("none")
  })

  it("resumes after interruption ends when playback is still wanted", () => {
    expect(
      planCatalogInterruptionAction({ paused: false, permanent: false }, true),
    ).toBe("resume")
  })

  it("stops on permanent focus loss", () => {
    expect(
      planCatalogInterruptionAction({ paused: true, permanent: true }, true),
    ).toBe("stop")
  })
})