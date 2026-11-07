import type { Artist } from "@/lib/kirtan/artists"

/**
 * Sample artists of the Kiirtan tab. TODO(api): artists, their photos and their texts come from the
 * backend. Names are made up; each one matches the `author` of some fixture Kiirtans
 * (lib/fixtures/kirtan.ts). Nothing here is for sale: no prices, no albums, no follow.
 */
export const ARTIST_FIXTURES: readonly Artist[] = [
  {
    id: "priya-devi",
    name: "Priya Devi",
    kind: "singer",
    about: "A singer who leads morning and night kiirtan in a small group. She records at home with a harmonium and a tabla, one take, no editing.",
    photoUrl: null,
  },
  {
    id: "dharmacakra",
    name: "Dharmacakra Kiirtan",
    kind: "group",
    about: "A group that sings the Baba Nam Kevalam mantra in long rounds at the weekly dharmacakra. Their recordings are made for meditation and sleep.",
    photoUrl: null,
  },
  {
    id: "lila-group",
    name: "Lila Kiirtan Group",
    kind: "group",
    about: "Sings the lila kiirtans, the stories of Krishna and Shiva told in song, with call and response between the leader and the room.",
    photoUrl: null,
  },
  {
    id: "festival-voices",
    name: "Festival Voices",
    kind: "group",
    about: "A choir that gathers for festivals: Dipavali, Buddha Purnima and the long all-night kiirtan.",
    photoUrl: null,
  },
  {
    id: "arun-deva",
    name: "Arun Deva",
    kind: "singer",
    about: "Plays the harmonium and sings short lila kiirtans. Most of his recordings are made early in the morning.",
    photoUrl: null,
  },
  {
    id: "sadhana-notes",
    name: "Sadhana Notes",
    kind: "group",
    about: "Short, quiet kiirtans to sit down with before meditation. Five to fifteen minutes each.",
    photoUrl: null,
  },
]
