import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true },
  // 단위 테스트(저장 큐·rank)는 브라우저 없이 node 로
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
