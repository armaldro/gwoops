import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @nest/domain is a workspace package of raw .ts sources, not a built
  // artifact. Next.js must be told to compile it rather than treat it as a
  // prebuilt dependency.
  transpilePackages: ['@nest/domain'],
  experimental: {
    // Server actions receive downscaled images; keep headroom for multi-upload.
    serverActions: { bodySizeLimit: '8mb' },
  },
}

export default nextConfig
