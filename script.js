// Change this ID to update both the YouTube video and its thumbnail.
const VIDEO_ID = 'lppWSHOX-Ck';
document.querySelector('#youtube-link').href = `https://www.youtube.com/watch?v=${encodeURIComponent(VIDEO_ID)}`;

const playButton = document.querySelector('#play');
const startButton = document.querySelector('#start-play');
const startIcon = document.querySelector('#start-icon');
const muteButton = document.querySelector('#mute');
const statusLabel = document.querySelector('#status');
const poster = document.querySelector('#poster');
const posterImage = document.querySelector('#poster img');
const loading = document.querySelector('#loading');
const videoWindow = document.querySelector('.video-window');
const stage = document.querySelector('.video-stage');
const controls = document.querySelector('.control-bar');
const seek = document.querySelector('#seek');
const volume = document.querySelector('#volume');
const fullscreen = document.querySelector('#fullscreen');
const playIcon = document.querySelector('#play-icon');
const soundIcon = document.querySelector('#sound-icon');
const fullscreenIcon = document.querySelector('#fullscreen-icon');
const timeLabel = document.querySelector('#time');
const CONTROLS_HIDE_DELAY = 3000;
const SYNC_INTERVAL = 250;
const messages = {
  '-1': 'Siap diputar', 0: 'Video selesai', 1: 'Sedang diputar',
  2: 'Dijeda', 3: 'Memuat video…', 5: 'Siap diputar'
};
let previousVolume = 100;
let scrubbing = false;
let syncTimer;
let controlsTimer;
let playing = false;
let controlsIdle = false;
let coverTimer;

function loadThumbnail() {
  const sizes = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'];
  let nextSize = 0;

  function tryNextSize() {
    if (nextSize >= sizes.length) {
      posterImage.hidden = true;
      posterImage.removeAttribute('src');
      return;
    }
    posterImage.src = `https://i.ytimg.com/vi/${encodeURIComponent(VIDEO_ID)}/${sizes[nextSize++]}.jpg`;
  }

  posterImage.addEventListener('error', tryNextSize);
  posterImage.addEventListener('load', () => {
    // YouTube can return a 120px placeholder even with a successful HTTP response.
    if (posterImage.naturalWidth <= 120) tryNextSize();
    else posterImage.hidden = false;
  });
  tryNextSize();
}
loadThumbnail();

function fitVideoWindow() {
  const width = Math.min(stage.clientWidth, stage.clientHeight * 16 / 9);
  videoWindow.style.width = `${width}px`;
  videoWindow.style.height = `${width * 9 / 16}px`;
}
const sizeObserver = new ResizeObserver(fitVideoWindow);
sizeObserver.observe(stage);
fitVideoWindow();

function showCover(mode) {
  clearTimeout(coverTimer);
  poster.hidden = mode === 'playing';
  loading.hidden = mode !== 'loading';
  startButton.hidden = mode === 'loading' || mode === 'error';
  setAttribute(startIcon, 'src', mode === 'playing' ? './img/pause.svg' : './img/play.svg');
  setAttribute(startButton, 'aria-label', mode === 'playing' ? 'Jeda video' : 'Putar video');
  startButton.classList.toggle('is-playing', mode === 'playing');
  if (startButton.hidden && document.activeElement === startButton) playButton.focus({ preventScroll: true });
}

function updateControlsVisibility() {
  const keyboardFocus = controls.matches(':has(:focus-visible)') || startButton.matches(':focus-visible');
  const usingControls = controls.matches(':hover');
  stage.classList.toggle('controls-hidden', playing && controlsIdle && !scrubbing && !keyboardFocus && !usingControls);
}

function revealControls() {
  clearTimeout(controlsTimer);
  controlsIdle = false;
  updateControlsVisibility();
  if (playing) {
    controlsTimer = setTimeout(() => {
      controlsIdle = true;
      updateControlsVisibility();
    }, CONTROLS_HIDE_DELAY);
  }
}

function onHover(event) {
  if (event.pointerType === 'touch') return;
  revealControls();
}
stage.addEventListener('pointerenter', onHover);
stage.addEventListener('pointermove', onHover);
// Leaving the video preserves the inactivity countdown instead of hiding instantly.
stage.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return;
  revealControls();
});
controls.addEventListener('pointerleave', revealControls);
controls.addEventListener('focusin', revealControls);
controls.addEventListener('focusout', () => queueMicrotask(revealControls));
controls.addEventListener('click', revealControls);
startButton.addEventListener('focusin', revealControls);
startButton.addEventListener('focusout', () => queueMicrotask(revealControls));
let player;
let ready = false;
let failed = false;

