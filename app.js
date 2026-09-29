'use strict';

const players = new Set();
const GAME_NAMES = {lol: 'League of Legends', dota2: 'Dota 2', hok: 'Honor of Kings'};
const pad =n => String(n).padStart(2, '0');
const clock = t => { t = Math.max(0, Number(t) || 0); return `${Math.floor(t / 60)}:${pad(Math.floor(t % 60))}`; };
const scrollBehavior = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
const ICON = {
  play: '<svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.1-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z"/><path d="m15.5 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

// Row of poster thumbnails used to pick a clip.
function thumbStrip(items, label, onSelect) {
  const el = document.createElement('div');
  el.className = 'thumbs';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', label);
  items.forEach((item, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.setAttribute('aria-label', item.label);
    b.innerHTML = `<img src="${item.poster}" alt="" loading="lazy" decoding="async"><span class="thumb-num">${pad(i + 1)}</span><span class="thumb-dur">${clock(Math.round(item.duration))}</span>`;
    b.addEventListener('click', () => onSelect(i));
    el.append(b);
  });
  return {
    el,
    select(i, reveal) {
      [...el.children].forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
      const b = el.children[i];
      if (reveal && b) el.scrollTo({left: b.offsetLeft - (el.clientWidth - b.offsetWidth) / 2, behavior: scrollBehavior()});
    },
  };
}

function createDemo(root, scenes) {
  if (!scenes.length) return;
  let index = 0;
  const isLoL = root.dataset.game === 'lol';
  const game = GAME_NAMES[root.dataset.game] || root.dataset.game;
  const titleOf = i => (isLoL ? `Clip ${pad(i + 1)}` : scenes[i].title);
  root.innerHTML = `<div class="stage"><div class="stage-bar"><span class="model-tag">MOBA-VL<span class="badge">Ours</span></span><span class="stage-title"></span><span class="stage-count"></span></div><div class="screen"><video playsinline preload="none" aria-label="${game} commentary video"></video><button type="button" class="play-overlay" aria-label="Play ${game} video"><span class="play-disc">${ICON.play}</span><span>Play demo</span></button><button type="button" class="nav-btn prev" aria-label="Previous ${game} clip">${ICON.prev}</button><button type="button" class="nav-btn next" aria-label="Next ${game} clip">${ICON.next}</button></div></div><p class="player-status" role="status"></p>`;
  const video = root.querySelector('video'), overlay = root.querySelector('.play-overlay'), status = root.querySelector('.player-status');
  const strip = thumbStrip(scenes.map((s, i) => ({poster: s.poster, duration: s.duration, label: `${game}, ${titleOf(i)}`})), `${game} clips`, i => { index = i; render(true); });
  root.append(strip.el);
  players.add(video);
  function render(reveal) {
    video.pause(); video.removeAttribute('src'); video.load();
    const scene = scenes[index];
    video.poster = scene.poster; video.controls = false; overlay.hidden = false;
    root.classList.remove('is-playing');
    root.querySelector('.stage-title').textContent = titleOf(index);
    root.querySelector('.stage-count').textContent = `${pad(index + 1)} / ${pad(scenes.length)}`;
    status.textContent = '';
    strip.select(index, reveal);
  }
  const step = d => { index = (index + d + scenes.length) % scenes.length; render(true); };
  root.querySelector('.prev').addEventListener('click', () => step(-1));
  root.querySelector('.next').addEventListener('click', () => step(1));
  overlay.addEventListener('click', async () => {
    video.src = scenes[index].src; video.controls = true; overlay.hidden = true;
    root.classList.add('is-playing');
    try { await video.play(); } catch { /* Native controls remain available. */ }
  });
  video.addEventListener('play', () => players.forEach(other => { if (other !== video) other.pause(); }));
  video.addEventListener('error', () => { if (video.getAttribute('src')) status.textContent = 'Video unavailable. Please try another clip.'; });
  render(false);
}

function createComparison(root, scenes) {
  if (!scenes.length) { root.textContent = 'Comparison videos are being prepared.'; return; }
  let index = 0, activeAudio = 'ours', sideBySide = false, wantPlay = false, pos = 0;
  const waiting = new Set();
  const MODELS = [{id: 'ours', name: 'MOBA-VL', tag: 'Ours'}, {id: 'proact', name: 'Proact-VL', tag: 'Prior method'}];
  root.innerHTML = `<div class="compare-toolbar"><div class="model-picker"><p class="picker-label" id="picker-label">Listen to commentary from</p><div class="model-tabs" role="group" aria-labelledby="picker-label">${MODELS.map(m => `<button type="button" class="model-tab" data-audio="${m.id}"><span class="tab-dot" aria-hidden="true"></span><span class="tab-text"><strong>${m.name}</strong><small>${m.tag}</small></span><span class="tab-sound" aria-hidden="true">${ICON.sound}<span>Audio</span></span></button>`).join('')}</div></div><label class="switch"><input type="checkbox" class="layout-toggle"><span class="switch-track" aria-hidden="true"></span><span>Side by side</span></label></div><div class="compare-grid">${MODELS.map(m => `<div class="stage" data-panel="${m.id}"><div class="stage-bar"><span class="model-tag">${m.name}<span class="badge">${m.tag}</span></span><span class="audio-state"></span></div><div class="screen"><video data-model="${m.id}" playsinline preload="none" aria-label="${m.name} comparison video"></video><span class="buffer-spinner" aria-hidden="true"></span><p class="missing-video" hidden>Video being prepared</p></div></div>`).join('')}</div><div class="transport"><button type="button" class="pair-play" aria-label="Play">${ICON.play}</button><input class="pair-seek" type="range" min="0" max="60" step="0.1" value="0" aria-label="Comparison playback position"><output class="pair-time">0:00 / 0:00</output></div><p class="pair-status" role="status"></p><div class="strip-head"><span>Clips</span><span class="pair-count"></span></div>`;
  const videos = [...root.querySelectorAll('video')];
  const play = root.querySelector('.pair-play'), seek = root.querySelector('.pair-seek'), time = root.querySelector('.pair-time');
  const status = root.querySelector('.pair-status'), toggle = root.querySelector('.layout-toggle');
  const strip = thumbStrip(scenes.map((s, i) => ({poster: s.ours.poster, duration: s.ours.duration, label: `Comparison clip ${i + 1}`})), 'Comparison clips', i => { index = i; render(true); });
  root.append(strip.el);
  videos.forEach(v => players.add(v));
  const scene = () => scenes[index];
  const byId = id => videos.find(v => v.dataset.model === id);
  const available = () => videos.filter(v => scene()[v.dataset.model]);
  // Only the model being heard plays in single view; side by side runs both, clocked by the audible one.
  const active = () => available().filter(v => sideBySide || v.dataset.model === activeAudio);
  const master = () => byId(activeAudio);
  const loaded = v => !!v.getAttribute('src');
  function commonDuration() {
    const lengths = available().map(v => (v.readyState > 0 && Number.isFinite(v.duration) ? v.duration : scene()[v.dataset.model].duration)).filter(d => Number.isFinite(d) && d > 0);
    return lengths.length ? Math.min(...lengths) : 0;
  }
  function showTime(t) {
    const total = commonDuration();
    t = Math.max(0, Math.min(t, total));
    seek.max = total; seek.value = t;
    seek.style.setProperty('--p', `${total ? (t / total) * 100 : 0}%`);
    time.textContent = `${clock(t)} / ${clock(total)}`;
  }
  function setPlaying(on) {
    play.innerHTML = on ? ICON.pause : ICON.play;
    play.setAttribute('aria-label', on ? 'Pause' : 'Play');
  }
  function setBuffering() {
    root.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('is-buffering', wantPlay && waiting.has(byId(p.dataset.panel))));
  }
  function ensureSrc(v) { if (!loaded(v)) { v.preload = 'auto'; v.src = scene()[v.dataset.model].src; } }
  function seekTo(v, t) {
    t = Math.max(0, Math.min(t, commonDuration()));
    if (v.readyState > 0) { if (Math.abs(v.currentTime - t) > .03) v.currentTime = t; }
    else v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(t, commonDuration()); }, {once: true});
  }
  function syncPos() { const m = master(); if (m && loaded(m) && m.readyState > 0) pos = m.currentTime; }
  function stop() { wantPlay = false; waiting.clear(); videos.forEach(v => { v.pause(); v.playbackRate = 1; }); setPlaying(false); setBuffering(); }
  async function run() {
    const set = active();
    videos.forEach(v => { if (!set.includes(v)) v.pause(); });
    set.forEach(v => { ensureSrc(v); seekTo(v, pos); });
    if (waiting.size) return;
    try { await Promise.all(set.map(v => v.play())); status.textContent = ''; }
    catch { if (wantPlay) { stop(); status.textContent = 'Playback could not start. Please try again.'; } }
  }
  function start() {
    players.forEach(v => { if (!videos.includes(v)) v.pause(); });
    if (pos >= commonDuration() - .05) pos = 0;
    wantPlay = true; setPlaying(true); run();
  }
  function finish() { stop(); pos = commonDuration(); videos.forEach(v => { if (loaded(v) && v.readyState > 0) seekTo(v, pos); }); showTime(pos); }
  function audio() {
    videos.forEach(v => { v.muted = v.dataset.model !== activeAudio; });
    root.querySelectorAll('[data-audio]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.audio === activeAudio)));
    root.dataset.active = activeAudio;
    root.classList.toggle('single-view', !sideBySide);
    root.classList.toggle('side-by-side', sideBySide);
    root.querySelectorAll('[data-panel]').forEach(panel => {
      const on = panel.dataset.panel === activeAudio;
      panel.hidden = !sideBySide && !on;
      panel.classList.toggle('has-audio', on);
      panel.querySelector('.audio-state').innerHTML = on ? `${ICON.sound}Audio on` : `${ICON.mute}Muted`;
    });
    toggle.checked = sideBySide;
  }
  function render(reveal) {
    stop(); pos = 0; const s = scene();
    if (!s[activeAudio]) activeAudio = 'ours';
    videos.forEach(v => { v.removeAttribute('src'); v.preload = 'none'; v.load(); const item = s[v.dataset.model]; v.poster = item?.poster || s.ours.poster; v.hidden = !item; v.parentElement.querySelector('.missing-video').hidden = !!item; });
    showTime(0);
    play.disabled = !s.proact; seek.disabled = !s.proact;
    status.textContent = s.proact ? '' : 'Proact-VL narration is being prepared for this clip.';
    root.querySelector('[data-audio="proact"]').disabled = !s.proact;
    root.querySelector('.pair-count').textContent = `${pad(index + 1)} / ${pad(scenes.length)}`;
    strip.select(index, reveal);
    audio();
  }
  play.addEventListener('click', () => { if (wantPlay) { syncPos(); stop(); } else start(); });
  seek.addEventListener('input', () => {
    pos = Math.min(Number(seek.value), commonDuration());
    active().forEach(v => { if (loaded(v) || wantPlay) { ensureSrc(v); seekTo(v, pos); } });
    showTime(pos);
  });
  videos.forEach(v => {
    v.addEventListener('timeupdate', () => {
      if (v !== master() || !wantPlay) return;
      pos = v.currentTime;
      if (pos >= commonDuration() - .02) { finish(); return; }
      showTime(pos);
      // Keep the muted panel in step: nudge its speed for small drift, jump only for large drift.
      if (sideBySide) active().forEach(o => {
        if (o === v || o.readyState < 2 || o.paused) return;
        const d = o.currentTime - pos;
        if (Math.abs(d) > .4) { o.currentTime = pos; o.playbackRate = 1; }
        else o.playbackRate = Math.abs(d) > .06 ? (d > 0 ? .94 : 1.06) : 1;
      });
    });
    // If either stream stalls, hold the other one until both have data again.
    v.addEventListener('waiting', () => {
      if (!wantPlay || !active().includes(v)) return;
      waiting.add(v); active().forEach(o => { if (o !== v) o.pause(); }); setBuffering();
    });
    v.addEventListener('canplay', () => {
      if (!waiting.delete(v)) return;
      setBuffering();
      if (wantPlay && !waiting.size) { syncPos(); run(); }
    });
    v.addEventListener('playing', () => { if (waiting.delete(v)) setBuffering(); });
    v.addEventListener('pause', () => { if (v === master() && wantPlay && !waiting.size && !v.ended) { syncPos(); stop(); } });
    v.addEventListener('ended', () => { if (wantPlay && v === master()) finish(); });
    v.addEventListener('loadedmetadata', () => showTime(pos));
    v.addEventListener('error', () => { if (loaded(v)) { stop(); status.textContent = 'Video unavailable. Please retry or select another clip.'; } });
  });
  root.querySelectorAll('[data-audio]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.audio === activeAudio) return;
    syncPos(); waiting.clear();
    activeAudio = b.dataset.audio; audio();
    if (wantPlay) run(); else active().forEach(v => { if (loaded(v)) seekTo(v, pos); });
    setBuffering();
  }));
  toggle.addEventListener('change', () => {
    syncPos(); waiting.clear();
    sideBySide = toggle.checked; audio();
    if (wantPlay) run();
    setBuffering();
  });
  render(false);
}

