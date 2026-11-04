/* Local CORS proxy for the browser preview. Browsers block calls from
 * localhost to the API because the API sends no CORS headers; this forwards
 * every request unchanged and adds them. Preview only, never shipped. */
const http = require("http")
const https = require("https")

const target = new URL(
  process.env.PROXY_TARGET || "https://prabhatai-api.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io",
)
const port = Number(process.env.PROXY_PORT || 8100)

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "*",
}

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors)
      res.end()
      return
    }
    const headers = { ...req.headers, host: target.host }
    delete headers.origin
    delete headers.referer
    const upstream = https.request(
      { hostname: target.hostname, port: 443, path: req.url, method: req.method, headers },
      (up) => {
        const out = { ...up.headers, ...cors }
        delete out["content-security-policy"]
        res.writeHead(up.statusCode || 502, out)
        up.pipe(res)
      },
    )
    upstream.on("error", (error) => {
      res.writeHead(502, cors)
      res.end(String(error.message))
    })
    req.pipe(upstream)
  })
  .listen(port, () => console.log(`CORS proxy on http://localhost:${port} -> ${target.origin}`))
