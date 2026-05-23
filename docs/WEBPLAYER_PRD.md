# 🎵 WebRainmeter — Project Spec (PRD)
> A persistent, always-on browser-based music player widget inspired by Rainmeter.  
> Target agents: Antigravity, Codex, Claude Code (custom model), or any vibe coder AI.

---

## 🧭 Project Overview

**What it is:** A locally-hosted web app that displays the currently playing music on the user's system — album art, track info, lyrics, progress bar, visualizer, weather, and a live clock — styled as a Rainmeter-inspired aesthetic dashboard.

**Why web instead of Rainmeter:** The browser never auto-locks. The desktop screen turns off after idle time, killing Rainmeter widgets. A browser tab stays alive as long as the machine is on and a tab is open — making it a persistent, always-visible now-playing display.

**Deployment:** Runs on `localhost` initially. Will be open-sourced on GitHub as a portfolio/AI project.

---

## 🏗️ Architecture

```
[Music Source]
     ↓
[WebNowPlaying Companion App]  ← browser extension feeds data here
     ↓  (WebSocket ws://localhost:1234)
[Python Flask API Server]      ← wraps WS data into REST + serves fallbacks
     ↓  (HTTP polling / SSE)
[Frontend Web Page]            ← the actual display
     ↓
[External APIs]
  - LRCLIB (lyrics, free, no key)
  - OpenWeatherMap (weather, free tier)
```

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Now-playing bridge | WebNowPlaying Redux (extension + companion app) |
| Backend | Python 3.x + Flask + `websockets` library |
| Local files fallback | Python `mutagen` library |
| Frontend | Vanilla HTML / CSS / JS (no framework required) |
| Lyrics | LRCLIB API — `https://lrclib.net/api` |
| Weather | OpenWeatherMap free API |
| Fonts | User's aesthetic choice — see Design section |
| Hosting | Localhost (GitHub Pages not applicable — backend is local) |

---

## 🎛️ Features

### Must-Have (MVP)
- [ ] Album art display (large, dominant)
- [ ] Song title + artist name
- [ ] Progress bar (live, auto-updating)
- [ ] Playback controls (prev / play-pause / next) via WebNowPlaying
- [ ] Live digital clock
- [ ] Weather widget (current temp + condition icon)

### Should-Have
- [ ] Synced lyrics (timestamp-matched via LRCLIB)
- [ ] Audio visualizer (Web Audio API — bars or waveform)
- [ ] Blurred album art as dynamic page background
- [ ] Smooth transitions on track change

### Nice-to-Have
- [ ] AI mood tag (genre → mood label via local LLM call or simple mapping)
- [ ] Dynamic color palette extracted from album art (ColorThief.js)
- [ ] Local files fallback (mutagen metadata reader, folder-watched)
- [ ] Multi-source indicator (shows which source is active)

---

## 🔌 Backend Spec

### File: `server.py`

**Responsibilities:**
1. Connect to WebNowPlaying companion WebSocket at `ws://localhost:1234`
2. Cache the latest now-playing state in memory
3. Expose the following REST endpoints:

#### `GET /nowplaying`
Returns current track data.

```json
{
  "title": "Song Name",
  "artist": "Artist Name",
  "album": "Album Name",
  "cover_url": "https://...",
  "progress_ms": 42000,
  "duration_ms": 210000,
  "is_playing": true,
  "source": "YouTube Music"
}
```

#### `GET /lyrics?title=...&artist=...`
Proxies to LRCLIB. Returns:
```json
{
  "synced": true,
  "lines": [
    { "time_ms": 4200, "text": "Lyric line here" },
    ...
  ]
}
```

#### `GET /weather`
Calls OpenWeatherMap with a hardcoded city (set in `.env`). Returns:
```json
{
  "temp": 28,
  "unit": "C",
  "condition": "Cloudy",
  "icon": "04d"
}
```

#### `GET /health`
Returns `{ "status": "ok" }` — used by frontend to detect if server is running.

---

### File: `config.env` (user fills this in)
```
OPENWEATHER_API_KEY=your_key_here
OPENWEATHER_CITY=Ambikapur
OPENWEATHER_UNITS=metric
WNP_WEBSOCKET_PORT=1234
```

---

## 🎨 Frontend Spec

