import puppeteer, { type Browser } from "puppeteer-core";

let browserPromise: Promise<Browser> | undefined;

const getBrowser = () => {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=medium"
      ]
    });
  }

  return browserPromise;
};

export const generatePdf = async (html: string, margin: number) => {
  const page = await (await getBrowser()).newPage();
  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: `${margin}px`,
        right: `${margin}px`,
        bottom: `${margin}px`,
        left: `${margin}px`
      }
    });
  } finally {
    await page.close();
  }
};
