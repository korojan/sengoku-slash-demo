// 戦国スラッシュ 体験版（iOSジェスチャ＋BGM/SE）
// 操作：ドラッグ＝左右移動／タップ＝ショット／長押し＝連射／フリック左右＝ダッシュ
(() => {
  const W = 450, H = 600;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const state = {
    running: true,
    timeLeft: 60,
    score: 0,
    player: { x: W/2, y: H-50, w: 32, h: 14, speed: 220 },
    shots: [], enemies: [], lastSpawn: 0, spawnInterval: 500, lastShot: 0, keys: {},
    // gesture
    autoFire: false, lastAutoFire: 0, autoFireInterval: 120,
    dashUntil: 0, dashTarget: null, dashSpeed: 900,
    // audio
    audioReady: false, muted: false, bgm: null, se: null,
  };

  // ===== Audio =====
  async function ensureAudio(){
    if (state.audioReady) return;
    try{
      const r1 = await fetch('assets/bgm.mp3');
      if (r1.ok){
        const b = await r1.blob();
        state.bgm = new Audio(URL.createObjectURL(b));
        state.bgm.loop = true;
        state.bgm.volume = 0.35;
      }
    }catch(e){}
    try{
      const r2 = await fetch('assets/slash.wav');
      if (r2.ok){
        const b = await r2.blob();
        state.se = new Audio(URL.createObjectURL(b));
        state.se.volume = 0.8;
      }
    }catch(e){}
    state.audioReady = true;
  }
  async function kickAudio(){
    await ensureAudio();
    if (!state.muted && state.bgm){
      try{ await state.bgm.play(); }catch(e){}
    }
  }
  function playSE(){
    if (state.muted || !state.se) return;
    try{ state.se.currentTime = 0; state.se.play(); }catch(e){}
  }

  const muteBtn = document.getElementById('mute');
  function updateMuteButton(){ muteBtn.textContent = state.muted ? '♪ OFF' : '♪ ON'; }
  muteBtn.addEventListener('click', async (e)=>{
    e.stopPropagation();
    state.muted = !state.muted;
    updateMuteButton();
    await ensureAudio();
    if (state.muted){ if (state.bgm) state.bgm.pause(); }
    else { if (state.bgm) { try{ await state.bgm.play(); }catch(e){} } }
  });
  updateMuteButton();
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){ if (state.bgm) state.bgm.pause(); }
    else { if (!state.muted && state.bgm) state.bgm.play().catch(()=>{}); }
  });

  // ===== Keyboard fallback (PC) =====
  window.addEventListener('keydown', e=> state.keys[e.code]=true);
  window.addEventListener('keyup', e=> state.keys[e.code]=false);

  // ===== Touch / Pointer (iOS) =====
  const wrap = document.getElementById('wrap');
  let touchStartX=0, touchStartY=0, touchStartTime=0, lastTouchX=null;
  const TAP_TIME=200, TAP_MOVE=10, HOLD_TIME=350;
  // フリックを“弱め”に：素早く＆長いスライドのみダッシュ
  const FLICK_TIME=150, FLICK_DISTANCE=100, DASH_OFFSET=90;

  const pointerToCanvasX = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    return Math.max(20, Math.min(W-20, x));
  };

  function startAutoFire(){ state.autoFire = true; state.lastAutoFire = 0; }
  function stopAutoFire(){ state.autoFire = false; }

  function handleStart(e){
    const t = e.changedTouches ? e.changedTouches[0] : e;
    touchStartX = t.clientX; touchStartY = t.clientY; touchStartTime = performance.now();
    lastTouchX = t.clientX;
    state.player.x = pointerToCanvasX(lastTouchX);
    kickAudio(); // 初回タップでBGM起動
    clearTimeout(handleStart.holdTimer);
    handleStart.holdTimer = setTimeout(()=> startAutoFire(), HOLD_TIME);
  }
  function handleMove(e){
    e.preventDefault(); // スクロール抑止
    const t = e.changedTouches ? e.changedTouches[0] : e;
    lastTouchX = t.clientX;
    state.player.x = pointerToCanvasX(lastTouchX);
  }
  function handleEnd(e){
    clearTimeout(handleStart.holdTimer);
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const dt = performance.now() - touchStartTime;
    const dx = t.clientX - touchStartX;
    const adx = Math.abs(dx);
    const ady = Math.abs(t.clientY - touchStartY);

    // フリック → ダッシュ
    if (dt <= FLICK_TIME && adx >= FLICK_DISTANCE && ady < 60){
      const dir = dx > 0 ? 1 : -1;
      const target = Math.max(20, Math.min(W-20, state.player.x + dir*DASH_OFFSET));
      state.dashTarget = target;
      state.dashUntil = performance.now() + 160;
      stopAutoFire();
      lastTouchX = null;
      return;
    }
    // タップ → 単発ショット
    if (dt <= TAP_TIME && adx < TAP_MOVE && ady < TAP_MOVE){
      shoot(performance.now());
    }
    stopAutoFire();
    lastTouchX = null;
  }

  wrap.addEventListener('touchstart', handleStart, {passive:false});
  wrap.addEventListener('touchmove', handleMove, {passive:false});
  wrap.addEventListener('touchend', handleEnd, {passive:false});
  // マウス/ペン
  wrap.addEventListener('pointerdown', (e)=>{ state.player.x = pointerToCanvasX(e.clientX); kickAudio(); });
  wrap.addEventListener('pointermove', (e)=>{ if (e.pressure>0 || e.buttons===1) state.player.x = pointerToCanvasX(e.clientX); });
  wrap.addEventListener('pointerup', ()=>{ stopAutoFire(); });

  // ===== Game core =====
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');

  function spawnEnemy(t){
    const x = 30 + Math.random()*(W-60);
    const speed = 40 + Math.random()*40;
    state.enemies.push({ x, y: -20, w: 20, h: 16, speed });
  }
  function shoot(t){
    if (t - state.lastShot < 200) return;
    state.lastShot = t;
    state.shots.push({ x: state.player.x, y: state.player.y-10, vy: -360 });
    playSE();
  }

  function update(dt, t){
    if (!state.running) return;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0){ state.running=false; }
    timeEl.textContent = 'TIME: ' + Math.max(0, state.timeLeft|0);

    if (t - state.lastSpawn > state.spawnInterval){
      state.lastSpawn = t; spawnEnemy(t);
      state.spawnInterval = Math.max(220, 500 - state.score*2);
    }

    // ダッシュ移動
    if (state.dashTarget != null){
      const dir = state.dashTarget > state.player.x ? 1 : -1;
      const step = state.dashSpeed * dt * dir;
      if ((dir>0 && state.player.x + step >= state.dashTarget) || (dir<0 && state.player.x + step <= state.dashTarget)){
        state.player.x = state.dashTarget; state.dashTarget = null;
      } else { state.player.x = state.player.x + step; }
      if (performance.now() > state.dashUntil) state.dashTarget = null;
      state.player.x = Math.max(20, Math.min(W-20, state.player.x));
    }

    // キーボード（PC）
    let vx = 0;
    if (state.keys['ArrowLeft']) vx -= state.player.speed;
    if (state.keys['ArrowRight']) vx += state.player.speed;
    state.player.x = Math.max(20, Math.min(W-20, state.player.x + vx*dt));
    if (state.keys['Space']) shoot(t);

    // 長押し連射
    if (state.autoFire){
      if (t - state.lastAutoFire > state.autoFireInterval){
        state.lastAutoFire = t;
        if (t - state.lastShot > 100) state.lastShot = t - 120;
        shoot(t);
      }
    }

    // 弾＆敵
    state.shots.forEach(s => s.y += s.vy*dt);
    state.shots = state.shots.filter(s => s.y > -20);
    state.enemies.forEach(e => { e.y += e.speed*dt; });

    // 当たり判定
    for (let i=state.enemies.length-1;i>=0;i--){
      const e = state.enemies[i];
      if (Math.abs(e.x - state.player.x) < 26 && Math.abs(e.y - state.player.y) < 18){
        state.timeLeft = Math.max(0, state.timeLeft - 3); state.enemies.splice(i,1); continue;
      }
      for (let j=state.shots.length-1;j>=0;j--){
        const s = state.shots[j];
        if (Math.abs(e.x - s.x) < 10 && Math.abs(e.y - s.y) < 8){
          state.shots.splice(j,1); state.enemies.splice(i,1);
          state.score += 10; scoreEl.textContent = 'SCORE: ' + state.score; break;
        }
      }
      if (e.y > H+20) state.enemies.splice(i,1);
    }
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    const g = ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#1b1a17'); g.addColorStop(1,'#2c1f1a');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=0.06; ctx.fillStyle='#f2d3a2';
    for(let r=40;r<260;r+=40){ ctx.beginPath(); ctx.arc(W*0.5, H*0.3, r, 0, Math.PI*2); ctx.fill(); }
    ctx.globalAlpha=1;

    ctx.fillStyle = '#e8e0cf'; drawSamurai(ctx, state.player.x, state.player.y);
    ctx.fillStyle = '#f6d061';
    state.shots.forEach(s => { ctx.beginPath(); ctx.moveTo(s.x, s.y-8); ctx.lineTo(s.x-3, s.y+8); ctx.lineTo(s.x+3, s.y+8); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = '#b94e48'; state.enemies.forEach(e => drawKasaEnemy(ctx, e.x, e.y));

    if (!state.running){
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 28px system-ui';
      ctx.fillText('体験版 終了', W/2, H/2 - 10);
      ctx.font='16px system-ui';
      ctx.fillText('製品版では制限なし & 追加要素', W/2, H/2 + 20);
      ctx.fillText('ページを再読み込みで再挑戦', W/2, H/2 + 42);
    }
  }
  function drawSamurai(ctx, x, y){ ctx.fillRect(x-10, y-6, 20, 12); ctx.beginPath(); ctx.arc(x, y-12, 6, 0, Math.PI*2); ctx.fill(); ctx.fillRect(x+8, y-10, 18, 3); }
  function drawKasaEnemy(ctx, x, y){ ctx.beginPath(); ctx.moveTo(x-12,y); ctx.lineTo(x+12,y); ctx.lineTo(x, y-10); ctx.closePath(); ctx.fill(); ctx.fillRect(x-6, y, 12, 12); }

  let last = performance.now();
  function loop(now){ const dt = Math.min(0.05, (now - last)/1000); last = now; update(dt, now); draw(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
})();
