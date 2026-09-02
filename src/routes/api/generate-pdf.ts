import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { generatePdf } from "@/lib/server/pdf-browser";

const MAX_CONTENT_SIZE = 5 * 1024 * 1024;
const DEFAULT_MARGIN = 32;
const MAX_MARGIN = 120;

const toMargin = (value: unknown) => {
  const margin = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(margin)) return DEFAULT_MARGIN;
  return Math.max(0, Math.min(MAX_MARGIN, margin));
};

const createDocument = (content: string, styles: string) => `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        ${styles}
      </style>
    </head>
    <body>${content}</body>
  </html>`;

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

const generateCloudflarePdf = async (html: string, margin: number) => {
  const browser = (env as { BROWSER?: BrowserRunBinding }).BROWSER;
  if (!browser) return null;

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

export const Route = createFileRoute("/api/generate-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentLength = Number(request.headers.get("content-length") || 0);
          if (contentLength > MAX_CONTENT_SIZE) {
            return Response.json({ error: "PDF content is too large" }, { status: 413 });
          }

          const { content, styles, margin } = (await request.json()) as {
            content?: unknown;
            styles?: unknown;
            margin?: unknown;
          };

          if (typeof content !== "string" || !content.trim()) {
            return Response.json({ error: "Missing PDF content" }, { status: 400 });
          }
          if (content.length > MAX_CONTENT_SIZE || (typeof styles === "string" && styles.length > MAX_CONTENT_SIZE)) {
            return Response.json({ error: "PDF content is too large" }, { status: 413 });
          }

          const safeMargin = toMargin(margin);
          const html = createDocument(content, typeof styles === "string" ? styles : "");
          const cloudflarePdf = await generateCloudflarePdf(html, safeMargin);

          if (cloudflarePdf) {
            if (!cloudflarePdf.ok) {
              console.error("Cloudflare PDF generation error:", cloudflarePdf.status);
              return Response.json({ error: "Failed to generate PDF" }, { status: 502 });
            }
            const headers = new Headers(cloudflarePdf.headers);
            headers.set("Content-Type", "application/pdf");
            headers.set("Content-Disposition", "attachment; filename=resume.pdf");
            headers.set("Cache-Control", "no-store");
            return new Response(cloudflarePdf.body, { headers });
          }

          const pdf = await generatePdf(html, safeMargin);
          return new Response(pdf, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": "attachment; filename=resume.pdf",
              "Cache-Control": "no-store"
            }
          });
        } catch (error) {
          console.error("PDF generation error:", error);
          return Response.json({ error: "Failed to generate PDF" }, { status: 500 });
        }
      }
    }
  }
});
