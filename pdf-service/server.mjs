import { createServer } from "node:http";
import puppeteer from "puppeteer-core";

// Docker always defines HOSTNAME as the container ID. Bind to all interfaces
// unless an explicit service-specific host is supplied.
const host = process.env.PDF_SERVICE_HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3333);
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";
const fontUrl = process.env.PDF_FONT_URL?.trim();
const maxContentSize = Number(process.env.PDF_MAX_CONTENT_SIZE || 5 * 1024 * 1024);

const sendJson = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const readJson = async (req) => {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxContentSize) {
      throw new Error("Request body exceeds the 5 MB export limit");
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const buildDocument = ({ content, styles }) => {
  // This mirrors the historical Tencent SCF implementation. FONT_URL was an
  // environment variable there; it remains optional because its old value was
  // never committed to the public repository.
  const fontFace = fontUrl
    ? `@font-face {
        font-family: "Noto Sans SC";
        src: url("${fontUrl}") format("woff2");
        font-display: swap;
      }`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${fontFace}</style>
    <style>${styles || ""}</style>
  </head>
  <body>${content}</body>
</html>`;
};

const generatePdf = async ({ content, styles, margin }) => {
  if (typeof content !== "string" || content.length === 0) {
    const error = new Error("Missing PDF content");
    error.statusCode = 400;
    throw error;
  }

  const pageMargin = Number(margin);
  const marginPx = Number.isFinite(pageMargin) && pageMargin >= 0 ? `${pageMargin}px` : "0px";
  let browser;

  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--font-render-hinting=none",
        "--disable-web-security"
      ]
    });

    const page = await browser.newPage();
    await page.setContent(buildDocument({ content, styles }), {
      waitUntil: ["domcontentloaded", "networkidle0"]
    });
    await page.evaluateHandle("document.fonts.ready");

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: marginPx,
        right: marginPx,
        // The live service leaves roughly one configured padding unit at the
        // bottom. Matching it keeps the final line from spilling onto page 1.
        bottom: marginPx,
        left: marginPx
      }
    });
  } finally {
    await browser?.close();
  }
};

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/healthz") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== "POST" || url.pathname !== "/generate-pdf") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  try {
    const pdf = await generatePdf(await readJson(req));
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=document.pdf",
      "Content-Length": pdf.length
    });
    res.end(pdf);
  } catch (error) {
    const status = error.statusCode || 500;
    console.error("PDF generation failed:", error);
    sendJson(res, status, { error: status === 500 ? "PDF generation failed" : error.message });
  }
}).listen(port, host, () => {
  console.log(`PDF service listening on http://${host}:${port}`);
});
