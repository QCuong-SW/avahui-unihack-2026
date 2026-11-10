/** @type {import('next').NextConfig} */
const isServerMode = process.env.NEXT_OUTPUT_MODE === 'server';

const nextConfig = {
  ...(isServerMode ? {} : { output: 'export' }),
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@avahui/shared', '@avahui/blockchain'],
  reactStrictMode: true,
};

export default nextConfig;
