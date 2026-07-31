/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@tanstack/react-query"],
  },
}

export default nextConfig
