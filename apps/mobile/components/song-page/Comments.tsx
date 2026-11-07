import { CommentsView } from "@/components/comments/CommentsView"
import type { SpTheme } from "@/constants/tokens/amSong"
import { commentableSong } from "@/lib/songComments/rules"

import type { SongPageModel } from "./useSongPageModel"
import { useSongComments } from "./useSongComments"

/**
 * The comments block at the end of the song page. The block itself (invitation, field, anonymous checkbox, list,
 * report and delete) is `components/comments/CommentsView`, shared with the recording page; this only picks the
 * song and its words.
 */
export function CommentsSection({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const songNumber = commentableSong(model.song?.number)
  if (songNumber === null) return null
  return <SongComments key={songNumber} t={t} songNumber={songNumber} />
}

function SongComments({ t, songNumber }: { t: SpTheme; songNumber: number }) {
  const comments = useSongComments(songNumber)
  return (
    <CommentsView
      t={t}
      comments={comments}
      testID="song-comments"
      words="songComments"
    />
  )
}
