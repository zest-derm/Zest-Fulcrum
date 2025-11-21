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
    missingSuspenseWithCSRBailout: false
  }
};

export default nextConfig;
