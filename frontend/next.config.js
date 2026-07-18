/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    esmExternals: 'loose',
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdf-lib': require.resolve('pdf-lib/cjs/index.js'),
    }
    return config
  },
}

module.exports = nextConfig;