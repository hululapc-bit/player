/* ============================================================
   WebRainmeter — app.js
   Client logic for the PRD v3 dashboard
   ============================================================ */

// ─── STATE ────────────────────────────────────────────────────
const state = {
  lastTrackKey: "",
  lyrics: [],
  syncedLyrics: false,
  nowPlaying: null,
  localProgressStartedAt: 0,
  localProgressBase: 0,
  pageLoadTime: Date.now(),
  accentRgb: { r: 255, g: 183, b: 77 },
  perfSettings: {
    fps: 60,
    glow: "on",
    bg: "hq",
    crt: "on"
  },
  clockShowSeconds: false,
  history: [],
  demoMode: false
};

function shouldEnableDemoMode() {
  const params = new URLSearchParams(window.location.search);
  const demoParam = params.get("demo");
  if (demoParam === "0" || demoParam === "false") return false;
  if (params.has("demo")) return true;
  return window.location.protocol === "file:" || window.location.hostname.endsWith("github.io");
}

// ─── DOM REFS ────────────────────────────────────────────────
const PLAY_SVG = `<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"></polygon></svg>`;
const PAUSE_SVG = `<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

const els = {
  clock:            document.getElementById("clock"),
  weatherIcon:      document.getElementById("weather-icon"),
  weatherTemp:      document.getElementById("weather-temp"),
  weatherCondition: document.getElementById("weather-condition"),
  sourcePip:        document.getElementById("source-pip"),
  topbarSource:     document.getElementById("topbar-source-text"),
  bgGlow:           document.getElementById("bg-glow"),
  player:           document.getElementById("player"),
  albumArt:         document.getElementById("album-art"),
  backgroundArt:    document.getElementById("background-art"),
  idleScreen:       document.getElementById("idle-screen"),
  cornerPip:        document.getElementById("corner-pip"),
  title:            document.getElementById("title"),
  artist:           document.getElementById("artist"),
  album:            document.getElementById("album"),
  elapsed:          document.getElementById("elapsed"),
  duration:         document.getElementById("duration"),
  progressFill:     document.getElementById("progress-fill"),
  progress:         document.querySelector(".progress"),
  lyrics:           document.getElementById("lyrics"),
  copyLyrics:       document.getElementById("copy-lyrics"),
  shuffle:          document.getElementById("shuffle"),
  previous:         document.getElementById("previous"),
  playPause:        document.getElementById("play-pause"),
  next:             document.getElementById("next"),
  queue:            document.getElementById("queue"),
  mood:             document.getElementById("mood"),
  sourceVal:        document.getElementById("source-val"),
  formatVal:        document.getElementById("format-val"),
  uptimeVal:        document.getElementById("uptime-val"),
  visualizer:       document.getElementById("visualizer"),
  historyList:      document.getElementById("history-list")
};

const fallbackCover = "assets/fallback-cover.png";
const VIZ_BAR_COUNT = 40;

// ─── MOCK TRACKS (F14 Demo Mode) ────────────────────────────────
const MOCK_TRACKS = [
  {
    title: "I Wanna Be Yours",
    artist: "Arctic Monkeys",
    album: "AM",
    duration_ms: 184003,
    cover_url: "https://i.scdn.co/image/ab67616d0000b2734ae1c4c5c45aabe565499163",
    source: "Spotify",
    lines: [
      { time_ms: 17870, text: "I wanna be your vacuum cleaner" },
      { time_ms: 22050, text: "Breathin' in your dust" },
      { time_ms: 25050, text: "I wanna be your Ford Cortina" },
      { time_ms: 28770, text: "I will never rust" },
      { time_ms: 32100, text: "If you like your coffee hot" },
      { time_ms: 36020, text: "Let me be your coffee pot" },
      { time_ms: 39220, text: "You call the shots, babe" },
      { time_ms: 42290, text: "I just wanna be yours" },
      { time_ms: 46220, text: "Secrets I have held in my heart" },
      { time_ms: 49820, text: "Are harder to hide than I thought" },
      { time_ms: 53380, text: "Maybe I just wanna be yours" },
      { time_ms: 56580, text: "I wanna be yours, I wanna be yours" },
      { time_ms: 62340, text: "Wanna be yours" }
    ]
  },
  {
    title: "death bed (coffee for your head)",
    artist: "Powfu, beabadoobee",
    album: "death bed",
    duration_ms: 173380,
    cover_url: "https://i.scdn.co/image/ab67616d0000b273bf01fd0986a195d485922167",
    source: "Spotify",
    lines: [
      { time_ms: 20, text: "Don't stay awake for too long, don't go to bed" },
      { time_ms: 5430, text: "I'll make a cup of coffee for your head" },
      { time_ms: 8880, text: "It'll get you up and going out of bed" },
      { time_ms: 11870, text: "Yeah, I don't wanna fall asleep, I don't wanna pass away" },
      { time_ms: 16050, text: "I been thinking of our future, 'cause I'll never see those days" },
      { time_ms: 19590, text: "I don't know why this has happened, but I probably deserve it" },
      { time_ms: 23030, text: "I tried to do my best, but you know that I'm not perfect" },
      { time_ms: 26370, text: "I been praying for forgiveness, you've been praying for my health" }
    ]
  },
  {
    title: "Me Gustas Tu",
    artist: "Manu Chao",
    album: "Próxima Estación: Esperanza",
    duration_ms: 240010,
    cover_url: "https://i.scdn.co/image/ab67616d0000b2731dcba4a728ca0b17cbd204a5",
    source: "Spotify",
    lines: [
      { time_ms: 90, text: "¿Qué horas son, mi corazón?" },
      { time_ms: 4070, text: "Te lo dije bien clarito" },
      { time_ms: 6120, text: "Permanece a la escucha" },
      { time_ms: 10820, text: "Permanece a la escucha" },
      { time_ms: 12970, text: "Doce de la noche en La Habana, Cuba" },
      { time_ms: 17160, text: "Once de la noche en San Salvador, El Salvador" },
      { time_ms: 21040, text: "Once de la noche en Managua, Nicaragua" },
      { time_ms: 23860, text: "Me gustan los aviones, me gustas tú" },
      { time_ms: 26410, text: "Me gusta viajar, me gustas tú" },
      { time_ms: 29060, text: "Me gusta la mañana, me gustas tú" },
      { time_ms: 31880, text: "Me gusta el viento, me gustas tú" },
      { time_ms: 34660, text: "Me gusta soñar, me gustas tú" }
    ]
  }
];

// ─── DEMO MODE HANDLERS ─────────────────────────────────────────
let currentMockIndex = 0;
let mockPlayInterval = null;

function enableDemoMode() {
  state.demoMode = true;
  document.body.classList.add("demo-mode");
  console.log("[WebRainmeter] Running in Static Demo Mode (Offline)");
  
  // Render demo source indicator in topbar
  els.topbarSource.textContent = "DEMO MODE";
  if (els.sourcePip) {
    els.sourcePip.style.backgroundColor = "var(--accent)";
  }
  
  // Load initial mock track
  loadMockTrack(0);
  
  // Start mock ticking progress loop
  startMockTicker();
  
  // Render static weather
  els.weatherTemp.textContent = "24°C";
  els.weatherCondition.textContent = "Partly Cloudy · Tokyo";
  els.weatherIcon.src = "https://openweathermap.org/img/wn/03d@2x.png";
}

function loadMockTrack(index) {
  currentMockIndex = index;
  const track = MOCK_TRACKS[index];
  
  state.nowPlaying = {
    available: true,
    title: track.title,
    artist: track.artist,
    album: track.album,
    cover_url: track.cover_url,
    progress_ms: 0,
    duration_ms: track.duration_ms,
    is_playing: true,
    source: track.source,
    can_play_pause: true,
    can_skip_previous: true,
    can_skip_next: true,
    updated_at: Date.now()
  };
  
  state.lastTrackKey = trackKey(state.nowPlaying);
  
  els.player.classList.remove("idle");
  els.player.classList.add("playing");
  els.title.textContent = track.title;
  els.artist.textContent = track.artist;
  els.album.textContent = track.album;
  els.sourceVal.textContent = track.source;
  els.topbarSource.textContent = "DEMO MODE";
  els.formatVal.textContent = getFormat(track.source);
  els.mood.textContent = getMood(track.title, track.artist);
  els.previous.disabled = false;
  els.playPause.disabled = false;
  els.next.disabled = false;
  els.shuffle.disabled = false;
  els.playPause.innerHTML = PAUSE_SVG;
  
  state.localProgressBase = 0;
  state.localProgressStartedAt = Date.now();
  
  // Load mock lyrics
  state.lyrics = track.lines;
  state.syncedLyrics = true;
  renderLyrics();
  if (els.copyLyrics) els.copyLyrics.classList.remove("hidden");
  
  // Crossfade art
  crossfadeArt(track.cover_url);
  extractAccent(track.cover_url);
  
  addToHistory(state.nowPlaying);
  updateProgress(state.nowPlaying);
}

function startMockTicker() {
  if (mockPlayInterval) clearInterval(mockPlayInterval);
  mockPlayInterval = setInterval(() => {
    if (!state.nowPlaying || !state.nowPlaying.is_playing) return;
    
    // Increment mock progress by 1000ms
    state.nowPlaying.progress_ms += 1000;
    if (state.nowPlaying.progress_ms >= state.nowPlaying.duration_ms) {
      // Auto advance to next song
      const nextIndex = (currentMockIndex + 1) % MOCK_TRACKS.length;
      loadMockTrack(nextIndex);
    } else {
      updateProgress(state.nowPlaying);
    }
  }, 1000);
}

function handleMockControl(action) {
  if (!state.nowPlaying) return;
  if (action === "play_pause") {
    state.nowPlaying.is_playing = !state.nowPlaying.is_playing;
    els.playPause.innerHTML = state.nowPlaying.is_playing ? PAUSE_SVG : PLAY_SVG;
    els.player.classList.toggle("playing", state.nowPlaying.is_playing);
    if (state.nowPlaying.is_playing) {
      state.localProgressBase = state.nowPlaying.progress_ms;
      state.localProgressStartedAt = Date.now();
    } else {
      state.localProgressStartedAt = 0;
    }
  } else if (action === "next") {
    const nextIndex = (currentMockIndex + 1) % MOCK_TRACKS.length;
    loadMockTrack(nextIndex);
  } else if (action === "previous") {
    // If progress is > 3s, restart the current track. Otherwise, go to previous track.
    if (state.nowPlaying.progress_ms > 3000) {
      state.nowPlaying.progress_ms = 0;
      state.localProgressBase = 0;
      state.localProgressStartedAt = Date.now();
      updateProgress(state.nowPlaying);
    } else {
      const prevIndex = (currentMockIndex - 1 + MOCK_TRACKS.length) % MOCK_TRACKS.length;
      loadMockTrack(prevIndex);
    }
  } else if (action === "shuffle") {
    let randIndex = currentMockIndex;
    if (MOCK_TRACKS.length > 1) {
      while (randIndex === currentMockIndex) {
        randIndex = Math.floor(Math.random() * MOCK_TRACKS.length);
      }
    }
    loadMockTrack(randIndex);
  }
}

function handleMockSeek(positionMs) {
  if (!state.nowPlaying) return;
  state.nowPlaying.progress_ms = positionMs;
  state.localProgressBase = positionMs;
  state.localProgressStartedAt = state.nowPlaying.is_playing ? Date.now() : 0;
  updateProgress(state.nowPlaying);
}

// ─── MOOD MAP ────────────────────────────────────────────────
const MOODS = [
  "MELANCHOLIC", "CYBERPUNK", "DREAMY", "CHILL",
  "LO-FI", "NOSTALGIC", "EUPHORIC", "ETHEREAL",
  "ENERGETIC", "INTROSPECTIVE", "DARK", "SERENE",
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getMood(title, artist) {
  const key = `${(title || "").toLowerCase()}::${(artist || "").toLowerCase()}`;
  return MOODS[hashString(key) % MOODS.length];
}

// ─── FORMAT MAP ──────────────────────────────────────────────
function getFormat(source) {
  const s = (source || "").toLowerCase();
  if (s.includes("spotify"))       return "STREAM 320k";
  if (s.includes("youtube"))       return "STREAM 256k";
  if (s.includes("apple"))         return "STREAM 256k";
  if (s.includes("tidal"))         return "FLAC 1411k";
  if (s.includes("soundcloud"))    return "STREAM 128k";
  if (s.includes("amazon"))        return "STREAM 320k";
  if (s.includes("deezer"))        return "STREAM 320k";
  if (s.includes("foobar"))        return "LOCAL FLAC";
  if (s.includes("musicbee"))      return "LOCAL FLAC";
  if (s.includes("vlc"))           return "LOCAL FILE";
  return "STREAM 256k";
}

// ─── HELPERS ─────────────────────────────────────────────────
function formatTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function trackKey(track) {
  return [track.title, track.artist, track.album].filter(Boolean).join("::");
}

function coverSource(url) {
  if (!url) return fallbackCover;
  if (state.demoMode) return url;
  return `/cover?url=${encodeURIComponent(url)}`;
}

// ─── CLOCK ───────────────────────────────────────────────────
function loadClockSettings() {
  try {
    state.clockShowSeconds = localStorage.getItem("webrainmeter_clock_seconds") === "true";
  } catch (e) {
    state.clockShowSeconds = false;
  }
}

function updateClock() {
  const options = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  if (state.clockShowSeconds) {
    options.second = "2-digit";
  }
  const timeStr = new Intl.DateTimeFormat([], options).format(new Date());
  els.clock.textContent = timeStr;
  // POLISH #8: Chromatic Aberration data-time attribute
  els.clock.setAttribute("data-time", timeStr);
}

// ─── UPTIME ──────────────────────────────────────────────────
function updateUptime() {
  els.uptimeVal.textContent = formatUptime(Date.now() - state.pageLoadTime);
}

// ─── FETCH HELPER ────────────────────────────────────────────
async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

// ─── CANVAS VISUALIZER SETUP ─────────────────────────────────
const canvas = document.getElementById("visualizer-canvas");
const micBtn = document.getElementById("visualizer-mic");
let ctx = null;
if (canvas) ctx = canvas.getContext("2d");

let audioCtx = null;
let analyser = null;
let micStream = null;
let micSource = null;
let liveSyncActive = false;
let dataArray = null;
let bufferLength = 0;

let lastDrawTime = 0;
let lastPauseDrawTime = 0;

let phase = 0;
let amplitudeScale = 0;
let lyricAmplitudeScale = 1.0;
let lastActiveLyricIndex = -1;

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  if (ctx) ctx.scale(dpr, dpr);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  updateLyricsPadding();
});

function drawVisualizer(timestamp) {
  requestAnimationFrame(drawVisualizer);
  if (!canvas || !ctx) return;

  const currentTimestamp = timestamp || performance.now();
  const fps = state.perfSettings?.fps !== undefined ? Number(state.perfSettings.fps) : 60;
  
  if (fps === 0) {
    ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    return;
  }

  // Throttle FPS if capped
  if (fps < 60) {
    const interval = 1000 / fps;
    const elapsed = currentTimestamp - lastDrawTime;
    if (elapsed < interval) {
      return;
    }
    lastDrawTime = currentTimestamp - (elapsed % interval);
  } else {
    lastDrawTime = currentTimestamp;
  }

  const isPlaying = state.nowPlaying?.available && state.nowPlaying.is_playing;
  const isAvailable = state.nowPlaying?.available;

  // Power Saving: Skip rendering if player is offline/idle
  if (!isAvailable && !liveSyncActive) {
    ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    return;
  }

  // Power Saving: Throttle paused state rendering to 10 FPS
  if (!isPlaying && !liveSyncActive && fps > 10) {
    const pauseInterval = 100;
    const elapsedSinceLastDraw = currentTimestamp - lastPauseDrawTime;
    if (elapsedSinceLastDraw < pauseInterval) {
      return;
    }
    lastPauseDrawTime = currentTimestamp - (elapsedSinceLastDraw % pauseInterval);
  }

  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);
  
  ctx.clearRect(0, 0, width, height);

  const r = state.accentRgb?.r ?? 255;
  const g = state.accentRgb?.g ?? 183;
  const b = state.accentRgb?.b ?? 77;

  const targetAmp = isPlaying ? 1.0 : 0.0;
  amplitudeScale += (targetAmp - amplitudeScale) * 0.08;
  lyricAmplitudeScale += (1.0 - lyricAmplitudeScale) * 0.05;

  const barWidth = 3;
  const barGap = 2;
  const numBars = Math.floor(width / (barWidth + barGap));
  const startX = (width - (numBars * (barWidth + barGap) - barGap)) / 2;
  const centerY = height / 2;
  const maxBarHeight = height - 12; // Margin top and bottom
  const minBarHeight = 3;

  ctx.lineWidth = barWidth;
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;

  if (state.perfSettings?.glow === "on") {
    ctx.shadowBlur = 10;
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.75)`;
  } else {
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  if (liveSyncActive && analyser && dataArray) {
    analyser.getByteTimeDomainData(dataArray);
    
    // Sample the time-domain buffer to calculate RMS amplitude per bar
    const samplesPerBar = dataArray.length / numBars;
    
    for (let i = 0; i < numBars; i++) {
      let sum = 0;
      const startSample = Math.floor(i * samplesPerBar);
      const endSample = Math.floor((i + 1) * samplesPerBar);
      const count = endSample - startSample;
      
      for (let s = startSample; s < endSample; s++) {
        const val = (dataArray[s] - 128) / 128; // Normalize to -1.0 to 1.0
        sum += val * val;
      }
      
      const rms = count > 0 ? Math.sqrt(sum / count) : 0;
      const amp = rms * 2.8 * amplitudeScale; // Boost factor for visibility
      const barHeight = Math.max(minBarHeight, amp * maxBarHeight);
      
      const x = startX + i * (barWidth + barGap) + barWidth / 2;
      ctx.beginPath();
      ctx.moveTo(x, centerY - barHeight / 2);
      ctx.lineTo(x, centerY + barHeight / 2);
      ctx.stroke();
    }
  } else {
    // Simulated Mode: combine multiple wave equations to form wave clusters like the user image
    // Pulse speed and amplitude dynamically on the beat (120 BPM rhythm)
    const progressMs = getCurrentProgressMs();
    const bpm = 120;
    const beatDurationMs = 60000 / bpm;
    const beatProgress = (progressMs % beatDurationMs) / beatDurationMs;
    const beatPulse = Math.pow(1 - beatProgress, 1.8);

    phase += isPlaying ? (0.04 + beatPulse * 0.04) : 0.01;
    
    for (let i = 0; i < numBars; i++) {
      const progress = (i / numBars);
      
      // Multi-frequency sine waves
      const angle1 = progress * Math.PI * 4 - phase * 1.5;
      const angle2 = progress * Math.PI * 10 + phase * 2.5;
      const angle3 = progress * Math.PI * 22 - phase * 4.0;
      
      // Envelope to taper at the left/right boundaries
      const envelope = Math.sin(progress * Math.PI);
      
      // Core wave calculation
      const waveVal = (
        Math.sin(angle1) * 0.45 +
        Math.sin(angle2) * 0.35 +
        Math.sin(angle3) * 0.20
      );
      
      // Low-frequency packet modulator to group amplitudes into symmetric clusters
      const clusterMod = Math.sin(progress * Math.PI * 3 - phase * 0.8) * 0.4 + 0.6;
      
      // Combined absolute amplitude
      let amp = Math.abs(waveVal) * envelope * clusterMod;
      
      // Modulate amplitude with beat pulse to make it bounce on beats (stronger on left bass frequencies)
      if (isPlaying) {
        const freqReact = (1 - progress);
        const modulatedPulse = 0.75 + 0.45 * beatPulse * freqReact;
        amp *= modulatedPulse;

        // Add subtle high-frequency jitter when playing to simulate live audio noise
        const jitter = (Math.sin(progress * 100 + phase * 20) * 0.05 + 0.05);
        amp = amp * 0.85 + jitter * 0.15;
      }
      
      const finalAmp = amp * amplitudeScale * lyricAmplitudeScale;
      const barHeight = Math.max(minBarHeight, finalAmp * maxBarHeight);
      
      const x = startX + i * (barWidth + barGap) + barWidth / 2;
      ctx.beginPath();
      ctx.moveTo(x, centerY - barHeight / 2);
      ctx.lineTo(x, centerY + barHeight / 2);
      ctx.stroke();
    }
  }
  
  ctx.shadowBlur = 0;
}

