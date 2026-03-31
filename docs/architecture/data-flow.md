# CWL Performance Tracker — Data Flow

End-to-end trace of how data moves through the system.

---

## Flow 1: Fetching Clan Data (Main Path)

```
User types clan tag → clicks "Fetch War Data"
  ↓
events.js → handleApiFetch()
  ↓
window.api.fetchClanData(clanTag)  ← crosses IPC bridge via preload.js
  ↓
main.js → ipcMain.handle('fetch-clan-data')
  ↓
API Call 1: GET /v1/clans/{tag}            → clanInfo (name, badge, league, memberList)
API Call 2: GET /v1/clans/{tag}/currentwar/leaguegroup → cwlGroupInfo (rounds, war tags)
API Calls 3-9: GET /v1/clanwarleagues/wars/{warTag}    → warDetails[0..6]
  (fetched in parallel per round using Promise.all)
  ↓
{ success: true, data: { clanInfo, warDetails, cwlError, cwlMasterRoster } }
  ↓ crosses IPC bridge back to renderer
events.js → processApiData(result.data)
  ↓
state.js → processApiData()
  - Builds player objects from clanInfo.memberList
  - Maps each player's war data from warDetails[0..6]
  - Identifies CWL roster members (cwlMasterRoster set)
  - Sets currentLiveDayIndex (which war is currently 'inWar')
  - Calls saveAppState() → localStorage
  - Calls computeAll()
  ↓
state.js → computeAll()
  - Auto-calculates warsWon from warDetails states
  - Auto-calculates cwlFinished (7 wars started)
  - Auto-calculates bonusCount (leagueBase + warsWon)
  - Calculates performance scores for every player/war via calculator.js
  - Sorts players and assigns ranks
  - Calls renderPlayersTable() + renderRankingsTable()
  ↓
ui/main_view.js → DOM updated
```

---

## Flow 2: Scoring a Single Attack

```
player object + warData object
  ↓
calculator.js → calculatePerformanceScore(player, warData)
  ↓
1. Guard: if player not in lineup → return null
2. Guard: if attack missed → return -20 (flat penalty)
3. Base score from stars: 1★=40, 2★=70, 3★=80
4. Destruction bonus: destructionPercentage × 0.2
5. baseAttackScore = starScore + destructionBonus
6. attackerPPS = getPlayerStrength(player.th, warData.myPosition)
7. defenderPPS = getPlayerStrength(warData.opponentTh, warData.opponentPosition)
8. difficultyMultiplier = defenderPPS / attackerPPS
9. finalScore = baseAttackScore × difficultyMultiplier
  ↓
score returned to state.js → stored in player.__computed.warScores[i]
```

---

## Flow 3: Save / Load

### Save (Export)
```
User clicks "Save" button
  ↓
events.js → exportData()
  ↓
state.js → exportData()
  - Strips __computed from all players (computed data is not saved)
  - Serializes full state to JSON string
  ↓
window.api.exportData(jsonString) ← crosses IPC bridge
  ↓
main.js → dialog.showSaveDialog() → fs.writeFileSync()
```

### Load (Import)
```
User clicks "Load" button
  ↓
window.api.importData() ← crosses IPC bridge
  ↓
main.js → dialog.showOpenDialog() → fs.readFileSync()
  ↓ crosses IPC bridge back
state.js → importData()
  - Parses JSON
  - Restores all state variables
  - Ensures all players have valid war arrays (backfills if needed)
  - Calls saveAppState() → localStorage
  - Calls computeAll() → re-renders UI
```

---

## Flow 4: Auto-Refresh

```
User sets auto-refresh interval in Settings
  ↓
events.js → setupAutoRefresh(minutes)
  - Clears existing interval timer
  - Sets new setInterval → calls handleApiFetch() every N minutes
  - handleApiFetch() with isBackground=true (silent toast)
```

---

## localStorage Key Map

| Key | Content | Set By |
|---|---|---|
| `cwl_players_v5` | Full player array (no __computed) | state.js → saveAppState() |
| `cwl_war_details` | Raw war data from API | state.js → saveAppState() |
| `cwl_settings_v1` | appSettings object | state.js → saveAppState() |
| `cwl_league_id` | Selected league ID string | state.js → saveAppState() |
| `cwl_war_format` | 15 or 30 | state.js → saveAppState() |
| `cwl_live_day_index` | Index of currently live war | state.js → saveAppState() |
| `cwl_clan_meta` | Clan name, badge URL, league name | state.js → saveAppState() |
| `cwl_clan_tag` | Last used clan tag | state.js → saveAppState() |
