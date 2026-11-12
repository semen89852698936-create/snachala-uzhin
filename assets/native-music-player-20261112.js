/* СНАЧАЛА УЖИН / newspaper music player.
   Plays only explicitly allowed CC BY 4.0 recordings listed in the manifest.
   Credit and license information: /music/credits.html.
   Existing site layout and editorial playlists remain unchanged. */
(() => {
  'use strict';
  if (window.__duNewspaperPlayerInstalled) return;
  window.__duNewspaperPlayerInstalled = true;
  const ROOT = '/assets/';
  const PHASES = ['kitchen', 'dinner', 'after'];
  const DEMO_SECONDS = 14;
  const state = {
    manifest:null, phase:'kitchen', index:0, playing:false, started:false,
    elapsed:0, volume:.65, ctx:null, master:null, voices:[], audio:null,
    anchor:0, clock:null, pending:false, panelOpen:false,
    error:'', demo:true
  };
  const $ = (s,root=document) => root.querySelector(s);
  const $$ = (s,root=document) => [...root.querySelectorAll(s)];
  const phaseData = () => state.manifest?.playlists[state.phase];
  const tracks = () => phaseData()?.tracks || [];
  const current = () => tracks()[state.index];
  const duration = () => {
    if (!state.demo && state.audio && Number.isFinite(state.audio.duration) && state.audio.duration > 0) return state.audio.duration;
    return Number(current()?.durationSeconds) || (state.demo ? DEMO_SECONDS : 0);
  };
  const timeText = sec => {
    sec=Math.max(0,Math.floor(Number(sec)||0));
    return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
  };
  function announce(msg) {
    state.error=msg;
    $$('.du-np-feedback').forEach(el => { el.textContent=msg; el.hidden=!msg; });
  }
  function installStyles() {
    if ($('#du-newspaper-style')) return;
    const link=document.createElement('link');
    link.id='du-newspaper-style'; link.rel='stylesheet';
    link.href=ROOT+'native-music-player-20261112.css';
    document.head.appendChild(link);
  }
  function trackInfo() {
    const item=current();
    return item ? item.title : 'Тестовая запись';
  }
  function stopVoices() {
    state.voices.forEach(v => { try{v.stop();}catch(_){} try{v.disconnect();}catch(_){} });
    state.voices.length=0;
  }
  function stopEngine() {
    stopVoices();
    if(state.audio) state.audio.pause();
    // Reuse the same HTMLAudioElement for uninterrupted next-track playback.
  }
  function ctxTime() { return state.ctx?.currentTime || 0; }
  function position() {
    if(!state.playing) return state.elapsed;
    if(state.demo) return Math.min(duration(),Math.max(0,ctxTime()-state.anchor));
    if (!state.audio) return state.elapsed;
    const d = duration();
    return d > 0 ? Math.min(d,state.audio.currentTime) : state.audio.currentTime;
  }
  function padNote(midi,t,len,level,type='sine') {
    const ctx=state.ctx, master=state.master;
    if(!ctx||!master || len<.055 || t+len<ctx.currentTime) return;
    const oscillator=ctx.createOscillator(), envelope=ctx.createGain();
    oscillator.type=type;
    oscillator.frequency.value=440*Math.pow(2,(midi-69)/12);
    envelope.gain.setValueAtTime(.0001,t);
    envelope.gain.linearRampToValueAtTime(level,t+.035);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,level*.45),Math.max(t+.06,t+len*.55));
    envelope.gain.exponentialRampToValueAtTime(.0001,t+len);
    oscillator.connect(envelope);envelope.connect(master);
    oscillator.start(t);oscillator.stop(t+len+.015);
    state.voices.push(oscillator);
  }
  function synthesizeDemo(track, offset) {
    const bpm=Number(track.bpm)||90, beat=60/bpm, seed=Number(track.seed)||12;
    const root=bpm>115?50:bpm>80?45:43;
    const quality=bpm>115?[0,4,7,12]:[0,3,7,12];
    const progressions=[0,5,7,3,0,7,5,3], melodic=[0,7,4,12,9,7,4,3,0,5,7,4];
    const start=ctxTime()+.055,base=start-offset;
    state.anchor=base;
    let bar=-1;
    for(let n=0;n*beat<duration();n++){
      const seconds=n*beat;
      if(seconds<offset-.1) continue;
      const when=base+seconds;
      if(when<ctxTime()+.01) continue;
      const newBar=Math.floor(n/4);
      if(newBar!==bar){
        bar=newBar;
        const progression=progressions[(newBar+seed)%progressions.length];
        for(const degree of quality){
          padNote(root+progression+degree+12,when,Math.min(3.9*beat,duration()-seconds-.02),.018,bpm>115?'triangle':'sine');
        }
      }
      const progression=progressions[(newBar+seed)%progressions.length];
      padNote(root+progression-12,when,Math.min(.55*beat,duration()-seconds-.02),bpm>115?.053:.042,'triangle');
      const note=root+12+progression+melodic[(n+seed)%melodic.length];
      padNote(note,when,Math.min(.8*beat,duration()-seconds-.02),bpm>115?.045:.031,'sine');
      if(bpm>115){
        padNote(79+(n%2),when+.48*beat,Math.min(.10*beat,duration()-seconds-.49*beat),.011,'triangle');
      }
    }
  }
  async function ensureContext() {
    if(state.ctx) return state.ctx;
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context) throw new Error('Этот браузер не поддерживает Web Audio.');
    state.ctx=new Context();
    state.master=state.ctx.createGain();
    state.master.gain.value=state.volume;
    state.master.connect(state.ctx.destination);
    return state.ctx;
  }
  function applyMediaSession() {
    if(!('mediaSession' in navigator)) return;
    const item=current(), chapter=phaseData();
    if(!item||!chapter) return;
    try{
      navigator.mediaSession.metadata=new MediaMetadata({
        title:item.title,artist:'Kevin MacLeod (incompetech.com)',
        album:chapter.label
      });
      navigator.mediaSession.playbackState=state.playing?'playing':'paused';
      navigator.mediaSession.setActionHandler('play',() => {play().catch(()=>{});});
      navigator.mediaSession.setActionHandler('pause',pause);
      navigator.mediaSession.setActionHandler('nexttrack',() => next().catch(()=>{}));
      navigator.mediaSession.setActionHandler('previoustrack',() => previous().catch(()=>{}));
      navigator.mediaSession.setActionHandler('seekto',ev => seek(ev.seekTime||0).catch(()=>{}));
    }catch(_){}
  }
  async function play() {
    const track=current();if(!track)return;
    if(state.pending) return;
    state.pending=true;announce('');
    try{
      state.started=true;
      const verified=!!(track.src && track.license?.streamingAllowed===true);
      if(!verified) throw new Error('Аудиозапись не имеет разрешённого источника.');
      state.demo=false;
      if(!state.audio) {
        state.audio=new Audio();
        state.audio.preload='auto';
        state.audio.addEventListener('ended',()=>next().catch(()=>{}));
        state.audio.addEventListener('loadedmetadata',render);
        state.audio.addEventListener('error',()=>{pause();announce('Аудиофайл сейчас недоступен. Проверь интернет или попробуй другую композицию.');});
      }
      if(state.audio.getAttribute('src')!==track.src) state.audio.src=track.src;
      state.audio.volume=state.volume;
      if(state.elapsed>0) {
        try {state.audio.currentTime=state.elapsed;} catch(_) {}
      }
      await state.audio.play();
      state.playing=true;
      state.panelOpen=true;
      render();
      applyMediaSession();
    }catch(err){
      state.playing=false;
      announce(err?.name==='NotAllowedError'?'Нажми воспроизведение ещё раз, чтобы разрешить звук.':'Не удалось запустить звук: '+String(err?.message||err));
      render();
    }finally{state.pending=false;}
  }
  function pause() {
    if(!state.playing) return;
    state.elapsed=Math.min(duration(),position());
    state.playing=false;
    stopVoices();
    if(state.audio)state.audio.pause();
    render();
    applyMediaSession();
  }
  async function choose(phase,index=0,autoplay=true) {
    if(!state.manifest?.playlists[phase])return;
    stopEngine();state.playing=false;state.phase=phase;
    state.index=Math.min(Math.max(0,index),tracks().length-1);
    state.elapsed=0;state.demo=true;state.error='';
    render();
    if(autoplay)await play();
  }
  async function next(){
    if(!tracks().length)return;
    const following=state.index+1;
    if(following<tracks().length)await choose(state.phase,following,state.playing);
    else { await choose(state.phase,0,state.playing); }
  }
  async function previous(){
    if(!tracks().length)return;
    await choose(state.phase,Math.max(0,state.index-1),state.playing);
  }
  async function seek(seconds){
    const to=Math.max(0,Math.min(duration()-.02,Number(seconds)||0));
    const wasPlaying=state.playing;
    if(wasPlaying)pause();
    state.elapsed=to;
    if(wasPlaying)await play();else render();
  }
  function setVolume(v){
    state.volume=Math.max(0,Math.min(1,Number(v)||0));
    if(state.master)state.master.gain.value=state.volume;
    if(state.audio)state.audio.volume=state.volume;
    render();
  }
  function sheetMarkup(phase) {
    const label=state.manifest?.playlists[phase]?.label || '';
    return '<div class="du-np-shadow"><div class="du-np-sheet" data-np-sheet="'+phase+'">'+
      '<span class="du-np-kicker">НОТНАЯ ХРОНИКА / ВЫРЕЗКА № 0'+(PHASES.indexOf(phase)+1)+'</span>'+
      '<div class="du-np-headline">Ритм <i>вечера</i><span>♫</span></div>'+
      '<p class="du-np-phase-name">'+label+'</p>'+
      '<p class="du-np-trackline" data-np-inline-track="'+phase+'">Музыка Kevin MacLeod · CC BY 4.0</p>'+
      '<button type="button" class="du-np-start" data-np-action="phase" data-np-phase="'+phase+'">▶ Слушать музыку</button>'+
      '<div class="du-np-corner">№ 0'+(PHASES.indexOf(phase)+1)+'</div>'+
    '</div></div>';
  }
  function floatingMarkup() {
    return '<div class="du-np-dock" id="duNewspaperDock">'+
      '<button class="du-np-launcher" id="duNpLauncher" type="button" aria-controls="duNpPanel" aria-expanded="false"><span>♫</span> Музыка</button>'+
      '<section class="du-np-dock-body" id="duNpPanel" aria-label="Собственный музыкальный плеер" hidden>'+
        '<div class="du-np-dock-paper">'+
        '<header class="du-np-top"><div class="du-np-masthead"><small>СНАЧАЛА УЖИН · РАДИО ДЛЯ ДВОИХ</small><strong>МУЗЫКАЛЬНЫЙ <i>ВЕСТНИК</i></strong><span class="du-np-edition">№ 001 · ТРИ ГЛАВЫ · ОДИН ВЕЧЕР</span></div>'+
        '<button class="du-np-close" type="button" data-np-action="close" aria-label="Свернуть плеер">×</button></header>'+
        '<nav class="du-np-tabs" aria-label="Выбери настроение">'+
        '<button type="button" data-np-action="tab" data-np-phase="kitchen">Готовить</button>'+
        '<button type="button" data-np-action="tab" data-np-phase="dinner">Ужинать</button>'+
        '<button type="button" data-np-action="tab" data-np-phase="after">Продолжить</button>'+
        '</nav>'+
        '<div class="du-np-now"><span class="du-np-stamp" id="duNpDemoStamp">CC BY</span>'+
        '<strong id="duNpTrack">Музыкальная газета</strong>'+
        '<small id="duNpSub">Kevin MacLeod · CC BY 4.0</small></div>'+
        '<div class="du-np-transport">'+
        '<button type="button" data-np-action="previous" title="Предыдущий трек" aria-label="Предыдущий трек"><svg class="du-np-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5V19" stroke="#692d42" stroke-width="2" stroke-linecap="round"/><path d="M19 5L8 12L19 19Z" fill="#692d42"/></svg></button>'+
        '<button type="button" class="du-np-main-play" data-np-action="toggle" id="duNpToggle" aria-label="Воспроизвести"><svg class="du-np-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4L20 12L8 20Z" fill="#fff8ef"/></svg></button>'+
        '<button type="button" data-np-action="next" title="Следующий трек" aria-label="Следующий трек"><svg class="du-np-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5V19" stroke="#692d42" stroke-width="2" stroke-linecap="round"/><path d="M5 5L16 12L5 19Z" fill="#692d42"/></svg></button>'+
        '</div>'+
        '<div class="du-np-timeline"><span id="duNpElapsed">0:00</span>'+
        '<input type="range" id="duNpSeek" min="0" max="14" value="0" step=".1" aria-label="Перемотка композиции">'+
        '<span id="duNpTotal">0:14</span></div>'+
        '<div class="du-np-bottom"><label for="duNpVolume">♫ Громкость</label>'+
        '<input type="range" id="duNpVolume" min="0" max="100" value="65" aria-label="Громкость" />'+
        '<span id="duNpCount">01 / 02</span></div>'+
        '<p class="du-np-notice">Kevin MacLeod (incompetech.com) · <a href="/music/credits.html" target="_blank" rel="noopener noreferrer">Авторство и все 40 записей</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>'+ '<button type="button" class="du-np-popout" data-np-action="popout" title="Отдельное окно продолжает играть при переходах по сайту" aria-label="Открыть отдельное музыкальное окно для непрерывного прослушивания">↗ Отдельное окно</button>'+
        '<div class="du-np-print-colophon" aria-hidden="true"><span>СЛУШАЙ. ГОТОВЬ. БУДЬ ВДВОЁМ.</span><span>СПЕЦИАЛЬНЫЙ ВЫПУСК ДЛЯ ВАШЕГО ВЕЧЕРА</span></div>'+ '<p class="du-np-feedback" role="status" hidden></p>'+
        '</div>'+
      '</section>'+
    '</div>';
  }
  function build() {
    $$('#music .du-music-card[data-music-phase]').forEach(card => {
      if($('.du-np-inline',card))return;
      const phase=card.getAttribute('data-music-phase');
      if(!state.manifest.playlists[phase])return;
      const node=document.createElement('div');
      node.className='du-np-inline';node.innerHTML=sheetMarkup(phase);
      const total=$('.du-music-total',card);
      if(total)total.insertAdjacentElement('afterend',node);
      else card.appendChild(node);
    });
    // The embedded Spotify audio is not relevant to the Russian market.
    // Only in the new preview, remove iframe elements and hide their shells.
    $$('#music .du-music-spotify-extra iframe').forEach(node=>node.remove());
    $$('#music .du-music-spotify-extra').forEach(node=>node.hidden=true);
    const legal=$('#music .du-music-legal');
    if(legal) legal.textContent='В нашем плеере 40 записей Kevin MacLeod по Creative Commons Attribution 4.0, с обязательным указанием автора. Другие 20 произведений не воспроизводятся. Условия и ссылки доступны в музыкальном плеере.';
    const dock=document.createElement('div');
    dock.innerHTML=floatingMarkup();
    document.body.appendChild(dock.firstElementChild);
    if(document.body.classList.contains('du-np-standalone'))state.panelOpen=true;
    render();
  }
  function render() {
    const item=current(),label=phaseData()?.label || '';
    const elapsed=position(),currentDuration=duration();
    const playSymbol=state.playing?'<svg class="du-np-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5H11V19H7ZM14 5H18V19H14Z" fill="#fff8ef"/></svg>':'<svg class="du-np-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4L20 12L8 20Z" fill="#fff8ef"/></svg>';
    const launcher=$('#duNpLauncher'),panel=$('#duNpPanel');
    if(!launcher || !panel)return;
    panel.hidden=!state.panelOpen;
    launcher.setAttribute('aria-expanded',String(state.panelOpen));
    launcher.classList.toggle('du-np-is-playing',state.playing);
    launcher.innerHTML='<span>♫</span> '+(state.playing?'Играет':'Музыка');
    const trackEl=$('#duNpTrack'),sub=$('#duNpSub'),toggle=$('#duNpToggle');
    if(trackEl)trackEl.textContent=item?.title||'Музыкальная газета';
    if(sub)sub.textContent=label+(item?' · '+item.bpm+' BPM · Kevin MacLeod':'');
    if(toggle){toggle.innerHTML=playSymbol;toggle.setAttribute('aria-label',state.playing?'Пауза':'Воспроизвести');}
    const seek=$('#duNpSeek');if(seek){seek.max=currentDuration;seek.value=Math.min(currentDuration,elapsed);}
    if($('#duNpElapsed'))$('#duNpElapsed').textContent=timeText(elapsed);
    if($('#duNpTotal'))$('#duNpTotal').textContent=timeText(currentDuration);
    if($('#duNpVolume'))$('#duNpVolume').value=Math.round(state.volume*100);
    if($('#duNpCount'))$('#duNpCount').textContent=
      String(state.index+1).padStart(2,'0')+' / '+String(tracks().length).padStart(2,'0');
    $$('.du-np-tabs button').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.npPhase===state.phase)));
    $$('.du-np-start').forEach(btn=>{
      const selected=btn.dataset.npPhase===state.phase;
      btn.textContent=selected&&state.playing?'Ⅱ Пауза':'▶ Слушать музыку';
      btn.setAttribute('aria-pressed',String(selected&&state.playing));
    });
    $$('.du-np-trackline').forEach(el=>{
      const phase=el.dataset.npInlineTrack;
      const list=state.manifest?.playlists[phase]?.tracks||[];
      el.textContent=phase===state.phase&&state.started?(item?.title||'')+' · '+item?.bpm+' BPM':
        list.length+' композиций Kevin MacLeod';
    });
    if(state.error)announce(state.error);
  }
  function installEvents() {
    document.addEventListener('click',event=>{
      const btn=event.target.closest('[data-np-action], #duNpLauncher');
      if(!btn)return;
      const action=btn.dataset.npAction;
      if(btn.id==='duNpLauncher') {state.panelOpen=!state.panelOpen;render();return;}
      if(action==='close'){state.panelOpen=false;render();return;}
      if(action==='popout') {
        const url='/music/player.html?phase='+encodeURIComponent(state.phase)+'&index='+state.index+'&volume='+Math.round(state.volume*100);
        const windowRef=window.open(url,'duMusicSeparatePlayer','width=480,height=740');
        if(windowRef){pause();state.panelOpen=false;render();}
        else announce('Разреши открытие музыкального окна в настройках браузера.');
        return;
      }
      if(action==='tab'){choose(btn.dataset.npPhase,0,false);state.panelOpen=true;render();return;}
      if(action==='phase'){
        if(state.phase===btn.dataset.npPhase&&state.playing){pause();return;}
        if(state.phase!==btn.dataset.npPhase)choose(btn.dataset.npPhase,0,true).catch(()=>{});
        else play().catch(()=>{});
        return;
      }
      if(action==='toggle'){(state.playing?Promise.resolve(pause()):play()).catch(()=>{});return;}
      if(action==='next'){next().catch(()=>{});return;}
      if(action==='previous'){previous().catch(()=>{});}
    });
    document.addEventListener('input',event=>{
      if(event.target.id==='duNpVolume')setVolume(Number(event.target.value)/100);
      if(event.target.id==='duNpSeek'){$('#duNpElapsed').textContent=timeText(event.target.value);}
    });
    document.addEventListener('change',event=>{
      if(event.target.id==='duNpSeek')seek(event.target.value).catch(()=>{});
    });
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
    window.addEventListener('pagehide',()=>{if(state.playing)pause();});
    state.clock=setInterval(()=>{
      if(state.playing&&state.demo&&position()>=duration()-.035){
        next().catch(()=>{});
        return;
      }
      if(state.playing)render();
    },160);
  }
  async function init() {
    installStyles();
    try{
      const res=await fetch('/music/native-player-manifest.json',{cache:'no-store'});
      if(!res.ok)throw new Error('Манифест не загружен ('+res.status+')');
      const manifest=await res.json();
      if(!manifest.playlists||!PHASES.every(k=>manifest.playlists[k]?.tracks?.length))throw new Error('В манифесте отсутствуют треки.');
      state.manifest=manifest;
      if(document.body.classList.contains('du-np-standalone')){
        const params=new URLSearchParams(location.search);
        const phase=params.get('phase');
        if(phase&&manifest.playlists[phase])state.phase=phase;
        const idx=Number(params.get('index'))||0;
        state.index=Math.max(0,Math.min(manifest.playlists[state.phase].tracks.length-1,idx));
        const volume=Number(params.get('volume'));
        if(Number.isFinite(volume)&&params.has('volume'))state.volume=Math.max(0,Math.min(1,volume/100));
      }
      build();
      installEvents();
      window.duNewspaperPlayer={
        getState:()=>({phase:state.phase,index:state.index,playing:state.playing,
          elapsed:position(),volume:state.volume,demo:state.demo,track:trackInfo()}),
        play,pause,next,previous,choose,seek,setVolume
      };
    }catch(err){
      console.error('Газетный плеер:',err);
      const node=document.createElement('p');
      node.className='du-np-error';node.textContent='Не удалось загрузить музыкальный плеер.';
      $('#music')?.appendChild(node);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
