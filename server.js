import fs from "fs";
import path from "path";
import cors from "cors";
import express from "express";
import { fileURLToPath } from "url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = 3001;

// Configure CORS to allow ALL origins - disable CORS restrictions
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// The absolute path to your API folder
const apiPath = path.resolve(__dirname, "api");

console.log(`\n--- DEBUG INFO ---`);
console.log(`API Folder Path: ${apiPath}`);

if (fs.existsSync(apiPath)) {
  const files = fs.readdirSync(apiPath);

  for (const file of files) {
    if (file.endsWith(".js") && !file.startsWith("_")) {
      const routeName = file.replace(".js", "");
      const routePath = `/api/${routeName}`;
      const fullPath = path.join(apiPath, file);

      const fileUrl = `file:///${fullPath.replace(/\\/g, "/")}`;

      try {
        const module = await import(fileUrl);
        const handler = module.default || module.handler;

        if (handler) {
          // If the handler follows Netlify's (event, context, callback) signature
          // adapt it to Express by building an event and callback wrapper.
          if (handler.length === 3) {
            app.all(routePath, (req, res) => {
              const event = {
                queryStringParameters: req.query || {},
                headers: req.headers || {},
                httpMethod: req.method,
                body: req.body,
                path: req.path,
              };
              const context = {};

              const callback = (err, result) => {
                if (err) {
                  return res.status(500).json({ error: err.message || err });
                }

                if (
                  result &&
                  typeof result === "object" &&
                  "statusCode" in result
                ) {
                  // Netlify-style response
                  const headers = result.headers || {};
                  Object.keys(headers).forEach((k) =>
                    res.setHeader(k, headers[k]),
                  );
                  return res.status(result.statusCode).send(result.body);
                }

                // Fallback: return JSON
                return res.json(result);
              };

              try {
                handler(event, context, callback);
              } catch (e) {
                callback(e);
              }
            });
          } else {
            // Vercel/Node style handler (req, res)
            app.all(routePath, (req, res) => handler(req, res));
          }

          console.log(`✅ Registered: ${routePath}`);
        }
      } catch (err) {
        console.log(`❌ Failed to load ${file}: ${err.message}`);
      }
    }
  }
}

app.get("/api", (req, res) => {
  res.json({ message: "API is running. Use /api/[endpoint]?url=..." });
});

app.listen(port, () => {
  console.log(`\n🚀 Server running at http://localhost:${port}`);
  console.log(
    `Test it: http://localhost:${port}/api/dns-server?url=google.com`,
  );
});
