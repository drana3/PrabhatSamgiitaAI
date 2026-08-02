import { publicContextLink } from "@/lib/context-links"

describe("publicContextLink", () => {
  it("maps NDMA CAP/XML endpoints to the public SACHET homepage", () => {
    expect(
      publicContextLink(
        "https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=1785672086661008",
      ),
    ).toBe("https://sachet.ndma.gov.in/")
  })

  it("keeps normal public source links", () => {
    expect(publicContextLink("https://knowindia.india.gov.in/")).toBe("https://knowindia.india.gov.in/")
  })

  it("returns null for invalid URLs", () => {
    expect(publicContextLink("not-a-url")).toBeNull()
  })
})
