import os
import re
import threading
import time
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import url2pathname

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file, send_from_directory

try:
    from pywnp import WNPRedux
except ImportError:
    WNPRedux = None


ROOT = Path(__file__).resolve().parent          # backend/
PROJECT_ROOT = ROOT.parent                        # project root
FRONTEND_DIR = PROJECT_ROOT / "frontend"
ASSETS_DIR = FRONTEND_DIR / "assets"

load_dotenv(PROJECT_ROOT / "config.env", override=True)
weather_key = os.getenv("OPENWEATHER_API_KEY", "").strip()
key_preview = weather_key[:4] if weather_key else "None"
print(f"Weather Key Loaded (first 4 chars): {key_preview}", flush=True)

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")

WNP_ADAPTER_PORT = int(os.getenv("WNP_WEBSOCKET_PORT", "1234"))
POLL_INTERVAL = float(os.getenv("WNP_POLL_INTERVAL", "1"))
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "8"))
ADAPTER_STARTED = False
ADAPTER_ERROR = ""

DEFAULT_NOW_PLAYING = {
    "available": False,
    "title": "",
    "artist": "",
    "album": "",
    "cover_url": "",
    "progress_ms": 0,
    "duration_ms": 0,
    "is_playing": False,
    "source": "",
    "can_play_pause": False,
    "can_skip_previous": False,
    "can_skip_next": False,
    "updated_at": None,
    "message": "Waiting for WebNowPlaying custom adapter...",
}

state_lock = threading.Lock()
now_playing = DEFAULT_NOW_PLAYING.copy()


def parse_number(value):
    if value is None:
        return 0
    text = str(value).strip()
    if not text:
        return 0
    if ":" in text:
        parts = [int(part) for part in re.findall(r"\d+", text)]
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return 0
    return float(match.group(0))


def seconds_to_ms(value):
    number = parse_number(value)
    if number <= 0:
        return 0
    # WNP/Rainmeter reports duration and position in seconds.
    return int(number * 1000)


def parse_bool(value):
    text = str(value).strip().lower()
    return text in {"1", "true", "yes", "playing", "supported"}


def parse_playing(value):
    text = str(value).strip().lower()
    if text in {"1", "playing", "play", "true"}:
        return True
    if text in {"0", "2", "paused", "stopped", "pause", "stop"}:
        return False
    return False


def get_duration_ms(duration_val, source):
    if duration_val <= 0:
        return 0
    player = str(source).lower() if source else ""
    is_desktop = any(dp in player for dp in ["vlc", "musicbee", "foobar", "wmp", "itunes", "winamp"])
    if is_desktop:
        return int(duration_val * 1000)
    
    # If the player is Spotify, Spotify Web reports duration in milliseconds (e.g. 173394)
    # while Spotify Desktop reports duration in seconds (e.g. 173).
    # If it is Spotify and the duration is > 5000, it is milliseconds.
    if "spotify" in player:
        if duration_val > 5000:
            return int(duration_val)
        return int(duration_val * 1000)
    
    # For generic web players (YouTube, SoundCloud, etc.):
    # Usually in seconds, but check if the value is ridiculously large (> 100000)
    if duration_val > 100000:
        return int(duration_val)
    return int(duration_val * 1000)


def get_progress_ms(position_val, duration_ms, source):
    if position_val <= 0:
        return 0
    player = str(source).lower() if source else ""
    
    # Spotify Web/Desktop always report position in seconds.
    if "spotify" in player:
        return int(position_val * 1000)
        
    is_desktop = any(dp in player for dp in ["vlc", "musicbee", "foobar", "wmp", "itunes", "winamp"])
    if is_desktop:
        return int(position_val * 1000)
        
    # Generic web player:
    # If duration_ms is known, and position is in milliseconds, position will be larger than duration in seconds.
    if duration_ms > 0 and position_val > (duration_ms / 1000.0) * 1.5:
        return int(position_val)
    if position_val > 10000:
        return int(position_val)
    return int(position_val * 1000)