### File structure
```
/frontend
  index.html
  style.css
  app.js
  /assets
    fallback-cover.png   ← shown when no album art available
```

### Layout Zones (v3 — locked)

```
┌──────────────────────────────────────────────────────┐
│  23:41:07        ● YT MUSIC           28°C · City    │  ← topbar
├────────────────┬───────────────────────┬─────────────┤
│                │                       │ // mood      │
│  [ALBUM ART]   │  // lyrics            │ MELANCHOLIC  │
│  144×144px     │                       │ ──────────── │
│                │  past line            │ // source    │
│  Song Title    │  past line            │ YT Music     │
│  Artist·Album  │▌ ACTIVE LINE (large)  │ ──────────── │
│                │  next line            │ // format    │
│  ━━━━━━━━ 1:22 │  next line            │ STREAM 256k  │
│  ⏮  ⏸  ⏭     │  next line            │ ──────────── │
│                │                       │ // uptime    │
│                │                       │ 04:12:38     │
├────────────────┴───────────────────────┴─────────────┤
│  ▁▃▆▇▅▇▆▄▆▇▅▆▃▁▂▄▆▅▄▆▇▅▆▃▁  // visualizer           │
└──────────────────────────────────────────────────────┘
  col 1: 210px      col 2: 1fr          col 3: 130px
```

### Design Direction (locked v3)

**Aesthetic:** Y2K retro-digital meets clean dark dashboard. Deep black base (`#090b10`), subtle scanline overlay (4px repeat, 7% opacity), soft radial purple/blue glow in background.

**Typography:**
- Song title + active lyric line → `Special Elite` (Google Fonts) — worn typewriter face
- Clock, labels, metadata, progress time → `Share Tech Mono` — terminal monospace
- All caps labels use `letter-spacing: 2px`, 8–9px, muted color (`#1e2e42`)

**Colors:**
- Base accent: `#5b9cf6` (blue) — used on progress fill, active lyric border, pip, lit visualizer bars
- Dynamic override: ColorThief.js extracts dominant color from album art on each track change; replaces `#5b9cf6` as CSS variable `--accent`
- Background glow shifts subtly with accent color on track change

**Lyrics panel (center column):**
- Past lines: `#2e4060`, 12px
- Active line: `#d8e8ff`, 15px, `border-left: 2px solid var(--accent)`, `padding-left: 10px`
- Future lines: `#2a3a55`, 12px
- Auto-scrolls so active line stays vertically centered

**Album art (left column):**
- 144×144px, `border-radius: 8px`, `border: 0.5px solid #1e2a3a`
- When track playing: shows album cover image
- When idle / no track: animated idle state — 7 EQ bars pulsing at staggered speeds (`#1e3a5a` → `#2a5888`), 3 blinking dots, blinking `WAITING...` text at 8px
- Corner pip: small circle, blinks between `#1e3050` and `#5b9cf6`

**Metadata sidebar (right column, 130px):**
- Sections: `// mood`, `// source`, `// format`, `// uptime`
- Each separated by `0.5px solid #141820` divider
- Mood tag: pill with `border: 0.5px solid #1e2a3a`
- All values in `Share Tech Mono`, muted palette

**Visualizer (bottom, full width):**
- Thin bars (5px wide, `gap: 3px`), `border-radius: 2px 2px 0 0`
- Three states: lit (`var(--accent)`), mid (`#2a4878`), dim (`#1e3050`)
- For streaming sources: dummy animation driven by progress data (not real frequencies)
- Label `// visualizer` bottom-right, 8px, very muted

**Idle screen behavior:**
- `/health` endpoint fails → entire page switches to idle state
- Album frame shows animated EQ idle; track info shows `---`; lyrics zone shows `// waiting for player`
- Does not crash or show errors

### Polling Behavior
- `app.js` polls `GET /nowplaying` every **1000ms**
- On track change (title differs from last state): fetch new lyrics, reset visualizer, crossfade art
- On server down (`/health` fails): show a "Waiting for player..." idle screen — don't crash

---

## 📁 Repo Structure (for GitHub)

```
webplayer/
├── server.py               ← Flask backend
├── config.env.example      ← template config (never commit real keys)
├── requirements.txt        ← Python deps
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── README.md
├── SETUP.md                ← step-by-step install guide
└── LICENSE                 ← MIT
```

