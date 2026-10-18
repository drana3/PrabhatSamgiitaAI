import { memberFirstName } from "@/lib/member"

describe("memberFirstName", () => {
  it("derives a friendly first name from an email address", () => {
    expect(memberFirstName("dewasheesh.rana3@gmail.com")).toBe("Dewasheesh")
  })

  it("uses the first word for regular display names", () => {
    expect(memberFirstName("Ananda Marga")).toBe("Ananda")
  })
})
