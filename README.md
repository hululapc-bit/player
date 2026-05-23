# WebRainmeter

WebRainmeter is a Rainmeter-inspired browser music dashboard for daily desktop use. It runs a local Flask backend, listens to WebNowPlaying Redux through a Custom Adapter, and renders album art, synced lyrics, weather, progress, controls, history, and a retro dark dashboard UI in the browser.

The live app is local-first. The GitHub Pages version is a static portfolio demo with fake tracks, so visitors can see the UI without installing WebNowPlaying or running Python.

## What It Does

- Now-playing dashboard with album art, title, artist, album, source, and progress
- Playback controls through WebNowPlaying where the source supports them
- Synced LRCLIB lyrics with active-line scrolling
- OpenWeather current conditions
- Dynamic accent color from album art
- Dummy streaming visualizer plus optional microphone/live input mode
- Song history stored in browser localStorage
- Performance controls for visualizer FPS, glow, backdrop, and CRT flicker
- Static demo mode for GitHub Pages and portfolio sharing

## Demo Mode

Open `frontend/index.html?demo=1` to run the backend-free showcase locally. The app also enables demo mode automatically on `file://` and `*.github.io` hosts.

Demo mode uses mock tracks and does not call `/nowplaying`, `/lyrics`, `/weather`, or `/control`.

## Local Requirements

- Python 3.10+
- WebNowPlaying Redux browser extension
- WebNowPlaying Custom Adapter enabled on port `1234`
- OpenWeather API key for weather
- Internet access for LRCLIB lyrics, OpenWeather, fonts, and album-art proxying

## Quick Start

```powershell
pip install -r requirements.txt
Copy-Item config.env.example config.env
python server.py
```

Open [http://localhost:5000/](http://localhost:5000/).

In the WebNowPlaying extension popup, enable `Custom Adapter` and set the port to `1234`.

## API

- `GET /health`
- `GET /nowplaying`
- `POST /control`
- `GET /lyrics?title=...&artist=...&duration_ms=...`
- `GET /weather`
- `GET /cover?url=...`

## GitHub Pages

This repo includes `.github/workflows/pages.yml`. After pushing to `main`, enable Pages in the repository settings with GitHub Actions as the source. The workflow publishes only the `frontend/` folder.

## Visualizer Limitation

Browsers cannot directly capture system audio from Spotify, YouTube Music, or other streaming apps. The default visualizer is a UI-driven dummy animation. True frequency data only works from audio the browser is allowed to capture, such as microphone/live input or audio loaded by the page itself.
