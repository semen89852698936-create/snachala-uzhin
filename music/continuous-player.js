/* СНАЧАЛА УЖИН: независимый непрерывный плеер. Источник аудио - только локальные лицензированные записи. */
(() => {
  'use strict';
  const script = document.currentScript;
  const manifestUrl = new URL('licensed-tracks.json', script.src);
  const rootUrl = new URL('../', script.src);
  const bounds = { cooking: [120, Infinity], dinner: [80, 100], continue: [0, 80] };
  const names = { cooking: 'Под что готовить', dinner: 'Под что ужинать', continue: 'Под что продолжить' };
  const phases = ['cooking', 'dinner', 'continue'];
  const styles = document.createElement('style');
  styles.textContent = `
    .du-local-player{border-top:1px solid rgba(131,81,105,.18);margin-top:16px;padding-top:16px;font-family:var(--sans,Arial,sans-serif);color:#634454}
    .du-local-player .du-local-title{font-size:14px;font-weight:800;line-height:1.5;overflow-wrap:anywhere}
    .du-local-player .du-local-controls{display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap}
    .du-local-player button{cursor:pointer;border:1px solid #ba9ba8;color:#633d51;background:#fff8f6;border-radius:999px;min-width:44px;min-height:44px;font-size:19px}
    .du-local-player button.du-local-toggle{background:#74495d;color:white;border-color:#74495d;min-width:64px;font-size:15px;font-weight:800}
    .du-local-player button:focus-visible{outline:3px solid #b26485;outline-offset:3px}
    .du-local-player input[type=range]{width:100%;accent-color:#74495d;min-height:28px}
    .du-local-player .du-local-meta{font-size:12px;line-height:1.6;color:#765866;display:flex;justify-content:space-between;gap:10px}
    .du-local-player .du-local-error{font-size:13px;color:#9a3434;min-height:1em}
    .du-local-player .du-local-credit{margin-top:10px;font-size:11px;line-height:1.5}
    .du-local-player .du-local-credit a{color:inherit;text-decoration:underline}
  `;
  document.head.appendChild(styles);
  const audio = new Audio();
  audio.preload = 'auto';
  let active = null, index = 0, groups = {}, views = {};
  const duration = n => Number.isFinite(n) ? Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0') : '0:00';
  const safe = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tracks = () => groups[active] || [];
  const draw = () => {
    for (const [phase, el] of Object.entries(views)) {
      const playing = phase === active && !audio.paused;
      el.querySelector('.du-local-toggle').textContent = playing ? '❚❚ Пауза' : '▶ Слушать';
      const t = phase === active ? tracks()[index] : groups[phase][0];
      el.querySelector('.du-local-title').textContent = t ? t.title + ' · ' + t.artist : names[phase];
      el.querySelector('.du-local-position').textContent = (phase === active ? index + 1 : 1) + ' из ' + groups[phase].length;
      el.querySelector('.du-local-credit').innerHTML = t && t.licenseUrl ?
        'Музыка: ' + safe(t.artist) + ' · <a target="_blank" rel="noopener noreferrer" href="' + safe(t.licenseUrl) + '">Лицензия</a>' +
        (t.sourceUrl ? ' · <a target="_blank" rel="noopener noreferrer" href="' + safe(t.sourceUrl) + '">Автор</a>' : '') : '';
      if (phase !== active) {
        el.querySelector('input').value = 0;
        el.querySelector('.du-local-time').textContent = '0:00 / 0:00';
      }
    }
  };
  const playIndex = async (phase, number) => {
    if (!groups[phase]?.length) return;
    active = phase;
    index = ((number % groups[phase].length) + groups[phase].length) % groups[phase].length;
    const track = groups[phase][index];
    audio.src = new URL(track.src, rootUrl).href;
    audio.load();
    views[phase].querySelector('.du-local-error').textContent = '';
    draw();
    try { await audio.play(); } catch (error) {
      views[phase].querySelector('.du-local-error').textContent = 'Не удалось запустить запись. Нажми «Слушать» ещё раз.';
    }
    draw();
  };
  const onToggle = phase => {
    if (active !== phase) return void playIndex(phase, 0);
    if (audio.paused) audio.play().catch(() => {
      views[phase].querySelector('.du-local-error').textContent = 'Браузер не разрешил воспроизведение.';
    });
    else audio.pause();
    draw();
  };
  audio.addEventListener('ended', () => { if (active) playIndex(active, index + 1); });
  audio.addEventListener('play', draw);
  audio.addEventListener('pause', draw);
  audio.addEventListener('error', () => {
    if (active && views[active]) views[active].querySelector('.du-local-error').textContent = 'Запись недоступна. Проверь подключение.';
  });
  audio.addEventListener('timeupdate', () => {
    if (!active || !views[active]) return;
    const el = views[active], slider = el.querySelector('input');
    slider.value = Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.currentTime / audio.duration * 1000) : 0;
    el.querySelector('.du-local-time').textContent = duration(audio.currentTime) + ' / ' + duration(audio.duration);
  });
  fetch(manifestUrl).then(r => { if (!r.ok) throw Error('manifest'); return r.json(); }).then(data => {
    phases.forEach(phase => {
      groups[phase] = (data.playlists?.[phase] || []).filter(t =>
        t && typeof t.src === 'string' && /^music\/licensed\/[\w.\-]+\.(mp3|ogg|m4a)$/.test(t.src) &&
        t.licenseVerified === true && Number.isFinite(t.bpm) && t.bpm >= bounds[phase][0] && t.bpm <= bounds[phase][1]);
    });
    const cards = [...document.querySelectorAll('.du-music-card[data-music-phase]')];
    cards.forEach(card => {
      const phase = card.dataset.musicPhase;
      if (!groups[phase]?.length) return;
      const container = document.createElement('section');
      container.className = 'du-local-player';
      container.setAttribute('aria-label', 'Музыкальный плеер: ' + names[phase]);
      container.innerHTML = '<div class="du-local-title"></div><div class="du-local-controls"><button type="button" class="du-local-prev" aria-label="Предыдущая песня">⏮</button><button type="button" class="du-local-toggle">▶ Слушать</button><button type="button" class="du-local-next" aria-label="Следующая песня">⏭</button></div><input type="range" min="0" max="1000" value="0" aria-label="Позиция воспроизведения"><div class="du-local-meta"><span class="du-local-position"></span><span class="du-local-time">0:00 / 0:00</span></div><div class="du-local-error" role="status" aria-live="polite"></div><div class="du-local-credit"></div>';
      card.appendChild(container);
      views[phase] = container;
      container.querySelector('.du-local-toggle').addEventListener('click', () => onToggle(phase));
      container.querySelector('.du-local-prev').addEventListener('click', () => playIndex(phase, phase === active ? index - 1 : 0));
      container.querySelector('.du-local-next').addEventListener('click', () => playIndex(phase, phase === active ? index + 1 : 0));
      container.querySelector('input').addEventListener('input', e => {
        if (phase === active && Number.isFinite(audio.duration)) audio.currentTime = Number(e.target.value) / 1000 * audio.duration;
      });
      const old = card.querySelector('.du-music-spotify-extra');
      if (old) old.hidden = true;
    });
    draw();
  }).catch(() => { /* Старый сайт оставляем без изменений, если каталог недоступен. */ });
})();
