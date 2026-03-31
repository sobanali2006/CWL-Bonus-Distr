# Deep Dive — Render.com Proxy Server Architecture

**Status:** Active (v1.2.1)
**ADR:** ADR-007

---

## The Core Problem: Dynamic IPs vs. Whitelists

The Clash of Clans Developer API requires that each API token is strictly bound to a whitelisted IP address. For users running scripts from home, ISP-assigned dynamic IPs present a major UX issue: whenever the ISP rotates the router's IP address (often daily or weekly), the API token is instantly invalidated with a `403 Access Denied` error.

The user must log into the CoC developer portal, delete the old key, paste their new IP, generate a new key, and update their local config.

A **Proxy Server** solves this by inserting a middleman with a guaranteed, permanent static IP.

```
[Electron App (Home IP: Changes)] → [Proxy Server (Static IP: Permanent)] → [CoC API]
```

## The $0 Problem: Cloud Providers & Credit Cards

Before scaling to a paid infrastructure, personal applications need a free staging ground. However, acquiring a permanent static IPv4 address for free is nearly impossible due to modern cloud security. 

Major cloud providers (AWS, Google Cloud, Azure, Oracle Cloud) enforce a strict **Credit Card verification** hurdle on all free tiers to combat crypto-mining bots. Additionally, providers like AWS recently started levying hourly charges simply for reserving an IPv4 Address, stripping away the "Always Free" guarantee entirely. 

To host a Proxy Server at a verifiable cost of $0.00 without relinquishing financial data, a Platform-as-a-Service (PaaS) loophole was required.

---

## The Solution: Render.com Regional NAT Gateways

We selected **Render.com** (ADR-007) because they allow users to spawn Node.js servers entirely free solely via a GitHub login. 

While PaaS containers generally hop IPs constantly, **Render routes all outbound requests through a tiny, static pool of regional NAT Gateways.**

For instance, any free service hosted in their Oregon (US West) region will always egress to the internet using one of exactly three static IP addresses:
1. `216.24.57.253`
2. `216.24.57.252`
3. `216.24.57.234`

Because the Supercell Developer Portal allows users to assign **multiple** IP addresses to a single Developer API Token, compiling all three Render NAT IPs into the token permanently whitelists the application, bypassing the dynamic routing issues of PaaS completely without requiring an expensive rigid VPC infrastructure. 

### The Cost of Free: "Cold Starts"
Render's free tier idles Web Services after 15 minutes of inactivity. When the Electron App attempts an API Fetch against a sleeping server, Render intercepts the request, boots up the container, and resumes the HTTP handshake.

This means **the absolute first fetch of any daily session faces a ~45-second latency delay (`Cold Start`)**. All subsequent tasks execute instantaneously until the 15-minute hibernation triggers again. For personal, intra-season CWL tracking, a daily 45-second delay is an optimal compromise against entering recurring billing commitments.

---

## The Proxy Implementation — Every Line Explained

Because the proxy only needs to forward traffic for one user, it requires no authentication, no database, no rate-limiting, and no complex routing. It acts as a transparent forwarder for ALL CoC endpoints.

### `proxy-server/server.js`

```javascript
const express = require('express');
```
**What:** Loads the Express web framework.
**Why:** Express makes it trivial to define HTTP routes (`GET /coc-proxy/*`). Without it, you'd write raw Node.js `http.createServer()` which is 5x more verbose.

```javascript
const https = require('https');
```
**What:** Node's built-in HTTPS module — no installation needed.
**Why:** We need to make outgoing HTTPS requests to `api.clashofclans.com`. This is the same module already used in `main.js`.

```javascript
const app = express();
const PORT = process.env.PORT || 3000;
const COC_TOKEN = process.env.COC_API_TOKEN;
```
**What:** Creates the Express app instance, reads config from environment variables.
**Why environment variables?** The token must NEVER be hardcoded in the file. If it's in the file, anyone who sees your code sees your token. `process.env` reads it securely from Render's dashboard at runtime — it lives nowhere in the code.

