import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const isCloudflareBuild = mode === "cloudflare";

  return {
    server: {
      port: 3000
    },
    optimizeDeps: {
      exclude: ["pdfjs-dist"]
    },
    ssr: {
      noExternal: ["pdfjs-dist"]
    },
    plugins: [
      ...(isCloudflareBuild
        ? [cloudflare({ viteEnvironment: { name: "ssr" } })]
        : []),
      tsconfigPaths(),
      tanstackStart({
        srcDirectory: "src",
        router: {
          routesDirectory: "routes"
        }
      }),
      viteReact()
    ]
  };
});
