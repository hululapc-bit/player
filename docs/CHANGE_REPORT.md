# WebRainmeter Change Report

## Project Location

`D:\codex\player`

## Initial Goal

Build a local Flask-served browser music dashboard inspired by Rainmeter.

The app should show:

- album art
- title, artist, album, and source
- progress bar
- playback controls
- live clock
- weather
- lyrics
- visualizer

## Initial Implementation

Created the project scaffold:

- `server.py`
- `requirements.txt`
- `config.env.example`
- `frontend/index.html`
- `frontend/style.css`
- `frontend/app.js`
- `frontend/assets/fallback-cover.png`
- `README.md`
- `SETUP.md`
- `LICENSE`
- `.gitignore`

The first backend version used `wnpcli`.

That was wrong for this setup because:

- `wnpcli` was not installed.
- `wnpcli` was not available on PATH.
- The WebNowPlaying extension screenshot showed `CLI` was unchecked.
- The extension was connected to `Rainmeter`, not CLI.

Result:

- Flask worked.
- The frontend loaded.
- `/nowplaying` stayed idle.
- Music metadata was not fetched.

## First Fix Attempt

Changed the backend to use `pywnp==2.0.2` and start WebRainmeter as its own WebNowPlaying custom adapter on port `1234`.

This changed the intended setup to:

- run `python server.py`
- open WebNowPlaying extension
- enable `Custom Adapter`
- enter port `1234`

Problem:

- `pywnp==2.0.2` depends on `winsdk`.
- On the user's Python 3.13 environment, `winsdk` did not have a usable prebuilt wheel.
- `pip` tried to build `winsdk` from source.
- The build failed because Microsoft Visual Studio / C compiler was not installed.

Observed error:

```text
Building wheel for winsdk did not run successfully.
No CMAKE_C_COMPILER could be found.
Visual Studio 17 2022 could not find any instance of Visual Studio.
Building windows wheels requires Microsoft Visual Studio.
```

Result:

- Dependency installation failed.
- Port `1234` did not work because the server could not start with the missing dependency.

## Final Fix

Pinned `pywnp` to the older adapter package:

```text
pywnp==1.0.5
```

Reason:

- `pywnp==1.0.5` depends on `websockets`.
- It does not depend on `winsdk`.
- It does not require Visual Studio.
- It can start the WebNowPlaying adapter port directly.

Updated `server.py` to support the older API:

- `WNPRedux.Initialize(...)`
- `WNPRedux.mediaInfo`
- `WNPRedux.mediaEvents.TogglePlaying()`
- `WNPRedux.mediaEvents.Next()`
- `WNPRedux.mediaEvents.Previous()`

The backend still also supports the newer API shape if present:

- `WNPRedux.start(...)`
- `WNPRedux.media_info`
- `media_info.controls.try_toggle_play_pause()`

## Current Requirements

`requirements.txt` now contains:

```text
Flask==3.0.3
python-dotenv==1.0.1
requests==2.32.3
pywnp==1.0.5
```

## Current WebNowPlaying Setup

The app now acts as a WebNowPlaying custom adapter.

Use this extension setup:

1. Run `python server.py`.
2. Open the WebNowPlaying extension popup.
3. Tick `Custom Adapter`.
4. Enter port `1234`.
5. Play music in a supported browser source.

Do not use the CLI adapter for this app.

## Current Backend Endpoints

- `GET /`
- `GET /health`
- `GET /nowplaying`
- `POST /control`
- `GET /lyrics?title=...&artist=...&duration_ms=...`
- `GET /weather`
- `GET /cover?url=...`

## Verification Done

Verified after the final fix:

- `pip install -r requirements.txt` works with `pywnp==1.0.5`.
- `server.py` compiles.
- `frontend/app.js` syntax check passes.
- Flask starts.
- `GET http://127.0.0.1:5000/health` returns ok.
- `GET http://127.0.0.1:5000/nowplaying` returns a clean idle state.
- TCP port `1234` opens successfully.

Smoke test result:

```json
{
  "Health": "ok",
  "NowPlayingAvailable": false,
  "Message": "Connected. Waiting for music metadata...",
  "Port1234Open": true
}
```

This means:

- Flask is running.
- The custom adapter server is running.
- Port `1234` is open.
- The app is waiting for metadata from the WebNowPlaying extension.

## Current Run Commands

From `D:\codex\player`:

```powershell
pip install -r requirements.txt
python server.py
```

Open:

```text
http://localhost:5000/
```

## If Music Still Does Not Appear

Check these in order:

1. `python server.py` must already be running.
2. WebNowPlaying extension must have `Custom Adapter` checked.
3. Custom Adapter port must be `1234`.
4. If it was already checked, uncheck and recheck it while the server is running.
5. Play music in a WebNowPlaying-supported browser source.
6. Open `http://127.0.0.1:5000/nowplaying` and check the returned message.

## Files Changed

- `server.py`
- `requirements.txt`
- `config.env.example`
- `README.md`
- `SETUP.md`
- `.gitignore`
- `frontend/index.html`
- `frontend/style.css`
- `frontend/app.js`
- `frontend/assets/fallback-cover.png`
- `LICENSE`