def clean_track_title(title):
    if not title:
        return ""
    # Strip common parenthesized/bracketed feature and version tags
    # (feat. ...), (ft. ...), (featuring ...), (with ...), (remastered ...), (live ...), (acoustic ...), (single ...)
    cleaned = re.sub(
        r'\s*[\(\[][^\]\)]*(?:feat\.?|ft\.?|featuring|with|remaster|live|acoustic|edit|version|deluxe|mono|stereo|anniversary|edition|mix|single)[^\]\)]*[\)\]]',
        '',
        title,
        flags=re.IGNORECASE
    )
    # Strip common dash-delimited feature and version tags
    # - feat. ..., - ft. ..., - remastered ..., - live ..., - acoustic ..., - radio edit, - single version, - original mix
    cleaned = re.sub(
        r'\s*-\s*.*(?:feat\.?|ft\.?|featuring|with|remaster|live|acoustic|edit|version|deluxe|mono|stereo|anniversary|edition|mix|single).*$',
        '',
        cleaned,
        flags=re.IGNORECASE
    )
    # Clean up trailing/leading whitespace and any residual empty parentheses or double spaces
    cleaned = re.sub(r'\s*\(\s*\)', '', cleaned)
    cleaned = re.sub(r'\s*\[\s*\]', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned if cleaned else title


def wnp_logger(level, message):
    print(f"[WebNowPlaying:{level}] {message}", flush=True)


def start_adapter():
    global ADAPTER_STARTED, ADAPTER_ERROR
    if WNPRedux is None:
        ADAPTER_ERROR = "pywnp is not installed. Run pip install -r requirements.txt."
        return

    try:
        if hasattr(WNPRedux, "start"):
            WNPRedux.start(WNP_ADAPTER_PORT, "1.0.0", wnp_logger)
        else:
            WNPRedux.Initialize(WNP_ADAPTER_PORT, "1.0.0", wnp_logger)
        ADAPTER_STARTED = True
        ADAPTER_ERROR = ""
    except Exception as exc:
        ADAPTER_ERROR = f"Could not start WebNowPlaying adapter on port {WNP_ADAPTER_PORT}: {exc}"
        ADAPTER_STARTED = False


def get_media_info_value(media_info, *names, default=""):
    for name in names:
        if hasattr(media_info, name):
            value = getattr(media_info, name)
            if value is not None:
                return value
    return default


def poll_now_playing_once():
    if WNPRedux is None:
        next_state = DEFAULT_NOW_PLAYING.copy()
        next_state["message"] = ADAPTER_ERROR
        return next_state

    media_info = getattr(WNPRedux, "media_info", None) or getattr(WNPRedux, "mediaInfo", None)
    if media_info is None:
        next_state = DEFAULT_NOW_PLAYING.copy()
        next_state["message"] = "WebNowPlaying adapter started, but no media state is available yet."
        return next_state

    title = get_media_info_value(media_info, "title", "Title")
    artist = get_media_info_value(media_info, "artist", "Artist")
    album = get_media_info_value(media_info, "album", "Album")
    source = get_media_info_value(media_info, "player_name", "Player")
    cover = get_media_info_value(media_info, "cover_url", "CoverUrl")

    # --- Compute duration_ms ---
    duration_seconds_raw = get_media_info_value(media_info, "duration_seconds", "DurationSeconds", default=0)
    duration_val = parse_number(duration_seconds_raw)
    duration_ms = get_duration_ms(duration_val, source)

    # --- Compute progress_ms ---
    position_seconds_raw = get_media_info_value(media_info, "position_seconds", "PositionSeconds", default=0)
    position_val = parse_number(position_seconds_raw)
    progress_ms = get_progress_ms(position_val, duration_ms, source)

    state = get_media_info_value(media_info, "state", "State", default="STOPPED")
    controls = getattr(media_info, "controls", None)

    has_track = bool(title or artist or album)
    if not has_track:
        next_state = DEFAULT_NOW_PLAYING.copy()
        if ADAPTER_ERROR:
            next_state["message"] = ADAPTER_ERROR
        elif ADAPTER_STARTED:
            clients = getattr(WNPRedux, "clients", 0)
            next_state["message"] = (
                f"Adapter running on port {WNP_ADAPTER_PORT}. "
                f"Enable Custom Adapter in WebNowPlaying and enter port {WNP_ADAPTER_PORT}."
                if clients == 0
                else "Connected. Waiting for music metadata..."
            )
        return next_state

    return {
        "available": True,
        "title": title or "Unknown Title",
        "artist": artist or "Unknown Artist",
        "album": album,
        "cover_url": cover,
        "progress_ms": progress_ms,
        "duration_ms": duration_ms,
        "is_playing": parse_playing(state),
        "source": source or "WebNowPlaying",
        "can_play_pause": bool(getattr(controls, "supports_play_pause", False)) or True,
        "can_skip_previous": bool(getattr(controls, "supports_skip_previous", False)) or hasattr(WNPRedux, "mediaEvents"),
        "can_skip_next": bool(getattr(controls, "supports_skip_next", False)) or hasattr(WNPRedux, "mediaEvents"),
        "updated_at": int(time.time()),
        "message": "",
    }


def polling_loop():
    global now_playing
    while True:
        try:
            next_state = poll_now_playing_once()
        except Exception as exc:
            next_state = DEFAULT_NOW_PLAYING.copy()
            next_state["message"] = f"WebNowPlaying unavailable: {exc}"
        with state_lock:
            now_playing = next_state
        time.sleep(POLL_INTERVAL)


def parse_lrc(synced_lyrics):
    lines = []
    if not synced_lyrics:
        return lines
    pattern = re.compile(r"\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)")
    for raw_line in synced_lyrics.splitlines():
        match = pattern.match(raw_line.strip())
        if not match:
            continue
        minutes = int(match.group(1))
        seconds = int(match.group(2))
        fraction = match.group(3) or "0"
        ms = int(fraction.ljust(3, "0")[:3])
        text = match.group(4).strip()
        lines.append({"time_ms": (minutes * 60 + seconds) * 1000 + ms, "text": text})
    return lines


def plain_lyrics_to_lines(plain_lyrics):
    if not plain_lyrics:
        return []
    return [
        {"time_ms": None, "text": line.strip()}
        for line in plain_lyrics.splitlines()
        if line.strip()
    ]


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/nowplaying")
def get_now_playing():
    with state_lock:
        return jsonify(now_playing.copy())


@app.route("/control", methods=["POST"])
def control():
    data = request.get_json(silent=True) or {}
    action = data.get("action", "")
    if WNPRedux is None:
        return jsonify({"ok": False, "error": ADAPTER_ERROR}), 503

    valid_actions = {"previous", "play_pause", "next", "seek", "shuffle"}
    if action not in valid_actions:
        return jsonify({"ok": False, "error": "Invalid action"}), 400

    try:
        if action == "seek":
            position_ms = data.get("position_ms")
            if position_ms is None:
                return jsonify({"ok": False, "error": "Missing position_ms"}), 400
            seconds = int(position_ms / 1000)
            if hasattr(WNPRedux, "mediaEvents"):
                WNPRedux.mediaEvents.SetPositionSeconds(seconds)
            else:
                media_info = getattr(WNPRedux, "media_info", None)
                controls = getattr(media_info, "controls", None)
                if controls is None:
                    return jsonify({"ok": False, "error": "No active player controls"}), 503
                if hasattr(controls, "try_set_position_seconds"):
                    controls.try_set_position_seconds(seconds)
                elif hasattr(controls, "set_position_seconds"):
                    controls.set_position_seconds(seconds)
        else:
            if hasattr(WNPRedux, "mediaEvents"):
                legacy_commands = {
                    "previous": "Previous",
                    "play_pause": "TogglePlaying",
                    "next": "Next",
                    "shuffle": "ToggleShuffle",
                }
                getattr(WNPRedux.mediaEvents, legacy_commands[action])()
            else:
                media_info = getattr(WNPRedux, "media_info", None)
                controls = getattr(media_info, "controls", None)
                if controls is None:
                    return jsonify({"ok": False, "error": "No active player controls"}), 503
                commands = {
                    "previous": "try_skip_previous",
                    "play_pause": "try_toggle_play_pause",
                    "next": "try_skip_next",
                    "shuffle": "try_toggle_shuffle",
                }
                getattr(controls, commands[action])()
    except Exception as exc:
        return jsonify({"ok": False, "action": action, "error": str(exc)}), 503

    return jsonify({"ok": True, "action": action})


@app.route("/lyrics")
def lyrics():
    title = request.args.get("title", "").strip()
    artist = request.args.get("artist", "").strip()
    duration_ms = request.args.get("duration_ms", "").strip()

    if not title or not artist:
        return jsonify({"synced": False, "lines": [], "message": "Missing title or artist"}), 400

    cleaned_title = clean_track_title(title)
    has_cleaned_title = (cleaned_title.lower() != title.lower())

    params = {"track_name": title, "artist_name": artist}
    if duration_ms and duration_ms.isdigit():
        secs = int(duration_ms) // 1000
        if secs > 0:
            params["duration"] = str(secs)

    data = None
    try:
        # Split artist string using regex to extract individual collaborators/artists
        artists_split = [a.strip() for a in re.split(r',| and | & |;|feat\.?|ft\.?', artist, flags=re.IGNORECASE) if a.strip()]

        # 1. Try strict get for the original combined artist name and original title
        try:
            response = requests.get("https://lrclib.net/api/get", params=params, timeout=REQUEST_TIMEOUT)
            if response.status_code == 200:
                data = response.json()
        except requests.RequestException:
            pass

        # 2. Try strict get for original artist and cleaned title (if different)
        if not data and has_cleaned_title:
            params_cleaned = {"track_name": cleaned_title, "artist_name": artist}
            if duration_ms and duration_ms.isdigit():
                secs = int(duration_ms) // 1000
                if secs > 0:
                    params_cleaned["duration"] = str(secs)
            try:
                response = requests.get("https://lrclib.net/api/get", params=params_cleaned, timeout=REQUEST_TIMEOUT)
                if response.status_code == 200:
                    data = response.json()
            except requests.RequestException:
                pass

        # 3. Try strict get for individual artists and original title (up to 3)
        if not data:
            for single_artist in artists_split[:3]:
                if single_artist.lower() == artist.lower():
                    continue
                params_fallback = {"track_name": title, "artist_name": single_artist}
                if duration_ms and duration_ms.isdigit():
                    secs = int(duration_ms) // 1000
                    if secs > 0:
                        params_fallback["duration"] = str(secs)
                try:
                    response = requests.get("https://lrclib.net/api/get", params=params_fallback, timeout=REQUEST_TIMEOUT)
                    if response.status_code == 200:
                        data = response.json()
                        break
                except requests.RequestException:
                    pass

        # 4. Try strict get for individual artists and cleaned title (up to 3, if different)
        if not data and has_cleaned_title:
            for single_artist in artists_split[:3]:
                params_fallback = {"track_name": cleaned_title, "artist_name": single_artist}
                if duration_ms and duration_ms.isdigit():
                    secs = int(duration_ms) // 1000
                    if secs > 0:
                        params_fallback["duration"] = str(secs)
                try:
                    response = requests.get("https://lrclib.net/api/get", params=params_fallback, timeout=REQUEST_TIMEOUT)
                    if response.status_code == 200:
                        data = response.json()
                        break
                except requests.RequestException:
                    pass

        # Helper function for matching
        def normalize_alphanumeric(s):
            return re.sub(r'[^a-zA-Z0-9]', '', s).lower()

        # 5. Try searching with original track title + cleaned track title and matching results
        if not data:
            # Search queries to try:
            # A: "title artist"
            # B: "title"
            # C: "cleaned_title artist"
            # D: "cleaned_title"
            queries = []
            if artists_split:
                queries.append(f"{title} {artists_split[0]}")
            queries.append(title)
            if has_cleaned_title:
                if artists_split:
                    queries.append(f"{cleaned_title} {artists_split[0]}")
                queries.append(cleaned_title)
            
            target_duration = int(duration_ms) // 1000 if (duration_ms and duration_ms.isdigit()) else None

            for query in queries:
                try:
                    response = requests.get("https://lrclib.net/api/search", params={"q": query}, timeout=REQUEST_TIMEOUT)
                    if response.status_code == 200:
                        results = response.json()
                        if results:
                            # Find the best candidate matching split artists
                            normalized_artists = [normalize_alphanumeric(a) for a in artists_split if normalize_alphanumeric(a)]
                            best_candidate = None
                            best_duration_diff = float('inf')

                            for result in results:
                                res_artist = normalize_alphanumeric(result.get("artistName", ""))
                                # Check if the result's artist matches any of our split artists
                                matches = False
                                for norm_art in normalized_artists:
                                    if norm_art in res_artist or res_artist in norm_art:
                                        matches = True
                                        break
                                
                                if matches or not normalized_artists:
                                    # Choose the candidate with closest duration if target_duration is available
                                    if target_duration is not None and result.get("duration") is not None:
                                        diff = abs(int(result["duration"]) - target_duration)
                                        if diff < best_duration_diff:
                                            best_duration_diff = diff
                                            best_candidate = result
                                    else:
                                        # Just pick the first matching candidate if no duration target
                                        best_candidate = result
                                        break
                            
                            if best_candidate:
                                data = best_candidate
                                break
                except requests.RequestException:
                    pass

            # Ultimate fallback: just pick the first search result with cleaned or original title
            if not data:
                search_titles = [cleaned_title, title] if has_cleaned_title else [title]
                for search_title in search_titles:
                    try:
                        response = requests.get("https://lrclib.net/api/search", params={"q": search_title}, timeout=REQUEST_TIMEOUT)
                        if response.status_code == 200:
                            results = response.json()
                            if results:
                                data = results[0]
                                break
                    except requests.RequestException:
                        pass

        if not data:
            return jsonify({"synced": False, "lines": [], "message": "No lyrics found"})

    except requests.RequestException as exc:
        return jsonify({"synced": False, "lines": [], "message": f"Lyric lookup failed: {exc}"}), 502

    synced_lines = parse_lrc(data.get("syncedLyrics"))
    if synced_lines:
        return jsonify({"synced": True, "lines": synced_lines})

    return jsonify({"synced": False, "lines": plain_lyrics_to_lines(data.get("plainLyrics"))})


weather_cache = {
    "data": None,
    "timestamp": 0,
    "error_data": None,
    "error_timestamp": 0
}
weather_cache_lock = threading.Lock()


@app.route("/weather")
def weather():
    global weather_cache
    api_key = os.getenv("OPENWEATHER_API_KEY", "").strip()
    city = os.getenv("OPENWEATHER_CITY", "Ambikapur").strip()
    units = os.getenv("OPENWEATHER_UNITS", "metric").strip()
    unit_label = "C" if units == "metric" else "F" if units == "imperial" else "K"

    if not api_key or api_key == "your_key_here":
        return jsonify({"error": "key not set"})

    current_time = time.time()
    with weather_cache_lock:
        if weather_cache["data"] and (current_time - weather_cache["timestamp"] < 600):
            return jsonify(weather_cache["data"])
        if weather_cache["error_data"] and (current_time - weather_cache["error_timestamp"] < 300):
            return jsonify(weather_cache["error_data"]), 502

    try:
        response = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": city, "appid": api_key, "units": units},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        err_res = {
            "available": False,
            "temp": None,
            "unit": unit_label,
            "condition": f"Weather unavailable: {exc}",
            "icon": "",
            "city": city,
        }
        with weather_cache_lock:
            weather_cache["error_data"] = err_res
            weather_cache["error_timestamp"] = current_time
            if weather_cache["data"]:
                return jsonify(weather_cache["data"])
        return jsonify(err_res), 502

    weather_data = (data.get("weather") or [{}])[0]
    result = {
        "available": True,
        "temp": round(data.get("main", {}).get("temp", 0)),
        "unit": unit_label,
        "condition": weather_data.get("main") or weather_data.get("description") or "",
        "icon": weather_data.get("icon", ""),
        "city": data.get("name", city),
    }

    with weather_cache_lock:
        weather_cache["data"] = result
        weather_cache["timestamp"] = current_time
        weather_cache["error_data"] = None
        weather_cache["error_timestamp"] = 0

    return jsonify(result)



@app.route("/cover")
def cover():
    raw_url = request.args.get("url", "")
    if not raw_url:
        return send_file(ASSETS_DIR / "fallback-cover.png", mimetype="image/png")

    cover_url = unquote(raw_url)
    if cover_url.startswith(("http://", "https://")):
        try:
            response = requests.get(cover_url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
        except requests.RequestException:
            return send_file(ASSETS_DIR / "fallback-cover.png", mimetype="image/png")

        content_type = response.headers.get("content-type", "image/jpeg")
        return response.content, 200, {"Content-Type": content_type, "Cache-Control": "public, max-age=300"}

    if cover_url.startswith("file://"):
        try:
            p = urlparse(cover_url)
            local_path = Path(url2pathname(p.path))
        except Exception:
            return send_file(ASSETS_DIR / "fallback-cover.png", mimetype="image/png")
    else:
        local_path = Path(cover_url)

    if local_path.exists() and local_path.is_file():
        return send_file(local_path)
    return send_file(ASSETS_DIR / "fallback-cover.png", mimetype="image/png")


start_adapter()
threading.Thread(target=polling_loop, daemon=True).start()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=False)