// Highlight the section currently in view in the top bar.
function trackSections() {
  const links = [...document.querySelectorAll('.topbar-links a')];
  if (!('IntersectionObserver' in window) || !links.length) return;
  const byId = new Map(links.map(a => [a.hash.slice(1), a]));
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    links.forEach(a => a.removeAttribute('aria-current'));
    byId.get(entry.target.id)?.setAttribute('aria-current', 'true');
  }), {rootMargin: '-45% 0px -50% 0px'});
  ['top', ...byId.keys()].forEach(id => { const section = document.getElementById(id); if (section) observer.observe(section); });
}

document.addEventListener('visibilitychange', () => { if (document.hidden) players.forEach(v => v.pause()); });
trackSections();

fetch('assets/demos.json', {cache: 'no-store'}).then(r => { if (!r.ok) throw Error('manifest'); return r.json(); }).then(demos => {
  document.querySelectorAll('.demo-player').forEach(root => createDemo(root, demos.filter(d => d.game === root.dataset.game)));
}).catch(() => document.querySelectorAll('.demo-player').forEach(root => { root.textContent = 'Demos unavailable. Please reload the page.'; }));

fetch('assets/comparisons.json', {cache: 'no-store'}).then(r => { if (!r.ok) throw Error('manifest'); return r.json(); })
  .then(scenes => createComparison(document.querySelector('#comparison-player'), scenes))
  .catch(() => { document.querySelector('#comparison-player').textContent = 'Comparison videos are being prepared.'; });
