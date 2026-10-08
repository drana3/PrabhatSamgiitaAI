import { NextResponse } from "next/server"

const association = {
  applinks: {
    apps: [],
    details: [
      {
        appID: "2665NAM545.net.prabhatasamgiita.ai",
        paths: ["/songs/*", "/songs"],
      },
    ],
  },
}

export function GET() {
  return NextResponse.json(association, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
