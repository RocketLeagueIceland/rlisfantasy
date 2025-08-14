import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ✅ Skip ESLint in `next build`
  eslint: { ignoreDuringBuilds: true },
  // ✅ Skip TypeScript type errors in `next build`
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig