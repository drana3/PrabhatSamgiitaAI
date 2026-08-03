import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.(test|spec).(ts|tsx)"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@prabhat/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
})
