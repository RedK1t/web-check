import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import middleware from "./_common/middleware.js";

const linkedPagesHandler = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 8000, // 8 seconds, to stay within Vercel's 10s limit
      headers: {
        "User-Agent": "Web-Check/1.0.0 (https://github.com/Lissy93/web-check)",
      },
    });

    if (!response.data || typeof response.data !== "string") {
      return {
        internal: [],
        external: [],
        skipped: "The page content is not valid HTML or is empty.",
      };
    }

    const html = response.data;
    const $ = cheerio.load(html);
    const internalLinksMap = new Map();
    const externalLinksMap = new Map();
    const parsedBaseUrl = new URL(url);

    // Get all links on the page
    $("a[href]").each((i, link) => {
      try {
        const href = $(link).attr("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript:"))
          return;

        const absoluteUrl = new URL(href, url).href;
        const linkedUrl = new URL(absoluteUrl);

        if (linkedUrl.hostname === parsedBaseUrl.hostname) {
          const count = internalLinksMap.get(absoluteUrl) || 0;
          internalLinksMap.set(absoluteUrl, count + 1);
        } else if (["http:", "https:"].includes(linkedUrl.protocol)) {
          const count = externalLinksMap.get(absoluteUrl) || 0;
          externalLinksMap.set(absoluteUrl, count + 1);
        }
      } catch (e) {
        // Ignore invalid URLs
      }
    });

    // Sort by most occurrences, remove duplicates, and convert to array
    const internalLinks = [...internalLinksMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);
    const externalLinks = [...externalLinksMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    // If there were no links, then mark as skipped and show reasons
    if (internalLinks.length === 0 && externalLinks.length === 0) {
      return {
        skipped:
          "No internal or external links found. " +
          "This may be due to the website being dynamically rendered, using a client-side framework (like React), and without SSR enabled. " +
          "That would mean that the static HTML returned from the HTTP request doesn't contain any meaningful content for Web-Check to analyze. " +
          "You can rectify this by using a headless browser to render the page instead.",
      };
    }

    return { internal: internalLinks, external: externalLinks };
  } catch (error) {
    return {
      error: `Failed to fetch or parse the page: ${error.message}`,
      internal: [],
      external: [],
    };
  }
};

export const handler = middleware(linkedPagesHandler);
export default handler;
