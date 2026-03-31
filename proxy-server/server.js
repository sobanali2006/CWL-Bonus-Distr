/**
 * FILE: server.js
 * PROCESS: Standalone Node.js server (runs on Oracle Cloud VPS, NOT inside Electron)
 * ROLE: Transparent API proxy — forwards any CoC API request from the Electron
 *       app to api.clashofclans.com using the server's whitelisted static IP.
 *       The Electron app never needs its own API token once this proxy is active.
 *
 * DEPENDENCIES:
 *   - express: HTTP route handling and response management
 *   - https (built-in): Outgoing HTTPS requests to CoC API
 *
 * ENVIRONMENT VARIABLES (required):
 *   - COC_API_TOKEN: Your CoC developer API token (whitelisted to this server's IP)
 *   - PORT: (optional) Server port, defaults to 3000
 *
 * ENDPOINTS:
 *   - GET /coc-proxy/*  — Wildcard route. Forwards any path after /coc-proxy/ to
 *                          api.clashofclans.com verbatim. Handles all three CoC
 *                          endpoint tiers (clan info, CWL group, war details).
 *   - GET /health       — Health check endpoint. Returns { status: 'ok' }.
 *
 * DOCS:
 *   - docs/deep-dives/public-server-architecture.md
 *   - docs/architecture/decisions.md → ADR-007
 *
 * DEPLOYMENT:
 *   - See proxy-server/README.md for full Oracle Cloud setup instructions
 */

const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const COC_TOKEN = process.env.COC_API_TOKEN;

// ── FAIL-FAST STARTUP GUARD ──────────────────────────────────────────────────
// If the API token is not set in environment variables, crash immediately.
// A running server without a token would silently fail every request — crashing
// on startup makes the misconfiguration obvious during initial setup.
if (!COC_TOKEN) {
    console.error('FATAL: COC_API_TOKEN environment variable is not set.');
    console.error('Set it with: export COC_API_TOKEN="your_token_here"');
    process.exit(1);
}

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
// Simple endpoint to verify the server is running. Useful for monitoring and
// for the Electron app to quickly test connectivity before making a full API call.
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── TRANSPARENT PROXY ROUTE ──────────────────────────────────────────────────
/**
 * ROUTE: GET /coc-proxy/*
 * PURPOSE: Wildcard route that forwards any CoC API path to api.clashofclans.com.
 *          The Electron app constructs the full CoC API path (e.g.,
 *          /v1/clans/%232PP/currentwar/leaguegroup) and appends it after /coc-proxy/.
 *          The proxy strips the /coc-proxy prefix and forwards the rest verbatim.
 *
 * EXAMPLES:
 *   GET /coc-proxy/v1/clans/%232PP
 *     → forwards to api.clashofclans.com/v1/clans/%232PP
 *
 *   GET /coc-proxy/v1/clans/%232PP/currentwar/leaguegroup
 *     → forwards to api.clashofclans.com/v1/clans/%232PP/currentwar/leaguegroup
 *
 *   GET /coc-proxy/v1/clanwarleagues/wars/%23WARTAG
 *     → forwards to api.clashofclans.com/v1/clanwarleagues/wars/%23WARTAG
 *
 * RESPONSE: Exact mirror of the CoC API response (status code + JSON body).
 *           Uses .pipe() to stream directly without buffering in server memory.
 *
 * ERROR: Returns 502 (Bad Gateway) if the upstream CoC API is unreachable.
 */
app.get('/coc-proxy/*', (req, res) => {
    // Extract the CoC API path from the wildcard match.
    // req.params[0] contains everything after /coc-proxy/
    // e.g., request to /coc-proxy/v1/clans/%232PP → cocPath = '/v1/clans/%232PP'
    const cocPath = '/' + req.params[0];

    // Build the outgoing HTTPS request options for CoC API.
    // Authorization header uses the server-side token — the Electron app
    // never sees or needs this token.
    const options = {
        hostname: 'api.clashofclans.com',
        path: cocPath,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${COC_TOKEN}` }
    };

    // Make the proxy request to CoC API.
    const proxyReq = https.request(options, (proxyRes) => {
        // Mirror the upstream status code (200, 403, 404, etc.) to the client.
        res.status(proxyRes.statusCode);

        // Set content-type to match CoC API's response (always JSON).
        res.setHeader('Content-Type', 'application/json');

        // CRITICAL: .pipe() streams the CoC response directly to the Electron client.
        // This avoids buffering the entire JSON body in server memory — important
        // for the small Oracle Free Tier VM (1GB RAM). Data flows through as a
        // stream: CoC → server → Electron app.
        proxyRes.pipe(res);
    });

    // Handle upstream connection failures (DNS failure, CoC API down, timeout).
    // 502 = "Bad Gateway" — standard HTTP code for "upstream server failed."
    proxyReq.on('error', (err) => {
        console.error(`Proxy error for ${cocPath}:`, err.message);
        res.status(502).json({ error: `Upstream request failed: ${err.message}` });
    });

    proxyReq.end();
});

// ── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`CWL Proxy Server active on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Proxy base:   http://localhost:${PORT}/coc-proxy/v1/...`);
});
