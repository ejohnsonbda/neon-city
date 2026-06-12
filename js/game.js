// ============================================================
//  GAME ENGINE — Neon City: Nightfall
// ============================================================
class Game {
  constructor() {
    if (typeof THREE === 'undefined') { alert('Three.js failed to load.'); return; }

    this.container = document.getElementById('game-container');
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.012);

    this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.1, 1200);
    this.camera.rotation.order = 'YXZ';

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    } catch (err) {
      Game.showFatalStartupError('WebGL could not start. Please enable hardware acceleration or try another browser.', err);
      this.failed = true;
      return;
    }
    this.renderer.setClearColor(0x05060c, 1);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.container.appendChild(this.renderer.domElement);

    this.composer = null; // bloom disabled for performance

    this.clock = new THREE.Clock();
    this.sound = new SoundManager();
    this.sound.loadSample('shoot', (window.__resources && window.__resources.shootSfx) || 'uploads/chromascension-lazer-gun-one-shot-542393.mp3');
    this.settings = { sensitivity: 0.0022, invertY: false };
    this.baseFOV = 78;
    this.aiming = false;

    // home-screen music (starts on first user gesture, stops on deploy)
    this.music = document.getElementById('menu-music');
    if (this.music) {
      this.music.volume = 0.55;
      const tryPlay = () => { if (!this.gameStarted && this.music.paused) this.music.play().catch(() => {}); };
      ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, tryPlay));
    }
    // gameplay music tracks (one chosen per level on deploy)
    this.gameMusic = [document.getElementById('game-music-1'), document.getElementById('game-music-2')].filter(Boolean);
    this.gameMusic.forEach(m => { m.volume = 0.4; });
    this.curGameMusic = null;

    this.objects = [];      // world colliders
    this.enemies = [];
    this.bullets = [];      // player tracers
    this.eBullets = [];     // enemy projectiles
    this.pProj = [];        // player plasma projectiles
    this.tProj = [];        // thrown projectiles (shuriken / arrows)
    this.items = [];        // pickups
    this.particles = [];
    this.tracers = [];
    this.boss = null;

    this.isPaused = false;
    this.gameStarted = false;
    this.level = 'city';
    this.score = 0;
    this.wave = 1;
    this.waveCountdown = null;

    this.player = {
      speed: 14, runSpeed: 22, jumpForce: 14,
      velocity: new THREE.Vector3(),
      onGround: false, hp: 120, maxHp: 120, armor: 0, maxArmor: 100,
      height: 1.7, classType: 'soldier', weaponIdx: 0,
      bobTimer: 0, lastStep: 0,
      weapons: []
    };

    // per-level arsenals
    this.defaultWeapons = [
      { name:'PISTOL',     type:'semi', rate:230,  dmg:38,  color:0x19f0ff, ammo:Infinity, maxAmmo:Infinity, spread:0.008, model:'pistol',  kick:0.012 },
      { name:'SMG',        type:'auto', rate:62,   dmg:13,  color:0xffd166, ammo:220, maxAmmo:480, spread:0.05,  model:'smg',     kick:0.009 },
      { name:'DUAL SHG',   type:'semi', rate:360,  dmg:8,   pellets:9, dual:true, color:0xff2d95, ammo:48,  maxAmmo:120, spread:0.14, model:'shotgun', kick:0.06 },
      { name:'FORCE PUSH', type:'semi', rate:1500, dmg:80,  color:0x19f0ff, ammo:Infinity, maxAmmo:Infinity, spread:0, forcePush:true, pushRadius:12, pushCone:0.55, model:'forcepush', kick:0 },
      { name:'PLASMA',     type:'semi', rate:760,  dmg:40, splash:5.5, splashDmg:55, color:0x9b5cff, ammo:24, maxAmmo:60, spread:0.004, projectile:true, model:'plasma', kick:0.03 },
      { name:'PULSE',      type:'auto', rate:40,   dmg:8,   color:0xff7a18, ammo:320, maxAmmo:700, spread:0.055, model:'pulse', kick:0.006 },
    ];
    this.player.weapons = this.defaultWeapons;
    this.weaponSmooth = { bowDraw: 0, bowRelease: 0 };

    this.input = { w: 0, a: 0, s: 0, d: 0, jump: 0, shoot: 0, sprint: 0 };
    this.touchState = { moveX: 0, moveY: 0 };
    this.raycaster = new THREE.Raycaster();
    this._tmp = new THREE.Vector3();

    this.initWorld();
    this.initUI();
    this.setupInputs();
    this.animate();

    this.mmCanvas = document.getElementById('minimap-canvas');
    this.mmCtx = this.mmCanvas.getContext('2d');
    this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (this.isMobile) document.getElementById('mobile-controls').classList.remove('hidden');
  }

  // ---------------- WORLD ----------------
  initWorld() {
    // Environment is built per-level on Deploy. Just set up the viewmodel now.
    this.createWeaponModel();
    this.scene.background = new THREE.Color(0x05060c);
  }

  buildWorld(level) {
    if (this.worldGroup) this.scene.remove(this.worldGroup);
    this.objects = [];
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    this.level = level;
    this.megaProps = null;
    this.railProps = null;
    this.desertProps = null;
    this.japanProps = null;
    // tune bloom per level: punchy at night, subtle in daylight (avoids white-out)
    if (this.bloom) {
      const day = (level === 'fields' || level === 'desert');
      if (day) { this.bloom.strength = 0.22; this.bloom.threshold = 0.92; this.bloom.radius = 0.35; }
      else { this.bloom.strength = 0.95; this.bloom.threshold = 0.52; this.bloom.radius = 0.75; }
    }
    if (level === 'fields') this.buildFields(this.worldGroup);
    else if (level === 'megacity') this.buildMegaCity(this.worldGroup);
    else if (level === 'rail') this.buildRailCity(this.worldGroup);
    else if (level === 'desert') this.buildDesert(this.worldGroup);
    else if (level === 'range') this.buildRange(this.worldGroup);
    else this.buildCity(this.worldGroup);
    this._expandWorld(3.0);
  }

  // Expand the whole world footprint by a factor: bakes an x/z scale into
  // every top-level world object (sky domes excluded), stretches fog and
  // re-scales the coordinate systems of moving props (trains, traffic).
  _expandWorld(f) {
    // moving props (train cars, traffic, birds) keep their true proportions —
    // only their positions/coordinate systems scale, never their shape
    const noStretch = new Set();
    [this.railProps, this.megaProps].forEach(pr => {
      if (!pr) return;
      (pr.cars || []).forEach(c => noStretch.add(c));
      (pr.vehicles || []).forEach(v => noStretch.add(v.mesh));
      (pr.birds || []).forEach(b => noStretch.add(b));
    });
    this.worldGroup.children.forEach(c => {
      const r = c.geometry && c.geometry.parameters && c.geometry.parameters.radius;
      if (r && r >= 700) return; // sky dome stays a sphere
      c.position.x *= f; c.position.z *= f;
      if (noStretch.has(c)) return;
      c.scale.x *= f; c.scale.z *= f;
    });
    if (this.scene.fog) {
      if (this.scene.fog.isFogExp2) this.scene.fog.density /= f;
      else { this.scene.fog.near *= f; this.scene.fog.far *= f; }
    }
    this.camera.far = Math.max(this.camera.far, 1200 * f);
    this.camera.updateProjectionMatrix();
    const sc = v => { if (v) { v.x *= f; v.z *= f; } };
    if (this.railProps) {
      const rp = this.railProps;
      if (rp.curve && rp.curve.points) { rp.curve.points.forEach(sc); if (rp.curve.updateArcLengths) rp.curve.updateArcLengths(); }
      if (rp.span) rp.span *= f;
      (rp.vehicles || []).forEach(v => v.pos *= f);
      (rp.cars || []).forEach(car => { sc(car.userData.prevPos); });
    }
    if (this.megaProps) {
      const mp = this.megaProps;
      if (mp.span) mp.span *= f;
      (mp.vehicles || []).forEach(v => v.pos *= f);
    }
    if (this.desertProps && this.desertProps.span) this.desertProps.span *= f;
    sc(this._railSpawn); sc(this._desertSpawn); sc(this._rangeSpawn);
  }

  // ================= EGYPTIAN DESERT + JUNGLE (dual biome) =================
  buildDesert(W) {
    const S = 7;
    this.scene.background = null;
    this.scene.fog = new THREE.FogExp2(0xd2b27a, 0.0042);
    // sky dome with clouds (warm desert daytime)
    const dsky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 24),
      new THREE.MeshBasicMaterial({ map: TextureGen.createDaySky('#5a8fc0', '#e8cf9a'), side: THREE.BackSide, fog: false }));
    W.add(dsky);

    // ground: rippled desert sand
    const sand = this.createGroundTex('sand', 26);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100 * S, 100 * S),
      new THREE.MeshStandardMaterial({ map: sand, normalMap: TextureGen.createNormalTexture('dirtN', 26, 26), color: 0xceac72, roughness: 0.95, metalness: 0.02 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; W.add(ground);

    // jungle biome patch (NW quadrant) — darker grass
    const jungleGrass = new THREE.Mesh(new THREE.CircleGeometry(34 * S * 0.5, 40),
      new THREE.MeshStandardMaterial({ color: 0x2f5e26, roughness: 0.92 }));
    jungleGrass.rotation.x = -Math.PI / 2; jungleGrass.position.set(-15 * S, 0.02, -20 * S); jungleGrass.receiveShadow = true; W.add(jungleGrass);

    // sandstone material (real texture)
    const stoneTex = TextureGen.createSandstone();
    const stoneMat = () => { const t = stoneTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.encoding = THREE.sRGBEncoding; return new THREE.MeshStandardMaterial({ map: t, color: 0xcaa97a, roughness: 0.85, metalness: 0.05 }); };
    const darkStone = () => { const t = stoneTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return new THREE.MeshStandardMaterial({ map: t, color: 0x9a7848, roughness: 0.9 }); };

    // ===== PYRAMIDS ===== (4-sided cones = pyramids), as colliders
    const pyramids = [[-8, -7, 3.2, 4.5], [9, -8, 2.4, 3.5], [-10, 6, 1.8, 2.8], [12, 5, 2.0, 3.0]];
    pyramids.forEach(([x, z, rad, h]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0, rad * S, h * S, 4), stoneMat());
      p.position.set(x * S, h * S / 2, z * S); p.rotation.y = Math.PI / 4; p.castShadow = true; p.receiveShadow = true;
      W.add(p); this.objects.push(p);
      // gold capstone
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0, rad * S * 0.16, h * S * 0.16, 4),
        new THREE.MeshStandardMaterial({ color: 0xffd35a, emissive: 0x6a4e0c, emissiveIntensity: 0.4, metalness: 0.8, roughness: 0.3 }));
      cap.position.set(x * S, h * S * 0.92, z * S); cap.rotation.y = Math.PI / 4; W.add(cap);
    });

    // ===== SPHINX ===== (collider blocks)
    const sx = 0, sz = 11;
    const sphinx = new THREE.Group();
    const sBase = new THREE.Mesh(new THREE.BoxGeometry(2.2 * S, 0.8 * S, 4.5 * S), darkStone()); sBase.position.y = 0.4 * S; sphinx.add(sBase);
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(1.6 * S, 1.2 * S, 3.2 * S), stoneMat()); sBody.position.y = 0.9 * S; sphinx.add(sBody);
    const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.9 * S, 16, 14), stoneMat()); sHead.position.set(0, 1.8 * S, 1.1 * S); sHead.scale.set(1.1, 1.0, 0.85); sphinx.add(sHead);
    // nemes headdress on sphinx
    const nemes = new THREE.Mesh(new THREE.BoxGeometry(1.1 * S, 0.5 * S, 1.0 * S),
      new THREE.MeshStandardMaterial({ color: 0xe6c34a, metalness: 0.6, roughness: 0.4 }));
    nemes.position.set(0, 2.3 * S, 0.9 * S); sphinx.add(nemes);
    sphinx.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    sphinx.position.set(sx * S, 0, sz * S); W.add(sphinx);
    this.objects.push(sBody, sBase);

    // ===== TEMPLE COLUMNS ===== (colliders)
    [[-4, 12], [4, 12], [-5, 14], [5, 14], [-3, 10], [3, 10], [-6, 8], [6, 8]].forEach(([x, z]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * S, 0.7 * S, 3.2 * S, 12), stoneMat());
      col.position.set(x * S, 1.6 * S, z * S); col.castShadow = true; col.receiveShadow = true; W.add(col); this.objects.push(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5 * S, 0.4 * S, 1.5 * S), darkStone());
      cap.position.set(x * S, 3.4 * S, z * S); cap.castShadow = true; W.add(cap);
    });

    // ===== SACRED TORCHES (flickering fire + light) =====
    const fireMat = new THREE.MeshStandardMaterial({ color: 0xff7722, emissive: 0xff3300, emissiveIntensity: 1.0 });
    const fireLights = [];
    [[-3, 10], [3, 10], [-2, 16.5], [2, 16.5], [0, 13], [-6, 5], [6, 5]].forEach(([x, z], i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * S, 0.22 * S, 1.8 * S, 6), new THREE.MeshStandardMaterial({ color: 0x9a7838, roughness: 0.8 }));
      pole.position.set(x * S, 0.9 * S, z * S); pole.castShadow = true; W.add(pole);
      const fire = new THREE.Mesh(new THREE.SphereGeometry(0.28 * S, 8, 8), fireMat);
      fire.position.set(x * S, 1.95 * S, z * S); W.add(fire);
      // real flame light on every other torch only (per-light cost on all meshes)
      let lt = null;
      if (i % 2 === 0) { lt = new THREE.PointLight(0xff7a33, 2.0, 12 * S * 0.5, 2); lt.position.set(x * S, 2.0 * S, z * S); W.add(lt); }
      fireLights.push({ light: lt, fire, base: 2.0, ph: Math.random() * 6 });
    });

    // ===== DENSE JUNGLE (trees, palms, bushes, undergrowth, vines) =====
    const jTrunk = new THREE.MeshStandardMaterial({ color: 0x5a3415, roughness: 1 });
    const jLeaf = new THREE.MeshStandardMaterial({ color: 0x2f7a2f, roughness: 1, flatShading: true });
    const jLeaf2 = new THREE.MeshStandardMaterial({ color: 0x3c8c3c, roughness: 1, flatShading: true });
    const jx = -15, jz = -20; // jungle centre (grid units)
    const addJTree = (x, z, sc) => {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * sc * S * 0.5, 0.6 * sc * S * 0.5, 1.4 * sc * S, 6), jTrunk);
      tr.position.set(x, 0.7 * sc * S, z); tr.castShadow = true; W.add(tr); this.objects.push(tr);
      [1.3, 1.85, 2.3].forEach((y, k) => {
        const f = new THREE.Mesh(new THREE.ConeGeometry((0.7 - k * 0.12) * sc * S, 0.85 * sc * S, 6), k % 2 ? jLeaf2 : jLeaf);
        f.position.set(x, y * sc * S, z); f.castShadow = true; W.add(f);
      });
    };
    const addPalm = (x, z) => {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * S * 0.5, 0.45 * S * 0.5, 1.8 * S, 6), jTrunk);
      tr.position.set(x, 0.9 * S, z); tr.castShadow = true; W.add(tr); this.objects.push(tr);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const fr = new THREE.Mesh(new THREE.ConeGeometry(0.4 * S, 1.0 * S, 4), jLeaf); fr.position.set(x + Math.cos(a) * 0.6 * S, 1.9 * S, z + Math.sin(a) * 0.6 * S); fr.rotation.z = a; fr.rotation.x = 0.5; fr.castShadow = true; W.add(fr); }
    };
    const addBush = (x, z) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry((0.35 + Math.random() * 0.3) * S, 6, 5), Math.random() > 0.5 ? jLeaf : jLeaf2);
      b.position.set(x, 0.25 * S, z); b.castShadow = true; W.add(b);
    };
    for (let i = 0; i < 70; i++) {
      const x = (jx + (Math.random() - 0.5) * 30) * S, z = (jz + (Math.random() - 0.5) * 28) * S;
      const r = Math.random();
      if (r < 0.55) addJTree(x, z, 0.8 + Math.random() * 0.5);
      else if (r < 0.78) addPalm(x, z);
      else addBush(x, z);
    }
    // undergrowth
    const under = new THREE.MeshStandardMaterial({ color: 0x4f9a3a, roughness: 1, flatShading: true });
    for (let i = 0; i < 140; i++) {
      const pl = new THREE.Mesh(new THREE.ConeGeometry(0.12 * S, 0.3 * S, 4), under);
      pl.position.set((jx + (Math.random() - 0.5) * 30) * S, 0.12 * S, (jz + (Math.random() - 0.5) * 28) * S); W.add(pl);
    }

    // ===== WATERFALL + POND + OASIS =====
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x35a0d0, metalness: 0.5, roughness: 0.25, emissive: 0x0d4a78, emissiveIntensity: 0.3, transparent: true, opacity: 0.85 });
    const fall = new THREE.Mesh(new THREE.BoxGeometry(1.4 * S, 4.5 * S, 1.0 * S), waterMat);
    fall.position.set(-9 * S, 2.0 * S, -22 * S); W.add(fall);
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(2.2 * S, 2.2 * S, 0.1 * S, 18), waterMat);
    pond.position.set(-9 * S, 0.05 * S, -21 * S); W.add(pond);
    const oasis = new THREE.Mesh(new THREE.CylinderGeometry(2.6 * S, 2.6 * S, 0.08 * S, 18), waterMat);
    oasis.position.set(-5 * S, 0.04 * S, -14 * S); W.add(oasis);
    this.railProps = null;

    // ===== ACACIA TREES (desert side) =====
    const acTrunk = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 1 });
    const acLeaf = new THREE.MeshStandardMaterial({ color: 0x7aa84a, roughness: 1, flatShading: true });
    [[-14, -12], [-12, -15], [13, -14], [15, -11], [-16, 8], [-14, 12], [14, 10], [16, 7], [-18, -5], [18, -4]].forEach(([x, z]) => {
      const sc = 0.9 + Math.random() * 0.3;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * sc * S * 0.5, 0.5 * sc * S * 0.5, 1.2 * sc * S, 6), acTrunk);
      tr.position.set(x * S, 0.6 * sc * S, z * S); tr.castShadow = true; W.add(tr); this.objects.push(tr);
      const can = new THREE.Mesh(new THREE.CylinderGeometry(1.0 * sc * S, 1.2 * sc * S, 0.4 * sc * S, 9), acLeaf);
      can.position.set(x * S, 1.3 * sc * S, z * S); can.castShadow = true; W.add(can);
    });

    // ===== GOLD ANKHS flanking the temple =====
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd35a, emissive: 0x6a4e0c, emissiveIntensity: 0.5, metalness: 0.85, roughness: 0.25 });
    const ankhs = [];
    [[-1.6, 14.5], [1.6, 14.5]].forEach(([x, z]) => {
      const a = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3 * S, 0.07 * S, 12, 24), goldMat); ring.position.y = 0.7 * S; a.add(ring);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.1 * S, 0.9 * S, 0.1 * S), goldMat); stem.position.y = 0.2 * S; a.add(stem);
      const arms = new THREE.Mesh(new THREE.BoxGeometry(0.7 * S, 0.1 * S, 0.1 * S), goldMat); arms.position.y = 0.45 * S; a.add(arms);
      a.position.set(x * S, 1.3 * S, z * S); W.add(a); ankhs.push(a);
    });

    // ===== BIRDS / VULTURES =====
    const birdMat = new THREE.MeshStandardMaterial({ color: 0x3a2e22 });
    const birds = [];
    for (let i = 0; i < 26; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.12 * S * 0.7, 0.3 * S * 0.7, 4), birdMat);
      b.userData = { x: (Math.random() - 0.5) * 60 * S * 0.6, z: (Math.random() - 0.5) * 55 * S * 0.6, y: (8 + Math.random() * 12) * S * 0.4, vx: (Math.random() - 0.5) * 7, vz: (Math.random() - 0.5) * 7 };
      b.position.set(b.userData.x, b.userData.y, b.userData.z); W.add(b); birds.push(b);
    }

    // ===== sand + firefly particles =====
    const mk = (n, col, size, spread, hy, cx, cz) => {
      const geo = new THREE.BufferGeometry(), pp = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pp[i * 3] = cx + (Math.random() - 0.5) * spread; pp[i * 3 + 1] = Math.random() * hy; pp[i * 3 + 2] = cz + (Math.random() - 0.5) * spread; }
      geo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, size, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      W.add(pts); return pts;
    };
    const sandP = mk(900, 0xd9bf85, 0.5, 80 * S, 14 * S, 0, 0);
    const fireflies = mk(500, 0xffd070, 0.4, 30 * S, 6 * S, jx * S, jz * S);

    // ===== sun glow disc =====
    const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(2.2 * S, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }));
    sunGlow.position.set(60 * S * 0.5, 50 * S * 0.5, -55 * S * 0.5); W.add(sunGlow);

    // ===== lighting (harsh desert sun) =====
    W.add(new THREE.AmbientLight(0xc9b48a, 0.28));
    W.add(new THREE.HemisphereLight(0xe8d4ae, 0x5a4c30, 0.22));
    const sun = new THREE.DirectionalLight(0xffe0a0, 0.82);
    sun.position.set(60, 120, -50); sun.castShadow = true; sun.shadow.bias = -0.0002;
    sun.shadow.camera.left = -220; sun.shadow.camera.right = 220; sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
    sun.shadow.camera.far = 600; sun.shadow.mapSize.set(1024, 1024); W.add(sun);

    this.desertProps = { fireLights, birds, ankhs, sandP, fireflies, span: 50 * S, S };
    this._desertSpawn = new THREE.Vector3(0, this.player.height, 22 * S);
  }

  // small helper to clone a tileable ground texture
  createGroundTex(kind, rep) {
    const t = kind === 'sand' ? TextureGen.createSand() : TextureGen.createAsphalt();
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // proper car model (body, hood, cabin with glass, trunk, wheels, lights) — forward is -z
  _makeCar(S, color) {
    const car = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.28 });
    this._carGlass = this._carGlass || new THREE.MeshStandardMaterial({ color: 0x0e141c, metalness: 0.4, roughness: 0.08 });
    this._carTrim = this._carTrim || new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.7, metalness: 0.4 });
    this._carTire = this._carTire || new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.95 });
    this._carHead = this._carHead || new THREE.MeshBasicMaterial({ color: 0xfff2cc });
    this._carTail = this._carTail || new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const W = 0.56 * S, H = 0.16 * S, L = 1.05 * S;
    const part = (geo, mat, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0);
      car.add(m); return m;
    };
    // chassis + hood + trunk
    const body = part(new THREE.BoxGeometry(W, H, L * 0.94), paint, 0, 0, 0); body.castShadow = true;
    part(new THREE.BoxGeometry(W * 0.94, H * 0.5, L * 0.26), paint, 0, H * 0.55, -L * 0.3);
    part(new THREE.BoxGeometry(W * 0.94, H * 0.45, L * 0.18), paint, 0, H * 0.52, L * 0.36);
    // cabin with wrap-around glass
    part(new THREE.BoxGeometry(W * 0.86, H * 0.85, L * 0.4), paint, 0, H * 0.85, L * 0.04);
    part(new THREE.BoxGeometry(W * 0.88, H * 0.55, L * 0.36), this._carGlass, 0, H * 0.95, L * 0.04);
    // skirt / bumpers
    part(new THREE.BoxGeometry(W * 1.02, H * 0.35, 0.05 * S), this._carTrim, 0, -H * 0.2, -L * 0.46);
    part(new THREE.BoxGeometry(W * 1.02, H * 0.35, 0.05 * S), this._carTrim, 0, -H * 0.2, L * 0.46);
    // wheels
    [[-1, -0.32], [1, -0.32], [-1, 0.34], [1, 0.34]].forEach(([sx, fz]) => {
      const wh = part(new THREE.CylinderGeometry(H * 0.62, H * 0.62, W * 0.14, 10), this._carTire, sx * W * 0.5, -H * 0.42, fz * L);
      wh.rotation.z = Math.PI / 2;
    });
    // headlights / taillights
    [-1, 1].forEach(sx => {
      part(new THREE.BoxGeometry(W * 0.18, H * 0.22, 0.02), this._carHead, sx * W * 0.3, H * 0.12, -L * 0.485);
      part(new THREE.BoxGeometry(W * 0.2, H * 0.18, 0.02), this._carTail, sx * W * 0.3, H * 0.12, L * 0.485);
    });
    return car;
  }

  // ================= RAIL CITY (rideable monorail, day↔night cycle, parks & birds) =================
  buildRailCity(W) {
    const S = 7;
    // day/night palette endpoints
    this.scene.background = new THREE.Color(0x9ec9e8);
    this.scene.fog = new THREE.FogExp2(0x9ec9e8, 0.0022);

    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(95 * S, 95 * S),
      new THREE.MeshStandardMaterial({ color: 0x30323a, roughness: 0.78, metalness: 0.22 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; W.add(ground);

    // road grid + markings
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x28292f, roughness: 0.65, metalness: 0.28 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffe7a0, emissive: 0x4a3a10, emissiveIntensity: 0.5 });
    for (let i = -36; i <= 36; i += 6) {
      if (Math.abs(i) < 3) continue;
      const rh = new THREE.Mesh(new THREE.BoxGeometry(1.0 * S, 0.06, 80 * S), roadMat); rh.position.set(i * S, 0, 0); rh.receiveShadow = true; W.add(rh);
      const rv = new THREE.Mesh(new THREE.BoxGeometry(80 * S, 0.06, 1.0 * S), roadMat); rv.position.set(0, 0, i * S); rv.receiveShadow = true; W.add(rv);
      for (let m = -35; m <= 35; m += 8) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.16 * S, 0.04, 1.2 * S), lineMat); a.position.set(i * S, 0.05, m * S); W.add(a);
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.2 * S, 0.04, 0.16 * S), lineMat); b.position.set(m * S, 0.05, i * S); W.add(b);
      }
    }

    // buildings with enhanced facade textures (real concrete + neon window bands)
    const baseTex = () => TextureGen.createImageTexture('concrete', () => TextureGen.createStonePath(), 2, 4);
    const tints = [0x9fb0c4, 0xb6a98f, 0x8fa9b8, 0xc2b6a0, 0x9aa7b5];
    const neonColors = [0xff3366, 0x33ffcc, 0xffaa33, 0xaa44ff, 0x19f0ff, 0xff66aa];
    const winMats = neonColors.map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.0 }));
    this._railWinMats = winMats;
    const self = this;
    function makeBuilding(x, z, w, d, h, ni) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ map: baseTex(), color: tints[(Math.random() * tints.length) | 0], roughness: 0.78, metalness: 0.15 }));
      body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; grp.add(body);
      const wm = winMats[ni % winMats.length];
      const bands = Math.min(6, Math.max(2, Math.floor(h / 9)));
      for (let r = 0; r < bands; r++) {
        const by = (r + 1) * (h / (bands + 1));
        const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.7, d + 0.1), wm);
        band.position.y = by; grp.add(band);
      }
      grp.position.set(x, 0, z); W.add(grp); self.objects.push(body);
      return grp;
    }
    const R = 34;
    for (let x = -R; x <= R; x += 5.5) {
      for (let z = -R; z <= R; z += 5.5) {
        if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
        // keep clear of the monorail oval band
        const ovalDist = Math.hypot((x * S) / (30 * S), (z * S) / (24 * S));
        if (ovalDist > 0.82 && ovalDist < 1.18) continue;
        if (Math.random() > 0.6) continue;
        const w = (0.8 + Math.random() * 1.0) * S, d = (0.8 + Math.random() * 1.0) * S;
        const h = (1.2 + Math.random() * 4.5) * S;
        makeBuilding(x * S + (Math.random() - 0.5) * 6, z * S + (Math.random() - 0.5) * 6, w, d, h, (Math.random() * winMats.length) | 0);
      }
    }
    // skyscrapers
    [[-20, -18], [22, -20], [-18, 22], [20, 20], [0, -30], [-30, 0], [30, 0], [0, 30]].forEach((p, idx) => {
      const h = 7.2 * S;
      const b = makeBuilding(p[0] * S, p[1] * S, 1.3 * S, 1.3 * S, h, idx);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14 * S, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff0000, emissiveIntensity: 0.9 }));
      beacon.position.y = h + 0.4 * S; b.add(beacon);
    });

    // 3 green parks
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x3f7d33, roughness: 0.95 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a28, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8c43, roughness: 1, flatShading: true });
    const addPark = (cx, cz, rad) => {
      const pg = new THREE.Mesh(new THREE.CircleGeometry(rad, 24), grassMat);
      pg.rotation.x = -Math.PI / 2; pg.position.set(cx, 0.02, cz); pg.receiveShadow = true; W.add(pg);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * (rad - 1);
        const tx = cx + Math.cos(a) * r, tz = cz + Math.sin(a) * r;
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * S * 0.5, 0.32 * S * 0.5, 0.7 * S, 5), trunkMat);
        tr.position.set(tx, 0.35 * S, tz); tr.castShadow = true; W.add(tr);
        const fo = new THREE.Mesh(new THREE.ConeGeometry(0.42 * S * 0.7, 0.7 * S, 7), leafMat);
        fo.position.set(tx, 0.82 * S, tz); fo.castShadow = true; W.add(fo);
      }
    };
    addPark(26 * S, 26 * S, 6.0 * S); addPark(-28 * S, -28 * S, 6.5 * S); addPark(-24 * S, 20 * S, 5.5 * S);

    // ===== MONORAIL (rideable) =====
    const trackH = 4.6 * S * 0.55; // ~17.7 — reachable via station ramp
    const rx = 30 * S, rz = 24 * S;
    const pts = [];
    for (let i = 0; i <= 120; i++) { const t = (i / 120) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * rx, trackH, Math.sin(t) * rz)); }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8da6c4, metalness: 0.7, roughness: 0.3 });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.5, 8, true), railMat); tube.castShadow = true; W.add(tube);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x7790b0, roughness: 0.6 });
    for (let i = 0; i < pts.length - 1; i += 8) {
      const pt = pts[i];
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * S * 0.5, 0.6 * S * 0.5, trackH, 6), pillarMat);
      pillar.position.set(pt.x, trackH / 2, pt.z); pillar.castShadow = true; W.add(pillar); this.objects.push(pillar);
    }

    // train: 4 open-top cars you can stand on
    const carW = 2.0 * S * 0.7, carH = 1.4 * S * 0.7, carL = 2.6 * S * 0.8;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdd44aa, metalness: 0.5, roughness: 0.4, emissive: 0x331122, emissiveIntensity: 0.3 });
    const cars = [];
    const trainTrim = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.6, metalness: 0.5 });
    const trainGlass = new THREE.MeshStandardMaterial({ color: 0x88ccff, emissive: 0x2288aa, emissiveIntensity: 0.4, metalness: 0.3, roughness: 0.1 });
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
    for (let i = 0; i < 4; i++) {
      const car = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(carW, carH, carL), bodyMat);
      shell.castShadow = true; car.add(shell);
      // streamlined pyramidal noses on both ends
      [-1, 1].forEach(sz => {
        const nose = new THREE.Mesh(new THREE.ConeGeometry(carW * 0.5, 0.9 * S * 0.5, 4), bodyMat);
        nose.rotation.x = sz * Math.PI / 2; nose.rotation.y = Math.PI / 4;
        nose.scale.y = 1; nose.scale.x = 1; nose.scale.z = carH / carW;
        nose.position.set(0, 0, sz * (carL / 2 + 0.9 * S * 0.25)); car.add(nose);
        // head/tail light strips on the nose
        const hl = new THREE.Mesh(new THREE.BoxGeometry(carW * 0.5, 0.12, 0.06), sz < 0 ? headLightMat : tailLightMat);
        hl.position.set(0, -carH * 0.18, sz * (carL / 2 + 0.32 * S)); car.add(hl);
      });
      // continuous window band with mullions
      const win = new THREE.Mesh(new THREE.BoxGeometry(carW + 0.04, carH * 0.36, carL * 0.84), trainGlass);
      win.position.y = 0.08; car.add(win);
      for (let mzi = -2; mzi <= 2; mzi++) {
        const mull = new THREE.Mesh(new THREE.BoxGeometry(carW + 0.06, carH * 0.38, 0.07 * S), trainTrim);
        mull.position.set(0, 0.08, mzi * carL * 0.19); car.add(mull);
      }
      // recessed door panels on each side
      [-1, 1].forEach(sx => [-0.24, 0.24].forEach(fz => {
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.03, carH * 0.62, 0.34 * S), trainTrim);
        door.position.set(sx * (carW / 2 + 0.005), -carH * 0.08, fz * carL); car.add(door);
      }));
      // under-skirt + accent stripe
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(carW * 0.92, 0.22 * S, carL * 0.9), trainTrim);
      skirt.position.y = -carH / 2 - 0.06 * S; car.add(skirt);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(carW + 0.05, 0.07, carL * 0.92),
        new THREE.MeshStandardMaterial({ color: 0x19f0ff, emissive: 0x19f0ff, emissiveIntensity: 0.9 }));
      stripe.position.y = -carH * 0.32; car.add(stripe);
      // flat ride-on roof deck
      const roof = new THREE.Mesh(new THREE.BoxGeometry(carW + 0.3, 0.25, carL + 0.3),
        new THREE.MeshStandardMaterial({ color: 0xb8c6d8, metalness: 0.4, roughness: 0.5 }));
      roof.position.y = carH / 2 + 0.12; car.add(roof);
      // roof AC pods at both ends of the deck
      [-1, 1].forEach(sz => {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(carW * 0.45, 0.18 * S, 0.3 * S), trainTrim);
        pod.position.set(0, carH / 2 + 0.32, sz * (carL / 2 - 0.28 * S)); car.add(pod);
      });
      // rails so you don't slide off
      [[-1, 0], [1, 0]].forEach(([sx]) => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, carL), new THREE.MeshStandardMaterial({ color: 0x99aabb, metalness: 0.6 }));
        r.position.set(sx * (carW / 2), carH / 2 + 0.4, 0); car.add(r);
      });
      W.add(car); cars.push(car);
      car.userData.prevPos = new THREE.Vector3();
      car.userData.delta = new THREE.Vector3();
    }
    const carTop = carH / 2 + 0.25; // local top surface y
    const carSpacing = 0.07; // progress gap between cars

    // ===== STATION: deck at track height + ramp from ground =====
    const station = new THREE.Group();
    const deckX = rx, deckZ = 0; // east side of the oval, on the track
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x55606e, roughness: 0.7, metalness: 0.3 });
    const deckW = 7 * S * 0.7, deckD = 6 * S * 0.7;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.5, deckD), deckMat);
    deck.position.set(deckX + carW * 0.9, trackH - 0.25, deckZ); deck.receiveShadow = true; deck.castShadow = true; station.add(deck);
    // canopy posts
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3, 6), deckMat);
      post.position.set(deckX + carW * 0.9 + sx * deckW * 0.4, trackH + 1.3, deckZ + sz * deckD * 0.4); station.add(post);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(deckW + 1, 0.3, deckD + 1),
      new THREE.MeshStandardMaterial({ color: 0x3aa0c0, emissive: 0x114455, emissiveIntensity: 0.4, metalness: 0.4 }));
    canopy.position.set(deckX + carW * 0.9, trackH + 2.8, deckZ); station.add(canopy);
    // ramp from ground up to deck
    const rampLen = trackH * 2.4;
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4 * S * 0.7, 0.4, rampLen), deckMat);
    const rampAngle = Math.atan2(trackH - 0.25, rampLen * 0.92);
    ramp.position.set(deckX + carW * 0.9 + deckW * 0.5 + Math.cos(rampAngle) * rampLen * 0.46, (trackH - 0.25) / 2, deckZ);
    ramp.rotation.z = rampAngle; station.add(ramp);
    W.add(station);
    // make ramp + deck climbable: register as step colliders is complex; instead expose deck for support and a simple ramp support handled below
    this.railRamp = { x1: deckX + carW * 0.9 + deckW * 0.5, x2: deckX + carW * 0.9 + deckW * 0.5 + Math.cos(rampAngle) * rampLen * 0.92, z: deckZ, hw: 2 * S * 0.7, top: trackH - 0.25 };

    // a glowing station sign
    const sign = new THREE.Mesh(new THREE.BoxGeometry(deckW, 1.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x19f0ff, emissive: 0x19f0ff, emissiveIntensity: 0.8 }));
    sign.position.set(deckX + carW * 0.9, trackH + 1.4, deckZ - deckD * 0.5); station.add(sign);

    // clouds
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xf2f6ff, transparent: true, opacity: 0.82, roughness: 1 });
    const clouds = [];
    for (let i = 0; i < 26; i++) {
      const cg = new THREE.Group();
      const parts = 3 + (Math.random() * 3 | 0);
      for (let p = 0; p < parts; p++) {
        const s = (3 + Math.random() * 3) * S * 0.4;
        const m = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 6), cloudMat);
        m.position.set((Math.random() - 0.5) * 8 * S * 0.4, (Math.random() - 0.5) * 3 * S * 0.4, (Math.random() - 0.5) * 7 * S * 0.4);
        cg.add(m);
      }
      cg.position.set((Math.random() - 0.5) * 85 * S * 0.6, (60 + Math.random() * 30) * S * 0.4, (Math.random() - 0.5) * 75 * S * 0.6);
      cg.userData = { sx: (Math.random() - 0.5) * 1.2, sz: (Math.random() - 0.5) * 0.6 };
      W.add(cg); clouds.push(cg);
    }

    // birds
    const birdMat = new THREE.MeshStandardMaterial({ color: 0x33302c });
    const birds = [];
    for (let i = 0; i < 36; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.13 * S * 0.6, 0.3 * S * 0.6, 4), birdMat);
      b.userData = { x: (Math.random() - 0.5) * 65 * S * 0.6, z: (Math.random() - 0.5) * 65 * S * 0.6, y: (30 + Math.random() * 22) * S * 0.4, vx: (Math.random() - 0.5) * 6, vz: (Math.random() - 0.5) * 6, flap: Math.random() * 6 };
      b.position.set(b.userData.x, b.userData.y, b.userData.z); W.add(b); birds.push(b);
    }

    // traffic
    const vColors = [0xff3366, 0x33ccff, 0xaa66ff, 0x66ff99, 0xffaa33, 0xff88cc];
    const vehicles = [];
    const lanes = [];
    for (let z = -30; z <= 30; z += 12) { if (Math.abs(z) < 4) continue; lanes.push({ axis: 'x', fixed: z * S }); }
    for (let x = -30; x <= 30; x += 12) { if (Math.abs(x) < 4) continue; lanes.push({ axis: 'z', fixed: x * S }); }
    lanes.forEach(lane => {
      for (let k = 0; k < 2; k++) {
        const car = this._makeCar(S, vColors[(Math.random() * vColors.length) | 0]);
        const dir = Math.random() > 0.5 ? 1 : -1, pos = -42 * S + Math.random() * 84 * S;
        // car forward is -z: orient the nose along the direction of travel
        if (lane.axis === 'x') { car.position.set(pos, 0.32 * S, lane.fixed); car.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
        else { car.position.set(lane.fixed, 0.32 * S, pos); car.rotation.y = dir > 0 ? Math.PI : 0; }
        W.add(car); vehicles.push({ mesh: car, lane, dir, pos, speed: 9 + Math.random() * 8 });
      }
    });

    // central monument
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9 * S, 2.1 * S, 0.5 * S, 8), new THREE.MeshStandardMaterial({ color: 0x6688aa, metalness: 0.5 }));
    base.position.y = 0.25 * S; base.castShadow = true; W.add(base); this.objects.push(base);
    const monOrb = new THREE.Mesh(new THREE.SphereGeometry(0.7 * S, 20, 20), new THREE.MeshStandardMaterial({ color: 0xff77aa, emissive: 0xff44aa, emissiveIntensity: 0.55 }));
    monOrb.position.y = 2.4 * S; W.add(monOrb);

    // ===== Lighting (animated for day/night) =====
    const ambient = new THREE.AmbientLight(0xbfd0e0, 0.8); W.add(ambient);
    const hemi = new THREE.HemisphereLight(0xaad4ff, 0x55663a, 0.7); W.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.5);
    sun.position.set(80, 150, -60); sun.castShadow = true; sun.shadow.bias = -0.0002;
    sun.shadow.camera.left = -220; sun.shadow.camera.right = 220; sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
    sun.shadow.camera.far = 600; sun.shadow.mapSize.set(1024, 1024); W.add(sun);
    // sun/moon disc
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(10 * S * 0.5, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff4c8, fog: false }));
    W.add(sunDisc);

    this.railProps = {
      curve, cars, carTop, carHW: Math.max(carW, carL) / 2 + 0.3, carSpacing, progress: 0,
      deck: { x: deck.position.x, z: deck.position.z, hw: deckW / 2, hd: deckD / 2, top: trackH },
      clouds, birds, vehicles, span: 42 * S,
      ambient, hemi, sun, sunDisc, monOrb, winMats,
      cycle: 0, S
    };
    // place player near the station ramp foot
    this._railSpawn = new THREE.Vector3(deckX + carW * 0.9 + deckW * 0.5 + 8 * S * 0.4, this.player.height, deckZ);
  }

  // ================= MEGAWATT CITY 1 (dense neon grid, live traffic) =================
  buildMegaCity(W) {
    const S = 6; // scale-up from the orbit demo to FPS scale
    this.scene.background = new THREE.Color(0x050516);
    this.scene.fog = new THREE.FogExp2(0x050516, 0.0028);

    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(95 * S, 95 * S),
      new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.5, metalness: 0.4 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; W.add(ground);

    // road grid + glowing lane markings
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.3 });
    const markMat = new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0x553300, emissiveIntensity: 0.8 });
    for (let i = -35; i <= 35; i += 5) {
      if (Math.abs(i) < 3) continue;
      const rh = new THREE.Mesh(new THREE.BoxGeometry(1.2 * S, 0.08, 75 * S), roadMat);
      rh.position.set(i * S, 0, 0); rh.receiveShadow = true; W.add(rh);
      const rv = new THREE.Mesh(new THREE.BoxGeometry(75 * S, 0.08, 1.2 * S), roadMat);
      rv.position.set(0, 0, i * S); rv.receiveShadow = true; W.add(rv);
      for (let m = -32; m <= 32; m += 8) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.2 * S, 0.05, 1.5 * S), markMat);
        a.position.set(i * S, 0.06, m * S); W.add(a);
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.5 * S, 0.05, 0.2 * S), markMat);
        b.position.set(m * S, 0.06, i * S); W.add(b);
      }
    }

    const buildingColors = [0x4a6c8f, 0x5a7c9f, 0x3a5c7a, 0x6a8caf, 0x2a4c6a, 0x7a9cbf, 0x5d7a9a, 0x4a6a8a];
    const neonColors = [0xff3366, 0x33ffcc, 0xffaa33, 0xaa44ff, 0x00ccff, 0xff66aa];
    const self = this;
    function makeBuilding(x, z, w, d, h, ci, ni) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: buildingColors[ci % buildingColors.length],
          map: TextureGen.createImageTexture('metal', null, 1, Math.max(2, Math.round(h / 8))),
          normalMap: TextureGen.createNormalTexture('concreteN', 1, Math.max(2, Math.round(h / 8))),
          roughness: 0.35, metalness: 0.5,
        }));
      body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; grp.add(body);
      // emissive window bands (cheap: a few glowing rings instead of hundreds of window meshes)
      const nm = new THREE.MeshStandardMaterial({ color: neonColors[ni % neonColors.length], emissive: neonColors[ni % neonColors.length], emissiveIntensity: 1.2 });
      const bands = Math.min(6, Math.max(2, Math.floor(h / (1.6 * 6))));
      for (let r = 0; r < bands; r++) {
        const by = (r + 1) * (h / (bands + 1));
        const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.7, d + 0.12), nm);
        band.position.y = by; grp.add(band);
      }
      // glowing roof trim
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), nm);
      trim.position.y = h - 0.2; grp.add(trim);
      grp.position.set(x, 0, z);
      W.add(grp); self.objects.push(body);
      return grp;
    }

    // grid of mid-rise blocks (sparser for performance)
    const R = 34;
    for (let x = -R; x <= R; x += 5.5) {
      for (let z = -R; z <= R; z += 5.5) {
        if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
        if (Math.random() > 0.62) continue;
        const w = (0.9 + Math.random() * 1.1) * S, d = (0.9 + Math.random() * 1.1) * S;
        const h = (1.5 + Math.random() * 4.5) * S;
        makeBuilding(x * S + (Math.random() - 0.5) * 6, z * S + (Math.random() - 0.5) * 6, w, d, h,
          (Math.random() * buildingColors.length) | 0, (Math.random() * neonColors.length) | 0);
      }
    }
    // landmark skyscrapers with antenna + beacon
    [[-18, -15], [20, -16], [-17, 19], [19, 18], [0, -24], [-24, 0], [24, 0], [0, 24], [-28, -10], [28, 12], [-12, 28], [12, 28]]
      .forEach((p, idx) => {
        const h = (7 + Math.random() * 3) * S;
        const b = makeBuilding(p[0] * S, p[1] * S, 1.4 * S, 1.4 * S, h, idx, idx % neonColors.length);
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * S, 0.16 * S, 1.0 * S, 5),
          new THREE.MeshStandardMaterial({ color: 0xddbb88, metalness: 0.8 }));
        ant.position.y = h + 0.5 * S; b.add(ant);
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14 * S, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 0.9 }));
        beacon.position.y = h + 1.0 * S; b.add(beacon);
      });

    // trees lining the avenues
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a28, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8c43, roughness: 1, flatShading: true });
    for (let i = 0; i < 120; i++) {
      const x = (Math.random() - 0.5) * 70 * S, z = (Math.random() - 0.5) * 70 * S;
      if (Math.hypot(x, z) < 6 * S) continue;
      const g = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * S * 0.5, 0.45 * S * 0.5, 1.1 * S, 6), trunkMat);
      tr.position.y = 0.55 * S; g.add(tr);
      [1.0, 1.55, 2.0].forEach((y, k) => {
        const f = new THREE.Mesh(new THREE.ConeGeometry((0.65 - k * 0.12) * S * 0.6, 0.85 * S * 0.6, 8), leafMat);
        f.position.y = (1.0 + y * 0.45) * S; g.add(f);
      });
      g.position.set(x, 0, z); W.add(g);
    }

    // street lamps
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x99aacc, metalness: 0.7 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffcc88, emissive: 0xff7700, emissiveIntensity: 0.9 });
    for (let x = -32; x <= 32; x += 12) for (let z = -32; z <= 32; z += 12) {
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * S * 0.5, 0.26 * S * 0.5, 2.6 * S, 6), poleMat);
      pole.position.set(x * S, 1.3 * S, z * S); W.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28 * S * 0.6, 8, 8), lampMat);
      lamp.position.set(x * S, 2.7 * S, z * S); W.add(lamp);
    }

    // central monument with rotating ring + orb
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2 * S, 2.5 * S, 0.5 * S, 8),
      new THREE.MeshStandardMaterial({ color: 0x6688aa, metalness: 0.6 }));
    base.position.y = 0.25 * S; W.add(base); this.objects.push(base);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.9 * S, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xff77aa, emissive: 0xff44aa, emissiveIntensity: 0.7 }));
    orb.position.y = 3.0 * S; W.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0 * S, 0.12 * S, 24, 80),
      new THREE.MeshStandardMaterial({ color: 0xff66cc, emissive: 0xff22aa, emissiveIntensity: 0.8 }));
    ring.position.y = 3.0 * S; W.add(ring);
    const orbLight = new THREE.PointLight(0xff55aa, 2.5, 30 * S * 0.4); orbLight.position.y = 3.0 * S; W.add(orbLight);

    // live traffic — boxes cruising the avenues
    const vColors = [0xff3366, 0x33ccff, 0xaa66ff, 0x66ff99, 0xffaa33, 0xff66cc, 0x44ffcc];
    const vehicles = [];
    const lanes = [];
    for (let z = -32; z <= 32; z += 8) { if (Math.abs(z) < 3) continue; lanes.push({ axis: 'x', fixed: z * S }); }
    for (let x = -32; x <= 32; x += 8) { if (Math.abs(x) < 3) continue; lanes.push({ axis: 'z', fixed: x * S }); }
    lanes.forEach(lane => {
      const n = 2 + (Math.random() * 2 | 0);
      for (let k = 0; k < n; k++) {
        const car = this._makeCar(S * 1.15, vColors[(Math.random() * vColors.length) | 0]);
        const dir = Math.random() > 0.5 ? 1 : -1;
        const pos = -38 * S + Math.random() * 76 * S;
        // car forward is -z: orient the nose along the direction of travel
        if (lane.axis === 'x') { car.position.set(pos, 0.4 * S, lane.fixed); car.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
        else { car.position.set(lane.fixed, 0.4 * S, pos); car.rotation.y = dir > 0 ? Math.PI : 0; }
        W.add(car);
        vehicles.push({ mesh: car, lane, dir, pos, speed: (8 + Math.random() * 9) });
      }
    });

    // floating energy orbs around the monument
    const orbs = [];
    for (let i = 0; i < 40; i++) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.12 * S, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xff66cc, emissive: 0xff44aa, emissiveIntensity: 0.7 }));
      o.userData = { angle: Math.random() * Math.PI * 2, radius: (2.5 + Math.random() * 5) * S, yOff: (1 + Math.random() * 4) * S, speed: 0.4 + Math.random() };
      W.add(o); orbs.push(o);
    }

    // drifting neon dust
    const pc = 1400, pg = new THREE.BufferGeometry(), pp = new Float32Array(pc * 3);
    for (let i = 0; i < pc; i++) { pp[i * 3] = (Math.random() - 0.5) * 90 * S; pp[i * 3 + 1] = Math.random() * 14 * S; pp[i * 3 + 2] = (Math.random() - 0.5) * 90 * S; }
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x88aaff, size: 0.3, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    W.add(dust);

    // lighting
    W.add(new THREE.AmbientLight(0x1a1a3a, 0.6));
    W.add(new THREE.HemisphereLight(0x223066, 0x0a0a14, 0.4));
    const moon = new THREE.DirectionalLight(0x99bbff, 0.85);
    moon.position.set(80, 160, -60); moon.castShadow = true; moon.shadow.bias = -0.0002;
    moon.shadow.camera.left = -200; moon.shadow.camera.right = 200; moon.shadow.camera.top = 200; moon.shadow.camera.bottom = -200;
    moon.shadow.camera.far = 600; moon.shadow.mapSize.set(1024, 1024); W.add(moon);

    this.megaProps = { vehicles, orbs, ring, orb, orbLight, dust, span: 38 * S, S };
  }

  // shared: an enterable hollow building (walls are colliders, doorway gap)
  buildEnterable(W, x, z, w, d, style) {
    const t = 0.35, H = 3.4;
    const add = (gw, gh, gd, px, py, pz, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), mat || style.wall);
      m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true;
      W.add(m); this.objects.push(m); return m;
    };
    add(w, H, t, x, H / 2, z - d / 2);
    add(t, H, d, x - w / 2, H / 2, z);
    add(t, H, d, x + w / 2, H / 2, z);
    const dg = 1.9, seg = (w - dg) / 2;
    add(seg, H, t, x - (dg / 2 + seg / 2), H / 2, z + d / 2);
    add(seg, H, t, x + (dg / 2 + seg / 2), H / 2, z + d / 2);
    add(dg, H * 0.3, t, x, H - H * 0.15, z + d / 2); // lintel over door
    // interior floor
    const fl = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.1, d - 0.1), style.floor);
    fl.position.set(x, 0.06, z); fl.receiveShadow = true; W.add(fl);
    // roof (collider so you can't see in from above / shaded interior)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, t, d + 0.4), style.roof || style.wall);
    roof.position.set(x, H + t / 2, z); roof.castShadow = true; W.add(roof); this.objects.push(roof);
    // pitched roof for houses
    if (style.cone) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.8, 1.7, 4), style.cone);
      cone.rotation.y = Math.PI / 4; cone.position.set(x, H + t + 0.85, z); cone.castShadow = true; W.add(cone);
    }
    // glowing windows on the side walls (neon city)
    if (style.win) {
      [-1, 1].forEach(s => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.0), style.win);
        win.position.set(x + s * (w / 2 - 0.02), 1.7, z - d * 0.18);
        win.rotation.y = -s * Math.PI / 2; W.add(win);
        const win2 = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.0), style.win);
        win2.position.set(x + s * (w / 2 - 0.02), 1.7, z + d * 0.22);
        win2.rotation.y = -s * Math.PI / 2; W.add(win2);
      });
    }
    // interior glow so it isn't pitch black inside
    const il = new THREE.PointLight(style.lamp || 0xffd9a0, 1.1, w + d); il.position.set(x, H - 0.6, z); W.add(il);
  }

  // ================= NIGHT CITY =================
  buildCity(W) {
    this.scene.background = null;
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.012);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 24),
      new THREE.MeshBasicMaterial({ map: TextureGen.createSky(), side: THREE.BackSide, fog: false }));
    W.add(sky);

    const fTex = TextureGen.createImageTexture('asphalt', () => TextureGen.createAsphalt(), 60, 60);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
      new THREE.MeshStandardMaterial({ map: fTex, normalMap: TextureGen.createNormalTexture('concreteN', 60, 60), roughness: 0.48, metalness: 0.55, color: 0x48505e }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; W.add(floor);

    // NEON CITY street detail: sidewalks, grass strips, and readable street signs
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x8a8f9b, roughness: 0.72, metalness: 0.12 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xd7dbe4, roughness: 0.5, metalness: 0.18 });
    const grassTex = TextureGen.createGrass(true); grassTex.repeat.set(18, 18);
    const cityGrassMat = new THREE.MeshStandardMaterial({ map: grassTex, color: 0x1f6f35, roughness: 0.95, metalness: 0.02 });
    const signPostMat = new THREE.MeshStandardMaterial({ color: 0xb9c9d8, roughness: 0.35, metalness: 0.75 });
    const signFaceMat = new THREE.MeshBasicMaterial({ color: 0x10263c });
    const signGlowMat = new THREE.MeshBasicMaterial({ color: 0x19f0ff, transparent: true, opacity: 0.18 });
    const addCitySlab = (w, d, x, z, mat, y = 0.045, h = 0.09) => {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      slab.position.set(x, y, z); slab.receiveShadow = true; slab.castShadow = true; W.add(slab);
      return slab;
    };
    // Raised sidewalks around the main neon avenue cross.
    [[-11.5, 0, 4.6, 310], [11.5, 0, 4.6, 310], [0, -11.5, 310, 4.6], [0, 11.5, 310, 4.6]].forEach(([x, z, w, d]) => addCitySlab(w, d, x, z, sidewalkMat, 0.075, 0.15));
    // Thin bright curbs make the sidewalks easy to read while moving at speed.
    [[-6.7, 0, 0.42, 310], [6.7, 0, 0.42, 310], [-16.3, 0, 0.34, 310], [16.3, 0, 0.34, 310],
     [0, -6.7, 310, 0.42], [0, 6.7, 310, 0.42], [0, -16.3, 310, 0.34], [0, 16.3, 310, 0.34]].forEach(([x, z, w, d]) => addCitySlab(w, d, x, z, curbMat, 0.16, 0.06));
    // Grass pockets and median strips break up the asphalt without blocking gameplay.
    [[-23, 0, 5.0, 300], [23, 0, 5.0, 300], [0, -23, 300, 5.0], [0, 23, 300, 5.0],
     [-23, -23, 20, 20], [23, -23, 20, 20], [-23, 23, 20, 20], [23, 23, 20, 20]].forEach(([x, z, w, d]) => addCitySlab(w, d, x, z, cityGrassMat, 0.035, 0.045));

    const makeStreetSignTexture = (label) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 96;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#061321'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = '#19f0ff'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, c.width - 12, c.height - 12);
      ctx.fillStyle = '#19f0ff'; ctx.font = 'bold 30px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#19f0ff'; ctx.shadowBlur = 12; ctx.fillText(label, c.width / 2, c.height / 2);
      const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
      if ('encoding' in tex && THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
      if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const addStreetSign = (x, z, label, rot = 0) => {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8), signPostMat);
      post.position.y = 1.6; post.castShadow = true; g.add(post);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.78, 0.09), signFaceMat);
      panel.position.set(0, 3.1, 0); panel.castShadow = true; g.add(panel);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.52, 0.58), new THREE.MeshBasicMaterial({ map: makeStreetSignTexture(label), transparent: true }));
      face.position.set(0, 3.1, 0.055); g.add(face);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.92), signGlowMat);
      glow.position.set(0, 3.1, 0.062); g.add(glow);
      g.position.set(x, 0, z); g.rotation.y = rot; W.add(g);
      // sign glow plane is emissive — no per-sign PointLight (33 lights caused city lag)
    };
    [[-17, -17, 'NEON AVE', Math.PI / 4], [17, -17, 'NIGHTFALL', -Math.PI / 4], [-17, 17, 'CYBER ST', Math.PI * 0.75], [17, 17, 'DOWNTOWN', -Math.PI * 0.75],
     [0, -31, 'MAIN ST', 0], [0, 31, 'PLAZA', Math.PI], [-31, 0, 'MARKET', Math.PI / 2], [31, 0, 'SKYWAY', -Math.PI / 2]].forEach(s => addStreetSign(s[0], s[1], s[2], s[3]));

    const variants = [];
    for (let i = 0; i < 5; i++) {
      const t = TextureGen.createBuilding();
      t.map.wrapS = t.map.wrapT = THREE.RepeatWrapping;
      t.emissive.wrapS = t.emissive.wrapT = THREE.RepeatWrapping;
      t.map.repeat.set(1, 12); t.emissive.repeat.set(1, 12); t.map.encoding = THREE.sRGBEncoding;
      variants.push(new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffffff,
        emissiveIntensity: 1.6, roughness: 0.28, metalness: 0.6 }));
    }
    const bldgGeo = new THREE.BoxGeometry(10, 1, 10);
    const billboards = []; const blockSize = 26;
    for (let x = -9; x <= 9; x++) for (let z = -9; z <= 9; z++) {
      if (Math.abs(x) < 3 && Math.abs(z) < 3) continue; // play plaza for enterable bldgs
      if (Math.random() > 0.24) {
        const h = 22 + Math.random() * 55;
        const m = new THREE.Mesh(bldgGeo, variants[(Math.random() * variants.length) | 0]);
        m.position.set(x * blockSize + (Math.random() - 0.5) * 6, h / 2, z * blockSize + (Math.random() - 0.5) * 6);
        m.scale.set(0.8 + Math.random() * 0.7, h, 0.8 + Math.random() * 0.7);
        // only buildings near the playable plaza cast shadows (270 casters tanked the framerate)
        m.castShadow = Math.abs(x) <= 4 && Math.abs(z) <= 4;
        m.receiveShadow = true; W.add(m); this.objects.push(m);
        if (Math.random() > 0.7) billboards.push(m);
        // rooftop detail models: antennas with beacon lights, AC units, water tanks
        if (Math.random() > 0.6) {
          const fx = m.position.x, fz = m.position.z, half = m.scale.x * 10 * 0.28;
          const kind = Math.random();
          if (kind < 0.45) {
            const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 4 + Math.random() * 4, 6), this._roofMetal || (this._roofMetal = new THREE.MeshStandardMaterial({ color: 0x444c5c, metalness: 0.8, roughness: 0.3 })));
            ant.position.set(fx + (Math.random() - 0.5) * half, h + ant.geometry.parameters.height / 2, fz + (Math.random() - 0.5) * half);
            W.add(ant);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
            tip.position.set(ant.position.x, h + ant.geometry.parameters.height + 0.1, ant.position.z);
            W.add(tip);
          } else if (kind < 0.75) {
            const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), this._roofDark || (this._roofDark = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7, metalness: 0.5 })));
            ac.position.set(fx + (Math.random() - 0.5) * half, h + 0.5, fz + (Math.random() - 0.5) * half);
            ac.rotation.y = Math.random() * Math.PI;
            W.add(ac);
          } else {
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.2, 8), this._roofDark || (this._roofDark = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7, metalness: 0.5 })));
            tank.position.set(fx + (Math.random() - 0.5) * half, h + 1.1, fz + (Math.random() - 0.5) * half);
            W.add(tank);
          }
        }
      }
    }
    billboards.slice(0, 26).forEach(b => {
      const bw = 6 + Math.random() * 5, bh = bw * 0.55;
      const bm = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh),
        new THREE.MeshBasicMaterial({ map: TextureGen.createBillboard(), transparent: true, fog: true }));
      const face = (Math.random() * 4) | 0; const half = (b.scale.x * 10) / 2 + 0.3;
      const y = 6 + Math.random() * (b.scale.y - 14);
      if (face === 0) bm.position.set(b.position.x, y, b.position.z + half);
      else if (face === 1) { bm.position.set(b.position.x, y, b.position.z - half); bm.rotation.y = Math.PI; }
      else if (face === 2) { bm.position.set(b.position.x + half, y, b.position.z); bm.rotation.y = -Math.PI / 2; }
      else { bm.position.set(b.position.x - half, y, b.position.z); bm.rotation.y = Math.PI / 2; }
      W.add(bm);
    });

    // enterable neon storefronts you can run inside
    const cityStyle = () => ({
      wall: new THREE.MeshStandardMaterial({ color: 0x20242e, roughness: 0.7, metalness: 0.3 }),
      floor: new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6, metalness: 0.4 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x16181f, roughness: 0.8 }),
      win: new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x19f0ff : 0xff2d95, side: THREE.DoubleSide }),
      lamp: 0x19f0ff
    });
    const spots = [[-22, 18], [24, 16], [-26, -20], [20, -24], [0, 30], [38, -4], [-40, 2]];
    spots.forEach(([sx, sz]) => this.buildEnterable(W, sx, sz, 9 + Math.random() * 3, 9 + Math.random() * 3, cityStyle()));

    const crateGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.8 });
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(crateGeo, crateMat);
      m.position.set((Math.random() - 0.5) * 300, 0.8, (Math.random() - 0.5) * 300);
      m.rotation.y = Math.random() * Math.PI; m.castShadow = true; m.receiveShadow = true;
      let ok = m.position.length() > 6;
      for (const b of this.objects) if (ok && m.position.distanceTo(b.position) < 8) { ok = false; break; }
      if (ok) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 1.62),
          new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x19f0ff : 0xff2d95 }));
        strip.position.y = 0.82; m.add(strip); W.add(m); this.objects.push(m);
      }
    }
    // 18 glowing bulbs for atmosphere, but only 6 real PointLights near the
    // plaza — forward rendering pays per-light on every mesh (Megawatt budget)
    const hues = [0x19f0ff, 0xff2d95, 0x9b5cff, 0xffb347, 0x39ff14];
    for (let i = 0; i < 18; i++) {
      const hue = hues[(Math.random() * hues.length) | 0];
      const near = i < 6;
      const range = near ? 120 : 280;
      const pos = new THREE.Vector3((Math.random() - 0.5) * range, 2.4 + Math.random() * 1.8, (Math.random() - 0.5) * range);
      if (near) {
        const pl = new THREE.PointLight(hue, 3.0, 24, 1.6);
        pl.position.copy(pos); W.add(pl);
      }
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: hue }));
      bulb.position.copy(pos); W.add(bulb);
    }
    // lights
    W.add(new THREE.AmbientLight(0x3a4a60, 0.7));
    W.add(new THREE.HemisphereLight(0x2040a0, 0x101018, 0.55));
    const moon = new THREE.DirectionalLight(0x8899cc, 0.75);
    moon.position.set(120, 180, -80); moon.castShadow = true; moon.shadow.bias = -0.0002;
    moon.shadow.camera.left = -180; moon.shadow.camera.right = 180; moon.shadow.camera.top = 180; moon.shadow.camera.bottom = -180;
    moon.shadow.camera.far = 500; moon.shadow.mapSize.set(1024, 1024); W.add(moon);
  }

  // ================= DAY COUNTRYSIDE =================
  buildFields(W) {
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0x9fd0ee, 90, 360);
    const fsky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 24),
      new THREE.MeshBasicMaterial({ map: TextureGen.createDaySky('#4a8fd4', '#e8d0a8'), side: THREE.BackSide, fog: false }));
    W.add(fsky);

    // rolling grass ground
    const grassTex = TextureGen.createGrass(false); grassTex.repeat.set(60, 60);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
      new THREE.MeshStandardMaterial({ map: grassTex, normalMap: TextureGen.createNormalTexture('dirtN', 60, 60), color: 0x3d6e2f, roughness: 0.95, metalness: 0 }));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; W.add(grass);
    // dirt path patch around spawn (real dirt PBR)
    const path = new THREE.Mesh(new THREE.CircleGeometry(10, 32),
      new THREE.MeshStandardMaterial({ map: TextureGen.createImageTexture('dirt', null, 6, 6), normalMap: TextureGen.createNormalTexture('dirtN', 6, 6), color: 0xc9b078, roughness: 1 }));
    path.rotation.x = -Math.PI / 2; path.position.y = 0.01; path.receiveShadow = true; W.add(path);

    // rolling hills on the horizon (flattened mounds)
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x356128, roughness: 1, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2;
      const r = 150 + Math.random() * 90;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(28 + Math.random() * 36, 10, 8), hillMat);
      hill.position.set(Math.cos(a) * r, -8 - Math.random() * 8, Math.sin(a) * r);
      hill.scale.y = 0.45; W.add(hill);
    }

    // clouds
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfe9f5, emissiveIntensity: 0.25, roughness: 1 });
    for (let i = 0; i < 16; i++) {
      const cg = new THREE.Group();
      for (let p = 0; p < 4; p++) {
        const s = 8 + Math.random() * 10;
        const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 7), cloudMat);
        m.position.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 26);
        cg.add(m);
      }
      cg.position.set((Math.random() - 0.5) * 500, 90 + Math.random() * 60, (Math.random() - 0.5) * 500); W.add(cg);
    }
    // sun
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }));
    sunDisc.position.set(-160, 170, -200); W.add(sunDisc);

    // trees, bushes, flowers
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
    const leafMats = [0x4f9e3e, 0x66b84e, 0x7cce5a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
    const addTree = (x, z, s) => {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.46 * s, 1.6 * s, 6), trunkMat);
      tr.position.y = 0.8 * s; tr.castShadow = true; g.add(tr);
      [1.0, 1.55, 2.05].forEach((y, k) => {
        const f = new THREE.Mesh(new THREE.ConeGeometry((0.95 - k * 0.18) * s, (1.2 - k * 0.18) * s, 8), leafMats[k]);
        f.position.y = (1.4 + y * 0.7) * s; f.castShadow = true; g.add(f);
      });
      g.position.set(x, 0, z); W.add(g);
      this.objects.push(tr); // trunk blocks
    };
    const flowerCols = [0xff69b4, 0xffdd55, 0xff8a4c, 0xcd88ff, 0x66ccff, 0xff5d5d];
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 200;
      addTree(Math.cos(a) * r, Math.sin(a) * r, 0.8 + Math.random() * 0.9);
    }
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 230;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
        new THREE.MeshStandardMaterial({ color: flowerCols[(Math.random() * flowerCols.length) | 0], emissive: 0x221100, emissiveIntensity: 0.15 }));
      head.position.set(x, 0.3, z); head.castShadow = true; W.add(head);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.32, 4), new THREE.MeshStandardMaterial({ color: 0x6aa544 }));
      stem.position.set(x, 0.16, z); W.add(stem);
    }
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 200;
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.6 + Math.random() * 0.5, 7, 6),
        new THREE.MeshStandardMaterial({ color: 0x5a9e3e, roughness: 1, flatShading: true }));
      bush.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r); bush.castShadow = true; W.add(bush);
    }

    // colorful enterable houses
    const bodyCols = [0xf6b43a, 0x6fb3e0, 0xef6f6c, 0x8fd17a, 0xcd88ff, 0xffd35c];
    const roofTex = TextureGen.createImageTexture('asphalt', () => TextureGen.createRoofTile('#26323d'), 6, 6); // fallback if no tile tex
    const houseSpots = [[-26, 20], [28, 18], [-30, -22], [26, -26], [0, 34], [44, 0], [-46, -6]];
    houseSpots.forEach(([sx, sz], i) => {
      const col = bodyCols[i % bodyCols.length];
      this.buildEnterable(W, sx, sz, 8 + Math.random() * 2, 8 + Math.random() * 2, {
        wall: new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.02 }),
        floor: new THREE.MeshStandardMaterial({ color: 0xbc9a6c, roughness: 0.8 }),
        roof: new THREE.MeshStandardMaterial({ color: 0xfff2e0, roughness: 0.4 }),
        cone: new THREE.MeshStandardMaterial({ color: 0xc2572c, roughness: 0.6, flatShading: true }),
        lamp: 0xffd9a0
      });
    });

    // wooden perimeter fence ring
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xc2a878, roughness: 0.8 });
    const fr = 70, posts = 70;
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.25), fenceMat);
      post.position.set(Math.cos(a) * fr, 0.55, Math.sin(a) * fr); post.castShadow = true; W.add(post);
    }

    // bright daytime lighting
    W.add(new THREE.AmbientLight(0xbfd4e8, 0.85));
    W.add(new THREE.HemisphereLight(0xaad4ff, 0x6b8f4a, 0.7));
    const sun = new THREE.DirectionalLight(0xfff3d0, 1.5);
    sun.position.set(-120, 150, -150); sun.castShadow = true; sun.shadow.bias = -0.0002;
    sun.shadow.camera.left = -120; sun.shadow.camera.right = 120; sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
    sun.shadow.camera.far = 500; sun.shadow.mapSize.set(1024, 1024); W.add(sun);
  }

  // ---------------- WEAPON MODEL ----------------
  createWeaponModel() {
    this.gunGroup = new THREE.Group();
    // shared materials
    this._matDark = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.45, metalness: 0.6 });
    this._matMetal = new THREE.MeshStandardMaterial({ color: 0x4a505c, metalness: 0.9, roughness: 0.25 });
    this._matPoly = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.6, metalness: 0.4 });
    this._matSteel = new THREE.MeshStandardMaterial({ color: 0x282c34, metalness: 0.95, roughness: 0.18 });
    this._matWood = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.75, metalness: 0.05 });
    this._matBrass = new THREE.MeshStandardMaterial({ color: 0xb89230, metalness: 0.9, roughness: 0.3 });
    this.gltfLoader = null;

    this.gunModels = {
      pistol:     this._buildPistol(0x19f0ff),
      smg:        this._buildSMG(0xffd166),
      shotgun:    this._buildShotgun(0xff2d95),
      forcepush:  this.buildForcePush(),
      plasma:     this._buildPlasma(0x9b5cff),
      pulse:      this._buildPulse(0xff7a18),
    };
    // second shotgun for dual wield
    this.gunModels.shotgun2 = this._buildShotgun(0xff2d95);
    this.gunModels.shotgun2.position.set(-0.44, 0, 0);
    // second pistol for dual wield (double-tap 1)
    this.gunModels.pistol2 = this._buildPistol(0x19f0ff);
    this.gunModels.pistol2.position.set(-0.44, 0, 0);
    Object.values(this.gunModels).forEach(m => { m.visible = false; this.gunGroup.add(m); });
    this.loadNeonWeaponModels();

    // shared muzzle flash + light
    this.muzzleFlash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.gunGroup.add(this.muzzleFlash);
    this.muzzleLight = new THREE.PointLight(0xffffff, 0, 11);
    this.gunGroup.add(this.muzzleLight);

    this.gunGroup.position.set(0.32, -0.3, -0.6);
    this.camera.add(this.gunGroup);
    this.scene.add(this.camera);
  }


  loadWeaponGLB(key, path, cfg = {}) {
    if (!this.gltfLoader || !this.gunModels || !this.gunModels[key]) return;
    const fallback = this.gunModels[key];
    fallback.userData.loadingGLB = true;
    this.gltfLoader.load(path, gltf => {
      try {
        const source = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!source) return;
        const holder = new THREE.Group();
        holder.name = cfg.name || `${key}_neon_glb_holder`;
        const model = source.clone(true);
        model.traverse(o => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.material) {
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              mats.forEach(m => {
                if (m.map) m.map.encoding = THREE.sRGBEncoding;
                if (m.emissiveMap) m.emissiveMap.encoding = THREE.sRGBEncoding;
                m.needsUpdate = true;
              });
            }
          }
        });
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        model.scale.setScalar((cfg.fit || 0.95) / maxDim);
        const fitBox = new THREE.Box3().setFromObject(model);
        const center = fitBox.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.rotation.set(cfg.rotX || 0, cfg.rotY || 0, cfg.rotZ || 0);
        model.position.add(cfg.offset || new THREE.Vector3());
        holder.add(model);
        holder.userData.muzzle = (cfg.muzzle || fallback.userData.muzzle || new THREE.Vector3(0, 0.03, -0.6)).clone();
        holder.userData.loadedGLB = true;
        holder.userData.weaponSource = path;
        holder.visible = fallback.visible;
        this.gunGroup.remove(fallback);
        this.gunModels[key] = holder;
        this.gunGroup.add(holder);
        if (this.player && this.player.weapons && this.player.weapons[this.player.weaponIdx]) {
          this.updateWeaponModel(this.player.weapons[this.player.weaponIdx].name);
        }
      } catch (err) {
        console.warn('Neon weapon GLB setup failed for', key, err);
      }
    }, undefined, err => console.warn('Neon weapon GLB failed to load:', path, err));
  }

  loadNeonWeaponModels() {
    if (!window.THREE || !THREE.GLTFLoader) return;
    this.gltfLoader = this.gltfLoader || new THREE.GLTFLoader();
    const base = 'assets/models/weapons/';
    this.loadWeaponGLB('katana', base + 'smooth_neon_katana.glb', {
      fit: 1.52,
      rotX: -0.20,
      rotY: Math.PI,
      rotZ: -0.32,
      offset: new THREE.Vector3(0.08, -0.04, -0.40),
      muzzle: new THREE.Vector3(0.09, 0, -1.36)
    });
    this.loadWeaponGLB('bow', base + 'smooth_neon_bow.glb', {
      fit: 1.26,
      rotX: -0.10,
      rotY: Math.PI * 0.5,
      rotZ: 0.02,
      offset: new THREE.Vector3(0.08, -0.02, -0.32),
      muzzle: new THREE.Vector3(0.12, 0, -0.92)
    });
  }

  _accent(hex) { return new THREE.MeshBasicMaterial({ color: hex }); }
  _glow(hex, i) { return new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: i || 1.4, roughness: 0.4 }); }
  _part(g, geo, mat, x, y, z, rx, ry, rz) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); g.add(m); return m;
  }

  // ---- PISTOL: compact sidearm ----
  _buildPistol(c) {
    const g = new THREE.Group();
    // polymer frame (lower)
    this._part(g, new THREE.BoxGeometry(0.085, 0.06, 0.32), this._matPoly, 0, -0.025, -0.06);
    // steel slide (upper) with rear cocking serrations
    this._part(g, new THREE.BoxGeometry(0.09, 0.07, 0.36), this._matSteel, 0, 0.04, -0.07);
    for (let i = 0; i < 4; i++) this._part(g, new THREE.BoxGeometry(0.094, 0.05, 0.008), this._matDark, 0, 0.045, 0.07 + i * 0.018);
    // ejection port recess
    this._part(g, new THREE.BoxGeometry(0.02, 0.03, 0.07), this._matDark, 0.038, 0.05, -0.1);
    // barrel + recoil guide protruding from the slide
    let bar = this._part(g, new THREE.CylinderGeometry(0.018, 0.018, 0.1, 12), this._matMetal, 0, 0.045, -0.28); bar.rotation.x = Math.PI / 2;
    bar = this._part(g, new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8), this._matMetal, 0, 0.012, -0.28); bar.rotation.x = Math.PI / 2;
    // sights: front post + rear notch blocks
    this._part(g, new THREE.BoxGeometry(0.012, 0.018, 0.012), this._matDark, 0, 0.085, -0.235);
    [-0.016, 0.016].forEach(dx => this._part(g, new THREE.BoxGeometry(0.012, 0.016, 0.012), this._matDark, dx, 0.084, 0.1));
    // angled grip with backstrap + stippled side panels
    this._part(g, new THREE.BoxGeometry(0.08, 0.18, 0.095), this._matPoly, 0, -0.135, 0.075, 0.3);
    [-0.043, 0.043].forEach(dx => this._part(g, new THREE.BoxGeometry(0.004, 0.13, 0.07), this._matDark, dx, -0.13, 0.075, 0.3));
    // magazine baseplate
    this._part(g, new THREE.BoxGeometry(0.075, 0.022, 0.1), this._matDark, 0, -0.225, 0.105, 0.3);
    // trigger guard loop + trigger blade
    this._part(g, new THREE.BoxGeometry(0.016, 0.012, 0.1), this._matPoly, 0, -0.095, -0.03);
    this._part(g, new THREE.BoxGeometry(0.016, 0.05, 0.012), this._matPoly, 0, -0.07, -0.075);
    this._part(g, new THREE.BoxGeometry(0.012, 0.035, 0.01), this._matSteel, 0, -0.065, -0.03, 0.25);
    // subtle energy accent line along the slide
    this._part(g, new THREE.BoxGeometry(0.094, 0.006, 0.2), this._accent(c), 0, 0.02, -0.08);
    g.userData.muzzle = new THREE.Vector3(0, 0.045, -0.36);
    return g;
  }

  // ---- SMG: suppressed compact carbine ----
  _buildSMG(c) {
    const g = new THREE.Group();
    // receiver + top picatinny rail with notches
    this._part(g, new THREE.BoxGeometry(0.095, 0.11, 0.42), this._matDark, 0, 0, -0.04);
    this._part(g, new THREE.BoxGeometry(0.05, 0.016, 0.44), this._matSteel, 0, 0.065, -0.05);
    for (let i = 0; i < 7; i++) this._part(g, new THREE.BoxGeometry(0.054, 0.01, 0.012), this._matDark, 0, 0.072, -0.24 + i * 0.06);
    // vented handguard around the barrel
    this._part(g, new THREE.BoxGeometry(0.075, 0.075, 0.2), this._matPoly, 0, 0.01, -0.33);
    [-0.04, 0.04].forEach(dx => { for (let i = 0; i < 3; i++) this._part(g, new THREE.BoxGeometry(0.004, 0.03, 0.035), this._matDark, dx, 0.012, -0.27 - i * 0.055); });
    // barrel + suppressor can
    let bar = this._part(g, new THREE.CylinderGeometry(0.014, 0.014, 0.12, 10), this._matMetal, 0, 0.02, -0.48); bar.rotation.x = Math.PI / 2;
    bar = this._part(g, new THREE.CylinderGeometry(0.026, 0.026, 0.14, 12), this._matSteel, 0, 0.02, -0.56); bar.rotation.x = Math.PI / 2;
    // front sight post + flip-up rear
    this._part(g, new THREE.BoxGeometry(0.01, 0.03, 0.01), this._matDark, 0, 0.09, -0.4);
    this._part(g, new THREE.BoxGeometry(0.026, 0.024, 0.012), this._matDark, 0, 0.09, 0.13);
    // curved magazine (two angled segments)
    this._part(g, new THREE.BoxGeometry(0.058, 0.13, 0.07), this._matMetal, 0, -0.12, -0.06, -0.1);
    this._part(g, new THREE.BoxGeometry(0.056, 0.11, 0.068), this._matMetal, 0, -0.215, -0.035, -0.32);
    // pistol grip + trigger guard
    this._part(g, new THREE.BoxGeometry(0.075, 0.15, 0.09), this._matPoly, 0, -0.12, 0.13, 0.32);
    this._part(g, new THREE.BoxGeometry(0.014, 0.01, 0.09), this._matPoly, 0, -0.083, 0.04);
    this._part(g, new THREE.BoxGeometry(0.012, 0.032, 0.01), this._matSteel, 0, -0.06, 0.02, 0.25);
    // charging handle knob (left side)
    this._part(g, new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), this._matSteel, -0.06, 0.03, -0.02, 0, 0, Math.PI / 2);
    // collapsing stock: twin rails + butt pad
    [-0.022, 0.022].forEach(dx => this._part(g, new THREE.BoxGeometry(0.01, 0.012, 0.18), this._matMetal, dx, 0.01, 0.3));
    this._part(g, new THREE.BoxGeometry(0.06, 0.1, 0.03), this._matPoly, 0, -0.01, 0.4);
    // energy accent strip
    this._part(g, new THREE.BoxGeometry(0.1, 0.006, 0.26), this._accent(c), 0, -0.058, -0.08);
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.66);
    return g;
  }

  // ---- SHOTGUN: side-by-side coach gun with wood furniture ----
  _buildShotgun(c) {
    const g = new THREE.Group();
    // steel receiver with break-action hinge line + twin hammer spurs
    this._part(g, new THREE.BoxGeometry(0.13, 0.1, 0.2), this._matSteel, 0, 0, 0.0);
    this._part(g, new THREE.BoxGeometry(0.135, 0.012, 0.012), this._matDark, 0, 0.02, -0.1);
    [-0.03, 0.03].forEach(dx => this._part(g, new THREE.BoxGeometry(0.018, 0.04, 0.025), this._matSteel, dx, 0.065, 0.06, -0.5));
    // side-by-side barrels with muzzle rings + top rib & brass bead
    [-0.042, 0.042].forEach(dx => {
      let b = this._part(g, new THREE.CylinderGeometry(0.034, 0.036, 0.52, 14), this._matMetal, dx, 0.03, -0.36); b.rotation.x = Math.PI / 2;
      b = this._part(g, new THREE.CylinderGeometry(0.038, 0.038, 0.025, 14), this._matSteel, dx, 0.03, -0.61); b.rotation.x = Math.PI / 2;
    });
    this._part(g, new THREE.BoxGeometry(0.02, 0.012, 0.5), this._matSteel, 0, 0.07, -0.36);
    this._part(g, new THREE.SphereGeometry(0.008, 8, 8), this._matBrass, 0, 0.082, -0.6);
    // wooden splinter forend with finger grooves
    this._part(g, new THREE.BoxGeometry(0.11, 0.055, 0.22), this._matWood, 0, -0.035, -0.22);
    [-0.04, 0.05].forEach(dz => this._part(g, new THREE.BoxGeometry(0.112, 0.012, 0.012), this._matDark, 0, -0.06, -0.22 + dz));
    // wooden stock: angled wrist + butt with recoil pad
    this._part(g, new THREE.BoxGeometry(0.09, 0.09, 0.2), this._matWood, 0, -0.045, 0.18, 0.18);
    this._part(g, new THREE.BoxGeometry(0.095, 0.13, 0.16), this._matWood, 0, -0.085, 0.34, 0.12);
    this._part(g, new THREE.BoxGeometry(0.1, 0.135, 0.02), this._matDark, 0, -0.09, 0.43, 0.12);
    // trigger guard + twin triggers
    this._part(g, new THREE.BoxGeometry(0.016, 0.01, 0.11), this._matSteel, 0, -0.105, 0.02);
    [-0.012, 0.012].forEach(dz => this._part(g, new THREE.BoxGeometry(0.01, 0.03, 0.008), this._matSteel, 0, -0.075, 0.02 + dz, 0.3));
    // brass shells in a side saddle
    for (let i = 0; i < 3; i++) {
      const sh = this._part(g, new THREE.CylinderGeometry(0.016, 0.016, 0.055, 8), this._matBrass, 0.075, 0.01, 0.1 + i * 0.045);
      sh.rotation.x = Math.PI / 2;
      this._part(g, new THREE.CylinderGeometry(0.0165, 0.0165, 0.015, 8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }), 0.075, 0.01, 0.075 + i * 0.045).rotation.x = Math.PI / 2;
    }
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.64);
    return g;
  }

  // ---- FORCE PUSH: glowing gauntlet ----
  buildForcePush() {
    // MK-IV Force Push Gauntlet — ported from the standalone prototype:
    // armored forearm, open palm w/ 5 splayed fingers, palm emitter core,
    // spinning energy rings + orbiting motes. Animated in updateForcePushFX().
    const g = new THREE.Group();
    const core = new THREE.Group();
    core.scale.setScalar(0.42);
    core.position.set(0, 0.02, 0.08);
    g.add(core);

    const plateMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.35, metalness: 0.85 });
    const plateMat2 = new THREE.MeshStandardMaterial({ color: 0x2c3a52, roughness: 0.3, metalness: 0.9 });
    const knuckleMat = new THREE.MeshStandardMaterial({ color: 0x3a4a66, roughness: 0.25, metalness: 0.95 });
    const energyMat = new THREE.MeshBasicMaterial({ color: 0x19f0ff });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xdffaff });
    const energyCores = [];
    const part = (parent, geo, mat, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(m); return m;
    };

    // forearm + armor plates + wrist energy band
    part(core, new THREE.CylinderGeometry(0.2, 0.24, 0.7, 12), plateMat, 0, 0, 0.5, Math.PI / 2, 0, 0);
    for (let i = 0; i < 3; i++) part(core, new THREE.BoxGeometry(0.42, 0.08, 0.16), plateMat2, 0, 0.16, 0.3 + i * 0.18, 0, 0, 0);
    energyCores.push(part(core, new THREE.TorusGeometry(0.23, 0.04, 10, 24), energyMat, 0, 0, 0.2, Math.PI / 2, 0, 0));

    // open hand — palm slab + back plate + heel
    const fist = new THREE.Group();
    fist.position.set(0, 0, -0.08);
    core.add(fist);
    part(fist, new THREE.BoxGeometry(0.46, 0.44, 0.14), plateMat2, 0, 0.04, -0.22);
    part(fist, new THREE.BoxGeometry(0.4, 0.38, 0.06), plateMat, 0, 0.05, -0.15);
    part(fist, new THREE.BoxGeometry(0.42, 0.14, 0.16), plateMat, 0, -0.16, -0.2);

    // splayed fingers with glowing tips (4 fingers + thumb)
    const buildFinger = (rootX, rootY, splay, tiltX, len) => {
      const f = new THREE.Group();
      f.position.set(rootX, rootY, -0.24);
      f.rotation.set(tiltX, 0, splay);
      fist.add(f);
      part(f, new THREE.BoxGeometry(0.082, len, 0.085), plateMat, 0, len / 2, 0);
      part(f, new THREE.SphereGeometry(0.05, 8, 8), knuckleMat, 0, len, 0);
      const tip = new THREE.Group(); tip.position.set(0, len, 0); tip.rotation.x = -0.25; f.add(tip);
      part(tip, new THREE.BoxGeometry(0.072, len * 0.72, 0.078), plateMat, 0, len * 0.36, 0);
      energyCores.push(part(tip, new THREE.SphereGeometry(0.035, 8, 8), energyMat, 0, len * 0.72, 0));
    };
    buildFinger(-0.17, 0.22, 0.34, -0.18, 0.2);
    buildFinger(-0.06, 0.25, 0.12, -0.1, 0.23);
    buildFinger(0.06, 0.25, -0.1, -0.1, 0.21);
    buildFinger(0.17, 0.22, -0.34, -0.18, 0.17);
    buildFinger(0.24, -0.04, -1.15, -0.35, 0.17); // thumb

    // palm emitter — the force-push core
    const emitter = new THREE.Group();
    emitter.position.set(0, 0.02, -0.32);
    fist.add(emitter);
    const emitterCore = part(emitter, new THREE.SphereGeometry(0.13, 16, 16), coreMat, 0, 0, 0);
    energyCores.push(emitterCore);
    energyCores.push(part(emitter, new THREE.TorusGeometry(0.18, 0.024, 10, 28), energyMat, 0, 0, 0.02));
    const emitterLight = new THREE.PointLight(0x19f0ff, 1.4, 3, 2);
    emitter.add(emitterLight);

    // spinning orbit rings + energy motes circling the fist
    const orbit = new THREE.Group();
    fist.add(orbit);
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.012, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0x19f0ff, transparent: true, opacity: 0.85 }));
    ringA.rotation.set(Math.PI / 2.2, 0.3, 0); orbit.add(ringA);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.01, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0x9b5cff, transparent: true, opacity: 0.7 }));
    ringB.rotation.set(0.4, Math.PI / 2.4, 0.5); orbit.add(ringB);
    const MOTES = 14;
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
    const moteData = [];
    for (let i = 0; i < MOTES; i++) moteData.push({
      r: 0.32 + Math.random() * 0.22, a: Math.random() * Math.PI * 2,
      speed: 1.4 + Math.random() * 2.4, tilt: Math.random() * Math.PI, y: (Math.random() - 0.5) * 0.5,
    });
    const moteMat = new THREE.PointsMaterial({ color: 0x19f0ff, size: 0.06, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    orbit.add(new THREE.Points(moteGeo, moteMat));

    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.5);
    g.userData.fp = { energyCores, emitterCore, emitterLight, orbit, ringA, ringB, moteGeo, moteData, moteMat, coreColors: { cyan: 0x19f0ff, white: 0xdffaff } };
    return g;
  }

  // per-frame gauntlet energy: pulsing cores, spinning rings, orbiting motes,
  // charge tremble + the in-HUD charge bar
  updateForcePushFX(dt) {
    const g = this.gunModels && this.gunModels.forcepush;
    const bar = document.getElementById('fp-charge-wrap');
    if (!g || !g.visible || !g.userData.fp) {
      if (bar) bar.style.opacity = '0';
      return;
    }
    const fp = g.userData.fp;
    const t = performance.now() * 0.001;
    const charge = this.fpCharge || 0;
    this._fpFlare = Math.max(0, (this._fpFlare || 0) - dt * 4);
    const flare = this._fpFlare;

    const pulse = 0.5 + Math.sin(t * 4) * 0.5;
    fp.energyCores.forEach((m, i) => {
      const p = 0.6 + Math.sin(t * (5 + i) + i) * 0.4;
      m.scale.setScalar(1 + p * 0.18 * (1 + charge) + flare * 0.6);
    });
    fp.emitterCore.material.color.setHex(charge > 0.5 || flare > 0.1 ? fp.coreColors.white : fp.coreColors.cyan);
    fp.emitterLight.intensity = 1.2 + pulse * 0.6 + charge * 3 + flare * 6;
    fp.emitterLight.distance = 3 + charge * 3;

    // orbit spins faster while charging; motes contract inward as energy gathers
    fp.orbit.rotation.z += dt * (0.6 + charge * 4 + flare * 6);
    fp.ringA.rotation.z += dt * (1 + charge * 3);
    fp.ringB.rotation.x -= dt * (0.8 + charge * 2.5);
    fp.ringA.material.opacity = 0.5 + pulse * 0.4 + charge * 0.2;
    fp.ringB.material.opacity = 0.4 + pulse * 0.3 + charge * 0.2;
    const gather = 1 - charge * 0.4;
    const arr = fp.moteGeo.attributes.position.array;
    fp.moteData.forEach((d, i) => {
      d.a += dt * d.speed * (1 + charge * 1.5);
      const r = d.r * gather;
      const x = Math.cos(d.a) * r, z = Math.sin(d.a) * r;
      const y = d.y + Math.sin(t * 2 + i) * 0.05;
      arr[i * 3] = x;
      arr[i * 3 + 1] = y * Math.cos(d.tilt) - z * Math.sin(d.tilt);
      arr[i * 3 + 2] = y * Math.sin(d.tilt) + z * Math.cos(d.tilt);
    });
    fp.moteGeo.attributes.position.needsUpdate = true;
    fp.moteMat.size = 0.05 + charge * 0.04;
    fp.moteMat.color.setHex(charge > 0.6 ? fp.coreColors.white : fp.coreColors.cyan);

    // charge tremble on the hand
    if (charge > 0) {
      g.rotation.z = (Math.random() - 0.5) * charge * 0.05;
      g.rotation.y = (Math.random() - 0.5) * charge * 0.04;
    } else { g.rotation.z = 0; g.rotation.y = 0; }

    // HUD charge bar
    if (bar) {
      const fill = document.getElementById('fp-charge-bar');
      const lbl = document.getElementById('fp-charge-val');
      bar.style.opacity = '1';
      if (fill) fill.style.width = (charge * 100).toFixed(0) + '%';
      if (lbl) lbl.textContent = charge > 0.92 ? 'MAX' : (charge > 0 ? (charge * 100).toFixed(0) + '%' : 'READY');
      if (lbl) lbl.style.color = charge > 0.92 ? '#fff' : '#19f0ff';
    }
  }

  // ---- PLASMA: bulky orb launcher ----
  _buildPlasma(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.15, 0.16, 0.4), this._matPoly, 0, 0, -0.02);
    const tube = this._part(g, new THREE.CylinderGeometry(0.075, 0.085, 0.42, 16), this._matDark, 0, 0.02, -0.32); tube.rotation.x = Math.PI / 2;
    this._part(g, new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16), this._matMetal, 0, 0.02, -0.52).rotation.x = Math.PI / 2;
    // glowing plasma chamber orb
    this.plasmaOrb = this._part(g, new THREE.SphereGeometry(0.06, 14, 14), this._glow(c, 2.4), 0, 0.02, -0.05);
    this._part(g, new THREE.BoxGeometry(0.1, 0.18, 0.11), this._matDark, 0, -0.15, 0.14, 0.3);
    this._part(g, new THREE.BoxGeometry(0.16, 0.014, 0.2), this._accent(c), 0, 0.11, 0.0);
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.58);
    return g;
  }

  // ---- PULSE: rotary multi-barrel cannon ----
  _buildPulse(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.16, 0.15, 0.34), this._matDark, 0, 0, 0.04);
    // barrel cluster on a spinner
    const spin = new THREE.Group(); spin.position.set(0, 0.0, -0.34);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = this._part(spin, new THREE.CylinderGeometry(0.016, 0.016, 0.4, 8), this._matMetal, Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0);
      b.rotation.x = Math.PI / 2;
    }
    this._part(spin, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16), this._matPoly, 0, 0, 0.18).rotation.x = Math.PI / 2;
    g.add(spin); g.userData.spin = spin;
    this._part(g, new THREE.BoxGeometry(0.1, 0.18, 0.12), this._matDark, 0, -0.16, 0.16, 0.28);
    this._part(g, new THREE.TorusGeometry(0.08, 0.02, 8, 18), this._glow(c, 1.6), 0, 0, -0.12).rotation.y = 0;
    this._part(g, new THREE.BoxGeometry(0.17, 0.014, 0.2), this._accent(c), 0, 0.1, 0.06);
    g.userData.muzzle = new THREE.Vector3(0, 0, -0.56);
    return g;
  }

  updateWeaponModel(name) {
    const key = (name || 'PISTOL').toLowerCase().replace(/ /g, '');
    const lookupKey = key === 'dualshg' ? 'shotgun' : (key === 'dualpistol' ? 'pistol' : key);
    Object.entries(this.gunModels).forEach(([k, m]) => m.visible = false);
    if (this.gunModels[lookupKey]) this.gunModels[lookupKey].visible = true;
    if (key === 'dualshg' && this.gunModels.shotgun2) this.gunModels.shotgun2.visible = true;
    if (key === 'dualpistol' && this.gunModels.pistol2) this.gunModels.pistol2.visible = true;
    if (this.weaponSmooth) { this.weaponSmooth.bowDraw = 0; this.weaponSmooth.bowRelease = 0; }
    this.swing = null;
    const model = this.gunModels[lookupKey] || this.gunModels.pistol;
    const mz = model.userData.muzzle || new THREE.Vector3(0, 0.03, -0.6);
    this.muzzleFlash.position.copy(mz).add(new THREE.Vector3(0, 0, -0.04));
    this.muzzleLight.position.copy(mz).add(new THREE.Vector3(0, 0, -0.06));
    const c = this.player.weapons[this.player.weaponIdx].color;
    this.muzzleFlash.material.color.setHex(c);
    this.muzzleLight.color.setHex(c);
  }

  // ---------------- UI / MENU ----------------
  initUI() {
    const levelSelect = document.getElementById('level-select');
    const levels = [
      { id: 'city',   name: 'NEON CITY',   desc: 'Rain-slick streets at midnight.', art: 'city' },
      { id: 'fields', name: 'COUNTRYSIDE', desc: 'Sunlit fields, hills & houses.',   art: 'fields' },
      { id: 'megacity', name: 'MEGAWATT CITY 1', desc: 'Dense grid, live traffic & neon.', art: 'mega' },
      { id: 'rail', name: 'RAIL CITY', desc: 'Ride the monorail · day to night.', art: 'rail' },
      { id: 'desert', name: 'EGYPT DESERT', desc: 'Pyramids, jungle & pharaoh golems.', art: 'desert' },
      { id: 'range', name: 'TEST RANGE', desc: 'Firing range · no hostiles · T resets.', art: 'range' }
    ];
    levels.forEach(l => {
      const c = document.createElement('div');
      c.className = 'lvl-card' + (l.id === 'city' ? ' sel' : '');
      c.dataset.id = l.id;
      c.innerHTML = `<div class="lvl-art ${l.art}"></div>
        <div class="lvl-body"><div class="lvl-name">${l.name}</div><div class="lvl-desc">${l.desc}</div></div>`;
      c.onclick = () => {
        document.querySelectorAll('#level-select .lvl-card').forEach(b => b.classList.remove('sel'));
        c.classList.add('sel');
        this.level = l.id;
        this.start();
      };
      levelSelect.appendChild(c);
    });
    // ?level=<id> from the home page pre-selects that theatre
    const urlLevel = new URLSearchParams(location.search).get('level');
    if (urlLevel && levels.some(l => l.id === urlLevel)) {
      this.level = urlLevel;
      document.querySelectorAll('#level-select .lvl-card').forEach(b =>
        b.classList.toggle('sel', b.dataset.id === urlLevel));
    }

    const charSelect = document.getElementById('char-select');
    const classes = [
      { id: 'scout',   name: 'SCOUT',   stats: 'SPD +++   HP +',   desc: 'Hit-and-run specialist.', col: '#19f0ff' },
      { id: 'soldier', name: 'SOLDIER', stats: 'SPD ++    HP ++',  desc: 'Versatile all-rounder.',  col: '#ffd166' },
      { id: 'heavy',   name: 'HEAVY',   stats: 'SPD +     HP +++', desc: 'Armored juggernaut.',     col: '#ff2d95' }
    ];
    classes.forEach(c => {
      const btn = document.createElement('button');
      btn.dataset.id = c.id;
      btn.className = 'char-card';
      btn.innerHTML = `<div class="char-name" style="color:${c.col}">${c.name}</div>
        <div class="char-stats">${c.stats}</div>
        <p class="char-desc">${c.desc}</p>`;
      btn.onclick = () => {
        document.querySelectorAll('#char-select .char-card').forEach(b => b.classList.remove('sel'));
        btn.classList.add('sel');
        this.selectChar(c.id);
      };
      charSelect.appendChild(btn);
    });
    document.querySelector('#char-select .char-card[data-id="soldier"]').classList.add('sel');
    this.selectChar('soldier');

    // ---- Armory ----
    this.startWeaponIdx = 0;
    const wepDefs = [
      { name:'PISTOL',     type:'SEMI', dmg:38, rateMs:230,  ammo:'∞',   trait:'DOUBLE-TAP 1: DUAL', col:'#19f0ff', idx:0 },
      { name:'SMG',        type:'AUTO', dmg:13, rateMs:62,   ammo:'480', trait:'RAPID FIRE',     col:'#ffd166', idx:1 },
      { name:'DUAL SHG',   type:'SEMI', dmg:72, rateMs:360,  ammo:'120', trait:'DUAL WIELD',     col:'#ff2d95', idx:2 },
      { name:'FORCE PUSH', type:'CHARGE', dmg:120, rateMs:1500, ammo:'∞',  trait:'HOLD TO CHARGE',  col:'#19f0ff', idx:3 },
      { name:'PLASMA',     type:'SEMI', dmg:95, rateMs:760,  ammo:'60',  trait:'SPLASH DAMAGE',  col:'#9b5cff', idx:4 },
      { name:'PULSE',      type:'AUTO', dmg:8,  rateMs:40,   ammo:'700', trait:'HIGH CAPACITY',  col:'#ff7a18', idx:5 },
    ];
    const buildWepCard = (w, container, selectable) => {
      const rateBar = Math.round((1 - w.rateMs / 1050) * 100);
      const dmgBar  = Math.round((w.dmg / 135) * 100);
      const card = document.createElement('div');
      card.className = 'wep-card' + (selectable && w.idx === 0 ? ' sel' : '');
      if (selectable && w.idx === 0) card.style.borderColor = w.col;
      card.innerHTML =
        `<div class="wep-top"><div class="wep-name" style="color:${w.col}">${w.name}</div><div class="wep-type">${w.type}</div></div>` +
        `<div class="wep-bar-row"><span>DMG</span><span>${w.dmg}</span></div>` +
        `<div class="wep-bar-track"><div class="wep-bar-fill" style="width:${dmgBar}%;background:${w.col}"></div></div>` +
        `<div class="wep-bar-row"><span>RATE</span><span>${rateBar}%</span></div>` +
        `<div class="wep-bar-track"><div class="wep-bar-fill" style="width:${rateBar}%;background:${w.col}88"></div></div>` +
        `<div class="wep-ammo">POOL <b style="color:${w.col}">${w.ammo}</b></div>` +
        `<div class="wep-badge" style="background:${w.col}1a;color:${w.col};border:1px solid ${w.col}44">${w.trait}</div>`;
      if (selectable) {
        card.onclick = () => {
          document.querySelectorAll('#armory-grid .wep-card').forEach(c => { c.classList.remove('sel'); c.style.borderColor = ''; });
          card.classList.add('sel');
          card.style.borderColor = w.col;
          this.startWeaponIdx = w.idx;
        };
      }
      container.appendChild(card);
    };
    const armoryGrid = document.getElementById('armory-grid');
    if (armoryGrid) wepDefs.forEach(w => buildWepCard(w, armoryGrid, true));
  }

  selectChar(t) {
    this.player.classType = t;
    if (t === 'scout')   { this.player.speed = 19; this.player.runSpeed = 30; this.player.maxHp = 85; }
    if (t === 'soldier') { this.player.speed = 14; this.player.runSpeed = 22; this.player.maxHp = 130; }
    if (t === 'heavy')   { this.player.speed = 10; this.player.runSpeed = 16; this.player.maxHp = 220; }
  }

  updateFOV(v) { this.baseFOV = parseFloat(v); if (!this.aiming) { this.camera.fov = this.baseFOV; this.camera.updateProjectionMatrix(); } document.getElementById('fov-val').innerText = v; }

  // right-click aim-down-sights (sniper zoom)
  setAim(on) {
    if (!this.gameStarted || this.isPaused) return;
    this.aiming = on;
    const scope = document.getElementById('scope-overlay');
    const w = this.player.weapons[this.player.weaponIdx];
    const isSniper = w.pierce; // railgun = true sniper scope
    if (scope) scope.style.opacity = (on && isSniper) ? 1 : 0;
    if (on) document.getElementById('crosshair').classList.add('aiming');
    else document.getElementById('crosshair').classList.remove('aiming');
  }

  // ---------------- INPUT ----------------
  setupInputs() {
    const onKey = (code, down) => {
      if (code === 'Backquote' && down) { this.toggleTerminal(); return; }
      if (this._termOpen) return;
      if (code === 'KeyW') this.input.w = down;
      if (code === 'KeyS') this.input.s = down;
      if (code === 'KeyA') this.input.a = down;
      if (code === 'KeyD') this.input.d = down;
      if (code === 'Space') { this.input.jump = down; if (down) this.jump(); }
      if (code === 'ShiftLeft') this.input.sprint = down;
      if (code === 'Escape' && down) this.togglePause();
      const digit = /^Digit([1-9])$/.exec(code);
      if (digit && down) {
        const idx = parseInt(digit[1], 10) - 1;
        // double-tap 1 while holding the pistol toggles dual wield
        const now = performance.now();
        if (idx === 0 && this.player.weaponIdx === 0 && now - (this._lastPistolTap || 0) < 350) {
          this.toggleDualPistol();
        } else {
          this.switchWeapon(idx);
        }
        if (idx === 0) this._lastPistolTap = now;
      }
      if (code === 'KeyR' && down) this.reload();
      if (code === 'KeyT' && down && this.level === 'range') this.layoutRangeTargets();
    };
    addEventListener('keydown', e => onKey(e.code, true));
    addEventListener('keyup', e => onKey(e.code, false));
    // dev terminal input box
    const ti = document.getElementById('term-input');
    if (ti) ti.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.code === 'Backquote' || e.code === 'Escape') { e.preventDefault(); this.toggleTerminal(); return; }
      if (e.code === 'Enter') { const cmd = ti.value.trim().toLowerCase(); ti.value = ''; this.execTerminal(cmd); }
    });
    // scroll wheel cycles weapons (shared behaviour with Wobbleton Tower)
    addEventListener('wheel', e => {
      if (!this.gameStarted || this.isPaused) return;
      const n = this.player.weapons.length;
      this.switchWeapon((this.player.weaponIdx + (e.deltaY > 0 ? 1 : -1) + n) % n);
    });
    addEventListener('mousedown', e => {
      if (this.isPaused || !this.gameStarted) return;
      if (e.button === 2) this.setAim(true);
      else this.input.shoot = true;
    });
    addEventListener('mouseup', e => {
      if (e.button === 2) this.setAim(false);
      else this.input.shoot = false;
    });
    addEventListener('contextmenu', e => { if (this.gameStarted) e.preventDefault(); });

    addEventListener('mousemove', e => {
      if (this.isPaused || !this.gameStarted) return;
      if (document.pointerLockElement === this.container) {
        const s = this.settings.sensitivity * (this.aiming ? (this.player.weapons[this.player.weaponIdx].pierce ? 0.32 : 0.6) : 1);
        this.camera.rotation.y -= e.movementX * s;
        const d = this.settings.invertY ? -1 : 1;
        this.camera.rotation.x -= e.movementY * s * d;
        this.camera.rotation.x = Math.max(-1.5, Math.min(1.5, this.camera.rotation.x));
      }
    });
    this.container.addEventListener('click', () => { if (!this.isPaused && this.gameStarted) this.lockPointer(); });

    // touch joystick
    const joy = document.getElementById('joystick-zone'), knob = document.getElementById('joystick-knob');
    let sx, sy;
    joy.addEventListener('touchstart', e => { sx = e.changedTouches[0].clientX; sy = e.changedTouches[0].clientY; }, { passive: false });
    joy.addEventListener('touchmove', e => {
      e.preventDefault();
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      const dist = Math.min(40, Math.hypot(dx, dy)), ang = Math.atan2(dy, dx);
      knob.style.transform = `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px)`;
      this.touchState.moveX = Math.cos(ang) * dist / 40; this.touchState.moveY = Math.sin(ang) * dist / 40;
    }, { passive: false });
    joy.addEventListener('touchend', () => { knob.style.transform = 'translate(0,0)'; this.touchState.moveX = 0; this.touchState.moveY = 0; });

    let ltx = 0, lty = 0;
    addEventListener('touchstart', e => { for (const t of e.touches) if (t.clientX > innerWidth / 2) { ltx = t.clientX; lty = t.clientY; } });
    addEventListener('touchmove', e => {
      if (this.isPaused) return;
      for (const t of e.touches) if (t.clientX > innerWidth / 2 && t.target.id !== 'fire-btn') {
        const dx = t.clientX - ltx, dy = t.clientY - lty;
        this.camera.rotation.y -= dx * 0.005;
        const d = this.settings.invertY ? -1 : 1;
        this.camera.rotation.x -= dy * 0.005 * d;
        this.camera.rotation.x = Math.max(-1.5, Math.min(1.5, this.camera.rotation.x));
        ltx = t.clientX; lty = t.clientY;
      }
    });
    const btn = (id, fn) => { const el = document.getElementById(id); el.addEventListener('touchstart', e => { e.preventDefault(); fn(true); }); el.addEventListener('touchend', e => { e.preventDefault(); fn(false); }); };
    btn('fire-btn', v => this.input.shoot = v); btn('jump-btn', v => { if (v) this.jump(); }); btn('switch-btn', v => { if (v) this.switchWeapon(); });
  }

  // ---------------- GAME FLOW ----------------
  start() {
    if (this.failed) return;
    this.gameStarted = true; this.isPaused = false; this.sound.resume();
    if (this.music) { this.music.pause(); this.music.currentTime = 0; }
    // start gameplay music — Desert Raid for desert/egypt, Final Arena Run elsewhere
    this.gameMusic.forEach(m => { m.pause(); m.currentTime = 0; });
    this.curGameMusic = (this.level === 'desert') ? this.gameMusic[1] : this.gameMusic[0];
    if (this.curGameMusic) this.curGameMusic.play().catch(() => {});
    this.buildWorld(this.level || 'city');
    this.player.weapons = this.defaultWeapons;
    this.player.weaponIdx = this.startWeaponIdx || 0;
    this.player.hp = this.player.maxHp; this.player.armor = 0; this.score = 0; this.wave = 1;
    this.waveCountdown = null;
    this.player.weapons.forEach(w => w.ammo = w.ammo === Infinity ? Infinity : Math.floor(w.maxAmmo * 0.6));
    this.camera.position.set(0, this.player.height, 0);
    if (this._railSpawn && this.level === 'rail') this.camera.position.copy(this._railSpawn);
    if (this._desertSpawn && this.level === 'desert') this.camera.position.copy(this._desertSpawn);
    if (this._rangeSpawn && this.level === 'range') this.camera.position.copy(this._rangeSpawn);
    this.player.ridingCar = null; this.player.floorY = this.player.height;
    this.camera.rotation.set(0, 0, 0);
    // time-of-day chip only on rail level
    const todWrap = document.getElementById('tod-chip');
    if (todWrap) todWrap.style.display = this.level === 'rail' ? 'flex' : 'none';

    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('hud-top').classList.remove('hidden');
    document.getElementById('hud-bottom').classList.remove('hidden');
    document.getElementById('crosshair').classList.remove('hidden');
    if (!this.isMobile) this.lockPointer();

    [...this.enemies].forEach(e => this.scene.remove(e)); this.enemies = []; this.boss = null;
    [...this.eBullets].forEach(b => this.scene.remove(b.mesh)); this.eBullets = [];
    [...this.pProj].forEach(b => this.scene.remove(b.mesh)); this.pProj = [];
    [...this.tProj].forEach(b => this.scene.remove(b.mesh)); this.tProj = [];
    if (this.rings) { this.rings.forEach(r => this.scene.remove(r.mesh)); this.rings = []; }
    this.swing = null;
    document.getElementById('boss-bar-wrap').classList.add('hidden');
    this.updateHUD();
    this.updateWeaponModel(this.player.weapons[0].name);
    if (this.level === 'range') {
      this.layoutRangeTargets();
      this.showMessage('WEAPON TEST RANGE — PRESS T TO RESET TARGETS', '#19f0ff');
    } else {
      this.startWaveCountdown(1);
    }
  }

  togglePause() {
    if (!this.gameStarted) return;
    this.aiming = false; this.input.shoot = false;
    this.isPaused = !this.isPaused;
    const pm = document.getElementById('pause-menu');
    if (this.isPaused) { pm.classList.remove('hidden'); document.exitPointerLock(); }
    else { pm.classList.add('hidden'); this.lockPointer(); }
  }

  lockPointer() {
    if (this.isMobile) return;
    try { const p = this.container.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }

  jump() { if (this.player.onGround && this.gameStarted && !this.isPaused) { this.player.velocity.y = this.player.jumpForce; this.player.onGround = false; } }

  // double-tap 1: twin pistols — twice the fire rate, slightly looser spread
  toggleDualPistol() {
    const p = this.defaultWeapons[0];
    this.dualPistol = !this.dualPistol;
    p.name = this.dualPistol ? 'DUAL PISTOL' : 'PISTOL';
    p.rate = this.dualPistol ? 115 : 230;
    p.spread = this.dualPistol ? 0.018 : 0.008;
    p.kick = this.dualPistol ? 0.016 : 0.012;
    this.updateWeaponModel(p.name);
    this.updateHUD();
    this.showMessage(this.dualPistol ? 'DUAL WIELD' : 'SINGLE PISTOL', '#19f0ff');
  }

  switchWeapon(idx) {
    if (idx === undefined) idx = (this.player.weaponIdx + 1) % this.player.weapons.length;
    if (idx >= this.player.weapons.length) return;
    if (this.aiming) this.setAim(false);
    this.player.weaponIdx = idx;
    this.gunGroup.rotation.x = Math.PI * 2;
    this.updateWeaponModel(this.player.weapons[idx].name);
    this.updateHUD();
  }

  reload() {
    this.gunGroup.userData.reloading = true;
    this.gunGroup.rotation.z = -Math.PI / 2.4;
    clearTimeout(this._reloadT);
    this._reloadT = setTimeout(() => { this.gunGroup.rotation.z = 0; this.gunGroup.userData.reloading = false; }, 480);
  }

  // ---------------- WAVES ----------------
  buildWave(n) {
    const list = [];
    if (n % 5 === 0) {
      list.push('boss');
      for (let i = 0; i < 3 + Math.floor(n / 5); i++) list.push('runner');
      for (let i = 0; i < 2; i++) list.push('shooter');
      return list;
    }
    for (let i = 0; i < 3 + Math.floor(n * 0.7); i++) list.push('grunt');
    for (let i = 0; i < Math.floor(n * 0.6); i++) list.push('runner');
    if (n >= 2) for (let i = 0; i < 1 + Math.floor(n / 4); i++) list.push('shooter');
    if (n >= 3) for (let i = 0; i < Math.floor(n / 3); i++) list.push('tank');
    // cap for performance
    return list.slice(0, 24);
  }

  startWaveCountdown(waveNumber) {
    this.wave = waveNumber;
    this.waveCountdown = { wave: waveNumber, timer: 3, lastShown: 3 };
    this.showMessage('WAVE ' + waveNumber + ' IN 3', '#19f0ff', 1100);
    this.updateHUD();
  }

  updateWaveCountdown(dt) {
    if (!this.waveCountdown) return false;
    const cd = this.waveCountdown;
    cd.timer -= dt;
    if (cd.timer > 0) {
      const shown = Math.max(1, Math.ceil(cd.timer));
      if (shown !== cd.lastShown) {
        cd.lastShown = shown;
        this.showMessage('WAVE ' + cd.wave + ' IN ' + shown, '#19f0ff', 1050);
      }
      return true;
    }
    this.waveCountdown = null;
    this.spawnWave();
    this.sound.wave();
    this.showMessage('WAVE ' + cd.wave, '#39ff14', 1300);
    this.updateHUD();
    return true;
  }

  spawnWave() {
    const list = this.buildWave(this.wave);
    const hpScale = 1 + (this.wave - 1) * 0.12;
    list.forEach(type => this.spawnEnemy(type, hpScale));
  }

  // ================= WEAPON TEST RANGE =================
  // Indoor firing range: distance-marked lanes, neon posts, golem target
  // dummies that don't fight back and respawn after 2s. T re-racks targets.
  buildRange(W) {
    this.scene.background = new THREE.Color(0x070a14);
    this.scene.fog = new THREE.FogExp2(0x070a14, 0.018);

    // polished marble range floor (PBR base color + normal from the kit)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({
        map: TextureGen.createImageTexture('marble', null, 30, 30),
        normalMap: TextureGen.createNormalTexture('marbleN', 30, 30),
        color: 0x7884a4, roughness: 0.35, metalness: 0.45,
      }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; W.add(floor);
    const grid = new THREE.GridHelper(200, 100, 0x1c3a5a, 0x0e1d30);
    grid.position.y = 0.01; W.add(grid);

    // distance posts with neon caps + lane lines every 10 units
    const postMat = new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.7 });
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x19f0ff });
    for (let d = 10; d <= 70; d += 10) {
      [-1, 1].forEach(s => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), postMat);
        post.position.set(s * 18, 1.5, -d); post.castShadow = true; W.add(post);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), stripMat);
        strip.position.set(s * 18, 2.9, -d); W.add(strip);
      });
      const ln = new THREE.Mesh(new THREE.PlaneGeometry(36, 0.18),
        new THREE.MeshBasicMaterial({ color: 0x19f0ff, transparent: true, opacity: 0.25 }));
      ln.rotation.x = -Math.PI / 2; ln.position.set(0, 0.02, -d); W.add(ln);
    }

    // back wall + side walls (colliders)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c1018, roughness: 0.8, metalness: 0.3 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(44, 16, 1), wallMat);
    wall.position.set(0, 8, -78); wall.receiveShadow = true; W.add(wall); this.objects.push(wall);
    [-1, 1].forEach(s => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 90), wallMat);
      sw.position.set(s * 22, 8, -33); W.add(sw); this.objects.push(sw);
    });
    // neon strips on the back wall
    [-7, 0, 7].forEach((sx, i) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 9, 0.2),
        new THREE.MeshBasicMaterial({ color: i === 1 ? 0x19f0ff : 0x2a6fff }));
      strip.position.set(sx, 5, -77.4); W.add(strip);
    });

    // lights (static counts only)
    W.add(new THREE.AmbientLight(0x3c4a68, 1.0));
    W.add(new THREE.HemisphereLight(0x32468a, 0x141420, 0.8));
    const key = new THREE.DirectionalLight(0xaab8ff, 1.2);
    key.position.set(6, 14, 8); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.far = 120;
    key.shadow.camera.left = -40; key.shadow.camera.right = 40; key.shadow.camera.top = 40; key.shadow.camera.bottom = -40;
    W.add(key);

    this._rangeSpawn = new THREE.Vector3(0, this.player.height, 14);
  }

  spawnDummy(x, z) {
    const mesh = EnemyFactory.build('grunt', 'rock');
    mesh.scale.setScalar(EnemyFactory.TYPES.grunt.scale);
    mesh.position.set(x, 0, z);
    mesh.userData = Object.assign({}, mesh.userData, {
      type: 'grunt', dummy: true, home: new THREE.Vector3(x, 0, z),
      hp: 200, maxHp: 200, speed: 0, dmg: 0, score: 10,
      animOffset: Math.random() * 10, lastFire: 0, hitFlash: 0,
    });
    mesh.lookAt(0, 0, 14); // face the firing line
    this.scene.add(mesh);
    this.enemies.push(mesh);
  }

  layoutRangeTargets() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].userData.dummy) { this.scene.remove(this.enemies[i]); this.enemies.splice(i, 1); }
    }
    const X = 2.4; // match the expanded world footprint
    const rows = [{ z: -14, n: 5, sp: 4 }, { z: -26, n: 5, sp: 5 }, { z: -40, n: 4, sp: 6 }, { z: -56, n: 3, sp: 7 }, { z: -70, n: 2, sp: 9 }];
    rows.forEach(r => { for (let i = 0; i < r.n; i++) this.spawnDummy((i - (r.n - 1) / 2) * r.sp * X, r.z * X); });
    this.updateHUD();
  }

  spawnEnemy(type, hpScale) {
    const cfg = EnemyFactory.TYPES[type];
    const mesh = EnemyFactory.build(type, this.level === 'desert' ? 'desert' : 'rock');
    mesh.scale.setScalar(cfg.scale);

    let pos = new THREE.Vector3(), ok = false, tries = 0;
    while (!ok && tries++ < 40) {
      const a = Math.random() * Math.PI * 2, d = (cfg.boss ? 55 : 38) + Math.random() * 55;
      pos.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      ok = true;
      for (const o of this.objects) if (pos.distanceTo(o.position) < 9) { ok = false; break; }
    }
    mesh.position.copy(pos);
    mesh.userData = Object.assign({}, mesh.userData, {
      type, hp: cfg.hp * hpScale, maxHp: cfg.hp * hpScale,
      speed: cfg.speed, dmg: cfg.dmg, melee: cfg.melee, ranged: cfg.ranged,
      range: cfg.range, projDmg: cfg.projDmg, fireRate: cfg.fireRate, boss: cfg.boss,
      score: cfg.score, animOffset: Math.random() * 10, lastFire: 0, hitFlash: 0
    });
    this.scene.add(mesh);
    this.enemies.push(mesh);
    if (cfg.boss) {
      this.boss = mesh;
      document.getElementById('boss-bar-wrap').classList.remove('hidden');
      this.sound.boss();
      this.showMessage('⚠ APEX HORROR INBOUND', '#ff2d95');
    }
  }

  // emoji billboard sprite (always faces camera)
  _emojiSprite(emoji) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.font = '92px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 70);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(0.9, 0.9, 0.9);
    return spr;
  }

  // ---------------- DEV TERMINAL (~) ----------------
  toggleTerminal() {
    this._termOpen = !this._termOpen;
    const t = document.getElementById('dev-terminal');
    if (!t) return;
    t.classList.toggle('hidden', !this._termOpen);
    this.input.shoot = false;
    if (this._termOpen) { document.exitPointerLock(); setTimeout(() => { const i = document.getElementById('term-input'); if (i) i.focus(); }, 60); }
    else if (this.gameStarted && !this.isPaused && !this.isMobile) this.lockPointer();
  }

  execTerminal(cmd) {
    const log = document.getElementById('term-log');
    const out = m => { if (log) log.textContent = m; };
    if (cmd === 'tulani') {
      this.god = !this.god;
      out(this.god ? 'GOD MODE ENABLED — invulnerable · infinite ammo' : 'god mode disabled');
      this.showMessage(this.god ? '★ GOD MODE ★' : 'GOD MODE OFF', '#ffd166');
    } else if (cmd === 'help') {
      out('commands: tulani (toggle god mode) · help');
    } else if (cmd) {
      out('unknown command: ' + cmd);
    }
  }

  // armor absorbs 60% of incoming damage until it breaks; the rest hits health
  damagePlayer(dmg) {
    if (this.god) return;
    const P = this.player;
    if (P.armor > 0) {
      const absorbed = Math.min(P.armor, dmg * 0.6);
      P.armor -= absorbed; dmg -= absorbed;
    }
    P.hp -= dmg;
    this.damageFlash(); this.updateHUD();
    if (P.hp <= 0) this.endGame();
  }

  _pickupGlow(color) {
    return new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  }
  spawnAmmo(pos) {
    const spr = this._emojiSprite('🔋');
    spr.position.copy(pos); spr.position.y = 0.7;
    spr.add(this._pickupGlow(0x39ff14));
    this.scene.add(spr); this.items.push(spr);
  }
  spawnHealth(pos) {
    const spr = this._emojiSprite(Math.random() > 0.5 ? '❤️' : '💊');
    spr.position.copy(pos); spr.position.y = 0.7; spr.userData.health = true;
    spr.add(this._pickupGlow(0xff3355));
    this.scene.add(spr); this.items.push(spr);
  }
  spawnArmor(pos) {
    const spr = this._emojiSprite('🛡️');
    spr.position.copy(pos); spr.position.y = 0.7; spr.userData.armor = true;
    spr.add(this._pickupGlow(0x19f0ff));
    this.scene.add(spr); this.items.push(spr);
  }

  showMessage(text, color) {
    const el = document.getElementById('game-message');
    el.innerText = text; el.style.color = color || '#fff'; el.style.opacity = 1;
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => el.style.opacity = 0, 1800);
  }

  // ---------------- SHOOTING ----------------
  enemyRoot(obj) {
    let o = obj;
    while (o) { if (this.enemies.indexOf(o) !== -1) return o; o = o.parent; }
    return null;
  }

  fireWeapon(w) {
    const camPos = this.camera.getWorldPosition(new THREE.Vector3());
    const baseDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const muzzlePos = this.muzzleFlash.getWorldPosition(new THREE.Vector3());

    if (w.forcePush) {
      // FORCE PUSH GAUNTLET — charged kinetic blast (power 0..1 from hold time)
      const power = this._fpPower !== undefined ? this._fpPower : 1;
      this._fpFlare = 1; // emitter overcharge pop, decays in updateForcePushFX
      const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
      const origin = this.camera.position.clone();

      // twin expanding shockwave rings (cyan + violet) + core flash sphere
      const waves = [];
      for (let k = 0; k < 2; k++) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.1, 0.42, 32),
          new THREE.MeshBasicMaterial({ color: k ? 0x9b5cff : 0x19f0ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        ring.position.copy(origin).addScaledVector(dir, 1 + k * 0.3);
        ring.quaternion.copy(this.camera.quaternion);
        this.scene.add(ring);
        waves.push({ mesh: ring, life: 0.6, max: 0.6, grow: 26 + power * 30 + k * 8 });
      }
      const flashS = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xdffaff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      flashS.position.copy(origin).addScaledVector(dir, 0.8);
      this.scene.add(flashS);
      waves.push({ mesh: flashS, life: 0.25, max: 0.25, grow: 10 + power * 8, flash: true });
      const wavesDir = dir.clone();
      const animateWaves = () => {
        let alive = false;
        waves.forEach(s => {
          if (s.life <= 0) return;
          s.life -= 0.016; alive = alive || s.life > 0;
          const k = 1 - s.life / s.max;
          if (s.flash) s.mesh.scale.setScalar(1 + k * s.grow * 0.1);
          else { s.mesh.scale.setScalar(1 + k * s.grow); s.mesh.position.addScaledVector(wavesDir, 0.1); }
          s.mesh.material.opacity = Math.max(0, 1 - k) * 0.9;
          if (s.life <= 0) this.scene.remove(s.mesh);
        });
        if (alive) requestAnimationFrame(animateWaves);
      };
      animateWaves();

      // screen flash
      const sf = document.getElementById('fp-flash');
      if (sf) {
        sf.style.transition = 'none'; sf.style.opacity = String(0.3 + power * 0.45);
        requestAnimationFrame(() => { sf.style.transition = 'opacity .45s ease'; sf.style.opacity = '0'; });
      }

      // damage + knockback in a forward cone — RANGE grows the longer the
      // charge was held (up to ~2.2x), along with damage and knockback
      const radius = w.pushRadius * (0.6 + 1.6 * power);
      const dmg = w.dmg * (0.5 + power);
      this.enemies.forEach(en => {
        if (!en) return;
        const toEn = en.position.clone().sub(origin);
        const dist = toEn.length();
        if (dist > radius) return;
        const dot = toEn.normalize().dot(dir);
        if (dot < w.pushCone) return;
        this.damageEnemy(en, dmg, en.position.clone());
        en.position.addScaledVector(toEn, (1 - dist / radius) * (4 + power * 8));
      });

      // recoil scaled by power
      this.gunGroup.position.z = -0.42 - (0.12 + power * 0.18);
      this.camera.rotation.x += 0.01 + power * 0.02;
      this.sound.tone(70 + power * 30, 'sawtooth', 0.2, 0.2 + power * 0.1);
      this.sound.tone(150 + power * 60, 'sine', 0.14, 0.3);
      return;
    }

    if (w.melee) {
      // KATANA — arc slash hitting all enemies within reach + frontal cone
      let any = false;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        const to = e.position.clone().setY(camPos.y).sub(camPos);
        const dist = to.length();
        if (dist > w.reach) continue;
        if (baseDir.dot(to.normalize()) > w.arc) {
          this.damageEnemy(e, w.dmg, e.position.clone().setY(e.userData.eyeHeight * 0.7));
          this.spawnSparks(e.position.clone().setY(e.userData.eyeHeight * 0.7), w.color, 9);
          any = true;
        }
      }
      // slash arc effect + swing anim
      this.swing = { start: performance.now(), dur: 300, dir: (this._swingFlip = !this._swingFlip) ? 1 : -1 };
      this.spawnSlashArc(camPos, baseDir, w.color);
      if (any) this.showHitmarker(false);
      return;
    }

    if (w.thrown || w.arrow) {
      // SHURIKEN / ARROW — spinning or piercing projectile
      const dir = baseDir.clone();
      const spread = w.spread * (this.aiming ? 0.3 : 1);
      dir.x += (Math.random() - 0.5) * spread; dir.y += (Math.random() - 0.5) * spread; dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
      this.spawnThrown(muzzlePos, dir, w);
      if (w.arrow && this.weaponSmooth) this.weaponSmooth.bowRelease = 1;
      // light recoil flick
      const recoil = w.arrow ? 0.45 : 1;
      this.gunGroup.position.z = -0.46 - w.kick * 2 * recoil;
      this.gunGroup.rotation.x = 0.05 + w.kick * 2 * recoil;
      this.camera.rotation.x += w.kick * recoil;
      return;
    }

    if (w.projectile) {
      // PLASMA — lob a slow exploding orb
      this.spawnPlasma(muzzlePos, baseDir, w);
    } else if (w.pierce) {
      // RAILGUN — instant beam that pierces every enemy in line
      this.raycaster.set(camPos, baseDir); this.raycaster.far = 400;
      const eHits = this.raycaster.intersectObjects(this.enemies, true);
      const wHits = this.raycaster.intersectObjects(this.objects, false);
      const wDist = wHits.length ? wHits[0].distance : 400;
      const seen = new Set();
      let last = 0;
      eHits.forEach(h => {
        if (h.distance > wDist) return;
        const root = this.enemyRoot(h.object);
        if (root && !seen.has(root)) { seen.add(root); this.damageEnemy(root, w.dmg, h.point); this.spawnSparks(h.point, w.color, 10); last = h.distance; }
      });
      const end = camPos.clone().add(baseDir.clone().multiplyScalar(Math.min(wDist, 400)));
      if (wHits.length && wDist <= 400) this.spawnSparks(wHits[0].point, w.color, 8, wHits[0].face ? wHits[0].face.normal : null);
      this.spawnBeam(muzzlePos, end, w.color);
    } else {
      // HITSCAN — pistol / smg / shotgun / pulse
      const pellets = w.pellets || 1;
      const spread = w.spread * (this.aiming ? 0.25 : 1);
      for (let p = 0; p < pellets; p++) {
        const dir = baseDir.clone();
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();
        this.raycaster.set(camPos, dir); this.raycaster.far = 400;
        const eHits = this.raycaster.intersectObjects(this.enemies, true);
        const wHits = this.raycaster.intersectObjects(this.objects, false);
        const eDist = eHits.length ? eHits[0].distance : Infinity;
        const wDist = wHits.length ? wHits[0].distance : Infinity;
        let endPoint;
        if (eDist < wDist && eHits.length) {
          const root = this.enemyRoot(eHits[0].object);
          endPoint = eHits[0].point;
          if (root) this.damageEnemy(root, w.dmg, eHits[0].point);
          this.spawnSparks(eHits[0].point, w.color, 6);
        } else if (wHits.length) {
          endPoint = wHits[0].point;
          this.spawnSparks(wHits[0].point, 0xffd089, 4, wHits[0].face ? wHits[0].face.normal : null);
        } else {
          endPoint = camPos.clone().add(dir.multiplyScalar(400));
        }
        this.spawnTracer(muzzlePos, endPoint, w.color);
      }
    }

    // recoil + flash (scaled per weapon)
    this.gunGroup.position.z = -0.42 - (w.kick || 0.01) * 3;
    this.gunGroup.rotation.x = 0.06 + (w.kick || 0.01) * 2.5;
    this.camera.rotation.x += w.kick || 0.012;
    // dual wield: flash alternates between right and left gun
    if (w.name === 'DUAL PISTOL' || w.name === 'DUAL SHG') {
      this._dualFlip = !this._dualFlip;
      this.muzzleFlash.position.x = this._dualFlip ? -0.44 : 0;
    } else {
      this.muzzleFlash.position.x = 0;
    }
    this.muzzleFlash.material.opacity = 1;
    this.muzzleFlash.rotation.z = Math.random() * Math.PI;
    this.muzzleFlash.scale.setScalar(w.pellets ? 1.6 : (w.pierce ? 1.8 : (w.projectile ? 1.4 : 1)));
    this.muzzleLight.intensity = w.pierce ? 5 : 3;
    if (this.gunModels.pulse.userData.spin && w.model === 'pulse') this.gunModels.pulse.userData.spinV = 26;
  }

  // PLASMA projectile
  spawnPlasma(pos, dir, w) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 14),
      new THREE.MeshBasicMaterial({ color: w.color }));
    mesh.position.copy(pos);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12),
      new THREE.MeshBasicMaterial({ color: w.color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.add(halo);
    this.scene.add(mesh);
    this.pProj.push({ mesh, vel: dir.clone().multiplyScalar(48), life: 3.2, dmg: w.dmg, splash: w.splash, splashDmg: w.splashDmg, color: w.color });
  }

  explodePlasma(pos, color, splash, dmg) {
    // AoE damage
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const d = e.position.distanceTo(pos);
      if (d < splash) this.damageEnemy(e, dmg * (1 - d / splash * 0.5), e.position.clone().setY(e.userData.eyeHeight * 0.6));
    }
    this.spawnSparks(pos, color, 26);
    // shockwave ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.5, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.copy(pos); ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring); this.rings = this.rings || []; this.rings.push({ mesh: ring, life: 0.4, max: splash });
    // additive flash sphere instead of a temp PointLight (avoids shader recompiles)
    const fl = new THREE.Mesh(new THREE.SphereGeometry(splash * 0.35, 12, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    fl.position.copy(pos); this.scene.add(fl);
    setTimeout(() => this.scene.remove(fl), 90);
    this.sound.kill();
  }

  spawnBeam(from, to, color) {
    const dist = from.distanceTo(to);
    const geo = new THREE.CylinderGeometry(0.05, 0.05, dist, 10);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(from).lerp(to, 0.5); m.lookAt(to); m.rotateX(Math.PI / 2);
    this.scene.add(m);
    this.tracers.push({ mesh: m, life: 0.18, max: 0.18 });
  }

  // shuriken / arrow projectile
  spawnThrown(pos, dir, w) {
    let mesh, spin = 0;
    if (w.arrow) {
      mesh = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0xcaa472 }));
      shaft.rotation.x = Math.PI / 2; mesh.add(shaft);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.8, roughness: 0.3 }));
      head.rotation.x = -Math.PI / 2; head.position.z = -0.52; mesh.add(head);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.09, 0.12), new THREE.MeshBasicMaterial({ color: 0xcc3344, side: THREE.DoubleSide }));
      fl.position.z = 0.4; mesh.add(fl);
      const fl2 = fl.clone(); fl2.rotation.z = Math.PI / 2; mesh.add(fl2);
    } else {
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 4, 4), new THREE.MeshStandardMaterial({ color: 0xc8d2dc, metalness: 0.9, roughness: 0.25, flatShading: true }));
      spin = 34;
    }
    mesh.position.copy(pos);
    if (w.arrow) mesh.lookAt(pos.clone().add(dir));
    this.scene.add(mesh);
    this.tProj.push({ mesh, vel: dir.clone().multiplyScalar(w.speed), life: w.arrow ? 3.2 : 2.5, dmg: w.dmg, arrow: !!w.arrow, spin, grav: w.arrow ? 9 : 4, color: w.color, pierce: w.arrow ? 1 : 0, hitSet: new Set() });
  }

  // katana slash arc visual
  spawnSlashArc(camPos, dir, color) {
    const arc = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.6, 18, 1, -0.7, 1.4),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const p = camPos.clone().add(dir.clone().multiplyScalar(2.2));
    arc.position.copy(p);
    arc.lookAt(camPos);
    arc.rotation.z = (this._swingFlip ? 1 : -1) * 0.6;
    this.scene.add(arc);
    this.rings = this.rings || [];
    this.rings.push({ mesh: arc, life: 0.16, max: 0.6, fixed: true });
  }

  damageEnemy(e, dmg, point) {
    e.userData.hp -= dmg;
    e.userData.hitFlash = 1;
    this.sound.hit();
    this.showHitmarker(false);
    if (e.userData.hp <= 0) {
      this.killEnemy(e, point);
    }
  }

  killEnemy(e, point) {
    const idx = this.enemies.indexOf(e);
    if (idx === -1) return;
    if (e.userData.dummy) {
      // range target: sparks, small score, respawn at home after 2s — no drops
      this.score += e.userData.score;
      this.showHitmarker(true); this.sound.kill();
      this.spawnSparks(point || e.position.clone().setY(1.2), 0x19f0ff, 14);
      this.scene.remove(e); this.enemies.splice(idx, 1);
      this.updateHUD();
      const h = e.userData.home;
      setTimeout(() => { if (this.gameStarted && this.level === 'range') this.spawnDummy(h.x, h.z); }, 2000);
      return;
    }
    this.score += e.userData.score;
    this.showHitmarker(true);
    this.sound.kill();
    this.spawnSparks(point || e.position.clone().setY(e.userData.eyeHeight * 0.6), e.userData.cores[0].color.getHex(), 18);
    // drops
    const r = Math.random();
    if (e.userData.boss) { this.spawnHealth(e.position); this.spawnAmmo(e.position); this.spawnArmor(e.position.clone().add(new THREE.Vector3(1.5, 0, 0))); }
    else if (r > 0.84) this.spawnHealth(e.position);
    else if (r > 0.72) this.spawnArmor(e.position);
    else if (r > 0.5) this.spawnAmmo(e.position);

    if (e === this.boss) { this.boss = null; document.getElementById('boss-bar-wrap').classList.add('hidden'); this.showMessage('APEX DOWN', '#39ff14'); }
    this.scene.remove(e);
    this.enemies.splice(idx, 1);
    this.updateHUD();
  }

  enemyFire(e) {
    const origin = e.position.clone().setY(e.userData.eyeHeight * (e.userData.boss ? 0.85 : 1));
    const target = this.camera.position.clone();
    const baseDir = target.sub(origin).normalize();
    const shots = e.userData.boss ? 5 : 1;
    for (let i = 0; i < shots; i++) {
      const dir = baseDir.clone();
      if (shots > 1) { const a = (i - (shots - 1) / 2) * 0.13; dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), a); }
      const col = e.userData.cores[0].color.getHex();
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10),
        new THREE.MeshBasicMaterial({ color: col }));
      mesh.position.copy(origin);
      // additive halo instead of a PointLight — adding/removing lights forces a
      // full shader recompile of every material (this was the boss-fight lag)
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      mesh.add(halo);
      this.scene.add(mesh);
      this.eBullets.push({ mesh, vel: dir.multiplyScalar(34), life: 3, dmg: e.userData.projDmg });
    }
    this.sound.enemyShoot();
  }

  // ---------------- PARTICLES ----------------
  spawnTracer(from, to, color) {
    const dist = from.distanceTo(to);
    const geo = new THREE.CylinderGeometry(0.018, 0.018, dist, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to); m.rotateX(Math.PI / 2);
    this.scene.add(m);
    this.tracers.push({ mesh: m, life: 0.07 });
  }

  spawnSparks(pos, color, count, normal) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(geo, mat); m.position.copy(pos);
      let v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8 + 0.2, (Math.random() - 0.5));
      if (normal) v.add(normal.clone().multiplyScalar(0.8));
      v.normalize().multiplyScalar(3 + Math.random() * 6);
      this.scene.add(m);
      this.particles.push({ mesh: m, vel: v, life: 0.4 + Math.random() * 0.3, grav: true });
    }
  }

  showHitmarker(kill) {
    const hm = document.getElementById('hitmarker');
    hm.style.stroke = kill ? '#ff3355' : '#fff';
    hm.style.opacity = 1;
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => hm.style.opacity = 0, 110);
  }

  damageFlash() {
    document.body.classList.add('damage-effect');
    clearTimeout(this._dmgT);
    this._dmgT = setTimeout(() => document.body.classList.remove('damage-effect'), 200);
  }

  updateBowSmooth(w, dt) {
    if (!this.gunModels || !this.gunModels.bow || !this.weaponSmooth) return;
    const bow = this.gunModels.bow;
    if (!bow.visible) return;
    const hasArrow = !w || w.ammo > 0 || w.ammo === Infinity;
    if (bow.userData.arrow) bow.userData.arrow.visible = hasArrow;
    const desiredDraw = this.input.shoot && hasArrow ? 1 : 0;
    this.weaponSmooth.bowDraw = THREE.MathUtils.lerp(this.weaponSmooth.bowDraw, desiredDraw, dt * (desiredDraw ? 8 : 12));
    this.weaponSmooth.bowRelease = Math.max(0, this.weaponSmooth.bowRelease - dt * 5.5);
    const draw = this.weaponSmooth.bowDraw;
    const releaseKick = this.weaponSmooth.bowRelease;
    if (bow.userData.arrow) {
      bow.userData.arrow.position.z = (bow.userData.arrowBaseZ || 0) + draw * 0.18 - releaseKick * 0.05;
      bow.userData.arrow.rotation.x = -draw * 0.04;
    }
    if (bow.userData.string) {
      bow.userData.string.position.z = (bow.userData.stringBaseZ || -0.2) + draw * 0.13 - releaseKick * 0.04;
      bow.userData.string.scale.y = 1 + draw * 0.03;
    }
    bow.rotation.x = THREE.MathUtils.lerp(bow.rotation.x, -draw * 0.035 + releaseKick * 0.08, dt * 10);
    bow.rotation.y = THREE.MathUtils.lerp(bow.rotation.y, draw * 0.045, dt * 10);
    bow.position.z = THREE.MathUtils.lerp(bow.position.z, -draw * 0.035 + releaseKick * 0.05, dt * 12);
  }

  // ---------------- UPDATE ----------------
  update(dt) {
    if (this.isPaused || !this.gameStarted) return;
    const P = this.player;

    // movement
    const spd = this.input.sprint ? P.runSpeed : P.speed;
    let mx = 0, mz = 0;
    if (this.isMobile) { mx = this.touchState.moveX; mz = this.touchState.moveY; }
    else { if (this.input.w) mz = -1; if (this.input.s) mz = 1; if (this.input.a) mx = -1; if (this.input.d) mx = 1; }
    const moveVec = new THREE.Vector3(mx, 0, mz).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camera.rotation.y);
    if (moveVec.lengthSq() > 0) moveVec.normalize();
    const acc = P.onGround ? 80 : 12, fric = P.onGround ? 10 : 1.5;

    if (mx !== 0 || mz !== 0) {
      P.velocity.x += moveVec.x * acc * dt;
      P.velocity.z += moveVec.z * acc * dt;
      const xz = new THREE.Vector2(P.velocity.x, P.velocity.z);
      if (xz.length() > spd) { xz.normalize().multiplyScalar(spd); P.velocity.x = xz.x; P.velocity.z = xz.y; }
      if (P.onGround) {
        P.bobTimer += dt * (this.input.sprint ? 15 : 10);
        this.camera.position.y = (P.floorY || P.height) + Math.sin(P.bobTimer) * 0.09;
        if (Math.sin(P.bobTimer) < -0.9 && Date.now() - P.lastStep > 330) { this.sound.step(); P.lastStep = Date.now(); }
      }
    } else {
      P.velocity.x -= P.velocity.x * fric * dt;
      P.velocity.z -= P.velocity.z * fric * dt;
      if (P.onGround) this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, (P.floorY || P.height), dt * 5);
    }

    // carry player if riding a train car (apply car's movement delta)
    if (P.ridingCar && P.ridingCar.userData.delta) {
      this.camera.position.x += P.ridingCar.userData.delta.x;
      this.camera.position.z += P.ridingCar.userData.delta.z;
    }

    P.velocity.y -= 35 * dt;
    this.camera.position.x += P.velocity.x * dt;
    this.camera.position.z += P.velocity.z * dt;
    this.camera.position.y += P.velocity.y * dt;

    // determine support height under player (ground, station deck, or train car top)
    let supportY = P.height;          // world floor
    let support = null;
    if (this.railProps) {
      const rp = this.railProps;
      // station ramp (sloped walkway up to the deck)
      if (this.railRamp) {
        const rm = this.railRamp;
        const lo = Math.min(rm.x1, rm.x2), hi = Math.max(rm.x1, rm.x2);
        if (this.camera.position.x > lo && this.camera.position.x < hi && Math.abs(this.camera.position.z - rm.z) < rm.hw) {
          const frac = THREE.MathUtils.clamp((this.camera.position.x - rm.x2) / (rm.x1 - rm.x2), 0, 1);
          const top = rm.top * frac + P.height;
          if (top > supportY) { supportY = top; support = 'ramp'; }
        }
      }
      // station deck
      if (rp.deck) {
        const d = rp.deck;
        if (Math.abs(this.camera.position.x - d.x) < d.hw && Math.abs(this.camera.position.z - d.z) < d.hd) {
          const top = d.top + P.height;
          if (top > supportY) { supportY = top; support = 'deck'; }
        }
      }
      // train car tops (rideable)
      let onCar = null;
      for (const car of rp.cars) {
        const cp = car.position;
        if (Math.abs(this.camera.position.x - cp.x) < rp.carHW && Math.abs(this.camera.position.z - cp.z) < rp.carHW) {
          const top = cp.y + rp.carTop + P.height;
          if (this.camera.position.y <= top + 0.6 && top > supportY - 0.01) { supportY = top; support = 'car'; onCar = car; }
        }
      }
      P.ridingCar = (support === 'car') ? onCar : null;
    }
    if (this.camera.position.y < supportY) { this.camera.position.y = supportY; P.velocity.y = 0; P.onGround = true; }
    else if (this.camera.position.y > supportY + 0.05) { P.onGround = false; }
    P.floorY = supportY;

    // world collisions — resolve out along axis of least penetration (no tunneling)
    const PR = 0.38;                    // player radius
    const px0 = this.camera.position;
    const bodyTop = px0.y, bodyBot = px0.y - 1.7;
    for (const obj of this.objects) {
      const b = new THREE.Box3().setFromObject(obj);
      // skip if player is entirely above (roof) or below the box vertically
      if (bodyBot > b.max.y || bodyTop < b.min.y) continue;
      const minX = b.min.x - PR, maxX = b.max.x + PR;
      const minZ = b.min.z - PR, maxZ = b.max.z + PR;
      if (px0.x > minX && px0.x < maxX && px0.z > minZ && px0.z < maxZ) {
        const dxL = px0.x - minX, dxR = maxX - px0.x;
        const dzL = px0.z - minZ, dzR = maxZ - px0.z;
        const m = Math.min(dxL, dxR, dzL, dzR);
        if (m === dxL) px0.x = minX;
        else if (m === dxR) px0.x = maxX;
        else if (m === dzL) px0.z = minZ;
        else px0.z = maxZ;
      }
    }

    // solid golems — cannot walk through enemies
    for (const e of this.enemies) {
      const er = e.userData.boss ? 2.2 : (e.userData.type === 'tank' ? 1.25 : (e.userData.type === 'runner' ? 0.6 : 0.85));
      const dx = px0.x - e.position.x, dz = px0.z - e.position.z;
      const d = Math.hypot(dx, dz), minD = er + PR;
      if (d < minD && d > 1e-4) {
        const k = (minD - d) / d;
        px0.x += dx * k; px0.z += dz * k;
      }
    }

    // pickups
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.rotation.y += dt * 2; it.position.y = 0.6 + Math.sin(Date.now() * 0.004 + i) * 0.12;
      if (this.camera.position.distanceTo(it.position) < 2) {
        this.sound.collect();
        if (it.userData.health) { P.hp = Math.min(P.maxHp, P.hp + 35); this.showMessage('+ HEALTH', '#ff3355'); }
        else if (it.userData.armor) { P.armor = Math.min(P.maxArmor, P.armor + 50); this.showMessage('+ ARMOR', '#19f0ff'); }
        else { P.weapons.forEach(w => { if (w.name !== 'PISTOL') w.ammo = Math.min(w.maxAmmo, w.ammo + 30); }); this.showMessage('+ AMMO', '#39ff14'); }
        this.updateHUD();
        this.scene.remove(it); this.items.splice(i, 1);
      }
    }

    // shooting
    const w = P.weapons[P.weaponIdx];
    const now = Date.now();
    if (w.forcePush) {
      // gauntlet: HOLD to charge kinetic energy, RELEASE to blast (power scales with charge)
      if (this.input.shoot && now - (w.lastShot || 0) > 400) {
        this.fpCharge = Math.min(1, (this.fpCharge || 0) + dt * 0.9);
      } else if ((this.fpCharge || 0) > 0) {
        this._fpPower = Math.max(0.25, this.fpCharge);
        this.fpCharge = 0;
        w.lastShot = now;
        this.fireWeapon(w);
        this.sound.shoot(w.name.toLowerCase());
      }
    } else { this.fpCharge = 0; }
    if (!w.forcePush && this.input.shoot && w.ammo > 0 && !this.gunGroup.userData.reloading && now - (w.lastShot || 0) > w.rate) {
      if (!this.god) w.ammo--;
      w.lastShot = now;
      this.fireWeapon(w);
      this.sound.shoot(w.name.toLowerCase());
      this.updateHUD();
    }
    // gun sway/return (ADS pulls weapon toward centre)
    const w0 = this.player.weapons[this.player.weaponIdx];
    const adsX = this.aiming ? 0.0 : 0.32, adsY = this.aiming ? -0.18 : -0.3, adsZ = this.aiming ? -0.46 : -0.6;
    this.gunGroup.position.z = THREE.MathUtils.lerp(this.gunGroup.position.z, adsZ, dt * 9);
    this.gunGroup.position.x = THREE.MathUtils.lerp(this.gunGroup.position.x, adsX, dt * 12);
    this.gunGroup.position.y = THREE.MathUtils.lerp(this.gunGroup.position.y, adsY, dt * 12);
    // zoom FOV toward aim target
    const isSniper = w0.pierce;
    const targetFOV = this.aiming ? this.baseFOV * (isSniper ? 0.32 : 0.62) : this.baseFOV;
    if (Math.abs(this.camera.fov - targetFOV) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, dt * 12);
      this.camera.updateProjectionMatrix();
    }
    if (!this.gunGroup.userData.reloading) this.gunGroup.rotation.x = THREE.MathUtils.lerp(this.gunGroup.rotation.x, 0, dt * 9);
    this.gunGroup.rotation.y = THREE.MathUtils.lerp(this.gunGroup.rotation.y, (-this.input.a + this.input.d) * 0.04, dt * 6);
    this.updateBowSmooth(w0, dt);
    this.muzzleFlash.material.opacity = THREE.MathUtils.lerp(this.muzzleFlash.material.opacity, 0, dt * 22);
    this.muzzleLight.intensity = THREE.MathUtils.lerp(this.muzzleLight.intensity, 0, dt * 20);

    // tracers / beams
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; const mx = t.max || 0.07; t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / mx) * 0.95;
      if (t.life <= 0) { this.scene.remove(t.mesh); this.tracers.splice(i, 1); }
    }
    // plasma projectiles
    for (let i = this.pProj.length - 1; i >= 0; i--) {
      const b = this.pProj[i];
      const step = b.vel.clone().multiplyScalar(dt);
      b.mesh.position.add(step); b.life -= dt;
      b.mesh.rotation.y += dt * 4;
      // hit test vs enemies + world
      let hit = null;
      for (const e of this.enemies) {
        if (e.position.distanceTo(b.mesh.position) < 1.3 + (e.userData.boss ? 1.5 : 0)) { hit = b.mesh.position.clone(); break; }
      }
      if (!hit) for (const o of this.objects) { if (o.position.distanceTo(b.mesh.position) < 5 && new THREE.Box3().setFromObject(o).distanceToPoint(b.mesh.position) < 0.2) { hit = b.mesh.position.clone(); break; } }
      if (b.mesh.position.y < 0.2) hit = b.mesh.position.clone().setY(0.2);
      if (hit || b.life <= 0) {
        if (hit) this.explodePlasma(hit, b.color, b.splash, b.splashDmg);
        this.scene.remove(b.mesh); this.pProj.splice(i, 1);
      }
    }
    // shockwave rings
    if (this.rings) for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.life -= dt;
      if (r.fixed) {
        r.mesh.material.opacity = Math.max(0, r.life / r.life0 || r.life / 0.16) * 0.85;
      } else {
        const s = (1 - r.life / 0.4) * r.max * 2 + 0.2;
        r.mesh.scale.set(s, s, s); r.mesh.material.opacity = Math.max(0, r.life / 0.4) * 0.8;
      }
      if (r.life <= 0) { this.scene.remove(r.mesh); this.rings.splice(i, 1); }
    }
    // thrown projectiles (shuriken / arrows)
    for (let i = this.tProj.length - 1; i >= 0; i--) {
      const b = this.tProj[i];
      b.vel.y -= b.grav * dt;
      const step = b.vel.clone().multiplyScalar(dt);
      b.mesh.position.add(step); b.life -= dt;
      if (b.arrow) { b.mesh.lookAt(b.mesh.position.clone().add(b.vel)); }
      else { b.mesh.rotation.z += b.spin * dt; b.mesh.rotation.y += b.spin * 0.5 * dt; }
      // hit enemies
      let consumed = false;
      for (const e of this.enemies) {
        if (b.hitSet.has(e)) continue;
        const center = e.position.clone().setY(e.userData.eyeHeight * 0.6);
        const rad = 1.5 + (e.userData.boss ? 1.8 : 0);
        if (center.distanceTo(b.mesh.position) < rad) {
          this.damageEnemy(e, b.dmg, b.mesh.position.clone());
          this.spawnSparks(b.mesh.position.clone(), b.color, 7);
          b.hitSet.add(e);
          if (b.pierce > 0) { b.pierce--; } else { consumed = true; }
          break;
        }
      }
      if (b.mesh.position.y < 0.15) consumed = true;
      if (consumed || b.life <= 0) { this.scene.remove(b.mesh); this.tProj.splice(i, 1); }
    }
    // katana swing animation
    if (this.swing) {
      const raw = (performance.now() - this.swing.start) / this.swing.dur;
      const p = Math.min(Math.max(raw, 0), 1);
      const eased = p * p * (3 - 2 * p);
      const attack = Math.sin(eased * Math.PI);
      const sweep = Math.sin(eased * Math.PI * 0.85);
      const baseX = this.aiming ? 0.0 : 0.32;
      this.gunGroup.rotation.z = THREE.MathUtils.lerp(this.gunGroup.rotation.z, this.swing.dir * sweep * 1.18, dt * 18);
      this.gunGroup.rotation.x = THREE.MathUtils.lerp(this.gunGroup.rotation.x, attack * 0.34, dt * 18);
      this.gunGroup.rotation.y = THREE.MathUtils.lerp(this.gunGroup.rotation.y, -this.swing.dir * attack * 0.22, dt * 18);
      this.gunGroup.position.x = THREE.MathUtils.lerp(this.gunGroup.position.x, baseX - this.swing.dir * attack * 0.22, dt * 18);
      this.gunGroup.position.y = THREE.MathUtils.lerp(this.gunGroup.position.y, (this.aiming ? -0.18 : -0.3) + attack * 0.04, dt * 18);
      if (raw >= 1) this.swing = null;
    } else {
      this.gunGroup.rotation.z = THREE.MathUtils.lerp(this.gunGroup.rotation.z, 0, dt * 12);
    }
    // pulse cannon barrel spin
    const pulse = this.gunModels && this.gunModels.pulse;
    if (pulse && pulse.userData.spin) {
      pulse.userData.spinV = THREE.MathUtils.lerp(pulse.userData.spinV || 0, 0, dt * 3);
      pulse.userData.spin.rotation.z -= (pulse.userData.spinV || 0) * dt;
    }
    this.updateForcePushFX(dt);

    // MEGAWATT CITY live props
    if (this.megaProps) {
      const mp = this.megaProps, t = performance.now() * 0.001;
      mp.vehicles.forEach(v => {
        v.pos += v.dir * v.speed * dt;
        if (v.pos > mp.span) v.pos = -mp.span; else if (v.pos < -mp.span) v.pos = mp.span;
        if (v.lane.axis === 'x') v.mesh.position.x = v.pos; else v.mesh.position.z = v.pos;
      });
      mp.orbs.forEach((o, i) => {
        o.userData.angle += dt * o.userData.speed;
        o.position.x = Math.cos(o.userData.angle + i) * o.userData.radius;
        o.position.z = Math.sin(o.userData.angle * 0.7 + i) * o.userData.radius;
        o.position.y = o.userData.yOff + Math.sin(t * 1.8 + i) * 0.4 * mp.S;
      });
      mp.ring.rotation.y += dt * 0.6;
      mp.ring.rotation.x = Math.sin(t * 0.5) * 0.2;
      mp.orb.rotation.y += dt * 0.5;
      mp.orbLight.intensity = 2.2 + Math.sin(t * 1.2) * 0.6;
      mp.dust.rotation.y += dt * 0.02;
    }

    // RAIL CITY live props (rideable train + day/night cycle)
    if (this.railProps) {
      const rp = this.railProps, t = performance.now() * 0.001;
      // move train along the loop; position each car and record movement delta for carrying
      rp.progress = (rp.progress + dt * 0.018) % 1;
      const up = new THREE.Vector3(0, 1, 0);
      rp.cars.forEach((car, i) => {
        let p = (rp.progress - i * rp.carSpacing) % 1; if (p < 0) p += 1;
        const pos = rp.curve.getPointAt(p);
        const tan = rp.curve.getTangentAt(p);
        car.userData.delta.subVectors(pos, car.userData.prevPos);
        if (car.userData.delta.lengthSq() > 25) car.userData.delta.set(0, 0, 0); // ignore loop wrap jump
        car.position.copy(pos);
        car.userData.prevPos.copy(pos);
        const look = pos.clone().add(tan); car.lookAt(look); car.rotateY(Math.PI / 2);
      });
      // traffic
      rp.vehicles.forEach(v => {
        v.pos += v.dir * v.speed * dt;
        if (v.pos > rp.span) v.pos = -rp.span; else if (v.pos < -rp.span) v.pos = rp.span;
        if (v.lane.axis === 'x') v.mesh.position.x = v.pos; else v.mesh.position.z = v.pos;
      });
      // birds
      rp.birds.forEach(b => {
        b.userData.x += b.userData.vx * dt; b.userData.z += b.userData.vz * dt;
        if (Math.abs(b.userData.x) > 50 * rp.S * 0.6) b.userData.vx *= -1;
        if (Math.abs(b.userData.z) > 50 * rp.S * 0.6) b.userData.vz *= -1;
        b.position.set(b.userData.x, b.userData.y + Math.sin(t * 3.5 + b.userData.x) * 1.2, b.userData.z);
        b.userData.flap += dt * 8; b.rotation.z = Math.sin(b.userData.flap) * 0.55;
        b.rotation.y = Math.atan2(b.userData.vx, b.userData.vz);
      });
      // clouds
      rp.clouds.forEach(c => {
        c.position.x += c.userData.sx * dt; c.position.z += c.userData.sz * dt;
        if (Math.abs(c.position.x) > 56 * rp.S * 0.6) c.userData.sx *= -1;
        if (Math.abs(c.position.z) > 56 * rp.S * 0.6) c.userData.sz *= -1;
      });
      rp.monOrb.rotation.y += dt * 0.5;

      // day↔night cycle (~90s full loop)
      rp.cycle = (rp.cycle + dt / 90) % 1;
      const ph = rp.cycle; // 0=dawn .. .5=dusk .. 1=dawn
      // daylight factor: 1 at noon (0.25), 0 at midnight (0.75)
      const day = Math.max(0, Math.cos((ph - 0.25) * Math.PI * 2)) ; // peaks at noon
      const night = 1 - day;
      // modulate bloom with the cycle: subtle by day, strong at night
      if (this.bloom) { this.bloom.strength = 0.3 + night * 0.6; this.bloom.threshold = 0.9 - night * 0.28; }
      const dayCol = new THREE.Color(0x9ec9e8), duskCol = new THREE.Color(0xf2914e), nightCol = new THREE.Color(0x0a1030);
      const sky = new THREE.Color();
      const dusk = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)) * 0, 1); // simple
      // blend: night<->day, with a dusk tint near transitions
      sky.copy(nightCol).lerp(dayCol, day);
      const transition = Math.max(0, 1 - Math.abs(day - 0.5) * 2.4); // near horizon crossings
      sky.lerp(duskCol, transition * 0.5);
      this.scene.background.copy(sky);
      if (this.scene.fog) this.scene.fog.color.copy(sky);
      rp.sun.intensity = 0.25 + day * 1.45;
      rp.sun.color.setRGB(1, 0.86 + day * 0.1, 0.7 + day * 0.22);
      rp.ambient.intensity = 0.28 + day * 0.6;
      rp.hemi.intensity = 0.25 + day * 0.55;
      // sun arcs across the sky
      const sa = (ph - 0.25) * Math.PI * 2;
      rp.sun.position.set(Math.cos(sa) * 150, Math.sin(sa) * 150 + 6, -60);
      rp.sunDisc.position.copy(rp.sun.position).multiplyScalar(1.4);
      rp.sunDisc.material.color.setRGB(1, 0.8 + day * 0.15, 0.55 + day * 0.3);
      rp.sunDisc.visible = rp.sun.position.y > -10;
      // windows glow at night
      const winGlow = night * 0.9;
      rp.winMats.forEach(m => m.emissiveIntensity = 0.05 + winGlow);
      // HUD time-of-day chip
      const tod = document.getElementById('tod-val');
      if (tod) { const hour = ((ph * 24) + 6) % 24; tod.innerText = (day > 0.15 ? '☀ ' : '☾ ') + String(Math.floor(hour)).padStart(2, '0') + ':' + (Math.floor((hour % 1) * 60) + '').padStart(2, '0'); }
    }

    // DESERT live props
    if (this.desertProps) {
      const dp = this.desertProps, t = performance.now() * 0.001;
      dp.fireLights.forEach((f, i) => {
        if (f.light) f.light.intensity = f.base + Math.sin(t * 9 + f.ph) * 0.7 + Math.random() * 0.2;
        f.fire.scale.setScalar(1 + Math.sin(t * 11 + f.ph) * 0.16);
      });
      dp.ankhs.forEach((a, i) => a.rotation.y += dt * (i % 2 ? -0.6 : 0.6));
      dp.birds.forEach(b => {
        b.userData.x += b.userData.vx * dt; b.userData.z += b.userData.vz * dt;
        if (Math.abs(b.userData.x) > 40 * dp.S * 0.6) b.userData.vx *= -1;
        if (Math.abs(b.userData.z) > 38 * dp.S * 0.6) b.userData.vz *= -1;
        b.position.set(b.userData.x, b.userData.y + Math.sin(t * 2.5 + b.userData.x) * 1.0, b.userData.z);
        b.rotation.y = Math.atan2(b.userData.vx, b.userData.vz);
        b.rotation.z = Math.sin(t * 5 + b.userData.x) * 0.4;
      });
      dp.sandP.rotation.y += dt * 0.012;
      dp.fireflies.rotation.y += dt * 0.04;
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.life -= dt;
      if (p.grav) p.vel.y -= 14 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.mesh.material.opacity = Math.max(0, p.life * 2);
      p.mesh.scale.multiplyScalar(1 - dt * 1.5);
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); }
    }
    // enemy projectiles
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      b.mesh.position.add(b.vel.clone().multiplyScalar(dt)); b.life -= dt;
      if (this.camera.position.distanceTo(b.mesh.position) < 1.1) {
        this.sound.damage(); this.damagePlayer(b.dmg);
        this.scene.remove(b.mesh); this.eBullets.splice(i, 1);
        continue;
      }
      if (b.life <= 0) { this.scene.remove(b.mesh); this.eBullets.splice(i, 1); }
    }

    // enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i], ud = e.userData;
      const toPlayer = this._tmp.subVectors(this.camera.position, e.position);
      const dist2D = Math.hypot(toPlayer.x, toPlayer.z);
      const time = Date.now() * 0.006 + ud.animOffset;

      // hit flash decay
      if (ud.hitFlash > 0) {
        ud.hitFlash = Math.max(0, ud.hitFlash - dt * 6);
        ud.cores.forEach(m => m.emissiveIntensity = 2.2 + ud.hitFlash * 5);
        e.children.forEach(c => { if (c.material && c.material.emissive && ud.cores.indexOf(c.material) === -1) { /* shell */ } });
      }

      if (ud.dummy) continue; // range targets don't move or attack

      if (ud.ranged) {
        // keep at range, strafe a bit
        const desired = ud.range || 26;
        const dir = toPlayer.clone(); dir.y = 0; dir.normalize();
        if (dist2D > desired + 4) e.position.add(dir.multiplyScalar(ud.speed * dt));
        else if (dist2D < desired - 6) e.position.add(dir.multiplyScalar(-ud.speed * dt));
        e.lookAt(this.camera.position.x, e.position.y, this.camera.position.z);
        if (ud.hover) e.position.y = Math.sin(time) * 0.25;
        // fire
        if (Date.now() - ud.lastFire > ud.fireRate && dist2D < (ud.range || 26) + 12) {
          ud.lastFire = Date.now(); this.enemyFire(e);
          if (ud.parts.orb) ud.parts.orb.scale.setScalar(1.6);
        }
        if (ud.parts && ud.parts.orb) ud.parts.orb.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 4);
        // boss also melees if close
        if (ud.boss && dist2D < 3.5) this.damagePlayer(ud.dmg * dt);
      } else {
        // melee chaser
        const atkRange = ud.boss ? 3.5 : 1.6 + (ud.type === 'tank' ? 0.6 : 0);
        if (dist2D > atkRange) {
          const dir = toPlayer.clone(); dir.y = 0; dir.normalize();
          e.position.add(dir.multiplyScalar(ud.speed * dt));
          e.lookAt(this.camera.position.x, e.position.y, this.camera.position.z);
          // walk animation
          const sw = ud.crawl ? 1.2 : 0.6;
          ud.parts.legs.forEach((l, k) => l.rotation.x = Math.sin(time * (ud.crawl ? 2 : 1) + (k % 2) * Math.PI) * sw);
          ud.parts.arms.forEach((a, k) => a.rotation.x = Math.sin(time + (k % 2) * Math.PI) * 0.5);
        } else {
          this.damagePlayer(ud.dmg * dt);
          ud.parts.arms.forEach(a => a.rotation.x = -Math.PI / 2.2);
        }
      }
    }

    // boss bar
    if (this.boss) {
      document.getElementById('boss-bar').style.width = Math.max(0, this.boss.userData.hp / this.boss.userData.maxHp * 100) + '%';
    }

    // next wave
    this.updateWaveCountdown(dt);
    if (this.level !== 'range' && this.enemies.length === 0 && !this.waveCountdown) {
      this.startWaveCountdown(this.wave + 1);
    }
  }

  // ---------------- MINIMAP ----------------
  drawMinimap() {
    const ctx = this.mmCtx, cx = 75, cy = 75, scale = 0.42;
    ctx.clearRect(0, 0, 150, 150);
    ctx.fillStyle = 'rgba(6,10,20,0.7)'; ctx.fillRect(0, 0, 150, 150);
    const rot = this.camera.rotation.y;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    ctx.fillStyle = '#2a3550';
    for (const o of this.objects) {
      if (o.scale.y > 4) {
        const dx = o.position.x - this.camera.position.x, dz = o.position.z - this.camera.position.z;
        const rx = dx * cosR - dz * sinR, ry = dx * sinR + dz * cosR;
        if (Math.abs(rx) < 150 && Math.abs(ry) < 150) ctx.fillRect(cx + rx * scale - 3, cy + ry * scale - 3, 6, 6);
      }
    }
    for (const e of this.enemies) {
      const dx = e.position.x - this.camera.position.x, dz = e.position.z - this.camera.position.z;
      const rx = dx * cosR - dz * sinR, ry = dx * sinR + dz * cosR;
      if (Math.abs(rx) < 150 && Math.abs(ry) < 150) {
        ctx.fillStyle = e.userData.boss ? '#ff2d95' : (e.userData.ranged ? '#9b5cff' : '#ff5555');
        ctx.beginPath(); ctx.arc(cx + rx * scale, cy + ry * scale, e.userData.boss ? 5 : 3, 0, 6.28); ctx.fill();
      }
    }
    for (const it of this.items) {
      const dx = it.position.x - this.camera.position.x, dz = it.position.z - this.camera.position.z;
      const rx = dx * cosR - dz * sinR, ry = dx * sinR + dz * cosR;
      if (Math.abs(rx) < 150 && Math.abs(ry) < 150) { ctx.fillStyle = it.userData.health ? '#ff3355' : '#39ff14'; ctx.fillRect(cx + rx * scale - 2, cy + ry * scale - 2, 4, 4); }
    }
    ctx.fillStyle = '#19f0ff';
    ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 4, cy + 5); ctx.lineTo(cx + 4, cy + 5); ctx.fill();
  }

  // ---------------- HUD ----------------
  updateHUD() {
    if (!this.gameStarted) return;
    document.getElementById('score-val').innerText = this.score.toLocaleString();
    document.getElementById('wave-val').innerText = this.wave;
    document.getElementById('enemies-val').innerText = this.enemies.length;
    const hpPct = Math.max(0, this.player.hp / this.player.maxHp * 100);
    document.getElementById('health-bar').style.width = hpPct + '%';
    document.getElementById('hp-num').innerText = Math.max(0, Math.ceil(this.player.hp));
    const armorBar = document.getElementById('armor-bar');
    if (armorBar) {
      armorBar.style.width = Math.max(0, this.player.armor / this.player.maxArmor * 100) + '%';
      const an = document.getElementById('armor-num');
      if (an) an.innerText = Math.max(0, Math.ceil(this.player.armor));
    }
    const w = this.player.weapons[this.player.weaponIdx];
    document.getElementById('weapon-name').innerText = w.name;
    document.getElementById('ammo-display').innerText = w.ammo === Infinity ? '∞' : w.ammo;
    document.getElementById('max-ammo-display').innerText = w.maxAmmo === Infinity ? '∞' : w.maxAmmo;
    const cont = document.getElementById('wep-icon-container');
    cont.innerHTML = '';
    this.player.weapons.forEach((wp, i) => {
      const d = document.createElement('div');
      d.className = 'wep-chip' + (i === this.player.weaponIdx ? ' active' : '');
      d.innerHTML = `<span class="wep-key">${i + 1}</span><span class="wep-lbl">${wp.name}</span>`;
      cont.appendChild(d);
    });
  }

  endGame() {
    if (!this.gameStarted) return;
    this.gameStarted = false; this.isPaused = true;
    if (this.curGameMusic) { this.curGameMusic.pause(); }
    document.exitPointerLock();
    document.getElementById('death-screen').classList.remove('hidden');
    document.getElementById('final-score').innerText = this.score.toLocaleString();
    document.getElementById('final-wave').innerText = this.wave;
  }

  // Auto quality scaler: if the frame rate stays low, step down pixel ratio,
  // then disable shadows — keeps the game playable on the weakest GPUs.
  autoQuality(dt) {
    this._fpsAvg = this._fpsAvg === undefined ? 60 : this._fpsAvg * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
    this._qualT = (this._qualT || 0) + dt;
    if (this._qualT < 3) return; // evaluate every 3 seconds
    this._qualT = 0;
    this._qualTier = this._qualTier || 0;
    if (this._fpsAvg < 28 && this._qualTier < 3) {
      this._qualTier++;
      if (this._qualTier === 1) this.renderer.setPixelRatio(1);
      else if (this._qualTier === 2) this.renderer.setPixelRatio(0.75);
      else if (this._qualTier === 3) {
        this.renderer.shadowMap.enabled = false;
        this.scene.traverse(o => { if (o.isLight) o.castShadow = false; });
        this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
      }
      this.renderer.setSize(innerWidth, innerHeight);
      this._fpsAvg = 60; // reset so the next tier is judged fresh
      console.info('[autoQuality] low fps — stepping down to tier', this._qualTier);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.autoQuality(dt);
    if (this.gameStarted && !this.isPaused) this.drawMinimap();
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
}

Game.showFatalStartupError = function(message, err) {
  console.error(message, err || '');
  const overlay = document.getElementById('menu-overlay') || document.body;
  const panel = document.createElement('div');
  panel.style.cssText = 'max-width:720px;margin:24px auto;padding:20px;border:1px solid rgba(255,45,149,.65);background:rgba(8,10,18,.92);color:#fff;font:600 16px Rajdhani,Arial,sans-serif;line-height:1.45;box-shadow:0 0 34px rgba(255,45,149,.25);';
  panel.innerHTML = `<b style="color:#ff2d95;font-family:Orbitron,Arial,sans-serif;letter-spacing:.08em">STARTUP ERROR</b><br>${message}`;
  overlay.appendChild(panel);
};

window.onload = () => TextureGen.load(() => {
  try {
    window.game = new Game();
    if (window.__dismissPreload) window.__dismissPreload();
  } catch (err) {
    if (window.__dismissPreload) window.__dismissPreload(err);
    Game.showFatalStartupError('The game failed to initialize. Check the browser console for details.', err);
  }
});
addEventListener('resize', () => {
  if (window.game && game.camera && game.renderer) {
    game.camera.aspect = innerWidth / innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(innerWidth, innerHeight);
    if (game.composer) game.composer.setSize(innerWidth, innerHeight);
  }
});
