# CoC API Token Setup

The app requires an API token from the official Clash of Clans developer portal.
This token is IP-whitelisted — it only works from the IP address you register it on.

---

## Steps

### 1. Get your current IP address

Visit [whatismyip.com](https://whatismyip.com) and note your IPv4 address.

> ⚠️ If you're on a dynamic IP (most home connections), your IP changes periodically.
> You'll need to create a new token (or update the whitelist) when it changes.
> This is the core limitation driving the public server feature plan.

### 2. Create a developer account

Go to [developer.clashofclans.com](https://developer.clashofclans.com) and sign in
with your Supercell ID.

### 3. Create an API key

- Click "My Account" → "Create New Key"
- Name: anything (e.g., "CWL Tracker Local")
- Description: optional
- Allowed IP addresses: paste your current IP

### 4. Copy the token

Copy the generated token string.

### 5. Add to api_config.json

```json
{
  "apiToken": "paste_your_token_here"
}
```

---

## What happens when your IP changes?

The API will return a 403 (Access Denied) error. You need to:
1. Go back to developer.clashofclans.com
2. Delete the old key
3. Create a new key with your new IP
4. Update `api_config.json`

This is why the public server feature is a planned improvement — it routes API calls
through a server with a static IP so users don't need their own tokens.
See `docs/features/public-server/design.md`.
