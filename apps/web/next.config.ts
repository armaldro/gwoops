import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Server actions receive downscaled images; keep headroom for multi-upload.
    serverActions: { bodySizeLimit: '8mb' },
  },
}

export default nextConfig
