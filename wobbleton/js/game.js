// ============================================================
//  GAME — WOBBLETON TOWER  (Three.js FPS)
//  6 brick floors of wave survival + an explorable wacky town.
// ============================================================
const Game = (() => {
  let scene, camera, renderer, clock, W;
  const EYE = 1.7;

  // ---------- weapons ----------
  // Shared arsenal — same six weapons as Neon City: Nightfall
  const WEAPONS = [
    { key: 'pistol',  name: 'PISTOL',     color: 0x19f0ff, dmg: 38, rate: 0.23,  auto: false, mode: 'hit',   pellets: 1, spread: 0.008, mag: 12, reserveMax: 9999, recoil: 0.08 },
    { key: 'smg',     name: 'SMG',        color: 0xffd166, dmg: 13, rate: 0.062, auto: true,  mode: 'hit',   pellets: 1, spread: 0.05,  mag: 36, reserveMax: 9999, recoil: 0.04 },
    { key: 'shotgun', name: 'DUAL SHG',   color: 0xff2d95, dmg: 8,  rate: 0.36,  auto: false, mode: 'hit',   pellets: 9, spread: 0.14,  mag: 8,  reserveMax: 9999, recoil: 0.22, dual: true },
    { key: 'gauntlet',name: 'FORCE PUSH', color: 0x19f0ff, dmg: 80, rate: 1.5,   auto: false, mode: 'force', pellets: 1, spread: 0,     mag: 999, reserveMax: 9999, recoil: 0.2, reach: 14, arc: 0.45, knockback: 9 },
    { key: 'plasma',  name: 'PLASMA',     color: 0x9b5cff, dmg: 40, rate: 0.76,  auto: false, mode: 'proj',  pellets: 1, spread: 0.005, mag: 8,  reserveMax: 9999, recoil: 0.18, pspeed: 46, pr: 0.4, splash: 5.5 },
    { key: 'pulse',   name: 'PULSE',      color: 0xff7a18, dmg: 8,  rate: 0.04,  auto: true,  mode: 'proj',  pellets: 1, spread: 0.055, mag: 60, reserveMax: 9999, recoil: 0.03, pspeed: 70, pr: 0.22 },
  ];

  // ---------- runtime state ----------
  const S = {
    yaw: 0, pitch: 0, pos: new THREE.Vector3(0, EYE, 8),
    vel: new THREE.Vector3(), onGround: true,
    hp: 100, maxHp: 100, armor: 0, score: 0, alive: true,
    level: 0, area: 'building', locked: false, transit: false, portalCD: 0,
    wi: 0,                       // weapon index
    mags: [], reserves: [], cd: 0, recoil: 0, reloadT: 0,
    shake: 0, hurt: 0,
    keys: {}, mouseDown: false,
    enemies: [], bullets: [], pickups: [], parts: [],
    zone: null, cleared: {}, buffs: { speed: 0, rapid: 0, shield: 0, double: 0 },
  };

  let viewModels = [], muzzle, vmHolder, muzzleFlash;

  // a soft star/burst texture for muzzle flash + impact sparks
  function flashTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,240,170,0.95)'); g.addColorStop(0.6, 'rgba(255,180,60,0.5)'); g.addColorStop(1, 'rgba(255,140,40,0)');
    x.fillStyle = g; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill();
    // star spikes
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 6;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60); x.stroke(); }
    const t = new THREE.Texture(c); t.needsUpdate = true; return t;
  }

  // ---------- audio (shared SoundManager + music from the main game) ----------
  let snd = null;
  function initAudio() {
    if (snd || typeof SoundManager === 'undefined') return;
    snd = new SoundManager();
    snd.loadSample('shoot', '../uploads/chromascension-lazer-gun-one-shot-542393.mp3');
  }
  function startGameMusic() {
    const gameM = document.getElementById('game-music');
    if (gameM) { gameM.volume = 0.35; gameM.play().catch(() => {}); }
    if (snd) snd.resume();
  }
  initAudio();

  function init(stage) {
    initAudio();
    startGameMusic();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 400);
    // mobile / coarse-pointer devices get a lighter renderer (this is where lag bites)
    const lowPower = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
    S.lowPower = lowPower;
    renderer = new THREE.WebGLRenderer({ antialias: !lowPower, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1 : 1.5));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = lowPower ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
    camera.far = lowPower ? 260 : 400; camera.updateProjectionMatrix();
    document.getElementById('app').appendChild(renderer.domElement);
    clock = new THREE.Clock();

    W = World.build(scene);

    // weapon viewmodels parented to camera
    vmHolder = new THREE.Group(); camera.add(vmHolder); scene.add(camera);
    WEAPONS.forEach((w, i) => {
      const vm = WeaponFactory.build(w.key);
      vm.position.set(0.32, -0.32, -0.7);
      // All weapon models are authored barrel-forward (-z); no flip needed.
      vm.rotation.y = 0;
      vm.scale.setScalar(1.1);
      // dual-wield: second gun in the left hand (always for DUAL SHG,
      // toggled by double-tapping 1 for the pistol)
      if (w.dual || w.key === 'pistol') {
        const second = WeaponFactory.build(w.key);
        second.position.x = -0.58;
        second.visible = !!w.dual;
        vm.add(second); vm.userData.second = second;
      }
      vm.visible = i === 0; vmHolder.add(vm); viewModels.push(vm);
      S.mags[i] = w.mag; S.reserves[i] = w.reserveMax;
    });
    muzzle = new THREE.PointLight(0xffffff, 0, 12, 2); camera.add(muzzle); muzzle.position.set(0.32, -0.2, -1.2);
    // bright muzzle-flash sprite at the barrel
    muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, opacity: 0 }));
    muzzleFlash.scale.setScalar(0.9); muzzleFlash.renderOrder = 999; camera.add(muzzleFlash);

    bindInput();
    layoutView();
    startStage(stage || 'tower');
    addEventListener('resize', onResize);
    HUD.weapon(WEAPONS[0], S.mags[0], S.reserves[0]);
    HUD.hint(true);
    animate();
  }

  // start the player in a chosen stage (called once from init)
  function startStage(stage) {
    if (stage === 'tower' || !W.areas[stage === 'streets' ? 'town' : stage]) {
      S.area = 'building'; S.level = 0; prevArea = 'building';
      S.pos.set(0, EYE, 8); S.yaw = 0;
      startFloor(0);
      return;
    }
    const area = stage === 'streets' ? 'town' : stage;
    const ad = W.areas[area], C = ad.center;
    // toggle remote-area visibility for the chosen stage
    // All areas visible simultaneously — open world
    ['jungle', 'castle', 'maze'].forEach(k => { if (W.areas[k].group) W.areas[k].group.visible = true; });
    // hand-picked safe spawn just inside each area, facing its centre
    let off;
    if (area === 'town') off = new THREE.Vector3(0, 0, 42);
    else if (area === 'jungle') off = new THREE.Vector3(-40, 0, 0);
    else if (area === 'castle') off = new THREE.Vector3(40, 0, 0);
    else off = new THREE.Vector3(0, 0, 48);   // maze south entrance
    S.pos.set(C.x + off.x, EYE, C.z + off.z);
    S.yaw = Math.atan2(off.x, off.z);  // face back toward centre
    S.area = area; prevArea = area;
    startArea(area);
    HUD.floorArea(ad);
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    // keep a usable horizontal view even on tall/portrait screens (Hor+ style)
    const baseV = 72 * Math.PI / 180, minH = 64 * Math.PI / 180, maxV = 102 * Math.PI / 180;
    let vFov = baseV;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    if (hFov < minH) vFov = Math.min(maxV, 2 * Math.atan(Math.tan(minH / 2) / camera.aspect));
    camera.fov = vFov * 180 / Math.PI;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    layoutView();
  }

  // place the gun + muzzle proportionally so they stay on-screen at any aspect ratio
  function layoutView() {
    if (!camera || !viewModels.length) return;
    const halfH = Math.tan(camera.fov * Math.PI / 360);
    const halfW = halfH * camera.aspect;
    const d = 0.72;
    const gx = Math.min(0.34, halfW * d * 0.62);   // toward right edge, capped for wide screens
    const gy = -Math.min(0.34, halfH * d * 0.6);    // lower portion
    S.gunX = gx; S.gunY = gy;
    viewModels.forEach(vm => { vm.position.x = gx; vm.position.y = gy; });
    if (muzzle) muzzle.position.set(gx, gy * 0.6, -1.15);
    if (muzzleFlash) muzzleFlash.position.set(gx, gy * 0.6, -1.15);
  }

  // ---------- input ----------
  function bindInput() {
    const cv = renderer.domElement;
    const engage = () => {
      if (!S.alive) return;
      S.engaged = true; HUD.hint(false);
      if (!S.locked && cv.requestPointerLock) {
        try { const pr = cv.requestPointerLock(); if (pr && pr.catch) pr.catch(() => { S.lockFail = true; }); } catch (e) { S.lockFail = true; }
      }
    };
    cv.addEventListener('click', engage);
    document.getElementById('lock-hint').addEventListener('click', engage);
    document.addEventListener('pointerlockchange', () => {
      S.locked = document.pointerLockElement === cv;
      if (S.locked) S.engaged = true;
      HUD.hint(!S.engaged);
    });
    document.addEventListener('pointerlockerror', () => { S.lockFail = true; });
    // relative look when pointer-locked
    document.addEventListener('mousemove', e => {
      if (S.locked) {
        S.yaw -= e.movementX * 0.0022; S.pitch -= e.movementY * 0.0022;
        S.pitch = Math.max(-1.45, Math.min(1.45, S.pitch));
      } else {
        // fallback: cursor position relative to centre steers the view
        S.mx = (e.clientX / innerWidth) * 2 - 1;
        S.my = (e.clientY / innerHeight) * 2 - 1;
      }
    });
    addEventListener('mousedown', e => { if (e.button === 0) S.mouseDown = true; });
    addEventListener('mouseup', e => { if (e.button === 0) S.mouseDown = false; });
    // dev terminal (~) — type "tulani" for god mode
    const termInput = document.getElementById('term-input');
    function toggleTerm() {
      S.termOpen = !S.termOpen;
      const t = document.getElementById('dev-terminal');
      if (!t) return;
      t.style.display = S.termOpen ? 'block' : 'none';
      S.mouseDown = false;
      if (S.termOpen) { if (document.exitPointerLock) document.exitPointerLock(); setTimeout(() => termInput && termInput.focus(), 60); }
    }
    function execTerm(cmd) {
      const log = document.getElementById('term-log');
      const out = m => { if (log) log.textContent = m; };
      if (cmd === 'tulani') {
        S.god = !S.god;
        out(S.god ? 'GOD MODE ENABLED — invulnerable · infinite ammo' : 'god mode disabled');
        HUD.flash('#ffd23f', S.god ? '★ GOD MODE! ★' : 'god mode off');
      } else if (cmd === 'help') out('commands: tulani (toggle god mode) · help');
      else if (cmd) out('unknown command: ' + cmd);
    }
    if (termInput) termInput.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.code === 'Backquote' || e.code === 'Escape') { e.preventDefault(); toggleTerm(); return; }
      if (e.code === 'Enter') { const cmd = termInput.value.trim().toLowerCase(); termInput.value = ''; execTerm(cmd); }
    });
    addEventListener('keydown', e => {
      if (e.code === 'Backquote') { toggleTerm(); return; }
      if (S.termOpen) return;
      S.keys[e.code] = true;
      if (e.code >= 'Digit1' && e.code <= 'Digit6') {
        const i = +e.code.slice(5) - 1;
        // double-tap 1 while holding the pistol toggles dual wield (same as Neon City)
        const now = performance.now();
        if (i === 0 && S.wi === 0 && now - (S._tap1 || 0) < 350) toggleDualPistol();
        else switchWeapon(i);
        if (i === 0) S._tap1 = now;
      }
      if (e.code === 'KeyR') reload();
      if (e.code === 'Space') jump();
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    addEventListener('keyup', e => { S.keys[e.code] = false; });
    addEventListener('wheel', e => { if (S.engaged) switchWeapon((S.wi + (e.deltaY > 0 ? 1 : -1) + WEAPONS.length) % WEAPONS.length); });
    document.getElementById('restart').addEventListener('click', restart);
  }

  function toggleDualPistol() {
    const p = WEAPONS[0];
    S.dualPistol = !S.dualPistol;
    p.name = S.dualPistol ? 'DUAL PISTOL' : 'PISTOL';
    p.rate = S.dualPistol ? 0.115 : 0.23;
    p.spread = S.dualPistol ? 0.018 : 0.008;
    const vm = viewModels[0];
    if (vm && vm.userData.second) vm.userData.second.visible = S.dualPistol;
    HUD.weapon(p, S.mags[0], S.reserves[0]);
    HUD.flash('#43c6ff', S.dualPistol ? 'DUAL WIELD!' : 'SINGLE PISTOL');
  }

  function switchWeapon(i) {
    if (i === S.wi || S.transit) return;
    viewModels[S.wi].visible = false; S.wi = i; viewModels[i].visible = true;
    S.cd = 0.15; S.recoil = 0;
    HUD.weapon(WEAPONS[i], S.mags[i], S.reserves[i]);
  }
  function reload() {
    const w = WEAPONS[S.wi];
    if (S.mags[S.wi] >= w.mag || S.reserves[S.wi] <= 0 || S.reloadT > 0) return;
    S.reloadT = 0.9;
  }
  function jump() { if (S.onGround && !S.transit && S.alive) { S.vel.y = 6.2; S.onGround = false; } }

  // ---------- shooting ----------
  function tryShoot(dt) {
    const w = WEAPONS[S.wi];
    if (!S.engaged || !S.alive || S.transit) { S.fpCharge = 0; return; }
    // FORCE PUSH: hold to charge — range, damage and knockback all grow the
    // longer the gauntlet is held; release to unleash the blast
    if (w.mode === 'force') {
      if (S.mouseDown && S.cd <= 0) {
        S.fpCharge = Math.min(1, (S.fpCharge || 0) + dt * 0.9);
      } else if ((S.fpCharge || 0) > 0 && !S.mouseDown) {
        const power = Math.max(0.25, S.fpCharge);
        S.fpCharge = 0;
        S.cd = w.rate * (S.buffs.rapid > 0 ? 0.42 : 1);
        S.recoil = Math.min(0.6, w.recoil * (0.6 + power));
        if (Game.opts.shake) S.shake = Math.min(0.7, 0.2 + power * 0.4);
        muzzle.intensity = 4 + power * 4; muzzle.color.setHex(w.color);
        if (muzzleFlash) { muzzleFlash.material.color.setHex(w.color); muzzleFlash.material.opacity = 1; muzzleFlash.scale.setScalar(0.8 + power); }
        if (snd) { snd.tone(70 + power * 30, 'sawtooth', 0.2, 0.25); snd.tone(150 + power * 60, 'sine', 0.14, 0.3); }
        forceBlast(camForward(), w, power);
      }
      return;
    }
    if (S.cd > 0 || S.reloadT > 0) return;
    const want = S.mouseDown && (w.auto || !S.firedThisClick);
    if (!w.auto) { if (S.mouseDown && !S.prevDown) S.firedThisClick = false; }
    if (!S.mouseDown) { S.firedThisClick = false; return; }
    if (!w.auto && S.firedThisClick) return;
    if (S.mags[S.wi] <= 0) { reload(); return; }

    S.firedThisClick = true;
    S.cd = w.rate * (S.buffs.rapid > 0 ? 0.42 : 1); if (!S.god) S.mags[S.wi]--;
    S.recoil = Math.min(0.5, S.recoil + w.recoil);
    if (Game.opts.shake) S.shake = Math.min(0.6, S.shake + w.recoil * 0.9);
    muzzle.intensity = 5; muzzle.color.setHex(w.color);
    // pop the muzzle flash sprite
    if (muzzleFlash) { muzzleFlash.material.color.setHex(w.color); muzzleFlash.material.opacity = 1; muzzleFlash.scale.setScalar(0.7 + Math.random() * 0.5); muzzleFlash.material.rotation = Math.random() * 6.28; }
    if (snd) snd.shoot(w.name.toLowerCase());
    HUD.weapon(w, S.mags[S.wi], S.reserves[S.wi]);

    const dir = camForward();
    if (w.mode === 'proj') {
      const p = camera.position.clone().add(dir.clone().multiplyScalar(0.8));
      spawnBullet(p, dir.clone().multiplyScalar(w.pspeed), w, true);
    } else {
      const rays = w.pellets;
      for (let r = 0; r < rays; r++) {
        const d = dir.clone();
        d.x += (Math.random() - 0.5) * w.spread * 2; d.y += (Math.random() - 0.5) * w.spread * 2; d.z += (Math.random() - 0.5) * w.spread * 2; d.normalize();
        hitscan(camera.position, d, w);
      }
    }
    tracer(dir, w);
  }

  // FORCE PUSH — kinetic cone blast: damage + knockback (shared with Neon City).
  // power (0..1, from hold time) scales range up to ~2.2x, plus damage/knockback.
  function forceBlast(dir, w, power) {
    power = power === undefined ? 1 : power;
    const reach = w.reach * (0.6 + 1.6 * power);
    const dmg = w.dmg * (0.5 + power);
    const origin = camera.position.clone();
    // twin expanding shockwave rings — bigger blast at higher charge
    for (let k = 0; k < 2; k++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.45, 28),
        new THREE.MeshBasicMaterial({ color: k ? 0xb06cf6 : 0x43c6ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.copy(origin).add(dir.clone().multiplyScalar(1 + k * 0.3));
      ring.quaternion.copy(camera.quaternion);
      scene.add(ring);
      S.parts.push({ mesh: ring, life: 0.5, fade: true, grow: (24 + k * 8) + power * 30, dir: dir.clone() });
    }
    for (const e of S.enemies) {
      if (e.dead) continue;
      const to = e.center().clone().sub(origin);
      const dist = to.length();
      if (dist > reach) continue;
      const align = to.clone().normalize().dot(dir);
      if (align < w.arc) continue;
      damageEnemy(e, dmg);
      // shove the golem backwards
      const push = to.setY(0).normalize().multiplyScalar((1 - dist / reach) * w.knockback * (0.5 + power));
      e.group.position.add(push);
      if (e.kb) e.kb.add(push); // if the enemy tracks knockback velocity
    }
  }

  function hitscan(origin, dir, w) {
    let best = null, bestT = Infinity;
    const hits = [];
    for (const e of S.enemies) {
      if (e.dead) continue;
      const t = raySphere(origin, dir, e.center(), e.hitR);
      if (t != null && t > 0 && t < 300) { hits.push({ e, t }); if (t < bestT) { bestT = t; best = e; } }
    }
    if (w.mode === 'rail') { hits.forEach(h => damageEnemy(h.e, w.dmg)); if (hits.length) impact(origin.clone().add(dir.clone().multiplyScalar(bestT)), w.color); }
    else if (best) { damageEnemy(best, w.dmg); impact(origin.clone().add(dir.clone().multiplyScalar(bestT)), w.color); }
    return best ? bestT : null;
  }
  function impact(pos, col) {
    // bright spark sprite
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), color: col, transparent: true, blending: THREE.AdditiveBlending, depthTest: false }));
    sp.position.copy(pos); sp.scale.setScalar(1.1); scene.add(sp);
    S.parts.push({ mesh: sp, life: 0.14, fade: true });
    burst(pos, col, 8);
  }

  // --- shared bullet resources (avoid per-shot allocation + per-bullet lights) ---
  const _bulletGeo = {};        // radius -> SphereGeometry (low-poly, reused)
  const _bulletMat = {};        // colorHex -> MeshBasicMaterial (reused)
  function bulletGeo(r) {
    const key = (r || 0.18).toFixed(2);
    return _bulletGeo[key] || (_bulletGeo[key] = new THREE.SphereGeometry(parseFloat(key), 6, 6));
  }
  function bulletMat(col) {
    return _bulletMat[col] || (_bulletMat[col] = new THREE.MeshBasicMaterial({ color: col }));
  }
  function spawnBullet(pos, vel, w, fromPlayer) {
    // cap live bullets so a full-auto gun can never pile up thousands of meshes
    if (S.bullets.length > 90) { const old = S.bullets.shift(); scene.remove(old.mesh); }
    const m = new THREE.Mesh(bulletGeo(w.pr || 0.18), bulletMat(w.color));
    m.position.copy(pos); scene.add(m);
    // NOTE: no per-bullet PointLight — many dynamic lights force WebGL shader
    // recompiles every frame, which is what made the auto pulse gun lag so badly.
    S.bullets.push({ mesh: m, vel, dmg: w.dmg, life: 3, fromPlayer, splash: w.splash || 0, color: w.color });
  }

  function tracer(dir, w) {
    if (w.mode === 'proj') return;
    const len = w.mode === 'rail' ? 80 : 60;
    const start = camera.position.clone().add(dir.clone().multiplyScalar(0.9)).add(camRight().multiplyScalar(S.gunX || 0.3)).add(new THREE.Vector3(0, (S.gunY || -0.3) * 0.5, 0));
    const end = start.clone().add(dir.clone().multiplyScalar(len));
    // glowing beam: a thin box stretched along the shot
    const thick = w.mode === 'rail' ? 0.12 : 0.05;
    const geo = new THREE.CylinderGeometry(thick, thick, len, 6);
    const beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: w.color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.copy(start.clone().lerp(end, 0.5));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    scene.add(beam);
    S.parts.push({ mesh: beam, life: w.mode === 'rail' ? 0.2 : 0.08, fade: true });
  }
  function camRight() { return new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation); }

  // ---------- enemies ----------
  function spawnEnemy(type, pos) {
    const cfg = EnemyFactory.TYPES[type];
    const g = EnemyFactory.build(type); g.scale.setScalar(cfg.scale);
    g.position.copy(pos); scene.add(g);
    const e = {
      group: g, type, cfg, hp: cfg.hp, maxHp: cfg.hp, dead: false,
      hitR: cfg.scale * (type === 'tank' || type === 'boss' || type === 'spider' ? 1.6 : 0.95),
      atkCd: Math.random(), bob: Math.random() * 6, fly: cfg.fly, flyH: 6 + Math.random() * 3, orbit: Math.random() * Math.PI * 2,
      center() { return new THREE.Vector3(g.position.x, g.position.y + cfg.scale * (type === 'tank' || type === 'boss' ? 1.4 : 1.0), g.position.z); },
    };
    S.enemies.push(e);
    return e;
  }

  function damageEnemy(e, dmg) {
    if (e.dead) return;
    e.hp -= dmg; e.hitFlash = 0.12;
    if (snd) snd.hit();
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    e.dead = true;
    if (snd) snd.kill();
    burst(e.center(), e.cfg.col, e.type === 'boss' || e.type === 'spider' ? 40 : 14);
    scene.remove(e.group);
    S.score += e.cfg.points * (S.buffs.double > 0 ? 2 : 1); HUD.score(S.score);
    // chance to drop pickup
    if (Math.random() < 0.3) dropPickup(e.group.position.clone());
    zoneOnKill();
  }

  function enemyShoot(e) {
    const from = e.center();
    const to = S.pos.clone(); const dir = to.sub(from).normalize();
    const w = { color: new THREE.Color(e.cfg.col).getHex(), pr: 0.3, dmg: e.cfg.dmg };
    const m = new THREE.Mesh(bulletGeo(0.3), bulletMat(e.cfg.col));
    m.position.copy(from); scene.add(m);
    S.bullets.push({ mesh: m, vel: dir.multiplyScalar(22), dmg: e.cfg.dmg, life: 4, fromPlayer: false, splash: 0, color: e.cfg.col });
  }

  function updateEnemies(dt, t) {
    const ground = zoneGroundY();
    for (const e of S.enemies) {
      if (e.dead) continue;
      const g = e.group;
      const toP = new THREE.Vector3(S.pos.x - g.position.x, 0, S.pos.z - g.position.z);
      const dist = toP.length(); toP.normalize();
      // face player
      g.rotation.y = Math.atan2(toP.x, toP.z);
      const baseY = e.fly ? ground + e.flyH : ground;
      const meleeR = e.cfg.scale * 1.6 + 1.2;

      if (e.cfg.range > 0) {            // ranged: keep distance
        if (e.fly) { e.orbit += dt * 0.5; const r = 18; const tx = S.pos.x + Math.cos(e.orbit) * r, tz = S.pos.z + Math.sin(e.orbit) * r; g.position.x += (tx - g.position.x) * dt * 0.6; g.position.z += (tz - g.position.z) * dt * 0.6; }
        else if (dist > e.cfg.range) { g.position.x += toP.x * e.cfg.speed * dt; g.position.z += toP.z * e.cfg.speed * dt; }
        else if (dist < e.cfg.range * 0.6) { g.position.x -= toP.x * e.cfg.speed * dt; g.position.z -= toP.z * e.cfg.speed * dt; }
        e.atkCd -= dt;
        if (e.atkCd <= 0 && dist < e.cfg.range + 6) { enemyShoot(e); e.atkCd = 1.8 + Math.random(); }
      } else {                          // melee
        if (dist > meleeR) { g.position.x += toP.x * e.cfg.speed * dt; g.position.z += toP.z * e.cfg.speed * dt; }
        e.atkCd -= dt;
        if (dist < meleeR && e.atkCd <= 0) { hurtPlayer(e.cfg.dmg); e.atkCd = 1.0; e.lunge = 0.2; }
      }
      // confine to zone
      clampToZone(g.position, e.cfg.scale);
      // vertical bob + settle
      e.bob += dt * 4;
      g.position.y = baseY + Math.sin(e.bob) * (e.fly ? 0.6 : 0.12) + (e.lunge ? 0.3 : 0);
      if (e.lunge) e.lunge -= dt;
      // animated cores (glowy mouths) + googly eye wiggle
      const pulse = 1.0 + Math.sin(t * 3 + e.bob) * 0.5 + (e.hitFlash ? 3 : 0);
      (g.userData.cores || []).forEach(mm => mm.emissiveIntensity = pulse);
      (g.userData.eyes || []).forEach((p, i) => { const b = p.userData.base, rr = p.userData.rr; p.position.x = b.x + Math.sin(t * 5 + i * 1.7) * rr * 0.2; p.position.y = b.y + Math.cos(t * 4.3 + i) * rr * 0.2; });
      if (g.userData.parts && g.userData.parts.orb) g.userData.parts.orb.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
      if (g.userData.wing) g.userData.wing.forEach((wg, i) => wg.rotation.z = Math.sin(t * 8) * 0.5 * (i ? -1 : 1));
      if (e.hitFlash) e.hitFlash -= dt;
    }
    S.enemies = S.enemies.filter(e => !e.dead);
  }

  // ---------- bullets & particles ----------
  function updateBullets(dt) {
    for (const b of S.bullets) {
      b.mesh.position.addScaledVector(b.vel, dt); b.life -= dt;
      if (b.fromPlayer) {
        for (const e of S.enemies) {
          if (e.dead) continue;
          if (b.mesh.position.distanceTo(e.center()) < e.hitR + 0.3) {
            if (b.splash) { S.enemies.forEach(o => { if (!o.dead && o.center().distanceTo(b.mesh.position) < b.splash) damageEnemy(o, b.dmg); }); burst(b.mesh.position.clone(), b.color, 18); }
            else damageEnemy(e, b.dmg);
            b.life = -1; break;
          }
        }
      } else {
        if (b.mesh.position.distanceTo(S.pos) < 0.8) { hurtPlayer(b.dmg); b.life = -1; }
      }
      if (b.life <= 0) { scene.remove(b.mesh); b.gone = true; }
    }
    S.bullets = S.bullets.filter(b => !b.gone);
    for (const p of S.parts) {
      p.life -= dt;
      if (p.vel) { p.mesh.position.addScaledVector(p.vel, dt); p.vel.y -= 14 * dt; }
      if (p.grow) { const s = p.mesh.scale.x + p.grow * dt; p.mesh.scale.setScalar(s); if (p.dir) p.mesh.position.addScaledVector(p.dir, dt * 6); }
      if (p.fade && p.mesh.material) p.mesh.material.opacity = Math.max(0, p.mesh.material.opacity - dt * (p.grow ? 2 : 6));
      if (p.life <= 0) { scene.remove(p.mesh); p.gone = true; }
    }
    S.parts = S.parts.filter(p => !p.gone);
  }
  const _burstGeo = new THREE.TetrahedronGeometry(0.16);
  function burst(pos, col, n) {
    if (S.parts.length > 220) return;   // don't let confetti pile up under full-auto fire
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(_burstGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true }));
      m.scale.setScalar(0.7 + Math.random() * 1.1);
      m.position.copy(pos); scene.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5 + 1, (Math.random() - 0.5) * 6);
      S.parts.push({ mesh: m, vel: v, life: 0.7 + Math.random() * 0.4, fade: true });
    }
  }

  // ---------- pickups ----------
  // ---------- emoji power-ups ----------
  const POWERUPS = [
    { kind: 'heal',   emoji: '🍔', disc: 0xff8a3d, weight: 3 },
    { kind: 'ammo',   emoji: '🔋', disc: 0xffd23f, weight: 3 },
    { kind: 'speed',  emoji: '⚡', disc: 0x43c6ff, weight: 2 },
    { kind: 'rapid',  emoji: '⭐', disc: 0xffd23f, weight: 2 },
    { kind: 'shield', emoji: '🛡️', disc: 0x5fe3a1, weight: 2 },
    { kind: 'armor',  emoji: '🦺', disc: 0x43c6ff, weight: 3 },
    { kind: 'double', text: '2×', disc: 0xff5ca2, weight: 2 },
    { kind: 'heart',  emoji: '❤️', disc: 0xff5ca2, weight: 1 },
  ];
  // bold "2×"-style text coin
  function textSprite(txt) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.font = '900 86px "Luckiest Guy", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 12; x.strokeStyle = '#3a2350'; x.strokeText(txt, 64, 72);
    x.fillStyle = '#fffaf0'; x.fillText(txt, 64, 72);
    const t = new THREE.Texture(c); t.needsUpdate = true;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
    sp.scale.set(1.1, 1.1, 1.1); return sp;
  }
  function emojiSprite(ch) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ch, 64, 70);
    const tex = new THREE.Texture(c); tex.needsUpdate = true;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.scale.set(1.1, 1.1, 1.1); return sp;
  }
  function pickWeighted(list) {
    let tot = 0; list.forEach(p => tot += p.weight); let r = Math.random() * tot;
    for (const p of list) { r -= p.weight; if (r <= 0) return p; } return list[0];
  }
  function dropPickup(pos) {
    const def = pickWeighted(POWERUPS);
    const g = new THREE.Group();
    // chunky toon disc behind the emoji
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 18), new THREE.MeshStandardMaterial({ color: def.disc, roughness: 0.6, flatShading: true }));
    disc.rotation.x = Math.PI / 2; g.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 22), new THREE.MeshStandardMaterial({ color: 0x3a2350, roughness: 0.7 }));
    g.add(ring);
    const sp = def.text ? textSprite(def.text) : emojiSprite(def.emoji); sp.position.z = 0.12; g.add(sp);
    g.position.copy(pos); g.position.y = zoneGroundY() + 0.9; scene.add(g);
    S.pickups.push({ group: g, def, sprite: sp });
  }
  function updatePickups(dt, t) {
    for (const p of S.pickups) {
      p.group.rotation.y += dt * 2.4;
      p.group.position.y = zoneGroundY() + 0.9 + Math.sin(t * 3 + p.group.position.x) * 0.18;
      p.sprite.material.rotation = Math.sin(t * 4) * 0.15;
      if (new THREE.Vector3(p.group.position.x, S.pos.y, p.group.position.z).distanceTo(S.pos) < 1.8) {
        if (snd) snd.collect();
        applyPowerup(p.def);
        burst(p.group.position.clone(), p.def.disc, 12);
        scene.remove(p.group); p.gone = true;
      }
    }
    S.pickups = S.pickups.filter(p => !p.gone);
  }
  function applyPowerup(def) {
    switch (def.kind) {
      case 'heal':   S.hp = Math.min(S.maxHp, S.hp + 35); HUD.hp(S.hp, S.maxHp, S.armor); HUD.flash('#ff8a3d', '🍔 YUM +35'); break;
      case 'heart':  S.hp = S.maxHp; HUD.hp(S.hp, S.maxHp, S.armor); HUD.flash('#ff5ca2', '❤️ FULL HEAL!'); break;
      case 'ammo':   WEAPONS.forEach((w, i) => { S.mags[i] = w.mag; }); HUD.weapon(WEAPONS[S.wi], S.mags[S.wi], S.reserves[S.wi]); HUD.flash('#ffd23f', '🔋 AMMO FULL'); break;
      case 'speed':  S.buffs.speed = 10; HUD.flash('#43c6ff', '⚡ ZOOMIES!'); break;
      case 'rapid':  S.buffs.rapid = 10; HUD.flash('#ffd23f', '⭐ RAPID FIRE!'); break;
      case 'shield': S.buffs.shield = 8; HUD.flash('#5fe3a1', '🛡️ SHIELD UP!'); break;
      case 'armor':  S.armor = Math.min(100, (S.armor || 0) + 50); HUD.hp(S.hp, S.maxHp, S.armor); HUD.flash('#43c6ff', '🦺 ARMOR +50'); break;
      case 'double': S.buffs.double = 14; HUD.flash('#ff5ca2', '2× SCORE!'); break;
    }
  }

  // ---------- player ----------
  function hurtPlayer(dmg) {
    if (!S.alive || S.transit) return;
    if (S.buffs.shield > 0) { S.shieldHit = 0.25; return; }   // shield blocks all damage
    // armor absorbs 60% of damage until it breaks (same rule as Neon City)
    if (S.armor > 0) {
      const absorbed = Math.min(S.armor, dmg * 0.6);
      S.armor -= absorbed; dmg -= absorbed;
    }
    if (S.god) return;
    if (snd) snd.damage();
    S.hp -= dmg; S.hurt = 0.4; if (Game.opts.shake) S.shake = Math.min(0.7, S.shake + 0.25);
    HUD.hp(S.hp, S.maxHp, S.armor);
    if (S.hp <= 0) gameOver();
  }
  function gameOver() {
    S.alive = false; S.hp = 0; document.exitPointerLock();
    document.getElementById('gameover').style.display = 'flex';
    document.getElementById('final-score').textContent = S.score;
  }
  function restart() {
    location.reload();
  }

  function camForward() {
    const e = new THREE.Euler(S.pitch, S.yaw, 0, 'YXZ');
    return new THREE.Vector3(0, 0, -1).applyEuler(e).normalize();
  }

  function updatePlayer(dt) {
    if (!S.alive) return;
    // fallback edge-steer look (when pointer lock is unavailable)
    if (!S.locked && S.engaged && S.mx != null) {
      const dz = 0.18;
      if (Math.abs(S.mx) > dz) S.yaw -= (S.mx - Math.sign(S.mx) * dz) * dt * 2.6;
      if (Math.abs(S.my) > dz) { S.pitch -= (S.my - Math.sign(S.my) * dz) * dt * 2.2; S.pitch = Math.max(-1.45, Math.min(1.45, S.pitch)); }
    }
    // arrow keys always turn the view (universal fallback)
    if (S.keys['ArrowLeft']) S.yaw += dt * 1.9;
    if (S.keys['ArrowRight']) S.yaw -= dt * 1.9;
    if (S.keys['ArrowUp']) S.pitch = Math.min(1.45, S.pitch + dt * 1.5);
    if (S.keys['ArrowDown']) S.pitch = Math.max(-1.45, S.pitch - dt * 1.5);
    const speed = (S.keys['ShiftLeft'] ? 9 : 5.5) * (S.buffs.speed > 0 ? 1.7 : 1);
    const fwd = new THREE.Vector3(Math.sin(S.yaw), 0, Math.cos(S.yaw));
    const right = new THREE.Vector3(Math.cos(S.yaw), 0, -Math.sin(S.yaw));
    const move = new THREE.Vector3();
    if (S.keys['KeyW']) move.sub(fwd); if (S.keys['KeyS']) move.add(fwd);
    if (S.keys['KeyA']) move.sub(right); if (S.keys['KeyD']) move.add(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);

    if (!S.transit) {
      const next = S.pos.clone().add(move);
      resolveMove(next);
      S.pos.copy(next);
      // gravity / jump
      const gy = zoneGroundY() + EYE;
      S.vel.y -= 20 * dt; S.pos.y += S.vel.y * dt;
      if (S.pos.y <= gy) { S.pos.y = gy; S.vel.y = 0; S.onGround = true; }
      checkPad();
      // checkPortals(); // portals removed — open world, all sectors visible
    }

    // camera
    const shakeX = (Math.random() - 0.5) * S.shake * 0.3, shakeY = (Math.random() - 0.5) * S.shake * 0.3;
    camera.position.copy(S.pos);
    camera.rotation.set(S.pitch + shakeY, S.yaw + shakeX, 0, 'YXZ');
    S.shake = Math.max(0, S.shake - dt * 2);

    // viewmodel recoil + sway
    const vm = viewModels[S.wi];
    if (vm) { vm.position.z = -0.7 + S.recoil * 0.4; vm.rotation.x = S.recoil * 0.8; }
    S.recoil = Math.max(0, S.recoil - dt * 4);
    // muzzle flash fade
    if (muzzleFlash && muzzleFlash.material.opacity > 0) muzzleFlash.material.opacity = Math.max(0, muzzleFlash.material.opacity - dt * 12);
    if (viewModels[S.wi].userData.spin) viewModels[S.wi].userData.spin.rotation.z += dt * 6;
  }

  // collision: keep within building (indoor) / town / jungle with obstacle push-out
  function pushOut(next, list) {
    for (const o of list) {
      if (next.x > o.minX - 0.6 && next.x < o.maxX + 0.6 && next.z > o.minZ - 0.6 && next.z < o.maxZ + 0.6) {
        const dl = Math.abs(next.x - (o.minX - 0.6)), dr = Math.abs(next.x - (o.maxX + 0.6));
        const dt2 = Math.abs(next.z - (o.minZ - 0.6)), db = Math.abs(next.z - (o.maxZ + 0.6));
        const m = Math.min(dl, dr, dt2, db);
        if (m === dl) next.x = o.minX - 0.6; else if (m === dr) next.x = o.maxX + 0.6;
        else if (m === dt2) next.z = o.minZ - 0.6; else next.z = o.maxZ + 0.6;
      }
    }
  }
  function resolveMove(next) {
    if (S.area !== 'building') {
      const ad = W.areas[S.area], C = ad.center, d = Math.hypot(next.x - C.x, next.z - C.z);
      if (d > ad.R) { next.x = C.x + (next.x - C.x) * ad.R / d; next.z = C.z + (next.z - C.z) * ad.R / d; }
      pushOut(next, ad.obstacles);
      // town has the building door at origin
      if (S.area === 'town' && next.z > W.doorZ - 0.2 && Math.abs(next.x) < W.DOOR_HALF - 0.4) { S.area = 'building'; S.level = 0; }
      return;
    }
    // inside the building
    const lim = W.INT - 0.6;
    next.x = Math.max(-lim, Math.min(lim, next.x));
    if (S.level === 0 && Math.abs(next.x) < W.DOOR_HALF - 0.4) {
      if (next.z < W.doorZ - 1.0) { S.area = 'town'; }   // stepped outside
      next.z = Math.min(lim, next.z);
      next.z = Math.max(next.z, W.doorZ - 3);
    } else {
      next.z = Math.max(-lim, Math.min(lim, next.z));
    }
  }

  function checkPad() {
    if (S.area !== 'building' || S.transit) return;
    const pad = W.padPos(S.level);
    if (Math.hypot(S.pos.x - pad.x, S.pos.z - pad.z) < 2.0 && S.cleared[S.level]) {
      if (S.level < W.FLOOR_COUNT - 1) rideUp();
    }
  }

  // ---------- portals (hub-and-spoke between open areas) ----------
  function findPortal(area, target) { return W.portals.find(p => p.area === area && p.target === target); }
  function checkPortals() {
    if (S.transit || S.portalCD > 0 || S.area === 'building') return;
    for (const p of W.portals) {
      if (p.area !== S.area) continue;
      if (Math.hypot(S.pos.x - p.pos.x, S.pos.z - p.pos.z) < 2.4) { teleport(p.target); break; }
    }
  }
  function teleport(to) {
    S.transit = true; HUD.fade(true);
    setTimeout(() => {
      clearActors();
      const ad = W.areas[to];
      // arrive next to the portal in the target area that leads back where we came from
      const back = findPortal(to, S.area === 'building' ? 'town' : S.area);
      if (back) {
        const dir = ad.center.clone().sub(back.pos).setY(0); if (dir.lengthSq() < 0.01) dir.set(1, 0, 0); dir.normalize();
        S.pos.set(back.pos.x + dir.x * 8, EYE, back.pos.z + dir.z * 8);
      } else {
        S.pos.set(ad.center.x, EYE, ad.center.z);
      }
      S.area = to;
      S.vel.set(0, 0, 0); S.onGround = true; S.portalCD = 1.5;
      HUD.fade(false);
      setTimeout(() => { S.transit = false; }, 400);
    }, 600);
  }
  function clearActors() {
    S.enemies.forEach(e => scene.remove(e.group)); S.enemies = [];
    S.pickups.forEach(p => scene.remove(p.group)); S.pickups = [];
    S.bullets.forEach(b => scene.remove(b.mesh)); S.bullets = [];
  }

  function rideUp() {
    S.transit = true; HUD.fade(true);
    const from = S.level, to = S.level + 1;
    setTimeout(() => {
      S.level = to;
      const pad = W.padPos(to);
      S.pos.set(pad.x - 4, W.floorY(to) + EYE, pad.z - 4);
      S.vel.set(0, 0, 0); S.onGround = true;
      startFloor(to);
      HUD.fade(false);
      setTimeout(() => { S.transit = false; }, 400);
    }, 700);
  }

  // ---------- zone ground / clamp ----------
  function zoneGroundY() { return S.area !== 'building' ? 0 : W.floorY(S.level); }
  function clampToZone(p, scale) {
    if (S.area !== 'building') { const C = W.areas[S.area].center, R = W.areas[S.area].R, d = Math.hypot(p.x - C.x, p.z - C.z); if (d > R) { p.x = C.x + (p.x - C.x) * R / d; p.z = C.z + (p.z - C.z) * R / d; } }
    else { const lim = W.INT - 0.6; p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z)); }
  }

  // ---------- waves ----------
  const FLOOR_PLAN = [
    ['grunt', 'grunt', 'runner'],
    ['grunt', 'runner', 'runner', 'sapling'],
    ['grunt', 'bramble', 'shooter', 'runner', 'sapling'],
    ['tank', 'grunt', 'shooter', 'bramble', 'runner'],
    ['tank', 'treant', 'shooter', 'dragon', 'bramble'],
    ['boss', 'tank', 'shooter', 'dragon', 'grunt'],   // top floor
  ];
  function startFloor(L) {
    HUD.floor(L);
    const waves = 2 + L;
    S.zone = { name: 'floor', level: L, wave: 0, totalWaves: L === 5 ? 1 : waves, alive: 0, queue: [], spawnT: 0, done: false };
    nextWave();
  }
  function startArea(name) {
    S.zone = { name, area: name, wave: 0, totalWaves: 999, alive: 0, queue: [], spawnT: 0, endless: true };
    nextWave();
  }
  function nextWave() {
    const z = S.zone; if (!z) return;
    z.wave++;
    if (!z.endless && z.wave > z.totalWaves) { clearZone(); return; }
    const isFloor = z.name === 'floor';
    const ad = isFloor ? null : W.areas[z.name];
    const pool = isFloor ? FLOOR_PLAN[z.level] : ad.pool;
    const base = isFloor ? 3 + z.level + z.wave : 4 + z.wave;
    z.queue = [];
    for (let i = 0; i < base; i++) {
      let type = pool[Math.floor(Math.random() * pool.length)];
      if (!isFloor && ad.boss && z.wave % ad.bossEvery === 0 && i === 0) type = ad.boss;   // area mini-boss
      if (z.level === 5 && i === 0) type = 'boss'; else if (z.level === 5) type = pool[1 + Math.floor(Math.random() * 4)];
      z.queue.push(type);
    }
    z.spawnT = 0;
    HUD.wave(z.wave, z.endless ? '∞' : z.totalWaves);
  }
  function updateWaves(dt) {
    const z = S.zone; if (!z || z.done) return;
    if (z.queue.length) {
      z.spawnT -= dt;
      if (z.spawnT <= 0) {
        const type = z.queue.shift();
        spawnEnemy(type, spawnPoint());
        z.alive++; z.spawnT = 0.7;
      }
    }
  }
  function zoneOnKill() { if (S.zone) { S.zone.alive--; checkWaveDone(); } }
  function checkWaveDone() {
    const z = S.zone; if (!z) return;
    if (z.queue.length === 0 && z.alive <= 0) {
      if (z.endless) { nextWave(); }
      else if (z.wave >= z.totalWaves) { clearZone(); }
      else { HUD.flash('#39ff14', 'WAVE ' + z.wave + ' CLEAR'); setTimeout(nextWave, 1500); }
    }
  }
  function clearZone() {
    const z = S.zone; z.done = true;
    if (z.name === 'floor') {
      S.cleared[z.level] = true;
      W.rings[z.level].material.color.setHex(0x39ff14); W.rings[z.level].material.emissive.setHex(0x39ff14);
      if (z.level < W.FLOOR_COUNT - 1) HUD.flash('#39ff14', 'FLOOR CLEAR — TAKE THE LIFT ▲');
      else HUD.flash('#ffd166', 'TOWER CLEARED! ★ explore the streets');
    }
  }
  function spawnPoint() {
    if (S.area !== 'building') {
      const ad = W.areas[S.area], C = ad.center;
      for (let tries = 0; tries < 14; tries++) {
        const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 26;
        const x = S.pos.x + Math.cos(a) * r, z = S.pos.z + Math.sin(a) * r;
        if (Math.hypot(x - C.x, z - C.z) < ad.R - 4) return new THREE.Vector3(x, 0, z);
      }
      return new THREE.Vector3(C.x, 0, C.z);
    }
    const lim = W.INT - 2;
    for (let tries = 0; tries < 10; tries++) {
      const p = new THREE.Vector3((Math.random() * 2 - 1) * lim, W.floorY(S.level), (Math.random() * 2 - 1) * lim);
      if (Math.hypot(p.x - S.pos.x, p.z - S.pos.z) > 8) return p;
    }
    return new THREE.Vector3(-lim, W.floorY(S.level), -lim);
  }

  // area wave bootstrap when entering an open area / building
  let prevArea = 'building';
  function areaWatch() {
    const a = S.area;
    if (a === prevArea) return;
    // show only the active remote area's group; hub (town+building) lives in the root scene
    // All areas visible — open world (no portal-based toggling)
    ['jungle', 'castle', 'maze'].forEach(k => { if (W.areas[k].group) W.areas[k].group.visible = true; });
    if (a === 'building') { startFloor(0); S.cleared[0] = true; W.rings[0].material.color.setHex(0x39ff14); W.rings[0].material.emissive.setHex(0x39ff14); }
    else { startArea(a); HUD.floorArea(W.areas[a]); }
    prevArea = a;
  }

  // ---------- math ----------
  function raySphere(o, d, c, r) {
    const oc = o.clone().sub(c);
    const b = oc.dot(d); const cc = oc.dot(oc) - r * r;
    const disc = b * b - cc; if (disc < 0) return null;
    const t = -b - Math.sqrt(disc); return t;
  }

  // ---------- loop ----------
  function animate() {
    requestAnimationFrame(animate);
    let dt = clock.getDelta(); if (dt > 0.05) dt = 0.05;
    const t = clock.elapsedTime;
    // keep the sun's shadow frustum centred on the player (tight + cheap, only nearby casters)
    if (W.sun) { W.sun.target.position.set(S.pos.x, 0, S.pos.z); W.sun.position.set(S.pos.x + 45, 80, S.pos.z + 30); }
    if (S.reloadT > 0) { S.reloadT -= dt; if (S.reloadT <= 0) { const w = WEAPONS[S.wi]; const need = w.mag - S.mags[S.wi]; const take = Math.min(need, S.reserves[S.wi]); S.mags[S.wi] += take; HUD.weapon(w, S.mags[S.wi], S.reserves[S.wi]); } }
    S.cd = Math.max(0, S.cd - dt);
    S.prevDown = S.mouseDown;
    if (S.portalCD > 0) S.portalCD -= dt;
    if (muzzle.intensity > 0) muzzle.intensity = Math.max(0, muzzle.intensity - dt * 40);

    areaWatch();
    updatePlayer(dt);
    tryShoot(dt);
    updateWaves(dt);
    updateEnemies(dt, t);
    updateBullets(dt);
    updatePickups(dt, t);
    // pad rings spin
    W.rings.forEach(r => r.rotation.z += dt);
    // portal FX removed — open world, no portals
    // ambient canopy monkeys swing (only when the jungle is the active area)
    if (S.area === 'jungle') (W.ambientMonkeys || []).forEach(m => { m.group.position.y = m.base + Math.sin(t * 2 + m.phase) * 0.5; m.group.rotation.z = Math.sin(t * 2 + m.phase) * 0.2; m.group.rotation.y = t * 0.3 + m.phase; });

    // buffs decay + HUD
    let buffChanged = false;
    for (const k in S.buffs) { if (S.buffs[k] > 0) { S.buffs[k] = Math.max(0, S.buffs[k] - dt); buffChanged = true; } }
    if (buffChanged || S._hadBuffs) { HUD.buffs(S.buffs); S._hadBuffs = buffChanged; }

    // hurt vignette
    document.getElementById('flash').style.opacity = S.hurt > 0 ? Math.min(0.6, S.hurt) : 0;
    if (S.hurt > 0) S.hurt -= dt;
    // shield glow
    const sfx = document.getElementById('shieldfx');
    if (sfx) sfx.style.opacity = S.buffs.shield > 0 ? (0.25 + (S.shieldHit > 0 ? 0.4 : Math.sin(t * 6) * 0.1 + 0.1)) : 0;
    if (S.shieldHit > 0) S.shieldHit -= dt;

    Minimap.draw(S, W);
    renderer.render(scene, camera);
  }

  return { init, opts: { shake: true }, S, getW: () => W, cam: () => camera, scene: () => scene, render: () => renderer.render(scene, camera) };
})();
