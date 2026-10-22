/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Uploads go direct-to-storage from the client, but we keep a generous
  // body size limit for metadata / admin JSON payloads.
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

module.exports = nextConfig;
