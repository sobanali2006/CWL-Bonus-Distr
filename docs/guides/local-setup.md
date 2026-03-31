# CWL Performance Tracker — Local Setup Guide

---

## Prerequisites

- **Node.js** v18 or newer — [nodejs.org](https://nodejs.org)
- A **Clash of Clans API token** — [developer.clashofclans.com](https://developer.clashofclans.com)
- Your **IP address must be whitelisted** on the API token (see api-token-setup.md)

---

## Steps

### 1. Clone the repository

```bash
git clone https://github.com/sobanali2006/CWL-Bonus-Distr.git
cd CWL-Bonus-Distr
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `api_config.json`

Create a file named `api_config.json` in the project root:

```json
{
  "apiToken": "your_api_token_here"
}
```

> ⚠️ This file is gitignored. Never commit it. It contains your API key.
> See `docs/guides/api-token-setup.md` for how to get a token.

### 4. Start the app

```bash
npm start
```

---

## Common Issues

| Problem | Fix |
|---|---|
| `CRITICAL: Could not read api_config.json` | Create the file as shown in Step 3 |
| `Access Denied (403)` on fetch | Your IP is not whitelisted on the API token |
| `Clan tag not found (404)` | Double-check the clan tag — must start with # |
| App window appears but data doesn't load | Open DevTools (uncomment line in main.js) to check console errors |
| Blank screen on startup | Run `npm install` again, check Node.js version |

---

## Enabling DevTools

In `main.js`, uncomment this line:

```javascript
// win.webContents.openDevTools();
```

This opens the Chrome DevTools panel for the renderer process.