async function toggleLiveSync() {
  if (liveSyncActive) {
    liveSyncActive = false;
    if (micBtn) micBtn.classList.remove("active");
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      micStream = null;
    }
    analyser = null;
    dataArray = null;
    if (audioCtx) {
      await audioCtx.close();
      audioCtx = null;
    }
  } else {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      
      micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(analyser);
      
      liveSyncActive = true;
      if (micBtn) micBtn.classList.add("active");
    } catch (err) {
      console.error("Microphone access denied or unavailable:", err);
      alert("Unable to access microphone or system audio. Please check browser permissions.");
    }
  }
}

if (micBtn) {
  micBtn.addEventListener("click", toggleLiveSync);
}

// ─── WEATHER ─────────────────────────────────────────────────
async function updateWeather() {
  if (state.demoMode) return;
  try {
    const weather = await fetchJson("/weather");
    if (weather.error === "key not set" || !weather.available) {
      els.weatherIcon.removeAttribute("src");
      els.weatherTemp.textContent = "-- °C";
      els.weatherCondition.textContent = "Weather offline";
      return;
    }
    els.weatherTemp.textContent = `${weather.temp}°${weather.unit}`;
    els.weatherCondition.textContent = `${weather.condition} · ${weather.city}`;
    els.weatherIcon.src = weather.icon
      ? `https://openweathermap.org/img/wn/${weather.icon}@2x.png`
      : "";
  } catch {
    els.weatherTemp.textContent = "--";
    els.weatherCondition.textContent = "Weather offline";
  }
}

