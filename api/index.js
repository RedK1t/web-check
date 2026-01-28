// Unified API Router - Consolidates all endpoints into a single serverless function
// This bypasses Vercel's 12 serverless function limit on the Hobby plan

// Import all endpoint handlers (the actual logic, not the middleware-wrapped versions)
import archivesModule from './archives.js';
import blockListsModule from './block-lists.js';
import cookiesModule from './cookies.js';
import dnsServerModule from './dns-server.js';
import firewallModule from './firewall.js';
import getIpModule from './get-ip.js';
import httpSecurityModule from './http-security.js';
import linkedPagesModule from './linked-pages.js';
import robotsTxtModule from './robots-txt.js';
import sitemapModule from './sitemap.js';
import sslModule from './ssl.js';
import techStackModule from './tech-stack.js';

// Map of endpoint names to their handlers
const endpoints = {
  'archives': archivesModule.handler || archivesModule.default,
  'block-lists': blockListsModule.handler || blockListsModule.default,
  'cookies': cookiesModule.handler || cookiesModule.default,
  'dns-server': dnsServerModule.handler || dnsServerModule.default,
  'firewall': firewallModule.handler || firewallModule.default,
  'get-ip': getIpModule.handler || getIpModule.default,
  'http-security': httpSecurityModule.handler || httpSecurityModule.default,
  'linked-pages': linkedPagesModule.handler || linkedPagesModule.default,
  'robots-txt': robotsTxtModule.handler || robotsTxtModule.default,
  'sitemap': sitemapModule.handler || sitemapModule.default,
  'ssl': sslModule.handler || sslModule.default,
  'tech-stack': techStackModule.handler || techStackModule.default,
};

// Unified handler that routes to the appropriate endpoint
export default async function handler(req, res) {
  // Extract endpoint from query or path
  let endpoint = req.query.endpoint;
  
  // Support backward compatibility: extract endpoint from path like /api/ssl
  if (!endpoint && req.url) {
    const pathMatch = req.url.match(/\/api\/([^?]+)/);
    if (pathMatch && pathMatch[1] && pathMatch[1] !== 'index') {
      endpoint = pathMatch[1];
    }
  }

  // Validate endpoint exists
  if (!endpoint) {
    return res.status(400).json({ 
      error: 'No endpoint specified. Use ?endpoint=<name> or /api/<name>' 
    });
  }

  // Get the handler for this endpoint
  const endpointHandler = endpoints[endpoint];

  if (!endpointHandler) {
    return res.status(404).json({ 
      error: `Unknown endpoint: ${endpoint}. Available endpoints: ${Object.keys(endpoints).join(', ')}` 
    });
  }

  // Route to the appropriate handler (already wrapped with middleware)
  try {
    return await endpointHandler(req, res);
  } catch (error) {
    return res.status(500).json({ 
      error: `Error in ${endpoint} endpoint: ${error.message}` 
    });
  }
}
