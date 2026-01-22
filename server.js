import fs from "fs";
import path from "path";
import cors from "cors";
import express from "express";
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = 3001;

app.use(cors());

// The absolute path to your API folder
const apiPath = path.resolve(__dirname, 'api');

console.log(`\n--- DEBUG INFO ---`);
console.log(`API Folder Path: ${apiPath}`);

if (fs.existsSync(apiPath)) {
  const files = fs.readdirSync(apiPath);
  
  for (const file of files) {
    if (file.endsWith('.js') && !file.startsWith('_')) {
      const routeName = file.replace('.js', '');
      const routePath = `/api/${routeName}`;
      const fullPath = path.join(apiPath, file);
      
      const fileUrl = `file:///${fullPath.replace(/\\/g, '/')}`;

      try {
        const module = await import(fileUrl);
        const handler = module.default || module.handler;

        if (handler) {
          // Pass req and res directly to the handler
          // The middleware inside the API files will handle the rest
          app.all(routePath, (req, res) => handler(req, res));
          console.log(`✅ Registered: ${routePath}`);
        }
      } catch (err) {
        console.log(`❌ Failed to load ${file}: ${err.message}`);
      }
    }
  }
}

app.get('/api', (req, res) => {
    res.json({ message: "API is running. Use /api/[endpoint]?url=..." });
});

app.listen(port, () => {
  console.log(`\n🚀 Server running at http://localhost:${port}`);
  console.log(`Test it: http://localhost:${port}/api/dns?url=google.com`);
});