// ─── IDLE STATE ──────────────────────────────────────────────
function renderIdle(message) {
  els.player.classList.add("idle");
  els.player.classList.remove("playing");
  els.title.textContent = "No track playing";
  els.artist.textContent = "Start WebNowPlaying CLI and play music";
  els.album.textContent = "";
  els.topbarSource.textContent = "OFFLINE";
  els.sourceVal.textContent = "---";
  els.mood.textContent = "---";
  els.formatVal.textContent = "---";
  els.progressFill.style.width = "0%";
  els.elapsed.textContent = "00:00";
  els.duration.textContent = "00:00";
  els.previous.disabled = true;
  els.playPause.disabled = true;
  els.next.disabled = true;
  els.shuffle.disabled = true;
  els.playPause.innerHTML = PLAY_SVG;
  els.lyrics.innerHTML = "<p>// waiting for player</p>";

  // POLISH #3: Reset Album Section Duration Badge
  const albumDurationBadge = document.getElementById("album-duration");
  if (albumDurationBadge) {
    albumDurationBadge.textContent = "00:00";
  }
}

// ─── PROGRESS ────────────────────────────────────────────────
function updateProgress(track) {
  let progress = track.progress_ms || 0;
  if (track.is_playing && state.localProgressStartedAt) {
    progress = state.localProgressBase + (Date.now() - state.localProgressStartedAt);
  }
  const duration = track.duration_ms || 0;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
  els.progressFill.style.width = `${pct}%`;
  els.elapsed.textContent = formatTime(progress);
  els.duration.textContent = formatTime(duration);
  highlightLyric(progress);

  // POLISH #3: Update Album Section Duration Badge
  const albumDurationBadge = document.getElementById("album-duration");
  if (albumDurationBadge) {
    albumDurationBadge.textContent = formatTime(duration);
  }
}

