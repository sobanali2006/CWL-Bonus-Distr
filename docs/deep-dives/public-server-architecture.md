# Deep Dive — Google Cloud Platform Proxy Server Architecture

**Status:** Active (v1.2.2)
**ADR:** ADR-008

---

## The Core Problem: Dynamic IPs vs. Whitelists

The Clash of Clans Developer API requires that each API token is strictly bound to a whitelisted IP address. For users running scripts from home, ISP-assigned dynamic IPs present a major UX issue: whenever the ISP rotates the router's IP address (often daily or weekly), the API token is instantly invalidated with a `403 Access Denied` error.

The user must log into the CoC developer portal, delete the old key, paste their new IP, generate a new key, and update their local config.

A **Proxy Server** solves this by inserting a middleman with a guaranteed, permanent static IP.

```
[Electron App (Home IP: Changes)] → [Proxy Server (Static IP: Permanent)] → [CoC API]
```

## The Cloud Journey: Render → Oracle → GCP

Finding a free, reliable hosting platform with a static IP proved challenging:

### Attempt 1 — Render.com (ADR-007, Superseded)
**Why tried:** Free tier with GitHub login only — no credit card required.
**Why failed:** Render routes outbound traffic through shared NAT Gateway IPs. While these IPs are technically static, the CoC API returned persistent `403 Access Denied` errors — likely because Supercell blocks known PaaS/cloud IP ranges used by thousands of developers.

### Attempt 2 — Oracle Cloud Free Tier
**Why tried:** Dedicated VM with a true static IP, Always Free tier.
**Why failed:** Setup and connectivity issues prevented successful deployment.

### Attempt 3 — Google Cloud Platform (ADR-008, Active) ✅
**Why it works:** GCP's Always Free Tier includes a dedicated `e2-micro` Compute Engine VM. Unlike PaaS platforms, a VM gives you a **unique, dedicated external IP** that isn't shared with other users. By reserving this IP and whitelisting it on the CoC Developer Portal, the token works permanently.

---

## Why GCE e2-micro and NOT Cloud Run

GCP offers two obvious hosting options:

| | **Cloud Run** (Serverless) | **Compute Engine** (VM) |
|---|---|---|
| **Outbound IP** | Dynamic, shared pool | Dedicated, reservable static IP |
| **Static IP cost** | ~$32/month (requires VPC + Cloud NAT) | **Free** (attached to running VM) |
| **Cold starts** | Yes (scales to zero) | No (always on) |
| **Free tier** | 2M requests/month | 1x e2-micro VM/month |
| **Management** | Zero (fully managed) | Minimal (SSH, pm2) |

**Verdict:** Cloud Run is architecturally superior for most serverless workloads, but the CoC API's IP whitelisting requirement makes it impractical without expensive networking infrastructure. The `e2-micro` VM provides everything we need for free.

---

## The GCP Free Tier — What You Get

GCP's [Always Free Tier](https://cloud.google.com/free/docs/free-cloud-features) includes:

- **1x `e2-micro` VM** — 0.25–2 shared vCPU, 1 GB RAM
- **30 GB Standard persistent disk** — boot disk storage
- **1 GB outbound networking** per month (North America)
- **Static external IP** — free when attached to a running VM

> **Credit card requirement:** GCP requires a credit card for identity verification at signup. However, GCP does **NOT** automatically charge after the $300 free trial credit expires. Resources simply stop unless you manually upgrade to a paid billing account.

With ~30-40 API requests per month, usage is well within all free limits.

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
**Why environment variables?** The token must NEVER be hardcoded in the file. If it's in the file, anyone who sees your code sees your token. `process.env` reads it from the shell environment at runtime — on GCP, this is set via `.bashrc` on the VM.

```javascript
if (!COC_TOKEN) {
  console.error('FATAL: COC_API_TOKEN environment variable is not set.');
  process.exit(1);
}
```
**What:** Crashes the server immediately if the token is missing.
**Why:** Crash-on-startup is safer than running a broken server that silently fails every request with a 403. You'll know immediately from `pm2 logs` if something's wrong.

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
**Why include Authorization header?** The CoC API requires `Bearer <token>` on every request. The token comes from the VM's environment variable — the Electron app never sees it or needs it.

```javascript
  const proxyReq = https.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    res.setHeader('Content-Type', 'application/json');
    proxyRes.pipe(res);
  });
```
**What:** Makes the outgoing request to CoC and pipes the response back.
**CRITICAL (`proxyRes.pipe`):** `.pipe()` connects two streams natively. The CoC response body arrives as a stream; we attach it directly to the Express response stream. The data flows continuously through the proxy without buffering the entire massive JSON payload in server memory first. This is extremely fast and memory-efficient for the GCP Free Tier VM's 1 GB RAM.

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
  "proxyUrl": "http://YOUR_GCE_EXTERNAL_IP:3000"
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
**Why `new URL()`?** `proxyUrl` is a string like `http://34.xx.xx.xx:3000`. `new URL()` safely parses it into `{ hostname, port, pathname }` components that `http.request()` requires as separate fields, avoiding hacky string splitting.

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
**Why only 502/500?** A `502` means the GCP server is offline or the upstream CoC API is unreachable. A `500` handles catastrophic server errors. We specifically *do not* fallback on a `404` or `403` because those are legitimate CoC errors passed securely through the proxy—they should bubble up to the user normally.

> 💡 Unlike Render.com, the GCE VM is always on — the fallback logic is primarily
> a safety net for rare scenarios (VM rebooted, pm2 crashed, network issues).
