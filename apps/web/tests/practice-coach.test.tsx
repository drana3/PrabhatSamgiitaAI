import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PracticeCoach } from "@/components/practice-coach"
import type { TransposedNotation } from "@/lib/api"

const notation: TransposedNotation = {
  song_number: 1,
  source_scale: "C",
  target_scale: "C",
  verification_status: "practice_draft",
  notation: {
    version: 1,
    source_scale: "C",
    lines: [{ line_number: 1, lyrics: "Bandhu he", measures: [{ beats: [{ beat: 1, notes: [{ sargam: "Sa", western: "C4", duration: 1, octave: "middle" }] }] }] }],
  },
}

describe("PracticeCoach feedback states", () => {
  it("explains a denied microphone instead of failing silently", async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")) },
    })
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: class MediaRecorder {} })

    render(<PracticeCoach notation={notation} />)
    await user.click(screen.getByRole("button", { name: /Record practice/ }))

    expect(await screen.findByText(/Microphone access was not available/i)).toBeVisible()
  })

  it("finishes an unsupported audio analysis with an actionable result", async () => {
    const user = userEvent.setup()
    render(<PracticeCoach notation={notation} />)
    const input = screen.getByLabelText("Choose audio file")

    await user.upload(input, new File(["invalid audio"], "practice.wav", { type: "audio/wav" }))

    expect(await screen.findByText("Analysis complete")).toBeVisible()
    expect(screen.getByText(/could not be analysed/i)).toBeVisible()
    await waitFor(() => expect(screen.queryByText(/Analysing melody/i)).not.toBeInTheDocument())
  })

  it("disables analysis responsibly when no notation reference exists", () => {
    render(<PracticeCoach notation={null} />)
    expect(screen.getByText(/notation reference is needed/i)).toBeVisible()
    expect(screen.queryByRole("button", { name: /Record practice/ })).not.toBeInTheDocument()
  })
})
