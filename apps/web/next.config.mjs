/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@reviewly/shared"],
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const apiOrigin = process.env.API_URL ?? "http://localhost:3001"
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }]
  },
}

export default nextConfig
