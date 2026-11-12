import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_SERVER,
} from 'next/constants.js';

/** @type {import('next').NextConfig} */
export default function createNextConfig(phase) {
  // Never force static export in `next dev` or `next start` so dynamic `/circles/[id]` routes work seamlessly.
  const isServerMode =
    phase === PHASE_DEVELOPMENT_SERVER ||
    phase === PHASE_PRODUCTION_SERVER ||
    process.env.NEXT_OUTPUT_MODE === 'server' ||
    Boolean(process.env.VERCEL);

  return {
    ...(isServerMode ? {} : { output: 'export' }),
    images: {
      unoptimized: true,
    },
    experimental: {
      optimizePackageImports: ['lucide-react', 'viem'],
    },
    transpilePackages: ['@avahui/shared', '@avahui/blockchain'],
    reactStrictMode: true,
    webpack: (config) => {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@farcaster/mini-app-solana': false,
        '@abstract-foundation/agw-client': false,
        permissionless: false,
      };
      return config;
    },
  };
}
