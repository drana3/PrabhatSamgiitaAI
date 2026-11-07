import { create } from "zustand"

/**
 * "Continued from 1:23": set when a song starts from its saved position, so the player can say so and
 * offer "Start over". Memory only: it is about the song playing now.
 */
type ResumeNotice = {
  songNumber: number | null
  /** the second the song was continued from */
  from: number
  show: (songNumber: number, from: number) => void
  clear: () => void
}

export const useResumeNotice = create<ResumeNotice>()((set) => ({
  songNumber: null,
  from: 0,
  show: (songNumber, from) => set({ songNumber, from }),
  clear: () => set({ songNumber: null, from: 0 }),
}))

/** How long after the saved position the notice stays: long enough to notice it, short enough not to nag. */
export const RESUME_NOTICE_SECONDS = 30

/** True while the notice belongs to this song and playback is still near where it was continued. */
export function resumeNoticeVisible(
  notice: { songNumber: number | null; from: number },
  songNumber: number | null,
  position: number,
): boolean {
  if (songNumber == null || notice.songNumber !== songNumber || !(notice.from > 0)) return false
  return position < notice.from + RESUME_NOTICE_SECONDS
}
