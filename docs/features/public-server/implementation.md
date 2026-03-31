# Feature Implementation — Public Server (Proxy)

**Status:** Active (v1.2.1)
**Files:** `proxy-server/server.js`, `main.js`

---

## What It Does

Enables the application to route all Clash of Clans API requests through a transparent Node.js/Express proxy server hosted on **Render.com**. This solves the dynamic home IP problem without requiring a credit card, by leveraging Render's static regional NAT gateways.

See `docs/deep-dives/public-server-architecture.md` for in-depth rationale and architecture.

---

## Proxy Server Architecture (`proxy-server/server.js`)

Deployed separately on a Render Free Web Service.
- Uses `express` for simple routing.
- Listens on `GET /coc-proxy/*`, acting as a wildcard router to forward requests exactly as-is.
- Outbound traffic passes out of Render's known NAT IPs, guaranteeing that one of 3 explicit IPs contacts CoC.
- Uses `process.env.COC_API_TOKEN` to inject the authorization header.
- Uses `.pipe()` to stream the HTTPS response from CoC directly back to the Electron app, keeping memory usage extremely low.

---

## Electron Integration (`main.js`)

The desktop app reads an optional `proxyUrl` from `api_config.json`.

```json
{
  "apiToken": "any_valid_token_for_fallback",
  "proxyUrl": "https://cwl-proxy-xyz.onrender.com"
}
```

### Forwarding and Fallback
If `proxyUrl` is configured, `main.js` transparently executes all REST fetches through the provided URL (`apiRequestViaProxy`).

If Render performs poorly during a cold-start boot sequence (triggering a timeout or `502 Bad Gateway`), or if the proxy server goes offline entirely, the `fetchData` wrapper catches this and **silently falls back to the direct CoC API connection using the local `apiToken`**. No application crashes occur.

---

## Security Notes
The `proxyUrl` accepts unauthenticated HTTP/HTTPS requests, meaning anyone with the URL can proxy traffic. For a solo internal tool, this is acceptable via security-by-obscurity. When moving to a larger userbase on AWS/GCP, authentication (passphrase logic) can be dropped directly into `server.js`.