function syncPlayback() {
  updateTimeline();
  updateSound();
}

function updateSyncTimer() {
  clearInterval(syncTimer);
  syncTimer = undefined;
  // A paused player or background tab does not need continuous DOM updates.
  if (ready && playing && !document.hidden) {
    syncTimer = setInterval(syncPlayback, SYNC_INTERVAL);
  }
}

function setAttribute(element, name, value) {
  if (element.getAttribute(name) !== String(value)) element.setAttribute(name, value);
}

function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function showError(message) {
  showCover('error');
  playing = false;
  revealControls();
  failed = true;
  ready = false;
  clearTimeout(loadTimeout);
  statusLabel.textContent = message;
  statusLabel.classList.remove('visually-hidden');
  playButton.disabled = true;
  startButton.disabled = true;
  muteButton.disabled = true;
  seek.disabled = volume.disabled = true;
  clearInterval(syncTimer);
}

function updateSound(muted = player.isMuted(), level = player.getVolume()) {
  muted = muted || level === 0;
  if (level > 0) previousVolume = level;
  const label = muted ? 'Aktifkan suara' : 'Matikan suara';
  setAttribute(muteButton, 'aria-label', label);
  setAttribute(soundIcon, 'src', muted ? './img/volume-x.svg' : './img/volume-2.svg');
  const nextVolume = String(muted ? 0 : level);
  if (volume.value !== nextVolume) volume.value = nextVolume;
  paintRange(volume);
}

function paintRange(input) {
  const percent = Number(input.max) > 0 ? Number(input.value) / Number(input.max) * 100 : 0;
  const progress = `${percent.toFixed(2)}%`;
  if (input.style.getPropertyValue('--progress') !== progress) input.style.setProperty('--progress', progress);
}

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateTimeline() {
  if (!ready) return;
  const duration = player.getDuration() || 0;
  if (Number(seek.max) !== duration) seek.max = duration;
  seek.disabled = duration <= 0;
  if (!scrubbing) seek.value = player.getCurrentTime() || 0;
  const currentTime = formatTime(seek.value);
  const totalTime = formatTime(duration);
  setText(timeLabel, `${currentTime} / ${totalTime}`);
  setAttribute(seek, 'aria-valuetext', `${currentTime} dari ${totalTime}`);
  paintRange(seek);
}

function disableCaptions(target = player) {
  // Best effort: unloadModule is not part of the documented stable IFrame API.
  // Check loaded modules to avoid an unload/onApiChange event loop.
  try {
    if (typeof target?.getOptions === 'function' && typeof target.unloadModule === 'function' &&
        target.getOptions().includes('captions')) {
      target.unloadModule('captions');
    }
  } catch {
    // Caption support varies; a missing module must not break playback.
  }
}

seek.addEventListener('input', () => { scrubbing = true; revealControls(); updateTimeline(); });
seek.addEventListener('change', () => {
  if (ready) {
    showCover(playing ? 'loading' : 'paused');
    player.seekTo(Number(seek.value), true);
    if (playing) {
      // Seeking within buffered data may not emit a new state-change event.
      coverTimer = setTimeout(() => {
        if (ready && playing && player.getPlayerState() === YT.PlayerState.PLAYING) showCover('playing');
      }, 300);
    }
  }
  scrubbing = false;
  revealControls();
});
seek.addEventListener('pointercancel', () => { scrubbing = false; updateTimeline(); revealControls(); });
seek.addEventListener('blur', () => { scrubbing = false; revealControls(); });
volume.addEventListener('input', () => {
  if (!ready) return;
  const level = Number(volume.value);
  player.setVolume(level);
  if (level > 0) player.unMute(); else player.mute();
  // Render the requested value without waiting for the iframe message round trip.
  updateSound(level === 0, level);
  revealControls();
});
fullscreen.hidden = !document.fullscreenEnabled || !stage.requestFullscreen;
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement === stage) await document.exitFullscreen();
    else await stage.requestFullscreen();
  } catch {
    statusLabel.textContent = 'Browser tidak mengizinkan layar penuh.';
    statusLabel.classList.remove('visually-hidden');
  }
});
document.addEventListener('fullscreenchange', () => {
  fitVideoWindow();
  const expanded = document.fullscreenElement === stage;
  fullscreen.setAttribute('aria-label', expanded ? 'Keluar layar penuh' : 'Layar penuh');
  setAttribute(fullscreenIcon, 'src', expanded ? './img/minimize.svg' : './img/maximize.svg');
  revealControls();
});

