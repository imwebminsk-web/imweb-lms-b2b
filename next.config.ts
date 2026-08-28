import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
if (supabaseUrl) {
  try {
    const host = new URL(supabaseUrl).hostname;
    remotePatterns = [
      {
        protocol: "https",
        hostname: host,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    /* env не URL — пропускаем */
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
  async redirects() {
    return [
      {
        source: "/privacy-agreement",
        destination: "/privacy",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
