# Feature Implementation — Public Server (Proxy)

**Status:** Active (v1.2.2)
**ADR:** ADR-008
**Files:** `proxy-server/server.js`, `main.js`

---

## What It Does

Enables the application to route all Clash of Clans API requests through a transparent Node.js/Express proxy server hosted on a **Google Cloud Platform Compute Engine `e2-micro` VM**. This solves the dynamic home IP problem by providing a dedicated, permanent static IP for CoC API token whitelisting.

See `docs/deep-dives/public-server-architecture.md` for in-depth rationale and architecture.

---

## Proxy Server Architecture (`proxy-server/server.js`)

Deployed separately on a GCE Always Free Tier VM.
- Uses `express` for simple routing.
- Listens on `GET /coc-proxy/*`, acting as a wildcard router to forward requests exactly as-is.
- Outbound traffic uses the VM's dedicated static external IP, which is whitelisted on the CoC Developer Portal.
- Uses `process.env.COC_API_TOKEN` to inject the authorization header.
- Uses `.pipe()` to stream the HTTPS response from CoC directly back to the Electron app, keeping memory usage extremely low.

---

## Electron Integration (`main.js`)

The desktop app reads an optional `proxyUrl` from `api_config.json`.

```json
{
  "apiToken": "any_valid_token_for_fallback",
  "proxyUrl": "http://YOUR_GCE_EXTERNAL_IP:3000"
}
```

### Forwarding and Fallback
If `proxyUrl` is configured, `main.js` transparently executes all REST fetches through the provided URL (`apiRequestViaProxy`).

If the proxy server is unreachable (triggering a `502 Bad Gateway` or `500` error), the `fetchData` wrapper catches this and **silently falls back to the direct CoC API connection using the local `apiToken`**. No application crashes occur.

> 💡 Unlike the previous Render.com deployment, the GCE VM is always on — no cold
> starts. The fallback is primarily a safety net for rare scenarios (VM rebooted,
> pm2 crashed, network issues).

---

## Security Notes
The `proxyUrl` accepts unauthenticated HTTP requests, meaning anyone with the URL can proxy traffic. For a solo internal tool with ~30-40 requests/month, this is acceptable. For a larger userbase, authentication (passphrase or API key logic) can be added directly into `server.js`.
