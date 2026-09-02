import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

const MAX_CONTENT_SIZE = 5 * 1024 * 1024;
const DEFAULT_MARGIN = 32;
const MAX_MARGIN = 120;

type BrowserRunBinding = {
  quickAction: (
    action: "pdf",
    options: {
      html: string;
      pdfOptions: {
        format: "a4";
        printBackground: boolean;
        preferCSSPageSize: boolean;
        margin: Record<"top" | "right" | "bottom" | "left", string>;
      };
    }
  ) => Promise<Response>;
};

const toMargin = (value: unknown) => {
  const margin = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(margin)) return DEFAULT_MARGIN;
  return Math.max(0, Math.min(MAX_MARGIN, margin));
};

const createDefaultFontCss = (requestUrl: string, fontFamily: unknown) => {
  if (
    typeof fontFamily !== "string" ||
    !fontFamily.includes("Alibaba PuHuiTi")
  ) {
    return "";
  }

  // Docker's renderer uses Liberation Sans for Latin glyphs and Noto Sans SC
  // for Chinese glyphs. Browser Run has a different system font set, so load
  // the same files from this deployment instead of relying on its fallbacks.
  const origin = new URL(requestUrl).origin;
  return `
    @font-face {
      font-family: "Alibaba PuHuiTi";
      src: url("${origin}/fonts/LiberationSans-Regular.ttf") format("truetype");
      font-weight: 400;
      font-style: normal;
      font-display: block;
      unicode-range: U+0000-02FF, U+1E00-1EFF, U+2000-2BFF;
    }
    @font-face {
      font-family: "Alibaba PuHuiTi";
      src: url("${origin}/fonts/LiberationSans-Bold.ttf") format("truetype");
      font-weight: 700;
      font-style: normal;
      font-display: block;
      unicode-range: U+0000-02FF, U+1E00-1EFF, U+2000-2BFF;
    }
    @font-face {
      font-family: "Alibaba PuHuiTi";
      src: url("${origin}/fonts/NotoSansSC.ttf") format("truetype");
      font-weight: 100 900;
      font-style: normal;
      font-display: block;
      unicode-range: U+3000-9FFF, U+F900-FAFF, U+FF00-FFEF;
    }
  `;
};

const createDocument = (content: string, styles: string, fontCss: string) => `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        ${fontCss}
        ${styles}
      </style>
    </head>
    <body>${content}</body>
  </html>`;

const generatePdf = (html: string, margin: number) => {
  const browser = (env as { BROWSER?: BrowserRunBinding }).BROWSER;
  if (!browser) {
    throw new Error("Cloudflare Browser Rendering binding is unavailable");
  }

  return browser.quickAction("pdf", {
    html,
    pdfOptions: {
      format: "a4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: `${margin}px`,
        right: `${margin}px`,
        bottom: `${margin}px`,
        left: `${margin}px`
      }
    }
  });
};

export const Route = createFileRoute("/generate-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentLength = Number(request.headers.get("content-length") || 0);
          if (contentLength > MAX_CONTENT_SIZE) {
            return Response.json({ error: "PDF content is too large" }, { status: 413 });
          }

          const { content, styles, margin, fontFamily } = (await request.json()) as {
            content?: unknown;
            styles?: unknown;
            margin?: unknown;
            fontFamily?: unknown;
          };

          if (typeof content !== "string" || !content.trim()) {
            return Response.json({ error: "Missing PDF content" }, { status: 400 });
          }
          if (
            content.length > MAX_CONTENT_SIZE ||
            (typeof styles === "string" && styles.length > MAX_CONTENT_SIZE)
          ) {
            return Response.json({ error: "PDF content is too large" }, { status: 413 });
          }

          const pdf = await generatePdf(
            createDocument(
              content,
              typeof styles === "string" ? styles : "",
              createDefaultFontCss(request.url, fontFamily)
            ),
            toMargin(margin)
          );

          if (!pdf.ok) {
            console.error("Cloudflare PDF generation error:", pdf.status);
            return Response.json({ error: "Failed to generate PDF" }, { status: 502 });
          }

          const headers = new Headers(pdf.headers);
          headers.set("Content-Type", "application/pdf");
          headers.set("Content-Disposition", "attachment; filename=resume.pdf");
          headers.set("Cache-Control", "no-store");
          return new Response(pdf.body, { headers });
        } catch (error) {
          console.error("PDF generation error:", error);
          return Response.json({ error: "Failed to generate PDF" }, { status: 500 });
        }
      }
    }
  }
});