// ─── MAIN POLLING ────────────────────────────────────────────
async function updateNowPlaying() {
  if (state.demoMode) {
    if (state.nowPlaying?.available) updateProgress(state.nowPlaying);
    return;
  }
  try {
    const track = await fetchJson("/nowplaying");
    state.nowPlaying = track;

    if (!track.available) {
      renderIdle(track.message || "Waiting for player...");
      return;
    }

    els.player.classList.remove("idle");
    els.player.classList.toggle("playing", track.is_playing);
    els.title.textContent = track.title || "Unknown Title";
    els.artist.textContent = track.artist || "Unknown Artist";
    els.album.textContent = track.album || "";

    // Topbar source indicator
    const sourceName = track.source || "WebNowPlaying";
    els.topbarSource.textContent = sourceName.toUpperCase();
    els.sourceVal.textContent = sourceName;

    // Sidebar metadata
    els.mood.textContent = getMood(track.title, track.artist);
    els.formatVal.textContent = getFormat(track.source);

    els.previous.disabled = !track.can_skip_previous;
    els.playPause.disabled = !track.can_play_pause;
    els.next.disabled = !track.can_skip_next;
    els.shuffle.disabled = false;
    els.playPause.innerHTML = track.is_playing ? PAUSE_SVG : PLAY_SVG;

    const nextTrackKey = trackKey(track);
    const isNewTrack = nextTrackKey !== state.lastTrackKey;
    if (isNewTrack) {
      state.lastTrackKey = nextTrackKey;
      await handleTrackChange(track);
    }

    // Interpolate progress to prevent micro-jitters
    const estimated = state.localProgressBase + (state.localProgressStartedAt ? (Date.now() - state.localProgressStartedAt) : 0);
    const drift = (track.progress_ms || 0) - estimated;
    
    if (isNewTrack) {
      state.localProgressBase = track.progress_ms || 0;
      state.localProgressStartedAt = track.is_playing ? Date.now() : 0;
    } else if (!track.is_playing) {
      state.localProgressBase = track.progress_ms || 0;
      state.localProgressStartedAt = 0;
    } else {
      if (!state.localProgressStartedAt && track.is_playing) {
        state.localProgressBase = track.progress_ms || 0;
        state.localProgressStartedAt = Date.now();
      } else if (Math.abs(drift) > 2000) {
        // Large drift (seek) - snap immediately
        state.localProgressBase = track.progress_ms || 0;
        state.localProgressStartedAt = Date.now();
      } else {
        // Small drift (quantization/jitter) - slowly adjust base without resetting start timestamp to keep movement smooth
        state.localProgressBase += drift * 0.1;
      }
    }
    updateProgress(track);
  } catch {
    renderIdle("Waiting for server...");
  }
}

