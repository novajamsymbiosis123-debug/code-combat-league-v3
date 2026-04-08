# 🏆 Code Combat League v3.0

> A full 5-level competitive coding tournament for 50 players — sequential 1v1 matches, escalating difficulty, real-time code streaming, and a live Final Battle showdown.

---

## 🚀 Quick Start

```bash
npm install
node server.js
```

Then open:
| Role | URL |
|------|-----|
| Host / Admin | http://localhost:3000/coding-combat-host.html |
| Player 1 | http://localhost:3000/coding-combat-player.html?slot=1 |
| Player 2 | http://localhost:3000/coding-combat-player.html?slot=2 |

---

## 🏗️ Tournament Structure

| Level | Players | Problems | Difficulty |
|-------|---------|----------|------------|
| Level 1 — Entry Round | 50 → 25 | 1 Easy | 🟢 Easy |
| Level 2 — Knockout | 25 → 13 | 1 Easy + 1 Medium | 🟡 Easy + Medium |
| Level 3 — Advanced Knockout | 13 → 7 | 1 Medium | 🟡 Medium |
| Level 4 — Semi-Final | 7 → 4 | 1 Medium + 1 Hard | 🔴 Medium + Hard |
| Level 5 — Final Battle 🎯 | 2 → 1 | 1 Hard | 🔴 Hard |

> **BYE System:** When an odd number of players enter a level, the player with the fewest wins is awarded a BYE (auto-advance with no match needed).

---

## 🎮 How to Run a Tournament

1. **Open the Host screen** → Enter 50 player names (or use "DEMO 50" for testing)
2. Click **INITIATE TOURNAMENT** — 25 Level 1 matches are auto-generated
3. For each match:
   - Click **Start Next Match** → Players receive their challenge
   - Click **Start Battle** → Timers begin
   - Players code and submit on their screens
   - Winner is auto-detected on correct submission OR host can manually mark solved/timeout
4. After all matches in a level: **Advance to Next Level**
5. Repeat through Levels 2–4
6. **Level 5 Final Battle:** Both finalists code live, host monitors real-time code stream and can declare the winner manually
7. 🏆 **Champion screen** with gold confetti!

---

## 📁 File Structure

```
├── server.js                  # Express + Socket.io tournament engine
├── evaluator.js               # Sandboxed code evaluation (JS/Node.js VM)
├── coding-combat-host.html    # Admin/Host dashboard
├── coding-combat-player.html  # Player interface (slot=1 or slot=2)
├── package.json
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

---

## 🧩 Architecture

### Server (`server.js`)
- **TournamentEngine** class handles all state: players, matches, levels, winners
- **25 challenges** across Easy / Medium / Hard tiers
- Problems are assigned per level automatically
- Expected test case values are **never sent to the client** (server-side only)
- REST endpoints: `GET /health`, `GET /api/tournament`, `GET /api/challenges`

### Socket.io Events

**Tournament control (host → server):**
| Event | Description |
|-------|-------------|
| `tournament_init` | Start tournament with player list |
| `match_next` | Activate next pending match |
| `level_advance` | Advance to next level |
| `match_override` | Manually declare match winner |
| `tournament_reset` | Full reset |

**Battle control (host → server):**
| Event | Description |
|-------|-------------|
| `setup` | Set up current battle |
| `start` | Start timer |
| `pause` / `resume` | Pause/resume timer |
| `host_mark_solved` | Mark player as solved |
| `host_mark_out` | Eliminate a player |
| `host_declare_winner` | Final override (Level 5) |

**Broadcasts (server → all clients):**
| Event | Description |
|-------|-------------|
| `tournament_state` | Full state snapshot |
| `match_active` | New match started |
| `battle_state` | Battle status update |
| `code_update` | Live code stream |
| `eval_result` | Code evaluation result |
| `player_solved` | Player solved correctly |
| `winner` | Match winner declared |
| `level_started` | New level begins |
| `champion_crowned` | Tournament champion |

---

## 💻 Language Support

| Language | Evaluation |
|----------|-----------|
| JavaScript | ✅ Full server-side evaluation via Node.js VM sandbox |
| Python | ⚠️ Template shown, requires backend Python sandbox |
| C / C++ | ⚠️ Template shown, requires Docker/GCC sandbox |

---

## 🐳 Docker

```bash
docker-compose up --build
```

---

## 🌐 Deploy

- **Render:** See `render.yaml`
- **Railway:** See `railway.json`  
- **Fly.io:** See `fly.toml`
- **PM2:** See `ecosystem.config.js`

---

## ⚖️ Rules & Edge Cases

- **Tie:** Faster execution time wins
- **No submission:** Auto-loss when timer expires
- **Disconnect:** Grace timeout before forfeit
- **Host override:** Always available — final authority
- **BYE:** Fewest-wins player gets the free advance

---

*Built with Node.js · Express · Socket.io · Vanilla JS*
