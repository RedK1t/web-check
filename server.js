import fs from "fs";
import path from "path";
import cors from "cors";
import express from "express";
import { fileURLToPath } from "url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = 3001;

// Configure CORS to allow specific frontend domains
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173", // Local development frontend
      "https://redkit.pages.dev", // Production frontend
      "http://localhost:3000", // Alternative local development
      "http://127.0.0.1:5173", // Alternative localhost format
      "http://localhost:3001", // Local API port
    ];

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Check if the origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any localhost port for development
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }

    // Allow any 127.0.0.1 port for development
    if (origin.match(/^http:\/\/127\.0\.0\.1:\d+$/)) {
      return callback(null, true);
    }

    console.log(`CORS blocked origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
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
