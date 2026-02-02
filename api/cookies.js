import axios from "axios";
import puppeteer from "puppeteer-core";
import middleware from "./_common/middleware.js";

const getPuppeteerCookies = async (url) => {
  // Try to dynamically import chrome-aws-lambda; if it's not installed, fall back to sensible defaults
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
    (chromium && chromium.executablePath ? await chromium.executablePath : "/usr/bin/chromium");

  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    ...(chromium && chromium.args ? chromium.args : []),
  ];

  const browser = await puppeteer.launch({
    args,
    defaultViewport: chromium && chromium.defaultViewport ? chromium.defaultViewport : null,
    executablePath,
    headless: chromium && typeof chromium.headless !== "undefined" ? chromium.headless : true,
  });

  try {
    const page = await browser.newPage();
    const navigationPromise = page.goto(url, { waitUntil: "networkidle2" });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Puppeteer took too long!")), 3000),
    );
    await Promise.race([navigationPromise, timeoutPromise]);
    return await page.cookies();
  } finally {
    await browser.close();
  }
};

const cookieHandler = async (url) => {
  let headerCookies = null;
  let clientCookies = null;

  try {
    const response = await axios.get(url, {
      withCredentials: true,
      maxRedirects: 5,
    });
    headerCookies = response.headers["set-cookie"];
  } catch (error) {
    if (error.response) {
      return {
        error: `Request failed with status ${error.response.status}: ${error.message}`,
      };
    } else if (error.request) {
      return { error: `No response received: ${error.message}` };
    } else {
      return { error: `Error setting up request: ${error.message}` };
    }
  }

  try {
    clientCookies = await getPuppeteerCookies(url);
  } catch (_) {
    clientCookies = null;
  }

  if (!headerCookies && (!clientCookies || clientCookies.length === 0)) {
    return { skipped: "No cookies" };
  }

  return { headerCookies, clientCookies };
};

export const handler = middleware(cookieHandler);
export default handler;
