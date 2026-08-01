import { apiUrl } from "@/lib/api"

const cleanDimension = (value: string) => value.replace(/[^a-zA-Z0-9/_-]/g, "_").slice(0, 256) || "unknown"

export function trackEvent(metricType: "page_view" | "feature_use", dimension: string) {
  if (typeof window === "undefined" || process.env.NODE_ENV === "test") return
  void fetch(apiUrl("/api/v1/analytics/events"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metric_type: metricType, dimension: cleanDimension(dimension) }),
    keepalive: true,
  }).catch(() => undefined)
}
