/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fvonaaujmtynnqtufkeb.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
}

module.exports = nextConfig 