```javascript
if (!COC_TOKEN) {
  console.error('FATAL: COC_API_TOKEN environment variable is not set.');
  process.exit(1);
}
```
**What:** Crashes the server immediately if the token is missing.
**Why:** Crash-on-startup is safer than running a broken server that silently fails every request with a 403. You'll know immediately from Render's logs if something's wrong.

```javascript
app.get('/coc-proxy/*', (req, res) => {
```
**What:** Defines a wildcard route. Any `GET` request starting with `/coc-proxy/` is caught here. The `*` captures everything after the prefix as `req.params[0]`.
**Why wildcard?** This single route handles `/v1/clans`, `/v1/clanwarleagues`, and anything else seamlessly without needing separate route definitions.

```javascript
  const cocPath = '/' + req.params[0];
```
**What:** Extracts the CoC API path from the wildcard match.
**Example:** Request to `/coc-proxy/v1/clans/%232PP` → `cocPath = '/v1/clans/%232PP'`

```javascript
  const options = {
    hostname: 'api.clashofclans.com',
    path: cocPath,
    method: 'GET',
    headers: { Authorization: `Bearer ${COC_TOKEN}` }
  };
```
**What:** The HTTPS request options payload to forward to the CoC API.
**Why include Authorization header?** The CoC API requires `Bearer <token>` on every request. The token comes from the server's environment variable — the Electron app never sees it or needs it.

```javascript
  const proxyReq = https.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    res.setHeader('Content-Type', 'application/json');
    proxyRes.pipe(res);
  });
```
**What:** Makes the outgoing request to CoC and pipes the response back.
**CRITICAL (`proxyRes.pipe`):** `.pipe()` connects two streams natively. The CoC response body arrives as a stream; we attach it directly to the Express response stream. The data flows continuously through the proxy without buffering the entire massive JSON payload in server memory first. This is extremely fast and memory-efficient for Render's free tier.

```javascript
  proxyReq.on('error', (e) => res.status(502).json({ error: e.message }));
  proxyReq.end();
```
**What:** Handles upstream connection failures.
**Why 502?** "Bad Gateway" is the standard HTTP code when a proxy fails to reach its upstream target. When the Electron app intercepts a 502, it natively triggers the fallback procedure.

---

## Electron Integration (`main.js`) — Additions Explained

### Config Schema Update
`api_config.json` receives an optional `proxyUrl` field.
```json
{
  "apiToken": "your_existing_token",
  "proxyUrl": "https://cwl-proxy-xyz.onrender.com"
}
```
**What:** Reads the optional field. 
**Why:** Fully backwards compatible. If `proxyUrl` is missing or the file hasn't been updated, the app defaults to direct API requests using the local `apiToken` exactly as before.

### New `new URL()` Parsing
```javascript
  return new Promise((resolve, reject) => {
    const url = new URL(proxyUrl + '/coc-proxy' + cocPath);
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search }, ...)
```
**What:** Parses the proxy URL and makes an HTTP request to it.
**Why `new URL()`?** `proxyUrl` is a string like `https://cwl-proxy.onrender.com`. `new URL()` safely parses it into `{ hostname, port, pathname }` components that `http.request()` requires as separate fields, avoiding hacky string splitting.

### Silent Fallback Logic
In `ipcMain.handle('fetch-clan-data')`:

```javascript
if (proxyUrl) {
  try {
    clanInfo = await apiRequestViaProxy(proxyUrl, cocPath);
  } catch (err) {
    if (err.statusCode === 502 || err.statusCode === 500) {
        // Fallback to local token
        console.warn('Proxy failed. Falling back to local token:', err.message);
        clanInfo = await apiRequest({ ...directCoCCall }); 
    } else {
        throw err; // Bubble 404/403 back to user
    }
  }
} 
// ...
```
**What:** The fallback resilience logic.
**Why `try/catch` and not `.catch()`?** Because we're inside an `async` function and the fallback needs to `await` the local token call too. `try/catch` around `await` is the correct async error handling pattern.
**Why only 502/500?** A `502` means the Render server is offline or restarting. A `500` handles a catastrophic Render cold-start timeout. We specifically *do not* fallback on a `404` or `403` because those are legitimate CoC errors passed securely through the proxy—they should bubble up to the user normally.
