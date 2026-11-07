/** A fake `fetch` for the recording extras tests: records every call and answers once with the given status and body. */
export type Seen = { url: string; init: RequestInit }

export function fakeFetch(answer: { status: number; body?: unknown; headers?: Record<string, string> }, seen: Seen[] = []): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    seen.push({ url, init })
    return {
      ok: answer.status < 400,
      status: answer.status,
      headers: { get: (k: string) => answer.headers?.[k] ?? null },
      json: async () => answer.body,
    } as unknown as Response
  }) as unknown as typeof fetch
}

export const CFG = (fetchImpl: typeof fetch) => ({ baseUrl: "https://api.example/", headers: () => ({ Authorization: "Bearer test" }), fetch: fetchImpl })
