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
    resolve: {
      alias: isCloudflareBuild
        ? {
            "@/lib/server/pdf-browser": new URL(
              "./src/lib/server/pdf-browser.cloudflare.ts",
              import.meta.url
            ).pathname
          }
        : {
            "cloudflare:workers": new URL(
              "./src/lib/server/cloudflare-workers-stub.ts",
              import.meta.url
            ).pathname
          }
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
