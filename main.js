// 体験版（assets は任意。GitHubでフォルダ維持するためのプレースホルダを同梱）
(() => {
  const W = 450, H = 600;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const st = { running:true, timeLeft:60, score:0, player:{x:W/2,y:H-50,w:32,h:14,speed:220},
               shots:[], enemies:[], lastSpawn:0, spawnInterval:500, lastShot:0, keys:{} };
  onkeydown=e=>st.keys[e.code]=true; onkeyup=e=>st.keys[e.code]=false;
  let l=false,r=false,a=false;
  const g=(id)=>document.getElementById(id);
  [['left',v=>l=v],['right',v=>r=v],['act',v=>a=v]].forEach(([id,set])=>{
    const el=g(id), d=()=>set(true), u=()=>set(false);
    el.addEventListener('pointerdown',d); el.addEventListener('pointerup',u); el.addEventListener('pointerleave',u);
    el.addEventListener('touchstart',e=>{d();e.preventDefault();},{passive:false});
    el.addEventListener('touchend',e=>{u();e.preventDefault();},{passive:false});
    el.addEventListener('mousedown',d); el.addEventListener('mouseup',u);
  });
  let sa=null,bgm=null;
  fetch('assets/slash.wav').then(r=>r.ok?r.blob():Promise.reject()).then(b=>new Audio(URL.createObjectURL(b))).then(a=>sa=a).catch(()=>{});
  fetch('assets/bgm.mp3').then(r=>r.ok?r.blob():Promise.reject()).then(b=>{bgm=new Audio(URL.createObjectURL(b));bgm.loop=true;bgm.volume=.35;bgm.play().catch(()=>{});}).catch(()=>{});
  const sEl=g('score'), tEl=g('time');
  const spawn=()=>{ const x=30+Math.random()*(W-60), sp=40+Math.random()*40; st.enemies.push({x,y:-20,w:20,h:16,speed:sp}); };
  const shoot=(t)=>{ if (t-st.lastShot<200) return; st.lastShot=t; st.shots.push({x:st.player.x,y:st.player.y-10,vy:-360}); if(sa){try{sa.currentTime=0;sa.play();}catch(e){}} };
  function upd(dt,t){
    if(!st.running) return;
    st.timeLeft-=dt; if(st.timeLeft<=0) st.running=false; tEl.textContent='TIME: '+Math.max(0, st.timeLeft|0);
    if(t-st.lastSpawn>st.spawnInterval){ st.lastSpawn=t; spawn(); st.spawnInterval=Math.max(220,500-st.score*2); }
    const goL=st.keys['ArrowLeft']||l, goR=st.keys['ArrowRight']||r; let vx=0; if(goL)vx-=st.player.speed; if(goR)vx+=st.player.speed;
    st.player.x=Math.max(20,Math.min(W-20,st.player.x+vx*dt));
    if(st.keys['Space']||a) shoot(t);
    st.shots.forEach(s=>s.y+=s.vy*dt); st.shots=st.shots.filter(s=>s.y>-20); st.enemies.forEach(e=>e.y+=e.speed*dt);
    for(let i=st.enemies.length-1;i>=0;i--){ const e=st.enemies[i];
      if(Math.abs(e.x-st.player.x)<26&&Math.abs(e.y-st.player.y)<18){ st.timeLeft=Math.max(0,st.timeLeft-3); st.enemies.splice(i,1); continue; }
      for(let j=st.shots.length-1;j>=0;j--){ const s=st.shots[j];
        if(Math.abs(e.x-s.x)<10&&Math.abs(e.y-s.y)<8){ st.shots.splice(j,1); st.enemies.splice(i,1); st.score+=10; sEl.textContent='SCORE: '+st.score; break; } }
      if(e.y>H+20) st.enemies.splice(i,1);
    }
  }
  function draw(t){
    ctx.clearRect(0,0,W,H);
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#1b1a17'); g.addColorStop(1,'#2c1f1a'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.06; ctx.fillStyle='#f2d3a2'; for(let r=40;r<260;r+=40){ ctx.beginPath(); ctx.arc(W*.5, H*.3, r, 0, Math.PI*2); ctx.fill(); } ctx.globalAlpha=1;
    ctx.fillStyle='#e8e0cf'; ctx.fillRect(st.player.x-10, st.player.y-6, 20,12); ctx.beginPath(); ctx.arc(st.player.x, st.player.y-12, 6, 0, Math.PI*2); ctx.fill(); ctx.fillRect(st.player.x+8, st.player.y-10, 18,3);
    ctx.fillStyle='#f6d061'; st.shots.forEach(s=>{ ctx.beginPath(); ctx.moveTo(s.x, s.y-8); ctx.lineTo(s.x-3, s.y+8); ctx.lineTo(s.x+3, s.y+8); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle='#b94e48'; st.enemies.forEach(e=>{ ctx.beginPath(); ctx.moveTo(e.x-12,e.y); ctx.lineTo(e.x+12,e.y); ctx.lineTo(e.x,e.y-10); ctx.closePath(); ctx.fill(); ctx.fillRect(e.x-6,e.y,12,12); });
    if(!st.running){ ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 28px system-ui'; ctx.fillText('体験版 終了', W/2, H/2-10); ctx.font='16px system-ui'; ctx.fillText('製品版では制限なし & 追加要素', W/2, H/2+20); ctx.fillText('再読み込みで再挑戦', W/2, H/2+42); }
  }
  let last=performance.now(); (function loop(now){ const dt=Math.min(.05,(now-last)/1000); last=now; upd(dt,now); draw(now); requestAnimationFrame(loop); })(last);
})();