---

## 📋 SETUP.md Outline (agent should generate this file too)

1. Install WebNowPlaying Redux extension (Chrome/Edge link)
2. Install WebNowPlaying companion desktop app (GitHub release link)
3. Clone this repo
4. `pip install -r requirements.txt`
5. Copy `config.env.example` → `config.env`, fill in API key + city
6. Run `python server.py`
7. Open `frontend/index.html` in browser (or serve via Flask static)
8. Play music — widget updates automatically

---

## ⚠️ Known Constraints / Agent Notes

- **WNP bridge target for v1: WNP CLI** (companion app). Raw Python WebSocket and C adapter are v2+ concerns. Do not implement them in v1.
- **Web Audio API visualizer** works with local audio context only — it cannot tap into system audio directly from a webpage. For streaming sources, the visualizer may need to run in a "dummy" animation mode (reacting to progress data instead of actual frequencies). Flag this to the user clearly in README.
- **LRCLIB** is free and requires no API key. Query format: `GET https://lrclib.net/api/get?artist_name=X&track_name=Y`
- **ColorThief.js** requires the album art image to be CORS-accessible. Proxy the image through the Flask backend if direct loading fails.
- **No login, no auth, no database.** Everything is stateless and local.
- **Target user is non-dev** for the end product — setup should be as simple as possible. Minimize CLI steps.

---

## 🤖 AI Project Angle (for GitHub README)

This project uses:
- AI-powered lyric sync (timestamp matching via LRCLIB)
- Dynamic color theming via ML-adjacent dominant color extraction (ColorThief)
- Optional: mood tagging via local LLM (Ollama) based on genre metadata

Position as: *"A Rainmeter-inspired, AI-enhanced music dashboard for the browser."*

---

---

## 🛠️ Implementation History

> What was built, what broke, and how it was fixed. Keep this updated as the project evolves.

### Project Location
`D:\codex\player`

### Backend Bridge — What Was Tried

**Attempt 1: `wnpcli`**
- Failed — `wnpcli` not installed, not on PATH, and the WNP extension had `CLI` unchecked (connected to Rainmeter instead)
- Result: Flask ran, frontend loaded, `/nowplaying` stayed idle

**Attempt 2: `pywnp==2.0.2`**
- Changed backend to act as its own WNP custom adapter on port `1234`
- Failed — `pywnp==2.0.2` depends on `winsdk`, which requires Microsoft Visual Studio C compiler to build from source
- Error: `No CMAKE_C_COMPILER could be found. Building windows wheels requires Microsoft Visual Studio.`
- Result: dependency install failed, server never started

**Final fix: `pywnp==1.0.5`**
- Uses `websockets` only — no `winsdk`, no Visual Studio needed
- Starts the WNP adapter port directly
- API used: `WNPRedux.Initialize()`, `WNPRedux.mediaInfo`, `WNPRedux.mediaEvents.*`
- Backend also handles newer API shape (`WNPRedux.start()`, `WNPRedux.media_info`) if present

### Current `requirements.txt`
```
Flask==3.0.3
python-dotenv==1.0.1
requests==2.32.3
pywnp==1.0.5
```

### Current WNP Setup (Custom Adapter mode)
1. Run `python server.py`
2. Open WebNowPlaying extension popup
3. Tick `Custom Adapter`
4. Enter port `1234`
5. Play music in a supported browser source

> Do NOT use the CLI adapter for this app.

### Current Backend Endpoints
- `GET /` — serves frontend
- `GET /health` — server status check
- `GET /nowplaying` — current track data
- `POST /control` — playback controls (play/pause/next/prev)
- `GET /lyrics?title=...&artist=...&duration_ms=...` — proxies LRCLIB
- `GET /weather` — proxies OpenWeatherMap
- `GET /cover?url=...` — proxies album art (CORS workaround)

### Verified Working
- `pip install -r requirements.txt` ✅
- `server.py` compiles ✅
- Flask starts on port `5000` ✅
- TCP port `1234` opens ✅
- `/health` returns `ok` ✅
- `/nowplaying` returns clean idle state ✅

### If Music Still Doesn't Appear
1. Confirm `python server.py` is running
2. Confirm WNP extension has `Custom Adapter` checked with port `1234`
3. Uncheck and recheck `Custom Adapter` while server is running
4. Play music in a WNP-supported browser source
5. Hit `http://127.0.0.1:5000/nowplaying` directly to check response

