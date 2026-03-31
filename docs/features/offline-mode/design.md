# Feature Design — Offline Mode

**Status:** Planned (future)
**Dependency:** Requires the public server feature first (or local API token)

---

## Problem

The app currently requires an active internet connection and a valid API token
every time you want to refresh data. During a live CWL season, you may want to:

- View data on a device with no internet
- Recover quickly after an API outage
- Continue working after your IP changes and your token stops working

---

## Current Mitigation

The **data freeze safeguard** (ADR-003) already handles one offline scenario:
if the API fails while local data exists, the app keeps the cached data and
does not wipe it. This is a passive protection, not a true offline mode.

---

## Goal

Allow the app to fully function without an internet connection using the last
successfully fetched data, and optionally pre-cache data while online.

---

## Architecture Options

### Option A — Service Worker (Web-Only)
Not applicable — this is an Electron desktop app, not a progressive web app.

### Option B — Enhanced localStorage Persistence (Recommended for now)
The app already persists all state to `localStorage`. The main gaps are:

1. **Auto-refresh on startup** currently fires even when offline → wastes time
2. **No "last updated" timestamp** shown to user → user doesn't know how stale the data is
3. **No visual indicator** that the app is running in offline/cached mode

**Implementation:**
- Add a `cwl_last_fetched` timestamp to `localStorage`
- Show a "Last updated: X minutes ago" indicator in the UI
- If startup fetch fails, show "Running on cached data from [timestamp]" toast
- Skip auto-refresh if `navigator.onLine === false`

### Option C — Electron Offline Detection
Use Electron's `online-status-changed` events to:
- Disable the fetch button when offline
- Show a banner: "No internet connection — showing cached data"
- Auto-fetch when the connection is restored

---

## Open Questions

1. Should offline mode be automatic or user-toggled?
2. How long should cached data be considered "fresh" before showing a staleness warning?
3. Should the fetch button be disabled when offline, or still shown (with a better error)?
