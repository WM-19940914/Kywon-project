/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 시 TypeScript 에러 체크 활성화
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { dev }) => {
    // Windows 환경에서 webpack 파일 캐시 깨짐 방지 — 메모리 캐시 사용
    if (dev) {
      config.cache = {
        type: 'memory',
      }
    }
    return config
  },
};

export default nextConfig;