---

### Performance Optimization Pass (post-MVP)

**Files changed:** `index.html`, `style.css`, `app.js`

#### What was added

**Sidebar `// optimization` panel (`index.html`)**
Four drop-down selectors styled to match the Y2K terminal aesthetic:
- `VIZ FPS` — cap visualizer at 60 / 30 / 15 FPS or OFF
- `GLOW/SHADOW` — toggle canvas shadow blur + text glow ON/OFF
- `BACKDROP` — toggle `blur(80px)` CSS filter vs flat dark tint
- `CRT FLICKER` — toggle scanline animation ON/OFF

**CSS performance classes (`style.css`)**
- `body.perf-flat-bg` — disables `filter: blur(...)` on background art; drops GPU composition to near zero
- `body.perf-no-crt` — disables `crt-flicker` animation (was triggering screen-wide repaint every 0.15s)
- `body.perf-no-glow` — disables text-shadows, canvas glow, bloom on clock/progress/art

**Visualizer throttling (`app.js`)**
- `drawVisualizer(timestamp)` uses frame delta timing to cap draw rate per user setting
- Rendering pauses completely when player is offline
- Throttles to 10 FPS when active but paused
- `ctx.shadowBlur` conditionally disabled when glow is OFF

**Settings persistence:** all 4 values saved/loaded from `localStorage`

#### Lyric styling locked in
- Past/future lines: `15px`, `color-mix(in srgb, var(--accent) 30%, transparent)`
- Active line: `20px`, `var(--accent)` full brightness, left-border accent
- Line height: `2.2`
- Small screen fallback (`max-height: 750px`): 13px / 16px, line-height `1.8`

#### Performance impact reference

| Setting | HQ Default | Optimized | Benefit |
|---|---|---|---|
| VIZ FPS | Native (60Hz+) | 30/15/OFF | Lowers CPU canvas loop |
| GLOW/SHADOW | Full glow | Flat | Reduces GPU fill-rate |
| BACKDROP | `blur(80px)` | Flat tint | Eliminates filter composition lag |
| CRT FLICKER | Constant | Static | Stops continuous browser repaints |

---

### Optimization Pass 2 — GPU, Lyric Sync, Title Cleaning

**Files changed:** `style.css`, `app.js`, `server.py`

#### 1. GPU blur rasterization fix
- **Problem:** `filter: blur(80px)` on a full-screen 100vw x 100vh image caused severe GPU redraw lag on integrated graphics
- **Fix:** Shrunk background container to 10vw x 10vh, reduced blur to `6px`, scaled up with `transform: scale(11.5)` -- offloads rasterization to GPU compositor
- **Result:** >95% rendering cost reduction. `.perf-flat-bg` still available as fallback

#### 2. Spotify title cleaning + lyric fallbacks (`server.py`)
- **Problem:** Spotify appends collaborator/edition tags to titles (e.g. `Sweater Weather - feat. ...`) causing LRCLIB 404s
- **Fix:** Added `clean_track_title()` regex parser; `/lyrics` endpoint retries with cleaned title on 404
- **Result:** Dramatically higher lyrics match rate on Spotify Web tracks

#### 3. Duration/progress unit detection (`server.py`)
- **Problem:** Spotify Web reports duration in ms but position in seconds -- caused durations like `2889:54` and lyric sync flickering
- **Fix:** Redesigned `get_duration_ms` + `get_progress_ms` to detect source and scale units dynamically. Killed zombie `python3.13` processes caching stale state
- **Verified:** Arctic Monkeys I Wanna Be Yours -- duration_ms: 184003, progress_ms: 109000 OK

---

## 🗺️ v2 Roadmap

> MVP is live. This section tracks what comes next.  
> Items marked 🔧 are optimizations. Items marked ✨ are new features.  
> Pick from either column — they're independent of each other.

---

### 🔧 Optimization Backlog
> Fix rough edges in what's already built. Hulula will specify priority order.

