// @ts-nocheck
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ⭐ [추가] 백엔드 API 엔드포인트 설정
  // 운영 시: /api -> 실제 백엔드(8080)로 프록시
  // 개발 시: http://localhost:8080 직접 호출
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
