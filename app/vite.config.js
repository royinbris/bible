import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 빌드 시점(호주 브리즈번 시간 기준)으로 자동 버전 생성
const now = new Date();
const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
const bneTime = new Date(utc + (10 * 60 * 60 * 1000)); // UTC + 10 hours (Brisbane)

const month = String(bneTime.getMonth() + 1).padStart(2, '0');
const date = String(bneTime.getDate()).padStart(2, '0');
const hours = String(bneTime.getHours()).padStart(2, '0');
const minutes = String(bneTime.getMinutes()).padStart(2, '0');
// 캐시 무효화를 위해 버전을 강제로 갱신합니다. (최신 강제 업데이트 재배포 트리거)
const versionStr = `v${month}.${date}.${hours}${minutes}-업데이트완료`;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(versionStr),
  }
})
