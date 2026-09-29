/** @type {import('next').NextConfig} */
const nextConfig = {
  // Azure Static Web Apps runs Next.js directly; standalone is for Container Apps Docker only.
  ...(process.env.SWA_DEPLOY === "true" ? {} : { output: "standalone" }),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        pathname: "/v1/create-qr-code/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["@tanstack/react-query"],
  },
}

export default nextConfig
