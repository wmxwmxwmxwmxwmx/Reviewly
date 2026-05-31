/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  transpilePackages: ["@reviewly/shared"],
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const apiOrigin = process.env.API_URL ?? "http://127.0.0.1:3001"
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }]
  },
}

export default nextConfig
