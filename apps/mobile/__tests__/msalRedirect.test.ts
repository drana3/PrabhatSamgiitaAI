import { describe, expect, it } from "vitest"

import { microsoftRedirectHint } from "@/lib/msalRedirect"

describe("Microsoft redirect URI", () => {
  it("uses a path-based custom scheme Azure accepts", () => {
    expect(microsoftRedirectHint()).toBe("prabhatai://auth")
  })
})
