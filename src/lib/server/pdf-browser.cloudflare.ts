export const generatePdf = async (): Promise<never> => {
  throw new Error("Local Chromium PDF generation is unavailable on Cloudflare Workers");
};
