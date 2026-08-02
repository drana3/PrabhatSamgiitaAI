export function readErrorDetail(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === "string") return detail
  }
  return fallback
}
