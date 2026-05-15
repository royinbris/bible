import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 빌드 시점(한국 시간 기준)으로 자동 버전 생성
const now = new Date();
const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
const kstTime = new Date(utc + (9 * 60 * 60 * 1000)); // UTC + 9 hours

const month = String(kstTime.getMonth() + 1).padStart(2, '0');
const date = String(kstTime.getDate()).padStart(2, '0');
const hours = String(kstTime.getHours()).padStart(2, '0');
const minutes = String(kstTime.getMinutes()).padStart(2, '0');
const versionStr = `v${month}.${date}.${hours}${minutes}`;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(versionStr),
  }
})