| ID | What | Where | Notes |
|---|---|---|---|
| O1 | Lyrics active line auto-scroll | `app.js` | Active line should stay vertically centered in panel as song progresses |
| O2 | Accent color consistency across sources | `app.js` + ColorThief | Doesn't always extract correctly on low-contrast covers |
| O3 | Visualizer reactivity | `app.js` | Currently dummy animation — make bar heights vary more dynamically with progress rhythm |
| O4 | Progress bar sync drift | `app.js` | Polling at 1000ms causes ~0.5s drift — interpolate between polls |
| O5 | Idle state polish | `style.css` | Transition in/out of idle should crossfade, not snap |
| O6 | ~~Page performance audit~~ | ~~`app.js` + `style.css`~~ | ✅ Done — performance settings panel added, visualizer throttled, CSS repaint sources togglable |
| O7 | Weather refresh rate | `server.py` | Currently fetches on every `/weather` call — cache for 10 min server-side |
| O8 | Font load flash (FOUT) | `index.html` | Add `font-display: swap` or preload Special Elite + Share Tech Mono |

---

### ✨ Feature Backlog
> Grow the site. Grouped by effort level.

#### Small (1 session each)
| ID | Feature | Notes |
|---|---|---|
| F1 | Local files support | Python `mutagen` watcher — reads MP3/OPUS/WAV metadata from a watched folder |
| F2 | Keyboard shortcuts | Space = play/pause, ←/→ = prev/next, no mouse needed |
| F3 | Song history log | Last N tracks played, shown on hover or a small panel — in-memory, no DB |
| F4 | Copy lyrics button | One-click copies full lyrics to clipboard |
| F5 | Clock format toggle | Click clock to switch HH:MM ↔ HH:MM:SS |

#### Medium (2–3 sessions each)
| ID | Feature | Notes |
|---|---|---|
| F6 | Fortify web source support | Test WNP extension with Fortify — document any quirks |
| F7 | Spotify Web API integration | OAuth flow, separate from WNP — richer metadata (BPM, genre) |
| F8 | AI mood tag (real) | Replace hardcoded mood with Ollama local LLM call based on genre/title — optional module |
| F9 | Album art color palette display | Show 3–5 extracted swatches from ColorThief in sidebar |
| F10 | Hotkey overlay | Press `?` to show all keyboard shortcuts in a modal |

#### Large (own milestone)
| ID | Feature | Notes |
|---|---|---|
| F11 | Multi-source switcher | UI to manually select active source when multiple are playing |
| F12 | Theme system | 2–3 switchable visual themes (current Y2K dark, a minimal light, a high-contrast) |
| F13 | Mobile layout | Responsive single-column layout for phone/tablet viewing |
| F14 | GitHub Pages frontend demo | Static demo mode with fake data — no backend needed — for portfolio showcase |
| F15 | Real visualizer via system audio | Research loopback audio capture (e.g. via VB-Cable + Web Audio API) — hard, but the "wow" feature |

---

### 📌 Current Status

| Layer | Status |
|---|---|
| Backend (Flask + WNP) | ✅ Working |
| Now-playing data | ✅ Working |
| Lyrics (LRCLIB synced) | ✅ Working |
| Lyric styling (accent color, sizing) | ✅ Done |
| Weather widget | ✅ Working |
| Dynamic accent color | ✅ Working |
| Visualizer (dummy) | ✅ Working |
| Golden ratio layout | ✅ Working |
| Performance settings panel | ✅ Done |
| Visualizer FPS throttling | ✅ Done |
| GPU blur rasterization fix | ✅ Done |
| Spotify title cleaning | ✅ Done |
| Duration/progress unit detection | ✅ Done |
| Settings localStorage persistence | ✅ Done |
| Local files | ⬜ Not started |
| Spotify API | ⬜ Not started |
| README / SETUP.md | ⬜ Not started |
| GitHub push | ⬜ Not started |

---

*Spec authored for: Hulula's WebRainmeter project — May 2026*  
*Design locked at v3. Feed this file directly to your vibe coder AI as the system prompt or project context.*
### Latest Portfolio Pass

- F14 GitHub Pages frontend demo: done. Static demo mode now runs with fake tracks on `?demo=1`, `file://`, and `*.github.io`, and `.github/workflows/pages.yml` publishes `frontend/`.
- README / SETUP.md: done. Both files now document the current Custom Adapter setup and the static portfolio demo path.
- F3 song history: already present in the sidebar with localStorage persistence.

---
