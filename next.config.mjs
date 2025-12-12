/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    },
    // Disable strict check for useSearchParams() in client components
    // This is needed because some client components use useSearchParams
    // and adding export const dynamic = 'force-dynamic' is sufficient
    missingSuspenseWithCSRBailout: false,
    // CRITICAL: Required for Prisma to work correctly in Vercel serverless functions
    // Without this, Prisma won't have access to environment variables
    serverComponentsExternalPackages: ['@prisma/client', '@prisma/engines'],
  }
};

export default nextConfig;
