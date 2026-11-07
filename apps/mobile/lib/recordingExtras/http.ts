import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"

/**
 * The one `fetch` helper of the recording extras (comments, chord sheets, video links; docs/recording-extras.md).
 * Plain `fetch`, no React: the base URL, the member headers and `fetch` come in through `RemoteConfig`, so tests run it
 * against a fake server. The error classes are the recordings module's, so one error shape serves every area.
 */

export type Call = <T>(cfg: RemoteConfig, method: string, path: string, body?: unknown) => Promise<T>

/** The `X-Error-Code` header and the `detail` text of a failed answer, as a `RemoteError`. */
export async function readError(response: Response): Promise<RemoteError> {
  let detail: unknown = null
  try {
    detail = ((await response.json()) as { detail?: unknown }).detail
  } catch {
    detail = null
  }
  const code = response.headers?.get?.("X-Error-Code") ?? null
  if (typeof detail === "string" && detail) return new RemoteError(response.status, detail, { code })
  if (Array.isArray(detail) && detail.length) {
    return new RemoteError(response.status, (detail[0] as { msg?: string })?.msg ?? `Request failed (${response.status})`, { code })
  }
  return new RemoteError(response.status, `Request failed (${response.status})`, { code })
}

/** A caller for one API area, e.g. `callFor("/api/v1/video-links")`. A network failure is a `NetworkError`, any other failed answer a `RemoteError`. */
export function callFor(prefix: string): Call {
  return async function call<T>(cfg: RemoteConfig, method: string, path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await (cfg.fetch ?? fetch)(`${cfg.baseUrl.replace(/\/+$/, "")}${prefix}${path}`, {
        method,
        headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...cfg.headers() },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      throw new NetworkError(error instanceof Error ? error.message : undefined)
    }
    if (!response.ok) throw await readError(response)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }
}
