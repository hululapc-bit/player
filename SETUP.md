# WebRainmeter Setup

This guide is for running the real local app. For the portfolio-only version, open `frontend/index.html?demo=1` or use the GitHub Pages deployment.

## 1. Install WebNowPlaying Redux

Install the browser extension from the official WebNowPlaying documentation:

https://wnp.keifufu.dev/

You do not need the old CLI adapter for this app. WebRainmeter listens as a Custom Adapter.

## 2. Install Python Dependencies

From this project folder:

```powershell
pip install -r requirements.txt
```

## 3. Create Local Config

```powershell
Copy-Item config.env.example config.env
```

Edit `config.env`:

```env
OPENWEATHER_API_KEY=your_key_here
OPENWEATHER_CITY=Ambikapur
OPENWEATHER_UNITS=metric
WNP_WEBSOCKET_PORT=1234
WNP_POLL_INTERVAL=1
PORT=5000
```

`config.env` is intentionally ignored by git.

## 4. Run The App

```powershell
python server.py
```

Open:

http://localhost:5000/

## 5. Connect WebNowPlaying

Open the WebNowPlaying extension popup while `python server.py` is running:

1. Enable `Custom Adapter`
2. Set the port to `1234`
3. Play music in a supported browser source
4. If nothing appears, untick and retick `Custom Adapter`

Check the raw feed at:

http://localhost:5000/nowplaying

## 6. Static Portfolio Demo

Use this when you want to show the UI without Python or WebNowPlaying:

```text
frontend/index.html?demo=1
```

The GitHub Pages workflow publishes `frontend/` and demo mode turns on automatically for `*.github.io`.

## Troubleshooting

- `Waiting for player`: confirm the Flask server is running, Custom Adapter is checked, and the port is `1234`.
- Weather offline: confirm `OPENWEATHER_API_KEY` and `OPENWEATHER_CITY` in `config.env`.
- No lyrics: LRCLIB may not have synced lyrics for the current track.
- Controls unavailable: the current source may not expose that control through WebNowPlaying.
- Visualizer is not real system audio: this is expected for streaming sources in v1.
