/** @type {import('next').NextConfig} */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const apiHost = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).hostname
  : 'localhost';
const apiPort = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).port || '443'
  : '8000';
const apiProtocol = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).protocol.replace(':', '')
  : 'http';

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: apiProtocol,
        hostname: apiHost,
        port: apiPort !== '443' && apiPort !== '80' ? apiPort : undefined,
        pathname: '/uploads/**',
      },
      {
        protocol: apiProtocol,
        hostname: apiHost,
        port: apiPort !== '443' && apiPort !== '80' ? apiPort : undefined,
        pathname: '/generated/**',
      },
    ],
  },
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return [
        {
          source: '/api/:path*',
          destination: `${API_BASE_URL}/api/:path*`,
        },
        {
          source: '/uploads/:path*',
          destination: `${API_BASE_URL}/uploads/:path*`,
        },
        {
          source: '/generated/:path*',
          destination: `${API_BASE_URL}/generated/:path*`,
        },
      ];
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:8000/uploads/:path*',
      },
      {
        source: '/generated/:path*',
        destination: 'http://localhost:8000/generated/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
