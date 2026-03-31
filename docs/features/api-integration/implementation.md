# Feature Implementation — API Integration

**Status:** Active (v1.0.0)
**Files:** `main.js`, `preload.js`

---

## What It Does

Fetches live Clash of Clans data from the official CoC REST API and returns it
to the renderer via Electron's IPC bridge. All network requests run in the main
process — never in the renderer — because the API token must stay server-side.

See `docs/architecture/data-flow.md → Flow 1` for the full request sequence.

---

## Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /v1/clans/{tag}` | Clan info: name, badge, league, member list with TH levels |
| `GET /v1/clans/{tag}/currentwar/leaguegroup` | CWL group: all 8 clans' rosters + 7 rounds of war tags |
| `GET /v1/clanwarleagues/wars/{warTag}` | Individual war details: members, attacks, destruction, state |

---

## Request Pattern

- **Call 1** (`/v1/clans/{tag}`) is awaited serially — if it fails, the whole fetch aborts.
- **Call 2** (`/currentwar/leaguegroup`) is awaited next — failure sets `cwlError` but does not abort.
- **Calls 3–9** (war details per round) use `Promise.all` per round — parallel fetch (see ADR-006).

---

## Error Handling

| Status Code | Meaning | Handling |
|---|---|---|
| 403 | IP not whitelisted or invalid token | Human-readable error returned to renderer |
| 404 | Clan not found / not in CWL | Clan fetch: hard fail. CWL fetch: sets `cwlError` |
| 500 | Unparseable response | Reject with generic parse error message |
| Network error | DNS / connection failure | Caught by `req.on('error')`, propagated to caller |

---

## Data Normalization

The CoC API returns each war from a neutral perspective — our clan may appear
as either `war.clan` or `war.opponent`. After fetching, `main.js` swaps these
keys so our clan is always `war.clan` and the enemy is always `war.opponent`.
This means all downstream code can safely assume `war.clan === our clan`.

---

## Security Notes

- API token read from `api_config.json` at startup — never sent to the renderer
- `api_config.json` is gitignored — never committed (see ADR-005)
- All API calls are made in the main process — the renderer only receives processed results
- `contextIsolation: true` and `nodeIntegration: false` prevent the renderer from
  accessing Node.js directly (see ADR-001)

---

## Known Limitations

- The API token is IP-whitelisted — it stops working when your IP changes
- This is the core blocker for the public server feature (see `features/public-server/design.md`)
- Rate limits: the official API has undocumented rate limits; excessive auto-refresh intervals
  may result in temporary 429 errors (not currently handled)
