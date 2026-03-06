import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Permitir importações dos módulos do pipeline (edge functions)
    server: {
      deps: {
        inline: [/supabase/],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts", "src/lib/**/*.tsx"],
      exclude: [
        "src/test/**",
        "src/**/*.d.ts",
        "src/integrations/**",
      ],
      all: true,
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
