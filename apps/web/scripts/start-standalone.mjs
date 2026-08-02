import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { spawn } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const standaloneRoot = join(webRoot, ".next", "standalone", "apps", "web")
const serverPath = join(standaloneRoot, "server.js")

if (!existsSync(serverPath)) {
  throw new Error("Standalone build is missing. Run `npm run build` first.")
}

const assets = [
  [join(webRoot, ".next", "static"), join(standaloneRoot, ".next", "static")],
  [join(webRoot, "public"), join(standaloneRoot, "public")],
]

for (const [source, destination] of assets) {
  rmSync(destination, { force: true, recursive: true })
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, { recursive: true })
}

const server = spawn(process.execPath, [serverPath], {
  cwd: standaloneRoot,
  env: {
    ...process.env,
    HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
    PORT: process.env.PORT || "3000",
  },
  stdio: "inherit",
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal))
}

server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