// ─── TRACK CHANGE ────────────────────────────────────────────
async function handleTrackChange(track) {
  const src = coverSource(track.cover_url);
  addToHistory(track);
  await crossfadeArt(src);
  extractAccent(src);
  await loadLyrics(track);
}

function crossfadeArt(src) {
  return new Promise((resolve) => {
    els.albumArt.style.opacity = "0";
    els.backgroundArt.style.opacity = "0";
    const img = new Image();
    img.onload = () => {
      els.albumArt.src = src;
      els.backgroundArt.src = src;
      requestAnimationFrame(() => {
        els.albumArt.style.opacity = "1";
        els.backgroundArt.style.opacity = "0.6";
        resolve();
      });
    };
    img.onerror = () => {
      els.albumArt.src = fallbackCover;
      els.backgroundArt.src = fallbackCover;
      els.albumArt.style.opacity = "1";
      els.backgroundArt.style.opacity = "0.6";
      resolve();
    };
    img.src = src;
  });
}

// ─── LYRICS ──────────────────────────────────────────────────
async function loadLyrics(track) {
  els.lyrics.innerHTML = "<p>Loading lyrics...</p>";
  if (els.copyLyrics) els.copyLyrics.classList.add("hidden");
  try {
    const params = new URLSearchParams({
      title: track.title || "",
      artist: track.artist || "",
      duration_ms: String(track.duration_ms || ""),
    });
    const lyricData = await fetchJson(`/lyrics?${params}`);
    state.lyrics = lyricData.lines || [];
    state.syncedLyrics = Boolean(lyricData.synced);
    renderLyrics();
    if (state.lyrics.length && els.copyLyrics) {
      els.copyLyrics.classList.remove("hidden");
    }
  } catch {
    state.lyrics = [];
    state.syncedLyrics = false;
    els.lyrics.innerHTML = "<p>No synced lyrics found</p>";
    if (els.copyLyrics) els.copyLyrics.classList.add("hidden");
  }
}