const loadTimeout = setTimeout(() => showError('Video belum terhubung. Muat ulang atau buka di YouTube.'), 20000);

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('player', {
    videoId: VIDEO_ID,
    width: '100%',
    height: '100%',
    playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0, fs: 0, cc_load_policy: 0, iv_load_policy: 3, origin: window.location.origin },
    events: {
      onReady(event) {
        clearTimeout(loadTimeout);
        failed = false;
        ready = true;
        event.target.mute();
        disableCaptions(event.target);
        event.target.getIframe().title = 'Pemutar video YouTube';
        event.target.getIframe().tabIndex = -1;
        playButton.disabled = false;
        startButton.disabled = false;
        muteButton.disabled = false;
        volume.disabled = false;
        statusLabel.textContent = 'Siap diputar';
        statusLabel.classList.add('visually-hidden');
        showCover('idle');
        updateSound(true);
        updateTimeline();
        updateSyncTimer();
      },
      onStateChange(event) {
        if (failed) return;
        playing = event.data === YT.PlayerState.PLAYING;
        if (playing) disableCaptions(event.target);
        revealControls();
        // A poster covers native pause/end suggestions; no cross-origin frame capture.
        clearTimeout(coverTimer);
        if (playing) {
          coverTimer = setTimeout(() => { if (playing && !failed) showCover('playing'); }, 200);
        } else {
          showCover(event.data === YT.PlayerState.BUFFERING ? 'loading' : 'paused');
        }
        const active = event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.BUFFERING;
        setAttribute(playIcon, 'src', active ? './img/pause.svg' : './img/play.svg');
        playButton.setAttribute('aria-label', active ? 'Jeda video' : 'Putar video');
        statusLabel.textContent = messages[event.data] || 'Siap diputar';
        updateTimeline();
        updateSyncTimer();
      },
      onApiChange(event) { disableCaptions(event.target); },
      onError(event) {
        const errors = { 2: 'ID video tidak valid.', 5: 'Video tidak dapat diputar di browser ini.', 100: 'Video tidak tersedia.', 101: 'Pemilik video menonaktifkan embed.', 150: 'Pemilik video menonaktifkan embed.', 153: 'Identitas situs tidak terbaca. Buka melalui localhost.' };
        showError(errors[event.data] || 'Gagal memuat video. Coba buka di YouTube.');
      },
      onAutoplayBlocked() {
        playing = false;
        showCover('paused');
        setAttribute(playIcon, 'src', './img/play.svg');
        playButton.setAttribute('aria-label', 'Putar video');
        revealControls();
        updateSyncTimer();
        statusLabel.textContent = 'Browser memblokir pemutaran. Tekan Putar lagi.';
        statusLabel.classList.remove('visually-hidden');
      }
    }
  });
};

function togglePlayback() {
  if (!ready) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
    showCover('paused');
    player.pauseVideo();
  } else {
    showCover('loading');
    player.playVideo();
  }
}
playButton.addEventListener('click', togglePlayback);
stage.addEventListener('click', (event) => {
  // Buttons and sliders handle their own actions; never toggle them twice.
  if (controls.contains(event.target) || startButton.contains(event.target)) return;
  togglePlayback();
});
startButton.addEventListener('click', togglePlayback);
muteButton.addEventListener('click', () => {
  if (!ready) return;
  const level = player.getVolume();
  const enableSound = player.isMuted() || level === 0;
  if (enableSound) {
    if (level === 0) player.setVolume(previousVolume);
    player.unMute();
  } else player.mute();
  updateSound(!enableSound, level || previousVolume);
});

document.addEventListener('visibilitychange', () => {
  if (ready && !document.hidden) syncPlayback();
  updateSyncTimer();
});
window.addEventListener('pagehide', () => {
  clearInterval(syncTimer);
  clearTimeout(controlsTimer);
  clearTimeout(coverTimer);
});
window.addEventListener('pageshow', () => {
  fitVideoWindow();
  if (ready && playing) showCover('playing');
  updateSyncTimer();
  revealControls();
});

if (location.protocol === 'file:') {
  showError('Buka halaman melalui hosting atau Live Server agar embed YouTube dapat dimuat.');
} else {
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  script.onerror = () => showError('YouTube tidak terhubung. Periksa koneksi atau pemblokir konten.');
  document.head.append(script);
}
