import { api } from "@/lib/client"

import { createStoryLoader } from "./storyLoader"

/** App-wide loader over the stories API. */
export const storyLoader = createStoryLoader((slug) => api.fetchStory(slug))