function updateLyricsPadding() {
  if (els.lyrics) {
    const halfHeight = els.lyrics.clientHeight / 2;
    els.lyrics.style.paddingTop = `${halfHeight}px`;
    els.lyrics.style.paddingBottom = `${halfHeight}px`;
  }
}

function renderLyrics() {
  if (!state.lyrics.length) {
    els.lyrics.innerHTML = "<p>No synced lyrics found</p>";
    if (els.copyLyrics) els.copyLyrics.classList.add("hidden");
    return;
  }
  els.lyrics.innerHTML = "";
  for (const line of state.lyrics) {
    const p = document.createElement("p");
    p.textContent = line.text || "♪";
    if (line.time_ms !== null && line.time_ms !== undefined) {
      p.dataset.time = String(line.time_ms);
    }
    els.lyrics.appendChild(p);
  }
  updateLyricsPadding();
}

function highlightLyric(progressMs) {
  const lyricNodes = [...els.lyrics.querySelectorAll("p[data-time]")];
  if (!lyricNodes.length) return;

  let activeIndex = 0;
  for (let i = 0; i < lyricNodes.length; i++) {
    if (Number(lyricNodes[i].dataset.time) <= progressMs + 250) activeIndex = i;
  }

  let changed = false;
  for (let i = 0; i < lyricNodes.length; i++) {
    const node = lyricNodes[i];
    const wasActive = node.classList.contains("active");
    const isActive = i === activeIndex;
    const isPast = i < activeIndex;

    node.classList.toggle("active", isActive);
    node.classList.toggle("past", isPast);

    if (isActive && !wasActive) changed = true;
  }

  if (changed) {
    const container = els.lyrics;
    const activeNode = lyricNodes[activeIndex];
    const targetScrollTop = activeNode.offsetTop - container.clientHeight / 2 + activeNode.clientHeight / 2;
    container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    if (activeIndex !== lastActiveLyricIndex) {
      lastActiveLyricIndex = activeIndex;
      lyricAmplitudeScale = 2.2; // Surge main wave amplitude
    }
  }
}

// ─── ACCENT COLOR EXTRACTION ─────────────────────────────────
function extractAccent(src) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      // Try ColorThief first
      if (typeof ColorThief !== "undefined") {
        const ct = new ColorThief();
        const [r, g, b] = ct.getColor(img);
        applyAccentColor(r, g, b);
        return;
      }
      // Fallback: canvas sampling
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      canvas.width = 32; canvas.height = 32;
      ctx.drawImage(img, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 16) {
        if (data[i + 3] < 80) continue;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
      }
      if (!count) return;
      applyAccentColor(
        Math.round(r / count),
        Math.round(g / count),
        Math.round(b / count)
      );
    } catch (err) {
      console.warn("Accent extraction failed:", err);
    }
  };
  img.src = src;
}

function applyAccentColor(r, g, b) {
  // Boost luminance so accent is always bright enough
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const minLum = 100;
  if (luminance < minLum && luminance > 0) {
    const scale = minLum / luminance;
    r = Math.min(255, Math.round(r * scale));
    g = Math.min(255, Math.round(g * scale));
    b = Math.min(255, Math.round(b * scale));
  }
  state.accentRgb = { r, g, b };
  document.documentElement.style.setProperty("--accent", `rgb(${r},${g},${b})`);
  document.documentElement.style.setProperty("--accent-soft", `rgba(${r},${g},${b},0.24)`);
  document.documentElement.style.setProperty("--accent-glow", `rgba(${r},${g},${b},0.10)`);
}

// ─── PLAYBACK CONTROLS ──────────────────────────────────────
async function sendControl(action) {
  if (state.demoMode) {
    handleMockControl(action);
    return;
  }
  try {
    await fetchJson("/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setTimeout(updateNowPlaying, 350);
  } catch {
    renderIdle("Control unavailable");
    setTimeout(updateNowPlaying, 900);
  }
}

async function sendSeek(positionMs) {
  if (state.demoMode) {
    handleMockSeek(positionMs);
    return;
  }
  try {
    await fetchJson("/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seek", position_ms: positionMs }),
    });
    setTimeout(updateNowPlaying, 350);
  } catch {
    setTimeout(updateNowPlaying, 900);
  }
}

