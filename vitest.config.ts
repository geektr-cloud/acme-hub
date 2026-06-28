import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// 独立的 vitest 配置：协议解析等纯逻辑模块不需要 Vue / Cloudflare 插件。
// 测试发现限定在 server/ 与 src/ 下的 *.test.ts。
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@server": fileURLToPath(new URL("./server", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "src/**/*.test.ts"],
  },
});
