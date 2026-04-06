# Feature Design — Public Server

**Status:** Implemented (v1.2.2 — GCP)
**ADR:** ADR-008

---

## Problem

The CoC API requires each token to be registered to a specific IP address.
This means every user needs to:
1. Create their own developer account
2. Get their own API token
3. Whitelist their own IP
4. Update the token whenever their IP changes

This is a significant barrier to sharing the app with other clan leaders.

---

## Goal

Allow users to use the app without their own API token by routing requests
through a server with a static, whitelisted IP.

---

## Architecture Options Evaluated

### Option A — Simple Proxy Server on PaaS (Render.com) ❌
A lightweight Node.js/Express server hosted on Render's free tier.

**Pros:** Free, no credit card, simple deployment.
**Cons:** Shared NAT Gateway IPs blocked by CoC API (`403 Access Denied`). 45-second cold starts.
**Status:** Rejected — ADR-007 superseded.

### Option B — Serverless Functions (Cloudflare Workers) ❌
Host API proxy functions on Cloudflare Workers.

**Pros:** No server to manage, auto-scales, free tier.
**Cons:** Egress IPs rotate constantly across huge datacenters — whitelisting is impossible.
**Status:** Rejected.

### Option C — Dedicated VPS (Oracle Cloud Free Tier) ❌
A dedicated VM with a true static IP on Oracle's Always Free tier.

**Pros:** Dedicated static IP, always-on, free tier.
**Cons:** Setup and connectivity issues prevented successful deployment.
**Status:** Rejected.

### Option D — Dedicated VM (GCP Compute Engine `e2-micro`) ✅ Chosen
A GCE `e2-micro` VM on GCP's Always Free Tier with a reserved static IP.

**Pros:** Dedicated static IP, always-on (no cold starts), 1 GB RAM, free forever in eligible regions.
**Cons:** Requires credit card for signup (identity verification only — no auto-charges). Minimal VM management (pm2, SSH).
**Status:** Implemented — ADR-008 active.

---

## Chosen Implementation

```
Electron App → HTTP GET http://GCE_IP:3000/coc-proxy/v1/clans/...
  ↓
GCE VM (proxy-server/server.js) → HTTPS GET api.clashofclans.com/v1/clans/...
  ↓
Response piped back → Electron App
```

- The proxy is a single `server.js` file using Express + Node's built-in `https` module.
- The CoC API token is stored as an environment variable on the VM — never in code.
- The Electron app has a silent fallback: if the proxy is unreachable (502/500), it falls back to the local `apiToken` in `api_config.json`.

See `proxy-server/README.md` for deployment instructions.
See `docs/deep-dives/public-server-architecture.md` for the full technical deep dive.

---

## Security Considerations

- The server-side API token is in environment variables, never in code
- The proxy is single-purpose — only forwards GET requests to `api.clashofclans.com`
- Rate limiting is unnecessary for a single-user proxy (~30-40 requests/month)
- No authentication needed — the proxy is personal, not public-facing

---

## Resolved Questions

1. **Which hosting platform?** → GCP Compute Engine `e2-micro` (ADR-008)
2. **Rate limiting strategy?** → Not needed for single-user usage
3. **Should the Electron app fall back to local token?** → Yes, implemented with silent 502/500 fallback
4. **Is a passphrase sufficient?** → Not needed — proxy is personal, not shared