// ─── EVENT LISTENERS ─────────────────────────────────────────
els.previous.addEventListener("click", () => { sendControl("previous"); els.previous.blur(); });
els.playPause.addEventListener("click", () => { sendControl("play_pause"); els.playPause.blur(); });
els.next.addEventListener("click", () => { sendControl("next"); els.next.blur(); });
els.shuffle.addEventListener("click", () => { sendControl("shuffle"); els.shuffle.blur(); });
els.queue.addEventListener("click", () => {
  els.player.classList.toggle("sidebar-collapsed");
  els.queue.blur();
});

els.progress.addEventListener("click", (e) => {
  if (!state.nowPlaying?.available || !state.nowPlaying.duration_ms) return;
  const rect = els.progress.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const seekMs = Math.round(pct * state.nowPlaying.duration_ms);

  state.localProgressBase = seekMs;
  state.localProgressStartedAt = state.nowPlaying.is_playing ? Date.now() : 0;
  updateProgress({ ...state.nowPlaying, progress_ms: seekMs });
  sendSeek(seekMs);
});

// Keyboard Shortcuts Elements & Event Handlers
const shortcutsModal = document.getElementById("shortcuts-modal");
const shortcutsToggleBtn = document.getElementById("shortcuts-toggle");
const closeShortcutsBtn = document.getElementById("close-shortcuts");

function toggleShortcutsModal() {
  if (!shortcutsModal) return;
  const isActive = shortcutsModal.classList.toggle("active");
  shortcutsModal.setAttribute("aria-hidden", !isActive);
}

if (shortcutsToggleBtn && closeShortcutsBtn && shortcutsModal) {
  shortcutsToggleBtn.addEventListener("click", toggleShortcutsModal);
  closeShortcutsBtn.addEventListener("click", toggleShortcutsModal);
  shortcutsModal.addEventListener("click", (e) => {
    if (e.target === shortcutsModal) {
      toggleShortcutsModal();
    }
  });
}

function getCurrentProgressMs() {
  let progress = state.nowPlaying?.progress_ms || 0;
  if (state.nowPlaying?.is_playing && state.localProgressStartedAt) {
    progress = state.localProgressBase + (Date.now() - state.localProgressStartedAt);
  }
  return progress;
}

window.addEventListener("keydown", (e) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    return;
  }

  const key = e.key.toLowerCase();
  
  if (e.key === "?") {
    e.preventDefault();
    toggleShortcutsModal();
    return;
  }

  if (e.key === "Escape" && shortcutsModal && shortcutsModal.classList.contains("active")) {
    e.preventDefault();
    toggleShortcutsModal();
    return;
  }

  if (shortcutsModal && shortcutsModal.classList.contains("active")) {
    return;
  }

  switch (key) {
    case " ":
    case "k":
      e.preventDefault();
      if (state.nowPlaying?.available && !els.playPause.disabled) {
        sendControl("play_pause");
      }
      break;

    case "arrowleft":
    case "j":
      e.preventDefault();
      if (state.nowPlaying?.available && state.nowPlaying.duration_ms) {
        const currentProg = getCurrentProgressMs();
        const targetProg = Math.max(0, currentProg - 10000);
        state.localProgressBase = targetProg;
        state.localProgressStartedAt = state.nowPlaying.is_playing ? Date.now() : 0;
        updateProgress({ ...state.nowPlaying, progress_ms: targetProg });
        sendSeek(targetProg);
      }
      break;

    case "arrowright":
    case "l":
      e.preventDefault();
      if (state.nowPlaying?.available && state.nowPlaying.duration_ms) {
        const currentProg = getCurrentProgressMs();
        const targetProg = Math.min(state.nowPlaying.duration_ms, currentProg + 10000);
        state.localProgressBase = targetProg;
        state.localProgressStartedAt = state.nowPlaying.is_playing ? Date.now() : 0;
        updateProgress({ ...state.nowPlaying, progress_ms: targetProg });
        sendSeek(targetProg);
      }
      break;

    case "n":
      e.preventDefault();
      if (state.nowPlaying?.available && !els.next.disabled) {
        sendControl("next");
      }
      break;

    case "p":
      e.preventDefault();
      if (state.nowPlaying?.available && !els.previous.disabled) {
        sendControl("previous");
      }
      break;

    case "s":
      e.preventDefault();
      if (state.nowPlaying?.available && !els.shuffle.disabled) {
        sendControl("shuffle");
      }
      break;

    case "q":
      e.preventDefault();
      els.player.classList.toggle("sidebar-collapsed");
      break;
  }
});

// ─── COPY LYRICS ─────────────────────────────────────────────
if (els.copyLyrics) {
  els.copyLyrics.addEventListener("click", () => {
    if (!state.lyrics || !state.lyrics.length) return;
    const fullText = state.lyrics.map(line => line.text || "").join("\n");
    navigator.clipboard.writeText(fullText).then(() => {
      els.copyLyrics.classList.add("success");
      const textEl = els.copyLyrics.querySelector(".copy-text");
      if (textEl) textEl.textContent = "COPIED";
      setTimeout(() => {
        els.copyLyrics.classList.remove("success");
        if (textEl) textEl.textContent = "COPY";
      }, 1500);
    }).catch(err => {
      console.error("Failed to copy lyrics:", err);
    });
  });
}

// ─── CLOCK TOGGLE ────────────────────────────────────────────
if (els.clock) {
  els.clock.addEventListener("click", () => {
    state.clockShowSeconds = !state.clockShowSeconds;
    try {
      localStorage.setItem("webrainmeter_clock_seconds", state.clockShowSeconds);
    } catch (e) {}
    updateClock();
  });
}

