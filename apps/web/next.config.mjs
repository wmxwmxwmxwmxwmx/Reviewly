/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  transpilePackages: ["@reviewly/shared"],
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const apiOrigin = process.env.API_URL ?? "http://127.0.0.1:3001"
    // fallback：在 App Router 静态/动态 Route Handler 之后执行。
    // 若用数组（afterFiles），动态段如 /api/governance/rules/[id] 会在 rewrite 之后才匹配，
    // PATCH 会直连 Gateway；连接失败时 dev proxy 返回纯文本 500 "Internal Server Error"。
    return {
      fallback: [
        { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      ],
    }
  },
}

export default nextConfig
