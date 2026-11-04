import { describe, expect, it } from "vitest"

import { readableTitle } from "@/lib/readableTitle"

describe("readableTitle", () => {
  it("title-cases a title stored in capitals and keeps diacritics", () => {
    expect(readableTitle("ÁNDHÁRA SHEŚE ÁLORA DESHE")).toBe("Ándhára Sheśe Álora Deshe")
    expect(readableTitle("ELO, ANEK JUGER SEI AJÁNÁ PATHIK")).toBe("Elo, Anek Juger Sei Ajáná Pathik")
  })
  it("leaves mixed case alone", () => {
    expect(readableTitle("Bandhu He Niye Calo")).toBe("Bandhu He Niye Calo")
    expect(readableTitle("E Gán Ámár, Álor Jharańá Dhárá")).toBe("E Gán Ámár, Álor Jharańá Dhárá")
  })
  it("handles empty and caseless text", () => {
    expect(readableTitle("")).toBe("")
    expect(readableTitle("  123  ")).toBe("123")
  })
})
