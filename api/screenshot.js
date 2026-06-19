import puppeteer from "puppeteer-core";
import middleware from "./_common/middleware.js";

// Resolve a Chromium executable the same way the other puppeteer endpoints do.
const resolveChromium = async () => {
  let chromium = null;
  try {
    const mod = await import("chrome-aws-lambda");
    chromium = mod.default || mod;
  } catch (err) {
    chromium = null;
  }

  const executablePath =
    process.env.CHROMIUM_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    (chromium && chromium.executablePath
      ? await chromium.executablePath
      : "/usr/bin/chromium");

  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    // In Docker, /dev/shm defaults to 64MB. Chromium uses it for rendering and
    // crashes the tab ("Not attached to an active page") on heavier pages.
    // This makes Chromium write shared memory to /tmp instead, avoiding the crash.
    "--disable-dev-shm-usage",
    // Many real targets (e.g. demo/test sites) have invalid TLS certs. Without
    // this, page.goto aborts with ERR_CERT_* and the tab detaches, so the
    // screenshot fails with the same "Not attached to an active page" error.
    "--ignore-certificate-errors",
    ...(chromium && chromium.args ? chromium.args : []),
  ];

  return { executablePath, args, chromium };
};

const screenshotHandler = async (url) => {
  // Validate the URL before spinning up a browser.
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return { error: `Invalid URL: ${url}` };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { error: "Invalid protocol — only http/https is supported." };
  }

  const { executablePath, args, chromium } = await resolveChromium();

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args,
      acceptInsecureCerts: true,
      defaultViewport: { width: 1280, height: 800 },
      executablePath,
      headless:
        chromium && typeof chromium.headless !== "undefined"
          ? chromium.headless
          : true,
    });

    const page = await browser.newPage();

    // Present as a real browser — many sites (Akamai/edgesuite etc.) return an
    // "Access Denied" page to the default headless user-agent.
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    // Navigate; if the page never fully settles, still screenshot what rendered.
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    } catch (_) {
      /* fall through and capture whatever has painted so far */
    }

    const base64 = await page.screenshot({
      type: "png",
      encoding: "base64",
      fullPage: false,
    });

    if (!base64) return { skipped: "No screenshot captured" };

    return { image: `data:image/png;base64,${base64}` };
  } catch (error) {
    return { error: `Failed to capture screenshot: ${error.message}` };
  } finally {
    if (browser) await browser.close();
  }
};

export const handler = middleware(screenshotHandler);
export default handler;