// ─── SONG HISTORY ────────────────────────────────────────────
function loadHistory() {
  try {
    const saved = localStorage.getItem("webrainmeter_history");
    if (saved) {
      state.history = JSON.parse(saved);
      renderHistory();
    }
  } catch (e) {
    console.warn("Failed to load history:", e);
  }
}

function saveHistory() {
  try {
    localStorage.setItem("webrainmeter_history", JSON.stringify(state.history));
  } catch (e) {
    console.warn("Failed to save history:", e);
  }
}

function addToHistory(track) {
  if (!track || !track.title) return;
  
  state.history = state.history.filter(
    item => !(item.title === track.title && item.artist === track.artist)
  );
  
  state.history.unshift({
    title: track.title,
    artist: track.artist || "Unknown Artist"
  });
  
  if (state.history.length > 5) {
    state.history.pop();
  }
  
  renderHistory();
  saveHistory();
}

function renderHistory() {
  if (!els.historyList) return;
  
  if (state.history.length === 0) {
    els.historyList.innerHTML = '<div class="history-empty">---</div>';
    return;
  }
  
  els.historyList.innerHTML = "";
  state.history.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.title = `${item.title} - ${item.artist}`;
    
    const titleSpan = document.createElement("span");
    titleSpan.className = "history-title";
    titleSpan.textContent = item.title;
    
    const artistSpan = document.createElement("span");
    artistSpan.className = "history-artist";
    artistSpan.textContent = item.artist;
    
    div.appendChild(titleSpan);
    div.appendChild(artistSpan);
    
    els.historyList.appendChild(div);
  });
}

// ─── PERFORMANCE SETTINGS METHODS ────────────────────────────
function loadPerformanceSettings() {
  const defaults = { fps: 60, glow: "on", bg: "hq", crt: "on" };
  try {
    const saved = localStorage.getItem("webrainmeter_perf");
    if (saved) {
      state.perfSettings = { ...defaults, ...JSON.parse(saved) };
    } else {
      state.perfSettings = defaults;
    }
  } catch (e) {
    state.perfSettings = defaults;
  }
  
  const fpsEl = document.getElementById("perf-fps");
  const glowEl = document.getElementById("perf-glow");
  const bgEl = document.getElementById("perf-bg");
  const crtEl = document.getElementById("perf-crt");
  
  if (fpsEl) fpsEl.value = String(state.perfSettings.fps);
  if (glowEl) glowEl.value = state.perfSettings.glow;
  if (bgEl) bgEl.value = state.perfSettings.bg;
  if (crtEl) crtEl.value = state.perfSettings.crt;
  
  applyPerformanceClasses();
}

function savePerformanceSettings() {
  try {
    localStorage.setItem("webrainmeter_perf", JSON.stringify(state.perfSettings));
  } catch (e) {
    console.warn("Could not save settings to localStorage:", e);
  }
  applyPerformanceClasses();
}

function applyPerformanceClasses() {
  const body = document.body;
  
  if (state.perfSettings.bg === "fast") {
    body.classList.add("perf-flat-bg");
  } else {
    body.classList.remove("perf-flat-bg");
  }
  
  if (state.perfSettings.crt === "off") {
    body.classList.add("perf-no-crt");
  } else {
    body.classList.remove("perf-no-crt");
  }
  
  if (state.perfSettings.glow === "off") {
    body.classList.add("perf-no-glow");
  } else {
    body.classList.remove("perf-no-glow");
  }
}

function initPerformanceListeners() {
  const fpsEl = document.getElementById("perf-fps");
  const glowEl = document.getElementById("perf-glow");
  const bgEl = document.getElementById("perf-bg");
  const crtEl = document.getElementById("perf-crt");
  
  if (fpsEl) {
    fpsEl.addEventListener("change", (e) => {
      state.perfSettings.fps = Number(e.target.value);
      savePerformanceSettings();
    });
  }
  if (glowEl) {
    glowEl.addEventListener("change", (e) => {
      state.perfSettings.glow = e.target.value;
      savePerformanceSettings();
    });
  }
  if (bgEl) {
    bgEl.addEventListener("change", (e) => {
      state.perfSettings.bg = e.target.value;
      savePerformanceSettings();
    });
  }
  if (crtEl) {
    crtEl.addEventListener("change", (e) => {
      state.perfSettings.crt = e.target.value;
      savePerformanceSettings();
    });
  }
}

// ─── INIT ────────────────────────────────────────────────────
loadPerformanceSettings();
loadClockSettings();
loadHistory();
initPerformanceListeners();
resizeCanvas();
drawVisualizer();
updateClock();
updateUptime();
if (shouldEnableDemoMode()) {
  enableDemoMode();
} else {
  updateWeather();
  updateNowPlaying();
}

setInterval(updateClock, 1000);
setInterval(updateUptime, 1000);
setInterval(updateNowPlaying, 1000);

// Update progress bar at 30ms (~33 FPS) for sub-second smooth animation
setInterval(() => {
  if (state.nowPlaying?.available) updateProgress(state.nowPlaying);
}, 30);

// POLISH #6: Randomize Latency Diagnostic (run every 1000ms instead of 30ms to save CPU)
setInterval(() => {
  const latencyEl = document.getElementById("diag-latency");
  if (latencyEl) {
    latencyEl.textContent = `${Math.floor(Math.random() * 8) + 8}ms`;
  }
}, 1000);
setInterval(updateWeather, 10 * 60 * 1000);
