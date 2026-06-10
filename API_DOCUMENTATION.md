# Web-Check API Documentation

A REST API that performs passive reconnaissance and OSINT analysis on a target domain or URL. Each endpoint inspects one aspect of a website — DNS, SSL, cookies, security headers, WAF, technology stack, archives, and more — and returns the result as JSON.

This service powers the **Reconnaissance** features of the RedKit platform.

## Overview

- **Framework:** Node.js + Express (`server.js`)
- **Default port:** `3001`
- **Base path:** `/api`
- **Content-Type:** `application/json; charset=UTF-8`
- **Routing:** Each `.js` file in the `api/` folder is auto-registered as `/api/<filename>`. Adding a new file there automatically creates a new endpoint (files prefixed with `_` are ignored).

## Configuration

Environment variables (see `template.env`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the server listens on (hard-coded to `3001` in `server.js`). |
| `NODE_ENV` | `production` | Node environment. |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `true` | Skip bundled Chromium download (use system binary). |
| `PUPPETEER_EXECUTABLE_PATH` / `CHROMIUM_PATH` | `/usr/bin/chromium` | Path to the Chromium binary (used by `cookies`). |
| `API_TIMEOUT_LIMIT` | `60000` | Per-request timeout in milliseconds. |
| `VITE_DISABLE_EVERYTHING` | _(unset)_ | If set, all endpoints return `503` with a "temporarily disabled" message. |
| `PLATFORM` | `NODE`/`NETLIFY` | Runtime adapter. Auto-detected (`VERCEL`, `WC_SERVER`, etc.). |

## Running the API

```bash
# Production
npm start            # NODE_ENV=production node server.js

# Development (auto-reload)
npm run dev          # WC_SERVER=true nodemon server.js
```

The server prints registered routes on startup and a test URL:
`http://localhost:3001/api/dns-server?url=google.com`

---

## Common Request Contract

Every analysis endpoint follows the same convention.

### Request

```
GET /api/<endpoint>?url=<target>
```

| Parameter | In | Required | Description |
|---|---|---|---|
| `url` | query | Yes | The target domain or URL to analyze. |

- `app.all(...)` is used, so any HTTP method is accepted, but **GET with a query string is the standard**.
- **URL normalization:** if `url` does not start with `http`, `https://` is automatically prepended. So `example.com` becomes `https://example.com`.

### Responses

| Status | When | Body |
|---|---|---|
| `200` | Success | Endpoint-specific JSON object (see below). |
| `200` | Not applicable | `{ "skipped": "<reason>" }` — e.g. site has no cookies / no robots.txt. |
| `200`/`500` | Soft error | `{ "error": "<message>" }` — some handlers return errors inline with a 200. |
| `400` | Bad input | `{ "error": "Invalid url query parameter" }`. |
| `408` | Timeout | Error message + guidance to retry / raise `API_TIMEOUT_LIMIT`. |
| `500` | No URL / handler threw | `{ "error": "No URL specified" }` or `{ "error": "<message>" }`. |
| `503` | Instance disabled | Returned when `VITE_DISABLE_EVERYTHING` is set. |

> **Note:** Error handling is not fully uniform across endpoints. Some return `{ error }` with HTTP `200`, others nest `{ statusCode, body }`. Always check for an `error` or `skipped` key in the body regardless of status code.

### CORS

All origins are allowed (`Access-Control-Allow-Origin: *`). `OPTIONS` preflight requests return `200`.

---

## Endpoints

### 1. `GET /api/dns-server`

Resolves the domain's IPv4 (A) records, performs reverse DNS, and checks DNS-over-HTTPS (DoH) support.

**Example**
```
GET /api/dns-server?url=google.com
```

**Response**
```json
{
  "domain": "google.com",
  "dns": [
    {
      "address": "142.250.190.46",
      "hostname": "ams15s40-in-f14.1e100.net",
      "dohDirectSupports": false
    }
  ]
}
```

---

### 2. `GET /api/get-ip`

Resolves the target to a single IP address using the system resolver.

**Example**
```
GET /api/get-ip?url=example.com
```

**Response**
```json
{
  "ip": "93.184.216.34",
  "family": 4
}
```

---

### 3. `GET /api/ssl`

Performs a TLS handshake and returns the server's SSL/TLS certificate details (issuer, subject, validity dates, fingerprints, etc.). Connects on port `443` (or the port in the URL).

**Example**
```
GET /api/ssl?url=https://github.com
```

**Response** _(abridged)_
```json
{
  "subject": { "CN": "github.com" },
  "issuer": { "C": "US", "O": "DigiCert, Inc.", "CN": "DigiCert TLS RSA SHA256 2020 CA1" },
  "valid_from": "Feb  7 00:00:00 2024 GMT",
  "valid_to": "Mar  7 23:59:59 2025 GMT",
  "fingerprint": "...",
  "serialNumber": "..."
}
```

Throws if the handshake is unauthorized or no certificate is presented (`rejectUnauthorized` is `false`, so self-signed certs still return data).

---

### 4. `GET /api/http-security`

Checks for the presence of common HTTP security headers. Each field is a boolean.

**Example**
```
GET /api/http-security?url=example.com
```

**Response**
```json
{
  "strictTransportPolicy": true,
  "xFrameOptions": false,
  "xContentTypeOptions": true,
  "xXSSProtection": false,
  "contentSecurityPolicy": true
}
```

| Field | Header checked |
|---|---|
| `strictTransportPolicy` | `Strict-Transport-Security` |
| `xFrameOptions` | `X-Frame-Options` |
| `xContentTypeOptions` | `X-Content-Type-Options` |
| `xXSSProtection` | `X-XSS-Protection` |
| `contentSecurityPolicy` | `Content-Security-Policy` |

---

### 5. `GET /api/firewall`

Detects whether the site sits behind a known Web Application Firewall (WAF) by fingerprinting response headers. Recognizes Cloudflare, AWS WAF, Akamai, Sucuri, Barracuda, F5 BIG-IP, Imperva, FortiWeb, Citrix NetScaler, DDoS-Guard, and many more.

**Example**
```
GET /api/firewall?url=cloudflare.com
```

**Response (WAF found)**
```json
{ "hasWaf": true, "waf": "Cloudflare" }
```

**Response (none detected)**
```json
{ "hasWaf": false }
```

---

### 6. `GET /api/cookies`

Returns cookies set by the target, from two sources:
- **`headerCookies`** — `Set-Cookie` headers from a plain HTTP GET (via axios).
- **`clientCookies`** — cookies set client-side, captured with a headless Chromium (Puppeteer). May be `null` if the browser launch/navigation fails or times out (3s nav cap).

**Example**
```
GET /api/cookies?url=example.com
```

**Response**
```json
{
  "headerCookies": ["session=abc; Path=/; HttpOnly"],
  "clientCookies": [
    { "name": "session", "value": "abc", "domain": "example.com", "httpOnly": true, "secure": true }
  ]
}
```

Returns `{ "skipped": "No cookies" }` if none are found from either source.

**Requires** a Chromium binary at `PUPPETEER_EXECUTABLE_PATH` / `CHROMIUM_PATH` (the Docker image installs it at `/usr/bin/chromium`).

---

### 7. `GET /api/tech-stack`

Identifies the technologies powering the site (frameworks, CMS, analytics, servers, etc.) using Wappalyzer.

**Example**
```
GET /api/tech-stack?url=https://wordpress.org
```

**Response** _(abridged)_
```json
{
  "urls": { "https://wordpress.org": { "status": 200 } },
  "technologies": [
    {
      "name": "WordPress",
      "confidence": 100,
      "version": "6.4",
      "categories": [{ "id": 1, "name": "CMS" }]
    }
  ]
}
```

Throws `Unable to find any technologies for site` if nothing is detected.

---

### 8. `GET /api/linked-pages`

Crawls the page's HTML and extracts all hyperlinks, split into internal (same hostname) and external links, ordered by number of occurrences. Has an 8s fetch timeout.

**Example**
```
GET /api/linked-pages?url=https://example.com
```

**Response**
```json
{
  "internal": ["https://example.com/about", "https://example.com/contact"],
  "external": ["https://github.com/example"]
}
```

Returns `{ internal: [], external: [], skipped: "..." }` for client-rendered (e.g. React without SSR) pages where the static HTML has no links.

---

### 9. `GET /api/robots-txt`

Fetches and parses `/robots.txt`, returning the list of `User-agent`, `Allow`, and `Disallow` rules in order.

**Example**
```
GET /api/robots-txt?url=https://google.com
```

**Response**
```json
{
  "robots": [
    { "lbl": "User-agent", "val": "*" },
    { "lbl": "Disallow", "val": "/search" },
    { "lbl": "Allow", "val": "/search/about" }
  ]
}
```

Returns `{ "skipped": "No robots.txt file present, unable to continue" }` when absent. Returns `400` if `url` is not a valid URL.

---

### 10. `GET /api/sitemap`

Fetches the site's `sitemap.xml` (falling back to the `Sitemap:` directive in `robots.txt` if a direct fetch 404s) and returns it parsed from XML into JSON. Has a 5s timeout per fetch.

**Example**
```
GET /api/sitemap?url=https://example.com
```

**Response** _(structure mirrors the XML)_
```json
{
  "urlset": {
    "url": [
      { "loc": ["https://example.com/"], "lastmod": ["2024-01-01"] }
    ]
  }
}
```

Returns `{ "skipped": "No sitemap found" }` or `{ "error": "Request timed-out after 5000ms" }`.

---

### 11. `GET /api/archives`

Queries the Internet Archive's Wayback Machine (CDX API) for the target's snapshot history and computes statistics: first/last capture, total scans, number of content changes, average page size, and scan/change frequency. Collapses snapshots to one per day and caps at 10,000 results.

**Example**
```
GET /api/archives?url=example.com
```

**Response** _(abridged)_
```json
{
  "firstScan": "1997-12-21T00:00:00.000Z",
  "lastScan": "2024-05-01T12:00:00.000Z",
  "totalScans": 8421,
  "changeCount": 512,
  "averagePageSize": 41234,
  "scanFrequency": {
    "daysBetweenScans": 1.15,
    "daysBetweenChanges": 18.9,
    "scansPerDay": 0.87,
    "changesPerDay": 0.05
  },
  "scans": [["19971221000000", "200", "<digest>", "1270", "<offset>"]],
  "scanUrl": "https://example.com"
}
```

Returns `{ "skipped": "Site has never before been archived via the Wayback Machine" }` if there is no history.

---

## Endpoint Quick Reference

| Endpoint | Purpose | External dependency |
|---|---|---|
| `/api/dns-server` | DNS A records + reverse DNS + DoH check | System DNS |
| `/api/get-ip` | Resolve domain to IP | System DNS |
| `/api/ssl` | TLS certificate details | Direct TLS connection |
| `/api/http-security` | Security header presence | Target HTTP |
| `/api/firewall` | WAF detection via headers | Target HTTP |
| `/api/cookies` | Header + client-side cookies | Puppeteer / Chromium |
| `/api/tech-stack` | Detect technologies | Wappalyzer |
| `/api/linked-pages` | Internal/external links | Target HTML |
| `/api/robots-txt` | Parse robots.txt | Target HTTP |
| `/api/sitemap` | Parse sitemap.xml | Target HTTP |
| `/api/archives` | Wayback Machine history | web.archive.org |

## Health Check

```
GET /api
→ { "message": "API is running. Use /api/[endpoint]?url=..." }
```
