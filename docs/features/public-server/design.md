# Feature Design — Public Server

**Status:** Planned (future)
**Blocker:** IP-whitelisted API key requirement

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

## Architecture Options

### Option A — Simple Proxy Server
A lightweight Node.js/Express server that:
- Accepts clan tag from the client
- Makes the CoC API call using a server-side token
- Returns the response

**Pros:** Simple, cheap to host (Render free tier, Railway, etc.)
**Cons:** Server goes down = app breaks for all users. Rate limiting risks.

### Option B — Serverless Functions (Recommended)
Host API proxy functions on Vercel/Netlify/Cloudflare Workers:
- No server to manage
- Auto-scales
- Free tier likely sufficient
- Each function = one API endpoint

**Implementation:**
```
User App → POST https://your-worker.workers.dev/api/clan
  ↓
Cloudflare Worker → CoC API (using server-stored token)
  ↓
Response → User App
```

### Option C — Supabase Edge Functions
If Supabase is ever added for other features, Edge Functions could host the proxy.

---

## Security Considerations

- The server-side API token must be in environment variables, never in code
- Rate limiting must be implemented to prevent abuse
- Consider requiring a simple passphrase to prevent public misuse

---

## Open Questions

1. Which hosting platform? (Cloudflare Workers recommended for free tier + performance)
2. Rate limiting strategy? (Per-IP? Per clan tag? Per session?)
3. Should the Electron app fall back to local token if server is unavailable?
4. Is a passphrase sufficient, or do we need user accounts?
