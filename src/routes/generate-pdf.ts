import { createFileRoute } from "@tanstack/react-router";

const MAX_CONTENT_SIZE = 5 * 1024 * 1024;
const DEFAULT_PDF_SERVICE_URL =
  "https://magic-pdf.zipq.qzz.io/generate-pdf";

const getPdfServiceUrl = () =>
  process.env.PDF_SERVICE_URL?.trim() || DEFAULT_PDF_SERVICE_URL;

export const Route = createFileRoute("/generate-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentLength = Number(request.headers.get("content-length") || 0);
          if (contentLength > MAX_CONTENT_SIZE) {
            return Response.json({ error: "PDF content is too large" }, { status: 413 });
          }

          const body = await request.arrayBuffer();
          if (body.byteLength > MAX_CONTENT_SIZE) {
            return Response.json({ error: "PDF content is too large" }, { status: 413 });
          }

          const pdf = await fetch(getPdfServiceUrl(), {
            method: "POST",
            headers: {
              "Content-Type": request.headers.get("content-type") || "application/json"
            },
            body
          });

          if (!pdf.ok) {
            console.error("PDF service error:", pdf.status);
            return new Response(pdf.body, {
              status: pdf.status,
              headers: pdf.headers
            });
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
