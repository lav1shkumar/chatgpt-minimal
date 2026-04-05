import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  logging: {
    browserToTerminal: 'warn'
  },
  reactCompiler: true,
  output: process.env.VERCEL ? undefined : 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.google.com',
        pathname: '/s2/favicons'
      }
    ]
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'radix-ui']
  }
}

export default nextConfig
