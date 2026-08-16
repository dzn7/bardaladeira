/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-0847453da3244ef199890651ca6b0fc7.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '**.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '**.backblazeb2.com',
      },
    ],
  },
  allowedDevOrigins: ['192.168.18.248'],
}

module.exports = nextConfig
