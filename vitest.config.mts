import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "lib",
          environment: "node",
          include: ["lib/**/*.test.ts", "scripts/**/*.test.mjs"],
        },
      },
    ],
  },
});
