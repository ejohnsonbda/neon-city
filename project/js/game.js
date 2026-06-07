// ============================================================
//  GAME ENGINE — Neon City: Nightfall
// ============================================================
class Game {
  constructor() {
    if (typeof THREE === 'undefined') { alert('Three.js failed to load.'); return; }

    this.container = document.getElementById('game-container');
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.012);
    this.lowMemoryMode = Game.shouldUseLowMemoryMode();
    window.__NEON_LOW_MEMORY = this.lowMemoryMode;
    document.documentElement.classList.toggle('low-memory-mode', this.lowMemoryMode);
    if (this.lowMemoryMode) this.scene.fog.density = 0.018;

    this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.1, 1200);
    this.camera.rotation.order = 'YXZ';
    this.camera.far = this.lowMemoryMode ? 650 : 1200;
    this.camera.updateProjectionMatrix();

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    } catch (err) {
      Game.showFatalStartupError('WebGL could not start. Please enable hardware acceleration or try another browser.', err);
      this.failed = true;
      return;
    }
    this.renderer.setClearColor(0x05060c, 1);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.lowMemoryMode ? 0.75 : 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = !this.lowMemoryMode;
    this.renderer.shadowMap.type = this.lowMemoryMode ? THREE.BasicShadowMap : THREE.PCFShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.container.appendChild(this.renderer.domElement);

    // ---- Post-processing: UnrealBloom energy glow (all emissive elements) ----
    this.composer = null;
    if (!this.lowMemoryMode && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass) {
      try {
        this.composer = new THREE.EffectComposer(this.renderer);
        this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
        this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.72, 0.55, 0.82);
        this.composer.addPass(this.bloom);
      } catch (e) { this.composer = null; }
    }

    this.clock = new THREE.Clock();
    this.framePerf = { avgMs: 16.7, slow: false, pulseSoundStep: 0, minimapAccum: 0 };
    this._liveAnimAccum = 0;
    this._effectMats = {};
    this._effectGeometries = {};
    this._emojiTextures = {};
    this._pulseShotCounter = 0;
    this.preloadReady = false;
    this.raycastObjects = [];
    this.sound = new SoundManager();
    this.shootSamplePromise = this.sound.loadSample('shoot', (window.__resources && window.__resources.shootSfx) || 'uploads/chromascension-lazer-gun-one-shot-542393.mp3');
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
    this.portals = [];
    this.portalCooldown = 0;
    this.boss = null;
    this.bosses = [];

    this.isPaused = false;
    this.gameStarted = false;
    this.level = 'city';
    this.score = 0;
    this.wave = 1;
    this.waveCountdown = null;

    this.player = {
      speed: 14, runSpeed: 22, jumpForce: 14,
      velocity: new THREE.Vector3(),
      onGround: false, hp: 120, maxHp: 120,
      height: 1.7, classType: 'soldier', weaponIdx: 0,
      bobTimer: 0, lastStep: 0,
      weapons: [
        { name: 'PISTOL',  type: 'semi', rate: 230, dmg: 38,  color: 0x19f0ff, ammo: Infinity, maxAmmo: Infinity, spread: 0.008, model: 'pistol',  kick: 0.012 },
        { name: 'SMG',     type: 'auto', rate: 62,  dmg: 13,  color: 0xffd166, ammo: 220, maxAmmo: 480, spread: 0.05,  model: 'smg',     kick: 0.009 },
        { name: 'SHOTGUN', type: 'semi', rate: 700, dmg: 11,  pellets: 9, color: 0xff2d95, ammo: 36,  maxAmmo: 96,  spread: 0.11, model: 'shotgun', kick: 0.05 },
        { name: 'RAILGUN', type: 'semi', rate: 1050, dmg: 135, color: 0x39ff14, ammo: 18, maxAmmo: 48, spread: 0, pierce: true, model: 'railgun', kick: 0.06 },
        { name: 'PLASMA',  type: 'semi', rate: 760, dmg: 40, splash: 5.5, splashDmg: 55, color: 0x9b5cff, ammo: 24, maxAmmo: 60, spread: 0.004, projectile: true, model: 'plasma', kick: 0.03 },
        { name: 'PULSE',   type: 'auto', rate: 40,  dmg: 8,   color: 0xff7a18, ammo: 320, maxAmmo: 700, spread: 0.055, model: 'pulse', kick: 0.006 },
        { name: 'SNIPER',  type: 'semi', rate: 1200, dmg: 9999, color: 0x00e5ff, ammo: 16, maxAmmo: 48, spread: 0, model: 'sniper', kick: 0.075, scope: true, oneHit: true }
      ]
    };

    // per-level arsenals: the neon katana and bow are available in every theatre;
    // Japan keeps the focused traditional loadout with shuriken support.
    this.defaultWeapons = this.player.weapons;
    this.japanWeapons = [
      { name: 'KATANA',   type: 'semi', rate: 320,  dmg: 90, color: 0xcfe8ff, ammo: Infinity, maxAmmo: Infinity, spread: 0, model: 'katana',   kick: 0, melee: true, reach: 4.35, arc: 0.55 },
      { name: 'SHURIKEN', type: 'semi', rate: 240,  dmg: 34, color: 0xc8d2dc, ammo: 60, maxAmmo: 180, spread: 0.02, model: 'shuriken', kick: 0.012, thrown: true, speed: 70 },
      { name: 'BOW',      type: 'semi', rate: 620,  dmg: 120, color: 0x19f0ff, ammo: 30, maxAmmo: 80, spread: 0.003, model: 'bow', kick: 0.008, arrow: true, speed: 104 }
    ];
    this.defaultWeapons = [
      ...this.defaultWeapons,
      { ...this.japanWeapons[0] },
      { ...this.japanWeapons[2] }
    ];
    this.applyFramePacingWeaponTuning(this.defaultWeapons);
    this.applyFramePacingWeaponTuning(this.japanWeapons);
    this.weaponSmooth = { bowDraw: 0, bowRelease: 0 };
    this.dualWield = false;
    this.lastPistolTap = 0;
    this.dualWieldTapMs = 340;

    this.input = { w: 0, a: 0, s: 0, d: 0, jump: 0, shoot: 0, sprint: 0 };
    this.touchState = { moveX: 0, moveY: 0 };
    this.raycaster = new THREE.Raycaster();
    this._tmp = new THREE.Vector3();

    this.initWorld();
    this.initUI();
    this.setupInputs();
    this.beginPreloadWarmup();
    this.animate();

    this.mmCanvas = document.getElementById('minimap-canvas');
    this.mmCtx = this.mmCanvas.getContext('2d');
    this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (this.isMobile) document.getElementById('mobile-controls').classList.remove('hidden');
  }




  static nextPreloadFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }

  setPreloadStatus(label, progress, detail) {
    Game.updateBootStatus(label, progress, detail);
  }

  async beginPreloadWarmup() {
    if (this._preloadStarted) return;
    this._preloadStarted = true;
    const runStage = async (label, progress, detail, fn) => {
      this.setPreloadStatus(label, progress, detail);
      await Game.nextPreloadFrame();
      try { if (typeof fn === 'function') await fn(); }
      catch (err) { console.warn('[Preload]', label, err); }
      await Game.nextPreloadFrame();
    };

    try {
      const low = !!this.lowMemoryMode;
      if (low) document.documentElement.classList.add('preload-lite');
      await runStage('EFFECT CACHE', 28, low ? 'Low-memory mode: warming only shared combat resources.' : 'Preparing reusable muzzle, pulse, plasma, and rail effects.', () => this.preloadEffectResources());
      await runStage('PICKUP SPRITES', 46, 'Rendering first-use health and ammo pickup glyphs.', () => this.preloadPickupSprites());
      await runStage('AUDIO DECODE', 62, 'Decoding weapon audio early when the browser allows it.', () => this.preloadAudioResources());
      if (!low) {
        await runStage('TEXTURE PATHS', 74, 'Touching common procedural terrain and sky texture builders.', () => this.preloadTextureBuilders());
        await runStage('ENEMY TEMPLATES', 84, 'Building and releasing common enemy mesh templates.', () => this.preloadEnemyTemplates());
      } else {
        await runStage('LITE TEXTURES', 74, 'Skipping heavy warm-up to protect 1 GB devices.', null);
      }
      await runStage('SHADER WARM-UP', 94, 'Compiling the first frame before deployment.', () => this.preloadRendererShaders());
      this.preloadReady = true;
      window.__NEON_PRELOAD_DONE = true;
      this.setPreloadStatus('READY', 100, 'Select a theatre and deploy.');
    } finally {
      setTimeout(() => Game.hideBootOverlay(), 420);
    }
  }

  preloadEffectResources() {
    const colors = [
      ['muzzle', 0xffffff, 0.95],
      ['pistol', 0x19f0ff, 0.8],
      ['shotgun', 0xff2d95, 0.72],
      ['rail', 0x39ff14, 0.86],
      ['plasma', 0x9b5cff, 0.78],
      ['pulse', 0xff7a18, this.lowMemoryMode ? 0.55 : 0.78]
    ];
    colors.forEach(([key, color, opacity]) => this.getEffectMaterial(key, color, opacity));
    this.getSparkGeometry();
  }

  getEmojiTexture(emoji) {
    this._emojiTextures ||= {};
    if (!this._emojiTextures[emoji]) {
      const size = this.lowMemoryMode ? 96 : 128;
      const c = document.createElement('canvas'); c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.font = Math.round(size * 0.72) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emoji, size / 2, size * 0.55);
      const tex = new THREE.CanvasTexture(c);
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.userData = tex.userData || {};
      tex.userData.sharedEffectResource = true;
      this._emojiTextures[emoji] = tex;
    }
    return this._emojiTextures[emoji];
  }

  preloadPickupSprites() {
    ['🔋', '❤️', '💊'].forEach(e => this.getEmojiTexture(e));
  }

  async preloadAudioResources() {
    if (this.sound && typeof this.sound.resume === 'function') {
      try { this.sound.resume(); } catch (e) {}
    }
    if (this.shootSamplePromise && typeof this.shootSamplePromise.then === 'function') {
      await Promise.race([
        this.shootSamplePromise.catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 900))
      ]);
    }
  }

  preloadTextureBuilders() {
    if (this.lowMemoryMode || typeof TextureGen === 'undefined') return;
    const tex = [];
    const safe = fn => { try { const t = fn(); if (t) tex.push(t); } catch (e) { console.warn('[Preload] texture builder skipped', e); } };
    safe(() => TextureGen.createAsphalt());
    safe(() => TextureGen.createGrass(false));
    safe(() => TextureGen.createSand());
    safe(() => TextureGen.createSky());
    safe(() => TextureGen.createDaySky('#153d25', '#4d7a49'));
    tex.forEach(t => { if (t && typeof t.dispose === 'function') t.dispose(); });
  }

  preloadEnemyTemplates() {
    if (this.lowMemoryMode || typeof EnemyFactory === 'undefined' || !EnemyFactory.build) return;
    const types = ['grunt', 'runner', 'shooter', 'boss'];
    this._preloadEnemyMeshes = [];
    types.forEach(type => {
      try {
        if (!EnemyFactory.TYPES || !EnemyFactory.TYPES[type]) return;
        const mesh = EnemyFactory.build(type, 'rock');
        mesh.position.set((this._preloadEnemyMeshes.length - 1.5) * 2.4, -1000, -6);
        this._preloadEnemyMeshes.push(mesh);
      } catch (err) { console.warn('[Preload] enemy template skipped', type, err); }
    });
  }

  preloadRendererShaders() {
    if (!this.renderer || !this.camera) return;
    const warmScene = new THREE.Scene();
    const warmCam = new THREE.PerspectiveCamera(60, 1, 0.1, 20);
    warmCam.position.set(0, 1.5, 5);
    warmCam.lookAt(0, 0, 0);
    warmScene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0x9bdcff, 1.0);
    key.position.set(2, 4, 3); warmScene.add(key);
    const standard = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x19f0ff, emissive: 0x052a36, roughness: 0.62, metalness: 0.18 }));
    const additive = new THREE.Mesh(new THREE.SphereGeometry(0.45, this.lowMemoryMode ? 8 : 16, this.lowMemoryMode ? 6 : 12), this.getEffectMaterial('shaderWarm', 0xff7a18, 0.72));
    additive.position.set(1.25, 0, 0);
    warmScene.add(standard, additive);
    (this._preloadEnemyMeshes || []).forEach((mesh, i) => { mesh.position.set(-2.5 + i * 1.6, 0, -2.5); warmScene.add(mesh); });
    try {
      if (typeof this.renderer.compile === 'function') this.renderer.compile(warmScene, warmCam);
      this.renderer.render(warmScene, warmCam);
      if (typeof this.renderer.compile === 'function') this.renderer.compile(this.scene, this.camera);
      this.renderer.render(this.scene, this.camera);
    } finally {
      (this._preloadEnemyMeshes || []).forEach(mesh => { warmScene.remove(mesh); this.disposeObject3D(mesh); });
      this._preloadEnemyMeshes = [];
      warmScene.remove(standard, additive);
      standard.geometry.dispose(); standard.material.dispose();
      additive.geometry.dispose();
    }
  }

  static shouldUseLowMemoryMode() {
    const params = new URLSearchParams(location.search || '');
    if (params.get('lowmem') === '0') return false;
    if (params.get('lowmem') === '1') return true;
    try {
      const saved = localStorage.getItem('neonLowMemory');
      if (saved === '1') return true;
      if (saved === '0') return false;
    } catch (e) {}
    const mem = navigator.deviceMemory || 4;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    return mem <= 1.5 || (mobile && mem <= 2);
  }

  disposeMaterial(mat) {
    if (!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    mats.forEach(m => {
      if (!m) return;
      if (m.userData && m.userData.sharedEffectResource) return;
      ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap'].forEach(k => {
        if (m[k] && typeof m[k].dispose === 'function') m[k].dispose();
      });
      if (typeof m.dispose === 'function') m.dispose();
    });
  }

  disposeObject3D(root) {
    if (!root) return;
    root.traverse(obj => {
      if (obj.geometry && typeof obj.geometry.dispose === 'function' && !(obj.geometry.userData && obj.geometry.userData.sharedEffectResource)) obj.geometry.dispose();
      if (obj.material) this.disposeMaterial(obj.material);
    });
  }

  clearTransientEffects() {
    const clearMeshList = (list, entryMesh = false) => {
      if (!Array.isArray(list)) return [];
      list.forEach(entry => {
        const mesh = entryMesh ? entry.mesh : entry;
        if (mesh) {
          this.scene.remove(mesh);
          this.disposeObject3D(mesh);
        }
      });
      return [];
    };
    this.enemies = clearMeshList(this.enemies);
    this.items = clearMeshList(this.items);
    this.particles = clearMeshList(this.particles, true);
    this.tracers = clearMeshList(this.tracers, true);
    this.eBullets = clearMeshList(this.eBullets, true);
    this.pProj = clearMeshList(this.pProj, true);
    this.tProj = clearMeshList(this.tProj, true);
    this.rings = clearMeshList(this.rings || [], true);
    this.boss = null;
    this.bosses = [];
    const bossWrap = document.getElementById('boss-bar-wrap');
    if (bossWrap) bossWrap.classList.add('hidden');
  }

  applyLowMemoryWorldOptimizations() {
    if (!this.lowMemoryMode || !this.worldGroup) return;
    const protectedRoots = new Set([...(this.objects || []), ...(this.portals || []).map(p => p.mesh).filter(Boolean)]);
    const isProtected = (obj) => {
      let cur = obj;
      while (cur) {
        if (protectedRoots.has(cur)) return true;
        cur = cur.parent;
      }
      return false;
    };
    let smallMeshIndex = 0, lightIndex = 0, removed = 0;
    const toRemove = [];
    this.worldGroup.traverse(obj => {
      obj.castShadow = false;
      obj.receiveShadow = false;
      if (obj.isLight && !isProtected(obj)) {
        lightIndex++;
        if (obj.isPointLight || obj.isSpotLight) {
          obj.intensity *= lightIndex <= 8 ? 0.55 : 0;
          if (lightIndex > 8) toRemove.push(obj);
        }
      }
      if (!obj.isMesh || isProtected(obj)) return;
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if (!m) return;
          if (m.emissiveIntensity !== undefined) m.emissiveIntensity *= 0.65;
          if (m.transparent && m.opacity > 0.45) m.opacity *= 0.8;
        });
      }
      if (obj.geometry) {
        obj.geometry.computeBoundingSphere();
        const r = obj.geometry.boundingSphere ? obj.geometry.boundingSphere.radius * Math.max(obj.scale.x, obj.scale.y, obj.scale.z) : 99;
        const transparent = obj.material && (Array.isArray(obj.material) ? obj.material.some(m => m && m.transparent) : obj.material.transparent);
        if (r < 0.85 || transparent) {
          smallMeshIndex++;
          if (smallMeshIndex % 3 !== 0) toRemove.push(obj);
        }
      }
    });
    toRemove.forEach(obj => {
      if (!obj.parent || isProtected(obj)) return;
      obj.parent.remove(obj);
      this.disposeObject3D(obj);
      removed++;
    });
    this.lowMemoryStats = { removedDecor: removed, retainedColliders: this.objects.length, level: this.level };
  }

  trimTransientEffects() {
    if (!this.lowMemoryMode) return;
    const caps = { particles: 70, tracers: 14, eBullets: 24, pProj: 10, tProj: 16, rings: 8 };
    const trim = (list, cap, entryMesh = true) => {
      if (!Array.isArray(list)) return;
      while (list.length > cap) {
        const entry = list.shift();
        const mesh = entryMesh ? entry.mesh : entry;
        if (mesh) { this.scene.remove(mesh); this.disposeObject3D(mesh); }
      }
    };
    trim(this.particles, caps.particles);
    trim(this.tracers, caps.tracers);
    trim(this.eBullets, caps.eBullets);
    trim(this.pProj, caps.pProj);
    trim(this.tProj, caps.tProj);
    trim(this.rings || [], caps.rings);
  }

  applyFramePacingWeaponTuning(weapons) {
    if (!Array.isArray(weapons)) return weapons;
    weapons.forEach(w => {
      if (!w || w.model !== 'pulse') return;
      if (w.baseRate === undefined) w.baseRate = w.rate;
      if (w.baseDmg === undefined) w.baseDmg = w.dmg;
      if (this.lowMemoryMode) {
        // The old 40 ms pulse stream created too many raycasts, tracers, spark meshes,
        // hitmarker timers, and WebAudio nodes per second on 1 GB RAM devices.
        // Keep the weapon automatic, but pace it like a compact energy SMG.
        w.rate = Math.max(w.baseRate, 90);
        w.dmg = Math.max(w.baseDmg, 12);
        w.fxCadence = 3;
        w.soundCadence = 3;
      } else {
        w.rate = w.baseRate;
        w.dmg = w.baseDmg;
        w.fxCadence = 1;
        w.soundCadence = 1;
      }
    });
    return weapons;
  }

  effectiveWeaponRate(w) {
    if (!w) return 999;
    let rate = w.rate || 100;
    if (w.model === 'pulse' && this.framePerf && this.framePerf.slow) rate = Math.max(rate, this.lowMemoryMode ? 125 : 75);
    return rate;
  }

  shouldEmitPulseVisual(w) {
    if (!w || w.model !== 'pulse') return true;
    this._pulseShotCounter = (this._pulseShotCounter || 0) + 1;
    const cadence = this.lowMemoryMode ? (this.framePerf && this.framePerf.slow ? 4 : (w.fxCadence || 3)) : (this.framePerf && this.framePerf.slow ? 2 : 1);
    return cadence <= 1 || this._pulseShotCounter % cadence === 0;
  }

  shouldEmitWeaponSound(w) {
    if (!w || w.model !== 'pulse') return true;
    this.framePerf.pulseSoundStep = (this.framePerf.pulseSoundStep || 0) + 1;
    const cadence = this.lowMemoryMode ? (this.framePerf.slow ? 4 : (w.soundCadence || 3)) : (this.framePerf.slow ? 2 : 1);
    return cadence <= 1 || this.framePerf.pulseSoundStep % cadence === 0;
  }

  updateFramePerf(dt) {
    if (!this.framePerf) return;
    const ms = Math.max(1, Math.min(120, dt * 1000));
    this.framePerf.avgMs = this.framePerf.avgMs * 0.92 + ms * 0.08;
    this.framePerf.slow = this.framePerf.avgMs > (this.lowMemoryMode ? 24 : 30);
  }

  getEffectMaterial(key, color, opacity = 1) {
    const k = key + ':' + color.toString(16) + ':' + opacity;
    if (!this._effectMats[k]) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
      mat.userData.sharedEffectResource = true;
      this._effectMats[k] = mat;
    }
    return this._effectMats[k];
  }

  getSparkGeometry() {
    if (!this._effectGeometries.spark) {
      const geo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      geo.userData.sharedEffectResource = true;
      this._effectGeometries.spark = geo;
    }
    return this._effectGeometries.spark;
  }

  rebuildRaycastCache() {
    const src = this.objects || [];
    if (!this.lowMemoryMode) { this.raycastObjects = src; return; }
    this.raycastObjects = src.filter(obj => {
      if (!obj) return false;
      if (obj.userData && obj.userData.isCollider) return true;
      if (!obj.geometry) return true;
      obj.geometry.computeBoundingSphere();
      const r = obj.geometry.boundingSphere ? obj.geometry.boundingSphere.radius * Math.max(obj.scale.x, obj.scale.y, obj.scale.z) : 99;
      return r > 0.55;
    });
  }

  applyLowMemoryEnemy(mesh) {
    if (!this.lowMemoryMode || !mesh) return;
    mesh.traverse(obj => {
      obj.castShadow = false;
      obj.receiveShadow = false;
      if (obj.isLight) obj.intensity *= 0.5;
    });
  }

  // ---------------- WORLD ----------------
  initWorld() {
    // Environment is built per-level on Deploy. Just set up the viewmodel now.
    this.createWeaponModel();
    this.scene.background = new THREE.Color(0x05060c);
  }

  buildWorld(level) {
    if (this.worldGroup) {
      this.scene.remove(this.worldGroup);
      this.disposeObject3D(this.worldGroup);
    }
    this.clearTransientEffects();
    this.objects = [];
    this.elevatedSupports = [];
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    this.level = level;
    this.megaProps = null;
    this.railProps = null;
    this.desertProps = null;
    this.jungleProps = null;
    this.japanProps = null;
    this.portals = [];
    this.portalCooldown = 0;
    // tune bloom per level: punchy at night, subtle in daylight (avoids white-out)
    if (this.bloom) {
      const day = (level === 'fields' || level === 'desert' || level === 'houseyard');
      if (day) { this.bloom.strength = 0.3; this.bloom.threshold = 0.88; this.bloom.radius = 0.4; }
      else { this.bloom.strength = 0.85; this.bloom.threshold = 0.62; this.bloom.radius = 0.7; }
    }
    if (level === 'fields') this.buildFields(this.worldGroup);
    else if (level === 'houseyard') this.buildHouseYardBossLevel(this.worldGroup);
    else if (level === 'megacity') this.buildMegaCity(this.worldGroup);
    else if (level === 'rail') this.buildRailCity(this.worldGroup);
    else if (level === 'desert') this.buildDesert(this.worldGroup);
    else if (level === 'jungle') this.buildJungle(this.worldGroup);
    else this.buildCity(this.worldGroup);
    this.applyLowMemoryWorldOptimizations();
    this.rebuildRaycastCache();
  }


  createPortal(W, position, target, color = 0x19f0ff, label = 'PORTAL') {
    this.portals ||= [];
    const group = new THREE.Group();
    group.name = label;
    group.position.copy(position);
    const ringMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, roughness: 0.24, metalness: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.13, 16, 64), ringMat);
    ring.rotation.y = Math.PI / 2;
    group.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.045, 12, 48), ringMat);
    inner.rotation.y = Math.PI / 2;
    group.add(inner);
    const field = new THREE.Mesh(new THREE.CircleGeometry(1.48, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    field.rotation.y = Math.PI / 2;
    group.add(field);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.28, 0.75), ringMat);
    base.position.y = -1.84;
    group.add(base);
    const light = new THREE.PointLight(color, 2.4, 18, 2);
    group.add(light);
    W.add(group);
    const portal = { mesh: group, field, position, target, radius: 2.6, cooldown: 0, label };
    this.portals.push(portal);
    return portal;
  }

  updatePortals(dt) {
    if (!this.portals || !this.portals.length) return;
    this.portalCooldown = Math.max(0, (this.portalCooldown || 0) - dt);
    for (const portal of this.portals) {
      portal.mesh.rotation.z += dt * 0.9;
      if (portal.field?.material) portal.field.material.opacity = 0.16 + Math.sin(Date.now() * 0.004) * 0.055;
      if (this.portalCooldown > 0) continue;
      const dx = this.camera.position.x - portal.position.x, dz = this.camera.position.z - portal.position.z;
      if (Math.hypot(dx, dz) < portal.radius && Math.abs(this.camera.position.y - portal.position.y) < 4.0) {
        this.portalCooldown = 1.5;
        this.showMessage(portal.label || 'PORTAL', '#19f0ff', 1200);
        const targetLevel = portal.targetLevel;
        const target = portal.target.clone();
        if (targetLevel && targetLevel !== this.level) {
          this.buildWorld(targetLevel);
          this.level = targetLevel;
          this.portalCooldown = 1.5;
        }
        this.camera.position.copy(target);
        this.player.velocity.set(0, 0, 0);
        this.player.onGround = true;
        break;
      }
    }
  }

  // ================= EGYPTIAN DESERT =================
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
      new THREE.MeshStandardMaterial({ map: sand, color: 0xceac72, roughness: 0.95, metalness: 0.02 }));
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
    [[-3, 10], [3, 10], [-2, 16.5], [2, 16.5], [0, 13], [-6, 5], [6, 5]].forEach(([x, z]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * S, 0.22 * S, 1.8 * S, 6), new THREE.MeshStandardMaterial({ color: 0x9a7838, roughness: 0.8 }));
      pole.position.set(x * S, 0.9 * S, z * S); pole.castShadow = true; W.add(pole);
      const fire = new THREE.Mesh(new THREE.SphereGeometry(0.28 * S, 8, 8), fireMat);
      fire.position.set(x * S, 1.95 * S, z * S); W.add(fire);
      const lt = new THREE.PointLight(0xff7a33, 2.0, 12 * S * 0.5, 2); lt.position.set(x * S, 2.0 * S, z * S); W.add(lt);
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
    W.add(new THREE.AmbientLight(0xc9b48a, 0.42));
    W.add(new THREE.HemisphereLight(0xe8d4ae, 0x5a4c30, 0.34));
    const sun = new THREE.DirectionalLight(0xffe0a0, 1.15);
    sun.position.set(60, 120, -50); sun.castShadow = true; sun.shadow.bias = -0.0002;
    sun.shadow.camera.left = -220; sun.shadow.camera.right = 220; sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
    sun.shadow.camera.far = 600; sun.shadow.mapSize.set(2048, 2048); W.add(sun);

    // Concept-sheet playable temple, tomb/scaffold route, balcony, and sandstone cover.
    this.addDesertPlayableStructures(W, S, stoneMat, darkStone);

    const desertPortal = this.createPortal(W, new THREE.Vector3(-16 * S, 1.8 * S, 18 * S), new THREE.Vector3(23 * S, this.player.height, -20 * S), 0x78ff65, 'JUNGLE PORTAL');
    desertPortal.targetLevel = 'jungle';
    this.desertProps = { fireLights, birds, ankhs, sandP, fireflies, span: 50 * S, S };
    this._desertSpawn = new THREE.Vector3(0, this.player.height, 22 * S);
  }


  // ================= LOST JUNGLE (distinct from Egypt) =================
  buildJungle(W) {
    const S = 7;
    this.scene.background = null;
    this.scene.fog = new THREE.FogExp2(0x17351b, 0.0095);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 24),
      new THREE.MeshBasicMaterial({ map: TextureGen.createDaySky('#153d25', '#4d7a49'), side: THREE.BackSide, fog: false }));
    W.add(sky);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100 * S, 100 * S),
      new THREE.MeshStandardMaterial({ color: 0x24451f, roughness: 0.96, metalness: 0.02 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; ground.receiveShadow = true; W.add(ground);

    const waterMat = new THREE.MeshStandardMaterial({ color: 0x156a8a, emissive: 0x0a3f55, emissiveIntensity: 0.35, roughness: 0.22, metalness: 0.2, transparent: true, opacity: 0.78 });
    const river = new THREE.Mesh(new THREE.BoxGeometry(10 * S, 0.08 * S, 52 * S), waterMat);
    river.position.set(-6 * S, 0.02 * S, -6 * S); river.rotation.y = -0.16; W.add(river);
    const lagoon = new THREE.Mesh(new THREE.CylinderGeometry(5 * S, 6.5 * S, 0.08 * S, 24), waterMat);
    lagoon.position.set(-13 * S, 0.04 * S, -18 * S); W.add(lagoon);
    const waterfall = new THREE.Mesh(new THREE.BoxGeometry(2.2 * S, 6.2 * S, 0.38 * S), waterMat);
    waterfall.position.set(-17 * S, 3.0 * S, -24 * S); W.add(waterfall);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5b6551, roughness: 0.94, metalness: 0.02 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x33552f, roughness: 1, metalness: 0.02 });
    const addBlock = (x, y, z, w, h, d, mat, collide = true) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, d * S), mat || stoneMat);
      b.position.set(x * S, y * S, z * S); b.castShadow = true; b.receiveShadow = true; W.add(b);
      if (collide) this.objects.push(b);
      return b;
    };
    addBlock(8, 0.45, -11, 15, 0.9, 4, stoneMat);
    addBlock(8, 1.55, -15, 11, 2.2, 3, stoneMat);
    addBlock(8, 3.05, -17.1, 8, 0.75, 2.4, mossMat, false);
    [[2, -8], [14, -8], [2, -15], [14, -15], [18, 5], [-20, 8], [22, -24]].forEach(([x, z]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * S, 0.62 * S, 3.0 * S, 9), stoneMat);
      col.position.set(x * S, 1.5 * S, z * S); col.castShadow = true; col.receiveShadow = true; W.add(col); this.objects.push(col);
    });

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b351a, roughness: 1 });
    const leafMats = [0x2f7a2f, 0x3c8c3c, 0x1f5c2b, 0x4f9a3a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
    const addTree = (x, z, sc) => {
      const h = (1.4 + Math.random() * 1.2) * sc * S;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * sc * S, 0.36 * sc * S, h, 7), trunkMat);
      tr.position.set(x, h / 2, z); tr.castShadow = true; W.add(tr); this.objects.push(tr);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry((0.8 + Math.random() * 0.5) * sc * S, (1.4 + Math.random() * 0.6) * sc * S, 7), leafMats[Math.floor(Math.random() * leafMats.length)]);
      leaf.position.set(x, h + 0.75 * sc * S, z); leaf.castShadow = true; W.add(leaf);
      if (Math.random() > 0.58) {
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.9 * sc * S, 8, 6), leafMats[Math.floor(Math.random() * leafMats.length)]);
        canopy.scale.y = 0.55; canopy.position.set(x + (Math.random() - 0.5) * S, h + 1.1 * sc * S, z + (Math.random() - 0.5) * S); canopy.castShadow = true; W.add(canopy);
      }
    };
    for (let i = 0; i < 135; i++) {
      const x = (Math.random() - 0.5) * 88 * S, z = (Math.random() - 0.5) * 88 * S;
      if (Math.abs(x) < 8 * S && Math.abs(z - 16 * S) < 7 * S) continue;
      if (Math.abs(x + 6 * S) < 8 * S && Math.abs(z + 6 * S) < 28 * S) continue;
      addTree(x, z, 0.75 + Math.random() * 0.7);
    }

    for (let i = 0; i < 45; i++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry((0.28 + Math.random() * 0.34) * S, 7, 5), leafMats[i % leafMats.length]);
      bush.position.set((Math.random() - 0.5) * 62 * S, 0.24 * S, (Math.random() - 0.5) * 62 * S); bush.scale.y = 0.55; W.add(bush);
      if (i % 3 === 0) this.objects.push(bush);
    }

    const vineMat = new THREE.MeshStandardMaterial({ color: 0x3cff65, emissive: 0x0d5f16, emissiveIntensity: 0.45, roughness: 0.8 });
    for (let i = 0; i < 28; i++) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.04 * S, (0.7 + Math.random() * 0.9) * S, 0.04 * S), vineMat);
      v.position.set((-20 + Math.random() * 48) * S, (2.2 + Math.random() * 2.4) * S, (-24 + Math.random() * 42) * S); v.rotation.z = (Math.random() - 0.5) * 0.4; W.add(v);
    }
    for (let i = 0; i < 35; i++) {
      const mush = new THREE.Mesh(new THREE.SphereGeometry(0.11 * S, 8, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x78ff65 : 0x35caff, emissive: i % 2 ? 0x78ff65 : 0x35caff, emissiveIntensity: 1.2 }));
      mush.position.set((-25 + Math.random() * 50) * S, 0.12 * S, (-25 + Math.random() * 50) * S); mush.scale.y = 0.45; W.add(mush);
    }

    // Concept-sheet playable ruin core, ziggurat tiers, treehouse rooms, vine bridge, and mossy cover.
    this.addJunglePlayableStructures(W, S, stoneMat, mossMat);

    const portal = this.createPortal(W, new THREE.Vector3(23 * S, 1.8 * S, -20 * S), new THREE.Vector3(-16 * S, this.player.height, 18 * S), 0xffd166, 'EGYPT PORTAL');
    portal.targetLevel = 'desert';

    W.add(new THREE.AmbientLight(0x6ca56c, 0.34));
    W.add(new THREE.HemisphereLight(0x87d99a, 0x0b220c, 0.44));
    const sun = new THREE.DirectionalLight(0xb7ffc0, 0.62);
    sun.position.set(-55, 92, 35); sun.castShadow = true; sun.shadow.camera.left = -220; sun.shadow.camera.right = 220; sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220; W.add(sun);
    this.jungleProps = { vines: true, river, lagoon, waterfall };
    this._jungleSpawn = new THREE.Vector3(0, this.player.height, 24 * S);
  }

  // ================= FEUDAL JAPAN =================
  buildJapan(W) {
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0xc4d8ea, 120, 560);

    // soft day sky dome
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 24),
      new THREE.MeshBasicMaterial({ map: TextureGen.createDaySky('#4f8fcf', '#f0dcc4'), side: THREE.BackSide, fog: false }));
    W.add(sky);

    // ground: lush grass with stone courtyard
    const grassTex = TextureGen.createGrass(false); grassTex.repeat.set(60, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
      new THREE.MeshStandardMaterial({ map: grassTex, color: 0x88b56a, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; W.add(ground);

    const stoneTex = TextureGen.createStonePath(); stoneTex.repeat.set(8, 8);
    const court = new THREE.Mesh(new THREE.CircleGeometry(26, 40),
      new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x9a958a, roughness: 0.9 }));
    court.rotation.x = -Math.PI / 2; court.position.y = 0.02; court.receiveShadow = true; W.add(court);
    // gravel approach path
    const pathT = TextureGen.createStonePath(); pathT.repeat.set(2, 10);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(7, 70),
      new THREE.MeshStandardMaterial({ map: pathT, color: 0xb8b2a4, roughness: 1 }));
    path.rotation.x = -Math.PI / 2; path.position.set(0, 0.015, 44); path.receiveShadow = true; W.add(path);

    // shared materials
    const woodTex = TextureGen.createWood(false); const beamTex = TextureGen.createWood(true);
    const tileTex = TextureGen.createRoofTile('#39424d');
    const wallWood = () => { const t = woodTex.clone(); t.needsUpdate = true; t.repeat.set(2, 2); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }); };
    const redWood = new THREE.MeshStandardMaterial({ color: 0xb5341f, roughness: 0.55 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x3a241a, roughness: 0.7 });
    const tileMat = () => { const t = tileTex.clone(); t.needsUpdate = true; t.repeat.set(4, 2); return new THREE.MeshStandardMaterial({ map: t, color: 0x4a5560, roughness: 0.7 }); };
    const shojiMat = new THREE.MeshStandardMaterial({ map: TextureGen.createShoji(), emissive: 0x4a3a1a, emissiveIntensity: 0.3, roughness: 0.8 });

    // curved Japanese roof (stacked tapering tiers)
    const addRoof = (parent, x, y, z, w, d, tiers) => {
      for (let t = 0; t < (tiers || 1); t++) {
        const ww = w * (1 - t * 0.22), dd = d * (1 - t * 0.22);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.35, dd), tileMat());
        roof.position.set(x, y + t * 1.0, z); roof.castShadow = true; parent.add(roof);
        // upturned eaves
        [-1, 1].forEach(s => {
          const eave = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, dd + 0.6), darkWood);
          eave.position.set(x + s * ww / 2, y + t * 1.0 + 0.18, z); eave.rotation.z = s * 0.34; parent.add(eave);
        });
      }
    };

    // ===== GREAT PAGODA (5 tiers, enterable base) =====
    const pagoda = new THREE.Group();
    const tiers = 5;
    for (let t = 0; t < tiers; t++) {
      const s = 1 - t * 0.13;
      const body = new THREE.Mesh(new THREE.BoxGeometry(7 * s, 2.4, 7 * s), redWood);
      body.position.y = 2 + t * 3.0; body.castShadow = true; pagoda.add(body);
      addRoof(pagoda, 0, 3.4 + t * 3.0, 0, 9 * s, 9 * s, 1);
      // pillar accents
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 0.3), darkWood);
        p.position.set(sx * 3.2 * s, 2 + t * 3.0, sz * 3.2 * s); pagoda.add(p);
      }));
    }
    // golden finial
    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 3, 8), new THREE.MeshStandardMaterial({ color: 0xd9b44a, metalness: 0.8, roughness: 0.3 }));
    finial.position.y = 2 + tiers * 3.0; pagoda.add(finial);
    pagoda.position.set(0, 0, -14); W.add(pagoda);
    // pagoda base walls = colliders (you can walk around/into base)
    [[-3.4, 0], [3.4, 0], [0, -3.4]].forEach(([dx, dz]) => {
      const wll = new THREE.Mesh(new THREE.BoxGeometry(dz ? 7 : 0.4, 2.4, dz ? 0.4 : 7), redWood);
      wll.position.set(dx, 1.2, -14 + dz); wll.castShadow = true; W.add(wll); this.objects.push(wll);
    });

    // ===== TORII GATES along the approach =====
    const toriiMat = new THREE.MeshStandardMaterial({ color: 0xd23b22, roughness: 0.5 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    [14, 26, 40, 56].forEach((z, i) => {
      const t = new THREE.Group();
      const sc = 1 - i * 0.04;
      [-2.6, 2.6].forEach(x => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 6.4 * sc, 10), toriiMat);
        pillar.position.set(x, 3.2 * sc, 0); pillar.castShadow = true; t.add(pillar); this.objects.push(pillar);
      });
      const top = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.5, 0.6), blackMat); top.position.y = 6.4 * sc; top.castShadow = true; t.add(top);
      const top2 = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.4, 0.5), toriiMat); top2.position.y = 5.6 * sc; t.add(top2);
      t.position.set(0, 0, z); W.add(t);
    });

    // ===== ENTERABLE BUILDINGS: dojo, teahouse, minka homes =====
    const japanStyle = (col) => ({
      wall: new THREE.MeshStandardMaterial({ color: col || 0xe9e0cf, roughness: 0.7 }),
      floor: new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.7 }),
      roof: tileMat(),
      cone: null,
      win: shojiMat,
      lamp: 0xffca7a
    });
    const houseSpots = [[-22, 6], [22, 4], [-26, -16], [26, -14], [-18, 24], [20, 26], [-34, -2], [34, -4]];
    houseSpots.forEach(([sx, sz], i) => {
      const w = 9 + Math.random() * 2, d = 8 + Math.random() * 2;
      this.buildEnterable(W, sx, sz, w, d, japanStyle(i % 3 === 0 ? 0xc9b89a : 0xe9e0cf));
      // pretty curved roof on top of the flat enterable roof
      addRoof(W, sx, 3.8, sz, w + 2.4, d + 2.4, i % 2 ? 2 : 1);
      // red lantern by the door
      const lant = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd83a2a, emissive: 0xb01e10, emissiveIntensity: 0.7 }));
      lant.scale.y = 1.3; lant.position.set(sx + w / 2 - 0.5, 2.4, sz + d / 2 + 0.5); W.add(lant);
      const ll = new THREE.PointLight(0xff7a3a, 0.8, 8); ll.position.copy(lant.position); W.add(ll);
    });

    // ===== STONE LANTERNS (toro) lining the path =====
    const lanternMats = new THREE.MeshStandardMaterial({ color: 0x8d887e, roughness: 0.95 });
    const lanternLights = [];
    [10, 22, 34, 48, 60].forEach(z => [-5, 5].forEach(x => {
      const t = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5, 6), lanternMats); base.position.y = 0.25; t.add(base);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.9, 6), lanternMats); post.position.y = 0.9; t.add(post);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), lanternMats); box.position.y = 1.55; t.add(box);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb347, emissiveIntensity: 0.7 })); glow.position.y = 1.55; t.add(glow);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.4, 6), lanternMats); cap.position.y = 2.0; t.add(cap);
      const lt = new THREE.PointLight(0xffc070, 0.7, 9); lt.position.set(0, 1.55, 0); t.add(lt);
      lanternLights.push({ light: lt, base: 0.7, ph: Math.random() * 6 });
      t.position.set(x, 0, z); t.traverse(o => { if (o.isMesh) o.castShadow = true; }); W.add(t); this.objects.push(box);
    }));

    // ===== CHERRY BLOSSOM TREES + falling petals =====
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 1 });
    const blossomMats = [0xffd1e8, 0xffb6d5, 0xffc6e0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true, emissive: 0x3a1020, emissiveIntensity: 0.1 }));
    const addSakura = (x, z, s) => {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.4 * s, 3.4 * s, 7), trunkMat);
      tr.position.y = 1.7 * s; tr.castShadow = true; g.add(tr); this.objects.push(tr);
      // branches
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.28;
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.14 * s, 1.6 * s, 5), trunkMat);
        br.position.set(Math.cos(a) * 0.8 * s, 3.1 * s, Math.sin(a) * 0.8 * s);
        br.rotation.z = Math.cos(a) * 0.7; br.rotation.x = Math.sin(a) * 0.7; g.add(br);
      }
      // blossom canopy clumps
      for (let i = 0; i < 14; i++) {
        const cl = new THREE.Mesh(new THREE.IcosahedronGeometry((0.8 + Math.random() * 0.7) * s, 0), blossomMats[(Math.random() * 3) | 0]);
        const a = Math.random() * 6.28, r = Math.random() * 2.2 * s;
        cl.position.set(Math.cos(a) * r, (3.6 + Math.random() * 1.6) * s, Math.sin(a) * r); cl.castShadow = true; g.add(cl);
      }
      g.position.set(x, 0, z); W.add(g);
    };
    const sakuraPos = [[-12, 12], [12, 14], [-15, -4], [15, -2], [-10, 30], [10, 32], [-28, 12], [28, 14], [-30, -22], [30, -20], [-8, -28], [8, -30]];
    sakuraPos.forEach(([x, z], i) => addSakura(x, z, 0.9 + (i % 3) * 0.25));

    // falling petals particle system
    const petalGeo = new THREE.BufferGeometry();
    const PETALS = 1200, pp = new Float32Array(PETALS * 3);
    for (let i = 0; i < PETALS; i++) { pp[i * 3] = (Math.random() - 0.5) * 130; pp[i * 3 + 1] = Math.random() * 30; pp[i * 3 + 2] = (Math.random() - 0.5) * 130; }
    petalGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({ color: 0xffc6e0, size: 0.5, transparent: true, opacity: 0.85, depthWrite: false }));
    W.add(petals);

    // ===== BAMBOO GROVE (SE) =====
    const bambooMat = new THREE.MeshStandardMaterial({ color: 0x6e9e3a, roughness: 0.8 });
    for (let i = 0; i < 80; i++) {
      const x = 24 + (Math.random() - 0.5) * 26, z = -28 + (Math.random() - 0.5) * 26;
      const h = 5 + Math.random() * 4;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, h, 6), bambooMat);
      st.position.set(x, h / 2, z); st.castShadow = true; W.add(st);
      if (i % 3 === 0) this.objects.push(st);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 5), new THREE.MeshStandardMaterial({ color: 0x4f8a2c, roughness: 1, flatShading: true }));
      leaf.position.set(x, h, z); W.add(leaf);
    }

    // ===== KOI POND with arched bridge =====
    const water = new THREE.Mesh(new THREE.CircleGeometry(7, 36),
      new THREE.MeshStandardMaterial({ color: 0x2f6f86, metalness: 0.5, roughness: 0.2, transparent: true, opacity: 0.86, emissive: 0x0a2a3a, emissiveIntensity: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.set(-20, 0.05, -2); W.add(water);
    // rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(7, 0.4, 8, 36), lanternMats);
    rim.rotation.x = -Math.PI / 2; rim.position.set(-20, 0.2, -2); W.add(rim);
    // arched bridge
    const bridge = new THREE.Group();
    for (let i = -5; i <= 5; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.5), redWood);
      const a = i * 0.16; seg.position.set(0, 1.2 + Math.cos(a) * 0.9 - 0.9, i * 0.5); seg.rotation.x = -a * 0.5; bridge.add(seg);
    }
    bridge.position.set(-20, 0.6, -2); W.add(bridge);

    // ===== sun + lighting =====
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
    sunDisc.position.set(180, 150, 120); W.add(sunDisc);
    W.add(new THREE.AmbientLight(0xbccfe0, 0.55));
    W.add(new THREE.HemisphereLight(0xaad0f5, 0x4a6238, 0.45));
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.5);
    sun.position.set(120, 140, 90); sun.castShadow = true; sun.shadow.bias = -0.0002;
    sun.shadow.camera.left = -120; sun.shadow.camera.right = 120; sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
    sun.shadow.camera.far = 480; sun.shadow.mapSize.set(2048, 2048); W.add(sun);

    this.japanProps = { petals, lanternLights };
    this._japanSpawn = new THREE.Vector3(0, this.player.height, 56);

    // ===================================================================
    //  TOWN EXPANSION — castle, village district, market, hanging lanterns
    // ===================================================================
    // a registry so hanging lanterns can pulse with bloom
    const hangLanterns = [];

    // ----- GREAT CASTLE (tenshu) landmark behind the pagoda -----
    const castle = new THREE.Group();
    const castleWall = new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.7 });
    const stoneBase = new THREE.MeshStandardMaterial({ map: TextureGen.createStonePath(), color: 0x8e887c, roughness: 0.95 });
    // sloped stone foundation
    const found = new THREE.Mesh(new THREE.CylinderGeometry(11, 14, 5, 4), stoneBase);
    found.rotation.y = Math.PI / 4; found.position.y = 2.5; found.castShadow = true; found.receiveShadow = true; castle.add(found);
    this.objects.push(found);
    // stacked tapering tiers with curved roofs
    for (let t = 0; t < 4; t++) {
      const s = 1 - t * 0.18;
      const body = new THREE.Mesh(new THREE.BoxGeometry(12 * s, 3, 12 * s), castleWall);
      body.position.y = 6.5 + t * 3.6; body.castShadow = true; castle.add(body);
      addRoof(castle, 0, 8.2 + t * 3.6, 0, 15 * s, 15 * s, 1);
      // gold accents along the tier
      const trim = new THREE.Mesh(new THREE.BoxGeometry(12 * s + 0.2, 0.3, 12 * s + 0.2), new THREE.MeshStandardMaterial({ color: 0xc8a24a, metalness: 0.7, roughness: 0.3, emissive: 0x4a3410, emissiveIntensity: 0.4 }));
      trim.position.y = 5.1 + t * 3.6; castle.add(trim);
    }
    // golden shachihoko finial
    const cf = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2, 6), new THREE.MeshStandardMaterial({ color: 0xe8c24a, metalness: 0.85, roughness: 0.25, emissive: 0x6a4e10, emissiveIntensity: 0.5 }));
    cf.position.y = 22; castle.add(cf);
    castle.position.set(0, 0, -48); W.add(castle);

    // ----- VILLAGE DISTRICT: two rows of enterable shops along a market street -----
    const shopCols = [0xd9c4a3, 0xc98a5a, 0x9fb0a0, 0xcf9f8a, 0xb8a878, 0xe0cdaa];
    const banners = [0xd23b22, 0x2a5c8a, 0x3a7a3a, 0xc89a2a, 0x7a3a8a];
    for (let row = 0; row < 2; row++) {
      const sx = row === 0 ? -10 : 10;
      for (let i = 0; i < 5; i++) {
        const sz = -2 - i * 11;
        const w = 8, d = 8;
        this.buildEnterable(W, sx, sz, w, d, japanStyle(shopCols[(i + row) % shopCols.length]));
        addRoof(W, sx, 3.8, sz, w + 2.6, d + 2.6, 1);
        // noren shop banner facing the street
        const ban = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 3.2),
          new THREE.MeshStandardMaterial({ color: banners[(i + row) % banners.length], roughness: 0.8, side: THREE.DoubleSide }));
        ban.position.set(sx + (row === 0 ? w / 2 + 0.2 : -w / 2 - 0.2), 2.0, sz); W.add(ban);
        // glowing paper lantern at each shop corner
        const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.6, 10),
          new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xff8a2a, emissiveIntensity: 0.9 }));
        lp.position.set(sx + (row === 0 ? w / 2 + 0.4 : -w / 2 - 0.4), 2.7, sz - 3); W.add(lp);
        const lpl = new THREE.PointLight(0xffb060, 0.7, 7); lpl.position.copy(lp.position); W.add(lpl);
        hangLanterns.push({ mesh: lp, light: lpl, base: 0.9, ph: Math.random() * 6 });
      }
    }

    // ----- HANGING LANTERN STRINGS arched over the approach path -----
    for (let z = 8; z <= 56; z += 8) {
      const cordY = 5.2 + Math.sin(z * 0.2) * 0.3;
      // cord
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 11, 4), new THREE.MeshStandardMaterial({ color: 0x2a2018 }));
      cord.rotation.z = Math.PI / 2; cord.position.set(0, cordY, z); W.add(cord);
      for (let k = -2; k <= 2; k++) {
        const col = k % 2 ? 0xff5a4a : 0xffd27a;
        const lan = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.85 }));
        lan.scale.y = 1.25; lan.position.set(k * 2.4, cordY - 0.5, z); W.add(lan);
        hangLanterns.push({ mesh: lan, base: 0.85, ph: Math.random() * 6 });
      }
    }

    // ----- MARKET STALLS in the courtyard -----
    const stallWood = new THREE.MeshStandardMaterial({ color: 0x6a4528, roughness: 0.8 });
    [[-7, 8], [7, 6], [-6, -2], [8, -4]].forEach(([sx, sz], i) => {
      const stall = new THREE.Group();
      [-1.4, 1.4].forEach(px => [-1, 1].forEach(pz => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6), stallWood);
        post.position.set(px, 1.1, pz); stall.add(post);
      }));
      const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 2.4), stallWood);
      counter.position.y = 1.0; stall.add(counter);
      const awn = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 2.8), new THREE.MeshStandardMaterial({ color: banners[i % banners.length], roughness: 0.8 }));
      awn.position.y = 2.3; awn.rotation.x = 0.12; stall.add(awn);
      stall.position.set(sx, 0, sz); stall.traverse(o => { if (o.isMesh) o.castShadow = true; });
      W.add(stall); this.objects.push(counter);
    });

    // ----- extra cherry trees ringing the town -----
    [[-40, 20], [40, 18], [-44, -14], [44, -12], [-38, -34], [38, -32], [0, -64], [-20, -52], [20, -50]]
      .forEach(([x, z], i) => addSakura(x, z, 1.0 + (i % 2) * 0.3));

    // Concept-sheet second-floor dojo/inn routes, balcony bridge, and castle approach overlook.
    this.addJapanPlayableStructures(W, addRoof, japanStyle);

    this.japanProps.hangLanterns = hangLanterns;
  }

  // small helper to clone a tileable ground texture
  createGroundTex(kind, rep) {
    const t = kind === 'sand' ? TextureGen.createSand() : TextureGen.createAsphalt();
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // ================= RAIL CITY (concept-art monorail district, rideable train, depot, day↔night cycle) =================
  buildRailCity(W) {
    const S = 7;
    this.scene.background = new THREE.Color(0x090d22);
    this.scene.fog = new THREE.FogExp2(0x090d22, 0.0026);

    const wetFloorMat = new THREE.MeshStandardMaterial({ color: 0x151824, roughness: 0.18, metalness: 0.58, emissive: 0x02040a, emissiveIntensity: 0.1 });
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x0f1220, roughness: 0.24, metalness: 0.5 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x273141, roughness: 0.28, metalness: 0.62, emissive: 0x050817, emissiveIntensity: 0.18 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8ea6c0, metalness: 0.82, roughness: 0.22 });
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x151a27, metalness: 0.75, roughness: 0.35 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x29313f, metalness: 0.18, roughness: 0.72 });
    const cyanMat = new THREE.MeshStandardMaterial({ color: 0x19f0ff, emissive: 0x19f0ff, emissiveIntensity: 1.15, roughness: 0.24, metalness: 0.35 });
    const magMat = new THREE.MeshStandardMaterial({ color: 0xff2d95, emissive: 0xff2d95, emissiveIntensity: 1.05, roughness: 0.24, metalness: 0.35 });
    const violetMat = new THREE.MeshStandardMaterial({ color: 0x8a4dff, emissive: 0x7b2cff, emissiveIntensity: 0.9, roughness: 0.22, metalness: 0.35 });
    const amberMat = new THREE.MeshStandardMaterial({ color: 0xffb24a, emissive: 0xff7a18, emissiveIntensity: 0.65, roughness: 0.35, metalness: 0.2 });
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x222936, metalness: 0.65, roughness: 0.32, emissive: 0x070914, emissiveIntensity: 0.2 });
    const neonMats = [cyanMat, magMat, violetMat, amberMat];
    const platforms = [];
    const lightProps = [];
    const gantries = [];

    const addSolid = (mesh, group = W) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      this.objects.push(mesh);
      return mesh;
    };
    const addDecor = (mesh, group = W) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    const registerPlatform = (mesh) => {
      mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mesh);
      platforms.push({ mesh, x: mesh.position.x, z: mesh.position.z, hw: Math.max((box.max.x - box.min.x) / 2, 0.5), hd: Math.max((box.max.z - box.min.z) / 2, 0.5), top: box.max.y });
      this.objects.push(mesh);
      return mesh;
    };
    const addNeonStrip = (x, y, z, w, h, d, mat, group = W) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      strip.position.set(x, y, z);
      group.add(strip);
      lightProps.push(strip);
      return strip;
    };
    const addPillar = (x, z, height, mat = concreteMat) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, height, 1.4), mat);
      pillar.position.set(x, height / 2, z);
      addSolid(pillar);
      addNeonStrip(x + 0.72, height * 0.55, z, 0.06, height * 0.55, 0.45, Math.random() > 0.5 ? cyanMat : magMat);
      return pillar;
    };
    const addRailing = (group, x, y, z, length, axis = 'x', mat = railMat) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? length : 0.12, 0.14, axis === 'z' ? length : 0.12), mat);
      rail.position.set(x, y, z); group.add(rail);
      for (let i = -0.5; i <= 0.5; i += 0.25) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), mat);
        if (axis === 'x') post.position.set(x + i * length, y - 0.42, z); else post.position.set(x, y - 0.42, z + i * length);
        group.add(post);
      }
    };
    const makeBox = (w, h, d, mat, x, y, z, solid = true, group = W) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      return solid ? addSolid(m, group) : addDecor(m, group);
    };

    // Wet ground plane and reflective road grid inspired by the concept mood frame.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100 * S, 100 * S), wetFloorMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; ground.receiveShadow = true; W.add(ground);

    const laneGlow = new THREE.MeshStandardMaterial({ color: 0x19f0ff, emissive: 0x19f0ff, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.25 });
    const magLane = new THREE.MeshStandardMaterial({ color: 0xff2d95, emissive: 0xff2d95, emissiveIntensity: 0.45, roughness: 0.2, metalness: 0.25 });
    for (let i = -36; i <= 36; i += 6) {
      if (Math.abs(i) < 3) continue;
      const rh = new THREE.Mesh(new THREE.BoxGeometry(1.0 * S, 0.06, 84 * S), roadMat); rh.position.set(i * S, 0, 0); rh.receiveShadow = true; W.add(rh);
      const rv = new THREE.Mesh(new THREE.BoxGeometry(84 * S, 0.06, 1.0 * S), roadMat); rv.position.set(0, 0, i * S); rv.receiveShadow = true; W.add(rv);
      for (let m = -38; m <= 38; m += 8) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.16 * S, 0.045, 1.1 * S), (m / 8) % 2 ? laneGlow : magLane); a.position.set(i * S, 0.06, m * S); W.add(a); lightProps.push(a);
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.1 * S, 0.045, 0.16 * S), (m / 8) % 2 ? magLane : laneGlow); b.position.set(m * S, 0.06, i * S); W.add(b); lightProps.push(b);
      }
    }

    // Dense skyline: dark concrete towers with cyan/magenta vertical bands.
    const baseTex = () => TextureGen.createImageTexture('concrete', () => TextureGen.createStonePath(), 2, 4);
    const buildingTints = [0x242a3a, 0x30384a, 0x1f2635, 0x3a3144, 0x202a33];
    const winMats = [cyanMat, magMat, violetMat, amberMat, new THREE.MeshStandardMaterial({ color: 0x66f6ff, emissive: 0x19f0ff, emissiveIntensity: 0.95, roughness: 0.22, metalness: 0.2 })];
    this._railWinMats = winMats;
    const self = this;
    function makeBuilding(x, z, w, d, h, ni, spire = false) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: baseTex(), color: buildingTints[(Math.random() * buildingTints.length) | 0], roughness: 0.68, metalness: 0.22 }));
      body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; grp.add(body); self.objects.push(body);
      const wm = winMats[ni % winMats.length];
      const bands = Math.min(9, Math.max(3, Math.floor(h / 8)));
      for (let r = 0; r < bands; r++) {
        const by = (r + 1) * (h / (bands + 1));
        const front = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.55, 0.08), wm); front.position.set(0, by, d / 2 + 0.045); grp.add(front);
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, d + 0.08), wm); side.position.set(w / 2 + 0.045, by, 0); grp.add(side);
      }
      if (spire) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, h * 0.28, 6), darkMetalMat); mast.position.y = h + h * 0.14; grp.add(mast);
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), magMat); beacon.position.y = h + h * 0.29; grp.add(beacon); lightProps.push(beacon);
      }
      grp.position.set(x, 0, z); W.add(grp);
      return grp;
    }
    const R = 37;
    for (let x = -R; x <= R; x += 5.5) {
      for (let z = -R; z <= R; z += 5.5) {
        if (Math.abs(x) < 7 && Math.abs(z) < 7) continue;
        const ovalDist = Math.hypot((x * S) / (30 * S), (z * S) / (24 * S));
        if (ovalDist > 0.76 && ovalDist < 1.24) continue;
        if (Math.random() > 0.54) continue;
        const w = (0.8 + Math.random() * 1.0) * S, d = (0.8 + Math.random() * 1.0) * S;
        const h = (1.6 + Math.random() * 5.6) * S;
        makeBuilding(x * S + (Math.random() - 0.5) * 5, z * S + (Math.random() - 0.5) * 5, w, d, h, (Math.random() * winMats.length) | 0, Math.random() > 0.7);
      }
    }
    [[-21, -18], [23, -20], [-18, 23], [22, 21], [0, -32], [-32, 0], [33, 0], [0, 32]].forEach((p, idx) => {
      makeBuilding(p[0] * S, p[1] * S, 1.45 * S, 1.45 * S, (7.4 + (idx % 3)) * S, idx, true);
    });

    // ===== MONORAIL LOOP AND TRACK CANYON =====
    const trackH = 4.6 * S * 0.55;
    const rx = 30 * S, rz = 24 * S;
    const pts = [];
    for (let i = 0; i <= 144; i++) { const t = (i / 144) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * rx, trackH, Math.sin(t) * rz)); }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 192, 0.48, 8, true), railMat); tube.castShadow = true; W.add(tube);
    const underTube = new THREE.Mesh(new THREE.TubeGeometry(curve, 192, 0.18, 8, true), cyanMat); underTube.position.y = -0.75; W.add(underTube); lightProps.push(underTube);
    for (let i = 0; i < pts.length - 1; i += 8) {
      const pt = pts[i];
      addPillar(pt.x, pt.z, trackH, i % 16 ? concreteMat : darkMetalMat);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 2.0), darkMetalMat);
      cap.position.set(pt.x, trackH - 0.15, pt.z); cap.rotation.y = Math.atan2(pt.z / rz, pt.x / rx) + Math.PI / 2; addDecor(cap);
      addNeonStrip(pt.x, trackH + 0.35, pt.z, 0.35, 0.35, 2.2, i % 16 ? cyanMat : magMat);
    }

    // Train: four rideable neon cars.
    const carW = 2.0 * S * 0.7, carH = 1.4 * S * 0.7, carL = 2.8 * S * 0.8;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x172233, metalness: 0.72, roughness: 0.28, emissive: 0x081224, emissiveIntensity: 0.45 });
    const cars = [];
    for (let i = 0; i < 4; i++) {
      const car = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(carW, carH, carL), bodyMat);
      shell.castShadow = true; shell.receiveShadow = true; car.add(shell);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(carW * 0.82, carH * 0.7, 0.26), magMat); nose.position.z = carL * 0.52; car.add(nose);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(carW + 0.35, 0.25, carL + 0.35), new THREE.MeshStandardMaterial({ color: 0xb8c6d8, metalness: 0.56, roughness: 0.42 }));
      roof.position.y = carH / 2 + 0.12; car.add(roof);
      [[-1], [1]].forEach(([sx]) => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, carL), railMat);
        r.position.set(sx * (carW / 2), carH / 2 + 0.4, 0); car.add(r);
      });
      const win = new THREE.Mesh(new THREE.BoxGeometry(carW + 0.04, carH * 0.42, carL * 0.78), cyanMat);
      win.position.y = 0.05; car.add(win); lightProps.push(win);
      W.add(car); cars.push(car);
      car.userData.prevPos = new THREE.Vector3();
      car.userData.delta = new THREE.Vector3();
    }
    const carTop = carH / 2 + 0.25;
    const carSpacing = 0.07;

    // Main platform arena: cover boxes, vending cover, glowing strips, and station canopy.
    const station = new THREE.Group();
    const deckX = rx, deckZ = 0;
    const deckW = 8.2 * S * 0.7, deckD = 7.2 * S * 0.7;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.5, deckD), deckMat);
    deck.position.set(deckX + carW * 0.9, trackH - 0.25, deckZ); deck.castShadow = true; deck.receiveShadow = true; station.add(deck); registerPlatform(deck);
    addRailing(station, deck.position.x, trackH + 0.4, deck.position.z - deckD * 0.5, deckW, 'x');
    addRailing(station, deck.position.x, trackH + 0.4, deck.position.z + deckD * 0.5, deckW, 'x');
    addNeonStrip(deck.position.x, trackH + 0.05, deck.position.z - deckD * 0.46, deckW * 0.92, 0.08, 0.08, magMat, station);
    addNeonStrip(deck.position.x, trackH + 0.07, deck.position.z + deckD * 0.46, deckW * 0.92, 0.08, 0.08, cyanMat, station);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.2, 6), darkMetalMat);
      post.position.set(deck.position.x + sx * deckW * 0.42, trackH + 1.8, deck.position.z + sz * deckD * 0.42); station.add(post);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(deckW + 2, 0.35, deckD + 1), new THREE.MeshStandardMaterial({ color: 0x14253a, emissive: 0x051426, emissiveIntensity: 0.5, metalness: 0.62, roughness: 0.25 }));
    canopy.position.set(deck.position.x, trackH + 3.6, deck.position.z); station.add(canopy);
    addNeonStrip(deck.position.x, trackH + 3.82, deck.position.z - deckD * 0.5, deckW, 0.16, 0.18, cyanMat, station);
    addNeonStrip(deck.position.x, trackH + 3.82, deck.position.z + deckD * 0.5, deckW, 0.16, 0.18, magMat, station);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(deckW * 0.78, 1.05, 0.22), cyanMat);
    sign.position.set(deck.position.x, trackH + 1.75, deck.position.z - deckD * 0.52); station.add(sign); lightProps.push(sign);
    W.add(station);

    const rampLen = trackH * 2.4;
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.4, 4 * S * 0.7), deckMat);
    const rampAngle = Math.atan2(trackH - 0.25, rampLen * 0.92);
    ramp.position.set(deckX + carW * 0.9 + deckW * 0.5 + Math.cos(rampAngle) * rampLen * 0.46, (trackH - 0.25) / 2, deckZ);
    ramp.rotation.z = -rampAngle; W.add(ramp);
    this.railRamp = { x1: deckX + carW * 0.9 + deckW * 0.5, x2: deckX + carW * 0.9 + deckW * 0.5 + Math.cos(rampAngle) * rampLen * 0.92, z: deckZ, hw: 2 * S * 0.7, top: trackH - 0.25 };
    addNeonStrip(ramp.position.x, ramp.position.y + 0.18, ramp.position.z - 2.1, 0.12, 0.08, rampLen * 0.82, magMat);
    addNeonStrip(ramp.position.x, ramp.position.y + 0.18, ramp.position.z + 2.1, 0.12, 0.08, rampLen * 0.82, cyanMat);

    // Playable station cover and ticket/vending silhouettes.
    [[deck.position.x - 10, deck.position.z - 7, magMat], [deck.position.x - 1.5, deck.position.z + 8, cyanMat], [deck.position.x + 8, deck.position.z + 2, violetMat]].forEach(([x, z, mat]) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 1.2), barrierMat); c.position.set(x, trackH + 0.8, z); station.add(c); this.objects.push(c);
      addNeonStrip(x, trackH + 1.65, z + 0.63, 2.2, 0.16, 0.08, mat, station);
    });

    // Track canyon catwalks and overlooks based on the concept track-canyon image.
    const catwalkData = [
      { x: 0, z: -rz - 18, w: 34, d: 5.2, y: trackH * 0.78, mat: cyanMat },
      { x: -rx - 16, z: -4, w: 5.2, d: 30, y: trackH * 0.62, mat: magMat },
      { x: 0, z: rz + 18, w: 40, d: 5.2, y: trackH * 0.72, mat: violetMat }
    ];
    catwalkData.forEach(cw => {
      const deckObj = new THREE.Mesh(new THREE.BoxGeometry(cw.w, 0.45, cw.d), deckMat);
      deckObj.position.set(cw.x, cw.y, cw.z); deckObj.castShadow = true; deckObj.receiveShadow = true; W.add(deckObj); registerPlatform(deckObj);
      addRailing(W, cw.x, cw.y + 0.72, cw.z - cw.d * 0.5, cw.w, 'x');
      addRailing(W, cw.x, cw.y + 0.72, cw.z + cw.d * 0.5, cw.w, 'x');
      addNeonStrip(cw.x, cw.y + 0.28, cw.z, cw.w * 0.82, 0.08, 0.1, cw.mat);
      addPillar(cw.x - cw.w * 0.42, cw.z, cw.y, darkMetalMat);
      addPillar(cw.x + cw.w * 0.42, cw.z, cw.y, darkMetalMat);
    });

    // Maintenance depot and train yard: parked train shells, repair bay, crates, crane arms.
    const depot = new THREE.Group();
    const depotX = -18 * S, depotZ = 17 * S;
    const bay = new THREE.Mesh(new THREE.BoxGeometry(18 * S, 5.2 * S, 8 * S), concreteMat);
    bay.position.set(depotX, 2.6 * S, depotZ); depot.add(bay); this.objects.push(bay);
    const bayMouth = new THREE.Mesh(new THREE.BoxGeometry(17.2 * S, 4.3 * S, 0.35 * S), new THREE.MeshStandardMaterial({ color: 0x061024, emissive: 0x061024, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.28 }));
    bayMouth.position.set(depotX, 2.35 * S, depotZ - 4.15 * S); depot.add(bayMouth);
    addNeonStrip(depotX, 4.9 * S, depotZ - 4.34 * S, 15 * S, 0.24, 0.18, magMat, depot);
    addNeonStrip(depotX - 8.7 * S, 2.6 * S, depotZ - 4.35 * S, 0.18, 4.2 * S, 0.18, cyanMat, depot);
    addNeonStrip(depotX + 8.7 * S, 2.6 * S, depotZ - 4.35 * S, 0.18, 4.2 * S, 0.18, cyanMat, depot);
    for (let i = 0; i < 2; i++) {
      const train = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(3.4 * S, 1.2 * S, 5.8 * S), bodyMat); shell.position.y = 0.9 * S; train.add(shell);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(3.45 * S, 0.42 * S, 4.6 * S), i ? magMat : cyanMat); glass.position.y = 1.04 * S; train.add(glass); lightProps.push(glass);
      train.position.set(depotX + (i ? 4.8 : -4.8) * S, 0, depotZ - 1.5 * S); depot.add(train);
    }
    for (let i = 0; i < 14; i++) {
      const x = depotX + (-11 + (i % 7) * 3.4) * S;
      const z = depotZ + (5.8 + Math.floor(i / 7) * 2.4) * S;
      makeBox(1.7 * S, 0.9 * S, 1.4 * S, barrierMat, x, 0.45 * S, z, true, depot);
      addNeonStrip(x, 0.95 * S, z + 0.72 * S, 1.0 * S, 0.12, 0.08, i % 2 ? cyanMat : magMat, depot);
    }
    for (let i = 0; i < 3; i++) {
      const crane = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35 * S, 4.5 * S, 0.35 * S), darkMetalMat); post.position.y = 2.25 * S; crane.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(6.0 * S, 0.25 * S, 0.25 * S), railMat); arm.position.set(2.7 * S, 4.2 * S, 0); crane.add(arm);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * S, 0.03 * S, 2.1 * S, 6), railMat); cable.position.set(5.3 * S, 3.0 * S, 0); crane.add(cable);
      crane.position.set(depotX + (-8 + i * 8) * S, 0, depotZ + 8.5 * S); depot.add(crane); gantries.push(crane);
    }
    W.add(depot);

    // Concept-sheet station hall, train-corridor room, second-floor overlook, and depot cover.
    this.addRailPlayableStructures(W, S, { concreteMat, deckMat, barrierMat, cyanMat, magMat, darkMetalMat }, registerPlatform);

    // Signal pylons and abstract transit glyphs from the concept frames.
    const signalPositions = [[deckX + 11, -deckD], [deckX - 18, deckD], [-rx, -rz * 0.8], [rx * 0.15, rz + 24], [-rx - 20, 0], [0, -rz - 24]];
    signalPositions.forEach((p, i) => {
      const tower = new THREE.Group();
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9.5, 0.7), darkMetalMat); mast.position.y = 4.75; tower.add(mast);
      for (let j = 0; j < 3; j++) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.55, 0.22), neonMats[(i + j) % neonMats.length]);
        panel.position.set(0, 2.2 + j * 2.1, -0.48); tower.add(panel); lightProps.push(panel);
        const glyph = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 20), neonMats[(i + j + 1) % neonMats.length]);
        glyph.position.set(0, 2.2 + j * 2.1, -0.64); glyph.rotation.x = Math.PI / 2; tower.add(glyph); lightProps.push(glyph);
      }
      tower.position.set(p[0], 0, p[1]); tower.rotation.y = i % 2 ? Math.PI * 0.5 : 0; W.add(tower); gantries.push(tower);
    });

    // Suspended power cables across the canyon, using thin arcs for visual depth.
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
    const cableRuns = [[-rx - 18, -rz, rx + 14, -rz * 0.75, trackH + 5], [-rx - 16, rz * 0.9, rx + 16, rz + 8, trackH + 6], [-rx, -rz - 20, -rx, rz + 18, trackH + 4]];
    cableRuns.forEach(([x1, z1, x2, z2, y], idx) => {
      for (let k = 0; k < 3; k++) {
        const mid = new THREE.Vector3((x1 + x2) / 2, y - 2 - k * 0.45, (z1 + z2) / 2);
        const curveCable = new THREE.CatmullRomCurve3([new THREE.Vector3(x1, y + k * 0.35, z1), mid, new THREE.Vector3(x2, y + k * 0.35, z2)]);
        const cable = new THREE.Mesh(new THREE.TubeGeometry(curveCable, 24, 0.045, 5, false), cableMat);
        W.add(cable);
      }
    });

    // Ground-level cover silhouettes and neon reflectors for combat readability.
    const coverSpots = [[-18, -10], [-9, 8], [8, -9], [16, 12], [-26, 2], [27, -6], [3, 20], [22, -24], [-19, 25]];
    coverSpots.forEach((p, i) => {
      const x = p[0] * S, z = p[1] * S;
      const w = (1.4 + (i % 3) * 0.35) * S, d = (1.0 + (i % 2) * 0.5) * S, h = (0.75 + (i % 2) * 0.35) * S;
      makeBox(w, h, d, barrierMat, x, h / 2, z);
      addNeonStrip(x, h + 0.08, z + d * 0.48, w * 0.62, 0.12, 0.08, i % 2 ? cyanMat : magMat);
    });

    // A central reflective transit core replaces the old park/orb and reinforces Rail City's identity.
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1 * S, 2.35 * S, 0.55 * S, 8), darkMetalMat);
    base.position.y = 0.28 * S; base.castShadow = true; base.receiveShadow = true; W.add(base); this.objects.push(base);
    const monOrb = new THREE.Mesh(new THREE.SphereGeometry(0.72 * S, 20, 20), magMat);
    monOrb.position.y = 2.45 * S; W.add(monOrb); lightProps.push(monOrb);
    const orbRing = new THREE.Mesh(new THREE.TorusGeometry(1.12 * S, 0.06 * S, 12, 48), cyanMat);
    orbRing.position.y = 2.45 * S; orbRing.rotation.x = Math.PI / 2; W.add(orbRing); lightProps.push(orbRing);

    // Low violet haze planes add depth without blocking gameplay.
    const hazeMat = new THREE.MeshBasicMaterial({ color: 0x7b2cff, transparent: true, opacity: 0.075, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const haze = [];
    for (let i = 0; i < 7; i++) {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(42 * S, 14 * S), hazeMat.clone());
      h.position.set((Math.random() - 0.5) * 70 * S, 6 * S + Math.random() * 7 * S, (Math.random() - 0.5) * 70 * S);
      h.rotation.y = Math.random() * Math.PI;
      W.add(h); haze.push(h);
    }

    // Animated traffic glows remain below the rail decks.
    const vColors = [0xff3366, 0x33ccff, 0xaa66ff, 0x66ff99, 0xffaa33, 0xff88cc];
    const vehicles = [];
    const lanes = [];
    for (let z = -30; z <= 30; z += 12) { if (Math.abs(z) < 4) continue; lanes.push({ axis: 'x', fixed: z * S }); }
    for (let x = -30; x <= 30; x += 12) { if (Math.abs(x) < 4) continue; lanes.push({ axis: 'z', fixed: x * S }); }
    lanes.forEach(lane => {
      for (let k = 0; k < 2; k++) {
        const car = new THREE.Mesh(new THREE.BoxGeometry(0.6 * S, 0.28 * S, 1.05 * S), new THREE.MeshStandardMaterial({ color: vColors[(Math.random() * vColors.length) | 0], emissive: vColors[(Math.random() * vColors.length) | 0], emissiveIntensity: 0.35, metalness: 0.45, roughness: 0.32 }));
        const dir = Math.random() > 0.5 ? 1 : -1, pos = -42 * S + Math.random() * 84 * S;
        if (lane.axis === 'x') { car.position.set(pos, 0.4 * S, lane.fixed); car.rotation.y = dir > 0 ? 0 : Math.PI; }
        else { car.position.set(lane.fixed, 0.4 * S, pos); car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        W.add(car); vehicles.push({ mesh: car, lane, dir, pos, speed: 9 + Math.random() * 8 });
      }
    });

    // A few industrial drones/birds keep sky motion but no longer read as sunny park wildlife.
    const birds = [];
    const birdMat = new THREE.MeshStandardMaterial({ color: 0x1be7ff, emissive: 0x19f0ff, emissiveIntensity: 0.55, metalness: 0.45 });
    for (let i = 0; i < 24; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.13 * S * 0.6, 0.3 * S * 0.6, 4), birdMat);
      b.userData = { x: (Math.random() - 0.5) * 65 * S * 0.6, z: (Math.random() - 0.5) * 65 * S * 0.6, y: (24 + Math.random() * 25) * S * 0.4, vx: (Math.random() - 0.5) * 6, vz: (Math.random() - 0.5) * 6, flap: Math.random() * 6 };
      b.position.set(b.userData.x, b.userData.y, b.userData.z); W.add(b); birds.push(b);
    }
    const clouds = [];

    // Lighting begins at neon night, then transitions through amber sunrise/dusk.
    const ambient = new THREE.AmbientLight(0x223050, 0.46); W.add(ambient);
    const hemi = new THREE.HemisphereLight(0x304a7a, 0x120a20, 0.45); W.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb56a, 0.7);
    sun.position.set(80, 100, -60); sun.castShadow = true; sun.shadow.bias = -0.0002;
    sun.shadow.camera.left = -220; sun.shadow.camera.right = 220; sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
    sun.shadow.camera.far = 600; sun.shadow.mapSize.set(1024, 1024); W.add(sun);
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(10 * S * 0.5, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff8a3d, fog: false }));
    W.add(sunDisc);
    const platformDecks = platforms;

    this.railProps = {
      curve, cars, carTop, carHW: Math.max(carW, carL) / 2 + 0.3, carSpacing, progress: 0,
      deck: { x: deck.position.x, z: deck.position.z, hw: deckW / 2, hd: deckD / 2, top: trackH },
      platforms: platformDecks,
      clouds, birds, vehicles, span: 42 * S,
      ambient, hemi, sun, sunDisc, monOrb, orbRing, winMats, neonMats, lightProps, gantries, haze,
      cycle: 0.1, S
    };
    this._railSpawn = new THREE.Vector3(deck.position.x - deckW * 0.18, trackH + this.player.height, deckZ + deckD * 0.18);
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
        new THREE.MeshStandardMaterial({ color: buildingColors[ci % buildingColors.length], roughness: 0.35, metalness: 0.5 }));
      body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; grp.add(body);
      // emissive window bands (cheap: a few glowing rings instead of hundreds of window meshes)
      const nm = new THREE.MeshStandardMaterial({ color: neonColors[ni % neonColors.length], emissive: neonColors[ni % neonColors.length], emissiveIntensity: 0.7 });
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

    // Concept-sheet breaker/control rooms, cable bridge, power pylons, balconies, and generator cover.
    this.addMegaCityPlayableStructures(W, S, { neonColors });

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
        const mat = new THREE.MeshStandardMaterial({ color: vColors[(Math.random() * vColors.length) | 0], metalness: 0.4, roughness: 0.4, emissive: 0x110000 });
        const car = new THREE.Mesh(new THREE.BoxGeometry(0.7 * S, 0.32 * S, 1.2 * S), mat);
        const dir = Math.random() > 0.5 ? 1 : -1;
        const pos = -38 * S + Math.random() * 76 * S;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.72 * S, 0.12 * S, 0.1 * S),
          new THREE.MeshBasicMaterial({ color: 0xffffcc }));
        head.position.z = (lane.axis === 'z' ? 1 : 1) * 0.6 * S * dir; car.add(head);
        if (lane.axis === 'x') { car.position.set(pos, 0.5 * S, lane.fixed); car.rotation.y = dir > 0 ? 0 : Math.PI; }
        else { car.position.set(lane.fixed, 0.5 * S, pos); car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
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
    fl.position.set(x, 0.06, z); fl.receiveShadow = true; W.add(fl); this.objects.push(fl);
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


  // shared: register a mesh top as walkable support for upper floors, balconies, bridges, and stair treads
  registerWalkableSupport(mesh, pad = 0.08) {
    if (!this.elevatedSupports) this.elevatedSupports = [];
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    this.elevatedSupports.push({
      mesh,
      x: center.x,
      z: center.z,
      hw: Math.max((box.max.x - box.min.x) / 2 + pad, 0.35),
      hd: Math.max((box.max.z - box.min.z) / 2 + pad, 0.35),
      top: box.max.y
    });
    return mesh;
  }

  // shared: simple solid/decor box with optional collision and optional walkable top support
  structureBox(W, w, h, d, x, y, z, mat, collide = false, support = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    W.add(m);
    if (collide) this.objects.push(m);
    if (support) this.registerWalkableSupport(m);
    return m;
  }

  // shared: compact stair/ramp made from individual walkable treads so every level supports vertical routes
  buildPlayableStairs(W, x, z, length, width, height, steps, mat, axis = 'z', dir = 1) {
    const count = Math.max(3, steps || 8);
    for (let i = 0; i < count; i++) {
      const frac = (i + 1) / count;
      const treadH = height / count;
      const treadLen = length / count;
      const y = frac * height - treadH / 2;
      const off = -dir * length / 2 + dir * (i + 0.5) * treadLen;
      const sx = axis === 'x' ? x + off : x;
      const sz = axis === 'z' ? z + off : z;
      const w = axis === 'x' ? treadLen : width;
      const d = axis === 'z' ? treadLen : width;
      this.structureBox(W, w, treadH, d, sx, y, sz, mat, false, true);
    }
  }

  // shared: visual railings that leave movement clear while making balconies/catwalks readable
  buildStructureRail(W, x, y, z, length, axis, mat) {
    const rail = this.structureBox(W, axis === 'x' ? length : 0.16, 0.16, axis === 'z' ? length : 0.16, x, y, z, mat, false, false);
    const posts = Math.max(2, Math.floor(length / 2.8));
    for (let i = 0; i <= posts; i++) {
      const off = -length / 2 + (length * i) / posts;
      this.structureBox(W, 0.14, 0.78, 0.14, axis === 'x' ? x + off : x, y - 0.42, axis === 'z' ? z + off : z, mat, false, false);
    }
    return rail;
  }

  // shared: multi-floor enterable block built around buildEnterable, with second-floor deck, stair access, balcony, and door cue
  buildMultiFloorStructure(W, x, z, w, d, style, opts = {}) {
    this.buildEnterable(W, x, z, w, d, style);
    const floorY = opts.floorY || 3.62;
    const stairMat = opts.stairMat || style.floor || style.roof || style.wall;
    const railMat = opts.railMat || style.roof || style.wall;
    const deckMat = opts.deckMat || style.floor || style.roof || style.wall;
    const deck = this.structureBox(W, w - 0.7, 0.18, d - 0.7, x, floorY, z, deckMat, false, true);
    const balconyDepth = opts.balconyDepth || 1.55;
    const balcony = this.structureBox(W, w * 0.62, 0.18, balconyDepth, x, floorY + 0.02, z + d / 2 + balconyDepth / 2, deckMat, false, true);
    this.buildStructureRail(W, x, floorY + 0.78, z + d / 2 + balconyDepth + 0.03, w * 0.62, 'x', railMat);
    this.buildStructureRail(W, x - w * 0.31, floorY + 0.78, z + d / 2 + balconyDepth / 2, balconyDepth, 'z', railMat);
    this.buildStructureRail(W, x + w * 0.31, floorY + 0.78, z + d / 2 + balconyDepth / 2, balconyDepth, 'z', railMat);
    const stairAxis = opts.stairAxis || 'z';
    const stairDir = opts.stairDir || -1;
    const stairLen = opts.stairLen || Math.max(6.5, d + 1.5);
    const stairWidth = opts.stairWidth || 2.2;
    const sx = opts.stairX ?? (stairAxis === 'x' ? x + w / 2 + stairLen / 2 - 0.4 : x - w / 2 - 1.6);
    const sz = opts.stairZ ?? (stairAxis === 'z' ? z + d / 2 + stairLen / 2 - 0.2 : z + d / 2 + 1.6);
    this.buildPlayableStairs(W, sx, sz, stairLen, stairWidth, floorY, opts.steps || 9, stairMat, stairAxis, stairDir);
    const doorMat = opts.doorMat || new THREE.MeshStandardMaterial({ color: 0x05070b, emissive: style.lamp || 0x111111, emissiveIntensity: 0.28, roughness: 0.65 });
    const upperDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.1), doorMat);
    upperDoor.position.set(x, floorY + 1.05, z + d / 2 + 0.03);
    upperDoor.rotation.y = 0;
    W.add(upperDoor);
    const glow = new THREE.PointLight(style.lamp || 0xffd9a0, 0.55, Math.max(w, d) * 1.2);
    glow.position.set(x, floorY + 1.4, z + d / 2 + 0.6);
    W.add(glow);
    return { deck, balcony };
  }

  // ================= PLAYABLE STRUCTURE UPGRADES FROM CONCEPT SHEETS =================
  addDesertPlayableStructures(W, S, stoneMatFn, darkStoneFn) {
    const wall = stoneMatFn();
    const floor = darkStoneFn();
    const roof = stoneMatFn();
    const lamp = 0xffc56a;
    const templeStyle = { wall, floor, roof, lamp, win: new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide }) };
    this.buildMultiFloorStructure(W, -9 * S, 9.2 * S, 8.6 * S, 7.2 * S, templeStyle, {
      floorY: 3.35 * S, stairX: -13.6 * S, stairZ: 13.8 * S, stairLen: 7.5 * S, stairWidth: 1.9 * S, stairAxis: 'z', stairDir: -1, steps: 10
    });
    const scaffoldMat = new THREE.MeshStandardMaterial({ color: 0x8f6b3e, roughness: 0.75, metalness: 0.05 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xb88b55, roughness: 0.82 });
    this.structureBox(W, 9.0 * S, 0.22 * S, 2.2 * S, 0.5 * S, 2.6 * S, 5.8 * S, deckMat, false, true);
    this.buildStructureRail(W, 0.5 * S, 3.05 * S, 4.68 * S, 8.5 * S, 'x', scaffoldMat);
    this.buildPlayableStairs(W, -4.6 * S, 7.2 * S, 6.2 * S, 1.5 * S, 2.55 * S, 8, deckMat, 'z', -1);
    [[-3.2, 3.8], [-1.2, 3.2], [1.4, 3.4], [3.6, 4.0], [-5.8, 12.4], [6.2, 12.8]].forEach(([x, z], i) => {
      this.structureBox(W, (1.2 + (i % 2) * 0.45) * S, 0.75 * S, 1.1 * S, x * S, 0.38 * S, z * S, i % 2 ? floor : wall, true, false);
    });
    const tombDoor = new THREE.Mesh(new THREE.PlaneGeometry(2.0 * S, 2.8 * S), new THREE.MeshBasicMaterial({ color: 0x120b08, side: THREE.DoubleSide }));
    tombDoor.position.set(0.0 * S, 1.42 * S, -3.18 * S);
    W.add(tombDoor);
  }

  addJunglePlayableStructures(W, S, stoneMat, mossMat) {
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x6f4d2c, roughness: 0.85 });
    const hutMat = new THREE.MeshStandardMaterial({ color: 0x6b4425, roughness: 0.82 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x415a39, roughness: 0.92 });
    const ruinStyle = { wall: stoneMat, floor: floorMat, roof: mossMat, lamp: 0x78ff65, win: new THREE.MeshBasicMaterial({ color: 0x78ff65, side: THREE.DoubleSide }) };
    this.buildMultiFloorStructure(W, 9.5 * S, -10.8 * S, 7.4 * S, 6.5 * S, ruinStyle, {
      floorY: 2.25 * S, stairX: 4.2 * S, stairZ: -6.8 * S, stairLen: 6.8 * S, stairWidth: 1.7 * S, stairAxis: 'z', stairDir: -1, steps: 8
    });
    [[8.5, 0.28, -11, 16, 0.55, 4.5], [8.5, 1.05, -14.6, 12, 0.55, 3.4], [8.5, 1.82, -17.4, 8, 0.55, 2.8]].forEach(([x, y, z, w, h, d]) => {
      this.structureBox(W, w * S, h * S, d * S, x * S, y * S, z * S, y > 1.1 ? mossMat : stoneMat, false, true);
    });
    const leftHouse = this.structureBox(W, 5.2 * S, 2.4 * S, 4.0 * S, -18 * S, 5.2 * S, -8 * S, hutMat, false, true);
    const rightHouse = this.structureBox(W, 5.0 * S, 2.2 * S, 4.0 * S, 19 * S, 5.0 * S, -18 * S, hutMat, false, true);
    this.structureBox(W, 37 * S, 0.22 * S, 1.2 * S, 0.5 * S, 4.55 * S, -13.1 * S, vineMat, false, true);
    this.buildStructureRail(W, 0.5 * S, 5.08 * S, -13.75 * S, 36 * S, 'x', vineMat);
    this.buildPlayableStairs(W, -21.5 * S, -1.0 * S, 10.5 * S, 1.7 * S, 4.2 * S, 11, vineMat, 'z', -1);
    [[3, -6], [5, -5], [13, -7], [15, -9], [17, -12], [4, -16]].forEach(([x, z], i) => {
      this.structureBox(W, (1.2 + (i % 3) * 0.35) * S, 0.6 * S, 1.05 * S, x * S, 0.32 * S, z * S, i % 2 ? mossMat : stoneMat, true, false);
    });
    [leftHouse, rightHouse].forEach(room => {
      const p = room.position;
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4 * S, 1.6 * S), new THREE.MeshBasicMaterial({ color: 0x071409, side: THREE.DoubleSide }));
      door.position.set(p.x, p.y - 0.25 * S, p.z + 2.03 * S);
      W.add(door);
    });
  }

  addJapanPlayableStructures(W, addRoof, styleFactory) {
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4528, roughness: 0.78 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x28160f, roughness: 0.82 });
    const style = styleFactory(0xd9c4a3);
    this.buildMultiFloorStructure(W, -34, -30, 10, 9, style, { floorY: 3.65, stairX: -40.2, stairZ: -25.4, stairLen: 7.5, stairWidth: 2.0, stairAxis: 'z', stairDir: -1, steps: 8, railMat: dark, stairMat: wood });
    addRoof(W, -34, 7.2, -30, 12.4, 11.2, 1);
    this.buildMultiFloorStructure(W, 34, -30, 10, 9, styleFactory(0xc98a5a), { floorY: 3.65, stairX: 40.2, stairZ: -25.4, stairLen: 7.5, stairWidth: 2.0, stairAxis: 'z', stairDir: -1, steps: 8, railMat: dark, stairMat: wood });
    addRoof(W, 34, 7.2, -30, 12.4, 11.2, 1);
    this.structureBox(W, 68, 0.18, 2.2, 0, 3.72, -30, wood, false, true);
    this.buildStructureRail(W, 0, 4.42, -31.15, 66, 'x', dark);
    this.buildPlayableStairs(W, -6, -39, 12, 2.0, 3.65, 10, wood, 'z', -1);
    this.structureBox(W, 18, 0.22, 4.0, 0, 5.14, -43.2, wood, false, true);
    this.buildStructureRail(W, 0, 5.85, -45.2, 17, 'x', dark);
  }

  addRailPlayableStructures(W, S, mats, registerPlatform) {
    const { concreteMat, deckMat, barrierMat, cyanMat, magMat, darkMetalMat } = mats;
    const hallStyle = { wall: concreteMat, floor: deckMat, roof: darkMetalMat, lamp: 0x19f0ff, win: new THREE.MeshBasicMaterial({ color: 0x19f0ff, side: THREE.DoubleSide }) };
    const stationX = 30 * S + 2.8 * S;
    this.buildMultiFloorStructure(W, stationX, -7.2 * S, 10.5 * S, 6.2 * S, hallStyle, {
      floorY: 2.7 * S, stairX: stationX - 6.5 * S, stairZ: -2.6 * S, stairLen: 7.2 * S, stairWidth: 1.8 * S, stairAxis: 'z', stairDir: -1, steps: 9, stairMat: deckMat, railMat: cyanMat
    });
    const bridge = this.structureBox(W, 9.5 * S, 0.24 * S, 1.8 * S, stationX - 0.5 * S, 2.95 * S, -1.2 * S, deckMat, false, true);
    registerPlatform(bridge);
    this.buildStructureRail(W, stationX - 0.5 * S, 3.55 * S, -2.15 * S, 9.0 * S, 'x', cyanMat);
    this.buildStructureRail(W, stationX - 0.5 * S, 3.55 * S, -0.25 * S, 9.0 * S, 'x', magMat);
    [[stationX - 10 * S, -7.7 * S], [stationX + 6 * S, -12.2 * S], [-18 * S, 13 * S], [-23 * S, 14 * S]].forEach(([x, z], i) => {
      this.structureBox(W, 2.8 * S, 1.1 * S, 1.25 * S, x, 0.55 * S, z, barrierMat, true, false);
      this.structureBox(W, 2.0 * S, 0.12 * S, 0.09 * S, x, 1.14 * S, z + 0.65 * S, i % 2 ? cyanMat : magMat, false, false);
    });
    const trainCarMat = new THREE.MeshStandardMaterial({ color: 0x101a2b, roughness: 0.32, metalness: 0.65, emissive: 0x061426, emissiveIntensity: 0.35 });
    this.buildMultiFloorStructure(W, -18 * S, 9.4 * S, 9.0 * S, 4.2 * S, { wall: trainCarMat, floor: deckMat, roof: darkMetalMat, lamp: 0xff2d95, win: new THREE.MeshBasicMaterial({ color: 0xff2d95, side: THREE.DoubleSide }) }, {
      floorY: 2.15 * S, stairX: -23.2 * S, stairZ: 13.2 * S, stairLen: 5.8 * S, stairWidth: 1.4 * S, stairAxis: 'z', stairDir: -1, steps: 7, stairMat: deckMat, railMat: magMat
    });
  }

  addMegaCityPlayableStructures(W, S, mats) {
    const { neonColors } = mats;
    const wall = new THREE.MeshStandardMaterial({ color: 0x263446, roughness: 0.4, metalness: 0.55 });
    const floor = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.38, metalness: 0.6 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xffdd55, emissive: 0xffaa22, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.35 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x33ffcc, emissive: 0x33ffcc, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.35 });
    const subStyle = { wall, floor, roof: trim, lamp: 0xffdd55, win: new THREE.MeshBasicMaterial({ color: 0xffdd55, side: THREE.DoubleSide }) };
    const ctrlStyle = { wall: new THREE.MeshStandardMaterial({ color: 0x1e3d4d, roughness: 0.36, metalness: 0.55 }), floor, roof: cyan, lamp: 0x33ffcc, win: new THREE.MeshBasicMaterial({ color: 0x33ffcc, side: THREE.DoubleSide }) };
    this.buildMultiFloorStructure(W, -13 * S, 6 * S, 8.5 * S, 7.5 * S, subStyle, { floorY: 2.9 * S, stairX: -18.0 * S, stairZ: 11.2 * S, stairLen: 6.6 * S, stairWidth: 1.6 * S, stairAxis: 'z', stairDir: -1, steps: 8, stairMat: trim, railMat: trim });
    this.buildMultiFloorStructure(W, 10 * S, 7 * S, 8.8 * S, 7.5 * S, ctrlStyle, { floorY: 3.1 * S, stairX: 4.6 * S, stairZ: 12.4 * S, stairLen: 7.2 * S, stairWidth: 1.8 * S, stairAxis: 'z', stairDir: -1, steps: 9, stairMat: cyan, railMat: cyan });
    this.structureBox(W, 14.0 * S, 0.22 * S, 1.65 * S, -1.5 * S, 3.22 * S, 6.7 * S, floor, false, true);
    this.buildStructureRail(W, -1.5 * S, 3.85 * S, 5.82 * S, 13.2 * S, 'x', cyan);
    this.buildStructureRail(W, -1.5 * S, 3.85 * S, 7.58 * S, 13.2 * S, 'x', trim);
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0xb9c6d3, roughness: 0.4, metalness: 0.75 });
    [[-24, 5], [23, 4]].forEach(([x, z]) => {
      const h = 6.0 * S;
      const lx = x * S, lz = z * S;
      this.structureBox(W, 0.35 * S, h, 0.35 * S, lx - 1.8 * S, h / 2, lz, pylonMat, true, false);
      this.structureBox(W, 0.35 * S, h, 0.35 * S, lx + 1.8 * S, h / 2, lz, pylonMat, true, false);
      this.structureBox(W, 4.2 * S, 0.24 * S, 0.24 * S, lx, 3.4 * S, lz, pylonMat, false, false);
      this.structureBox(W, 4.8 * S, 0.24 * S, 0.24 * S, lx, 5.1 * S, lz, pylonMat, false, false);
    });
    [[-20, 13], [-15, 14], [-8, 12], [3, 14], [15, 13], [20, 12], [-4, 2], [5, 2]].forEach(([x, z], i) => {
      const mat = new THREE.MeshStandardMaterial({ color: neonColors[i % neonColors.length], emissive: neonColors[i % neonColors.length], emissiveIntensity: 0.35, roughness: 0.48, metalness: 0.55 });
      this.structureBox(W, (1.5 + (i % 3) * 0.35) * S, 0.85 * S, 1.15 * S, x * S, 0.43 * S, z * S, mat, true, false);
    });
  }

  addCityPlayableStructures(W) {
    const wall = new THREE.MeshStandardMaterial({ color: 0x20242e, roughness: 0.66, metalness: 0.35 });
    const floor = new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.55, metalness: 0.45 });
    const cyan = new THREE.MeshBasicMaterial({ color: 0x19f0ff, side: THREE.DoubleSide });
    const mag = new THREE.MeshBasicMaterial({ color: 0xff2d95, side: THREE.DoubleSide });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x19f0ff, emissive: 0x19f0ff, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.35 });
    const cityStyleA = { wall, floor, roof: new THREE.MeshStandardMaterial({ color: 0x171923, roughness: 0.7, metalness: 0.4 }), lamp: 0x19f0ff, win: cyan };
    const cityStyleB = { wall: new THREE.MeshStandardMaterial({ color: 0x2b2031, roughness: 0.64, metalness: 0.35 }), floor, roof: new THREE.MeshStandardMaterial({ color: 0x1c1421, roughness: 0.7, metalness: 0.4 }), lamp: 0xff2d95, win: mag };
    this.buildMultiFloorStructure(W, -18, -12, 12, 11, cityStyleA, { floorY: 4.0, stairX: -25.5, stairZ: -5.4, stairLen: 8.8, stairWidth: 2.2, stairAxis: 'z', stairDir: -1, steps: 10, railMat });
    this.buildMultiFloorStructure(W, 18, -12, 12, 11, cityStyleB, { floorY: 4.0, stairX: 25.5, stairZ: -5.4, stairLen: 8.8, stairWidth: 2.2, stairAxis: 'z', stairDir: -1, steps: 10, railMat });
    this.structureBox(W, 24, 0.22, 2.4, 0, 4.18, -12, new THREE.MeshStandardMaterial({ color: 0x171923, roughness: 0.45, metalness: 0.55 }), false, true);
    this.buildStructureRail(W, 0, 4.88, -13.25, 23, 'x', railMat);
    this.buildStructureRail(W, 0, 4.88, -10.75, 23, 'x', new THREE.MeshStandardMaterial({ color: 0xff2d95, emissive: 0xff2d95, emissiveIntensity: 0.85, roughness: 0.3, metalness: 0.35 }));
    [[-9, -2], [-5, -2.5], [5, -2], [9, -2.5], [0, -22], [-28, -2], [28, -2]].forEach(([x, z], i) => {
      this.structureBox(W, 2.1, 1.4, 1.7, x, 0.7, z, new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2a2620 : 0x1e2638, roughness: 0.78, metalness: 0.25 }), true, false);
    });
  }

  addFieldsPlayableStructures(W) {
    const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a32, roughness: 0.82 });
    const barnWall = new THREE.MeshStandardMaterial({ color: 0x91482f, roughness: 0.66 });
    const plaster = new THREE.MeshStandardMaterial({ color: 0xd9c89d, roughness: 0.74 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x6b2f2f, roughness: 0.75 });
    const rail = new THREE.MeshStandardMaterial({ color: 0x5f3d20, roughness: 0.85 });
    const barnStyle = { wall: barnWall, floor: wood, roof, lamp: 0xffd27a, win: new THREE.MeshBasicMaterial({ color: 0xffd27a, side: THREE.DoubleSide }) };
    const farmStyle = { wall: plaster, floor: wood, roof, cone: roof, lamp: 0xffd9a0, win: new THREE.MeshBasicMaterial({ color: 0xb7e28c, side: THREE.DoubleSide }) };
    this.buildMultiFloorStructure(W, -18, 16, 13, 11, barnStyle, { floorY: 4.0, stairX: -25.5, stairZ: 23.0, stairLen: 9.0, stairWidth: 2.4, stairAxis: 'z', stairDir: -1, steps: 10, railMat: rail, stairMat: wood });
    this.buildMultiFloorStructure(W, 11, 18, 10, 9, farmStyle, { floorY: 3.65, stairX: 4.6, stairZ: 24.1, stairLen: 7.8, stairWidth: 2.1, stairAxis: 'z', stairDir: -1, steps: 8, railMat: rail, stairMat: wood });
    this.buildMultiFloorStructure(W, 30, 9, 8.5, 8, { wall: new THREE.MeshStandardMaterial({ color: 0x8a6638, roughness: 0.8 }), floor: wood, roof, lamp: 0xffd9a0, win: new THREE.MeshBasicMaterial({ color: 0xffe2a0, side: THREE.DoubleSide }) }, { floorY: 3.4, stairX: 24.5, stairZ: 14.5, stairLen: 6.8, stairWidth: 1.9, stairAxis: 'z', stairDir: -1, steps: 7, railMat: rail, stairMat: wood });
    const siloMat = new THREE.MeshStandardMaterial({ color: 0xd4d2bd, roughness: 0.62, metalness: 0.15 });
    const siloDeck = this.structureBox(W, 4.8, 0.22, 4.8, 21, 5.8, 16, wood, false, true);
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 11, 18), siloMat);
    silo.position.set(21, 5.5, 16); silo.castShadow = true; silo.receiveShadow = true; W.add(silo); this.objects.push(silo);
    this.buildPlayableStairs(W, 16.5, 22.0, 10.2, 1.7, 5.7, 11, wood, 'z', -1);
    this.buildStructureRail(W, 21, 6.5, 13.6, 4.6, 'x', rail);
    [[-30, 8, 0], [-22, 8, 0], [-6, 8, 0], [4, 8, 0], [18, 8, 0], [34, 8, 0], [-10, 28, 1.57], [2, 28, 1.57], [14, 28, 1.57]].forEach(([x, z, rot]) => {
      const gate = this.structureBox(W, 7.0, 1.2, 0.18, x, 0.65, z, rail, true, false);
      gate.rotation.y = rot;
    });
    [[-24, 23], [-21, 25], [-15, 25], [7, 25], [13, 24], [27, 14], [33, 14]].forEach(([x, z], i) => {
      this.structureBox(W, 1.8, 1.0, 1.5, x, 0.5, z, new THREE.MeshStandardMaterial({ color: i % 2 ? 0xcaa85c : 0xd9b86c, roughness: 0.9 }), true, false);
    });
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
      new THREE.MeshStandardMaterial({ map: fTex, roughness: 0.7, metalness: 0.28, color: 0x6b7280 }));
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
      const light = new THREE.PointLight(0x19f0ff, 0.55, 8, 2.4);
      light.position.set(x, 3.05, z); W.add(light);
    };
    [[-17, -17, 'NEON AVE', Math.PI / 4], [17, -17, 'NIGHTFALL', -Math.PI / 4], [-17, 17, 'CYBER ST', Math.PI * 0.75], [17, 17, 'DOWNTOWN', -Math.PI * 0.75],
     [0, -31, 'MAIN ST', 0], [0, 31, 'PLAZA', Math.PI], [-31, 0, 'MARKET', Math.PI / 2], [31, 0, 'SKYWAY', -Math.PI / 2]].forEach(s => addStreetSign(s[0], s[1], s[2], s[3]));

    const variants = [];
    for (let i = 0; i < 5; i++) {
      const t = TextureGen.createBuilding();
      t.map.wrapS = t.map.wrapT = THREE.RepeatWrapping;
      t.emissive.wrapS = t.emissive.wrapT = THREE.RepeatWrapping;
      t.map.repeat.set(1, 2); t.emissive.repeat.set(1, 2); t.map.encoding = THREE.sRGBEncoding;
      variants.push(new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffffff,
        emissiveIntensity: 1.25, roughness: 0.35, metalness: 0.55 }));
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
        m.castShadow = true; m.receiveShadow = true; W.add(m); this.objects.push(m);
        if (Math.random() > 0.7) billboards.push(m);
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
    // Concept-sheet downtown lobby/shop towers with stair access, balconies, and a skybridge combat lane.
    this.addCityPlayableStructures(W);

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
    const hues = [0x19f0ff, 0xff2d95, 0x9b5cff, 0xffb347, 0x39ff14];
    for (let i = 0; i < 18; i++) {
      const hue = hues[(Math.random() * hues.length) | 0];
      const pl = new THREE.PointLight(hue, 2.4, 16, 2.2);
      pl.position.set((Math.random() - 0.5) * 300, 2.6 + Math.random() * 2.2, (Math.random() - 0.5) * 300);
      W.add(pl);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: hue }));
      bulb.position.copy(pl.position); W.add(bulb);
    }
    // lights
    W.add(new THREE.AmbientLight(0x2a2f3e, 0.32));
    W.add(new THREE.HemisphereLight(0x18203c, 0x080810, 0.24));
    const moon = new THREE.DirectionalLight(0x7e8ac8, 0.42);
    moon.position.set(120, 180, -80); moon.castShadow = true; moon.shadow.bias = -0.0002;
    moon.shadow.camera.left = -180; moon.shadow.camera.right = 180; moon.shadow.camera.top = 180; moon.shadow.camera.bottom = -180;
    moon.shadow.camera.far = 500; moon.shadow.mapSize.set(2048, 2048); W.add(moon);
  }

  // ================= COLORFUL HOUSE YARD BOSS ARENA =================
  buildHouseYardBossLevel(W) {
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 75, 260);

    const sky = new THREE.Mesh(new THREE.SphereGeometry(760, 32, 20),
      new THREE.MeshBasicMaterial({ map: TextureGen.createDaySky('#59a7e8', '#ffd5a8'), side: THREE.BackSide, fog: false }));
    W.add(sky);

    const grassTex = TextureGen.createGrass(false); grassTex.repeat.set(34, 34);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({ map: grassTex, color: 0x6da55a, roughness: 0.88, metalness: 0.02 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; W.add(ground);

    const pathMat = new THREE.MeshStandardMaterial({ color: 0xd7b881, roughness: 0.92 });
    [[0, 22, 7.0, 42, 0], [0, -22, 5.2, 26, 0], [-16, 4, 5.4, 25, Math.PI / 2], [16, 4, 5.4, 25, Math.PI / 2]].forEach(([x, z, w, d, r]) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), pathMat);
      p.position.set(x, 0.012, z); p.rotation.y = r; p.receiveShadow = true; W.add(p);
    });

    const mat = {
      body: new THREE.MeshStandardMaterial({ color: 0xf9b43a, roughness: 0.35, metalness: 0.04 }),
      roof: new THREE.MeshStandardMaterial({ color: 0xdd4a4a, emissive: 0x331100, emissiveIntensity: 0.08, roughness: 0.42 }),
      trim: new THREE.MeshStandardMaterial({ color: 0xfff0e0, roughness: 0.45 }),
      wood: new THREE.MeshStandardMaterial({ color: 0xbc9a6c, roughness: 0.38 }),
      brick: new THREE.MeshStandardMaterial({ color: 0xb55a3a, roughness: 0.75 }),
      step: new THREE.MeshStandardMaterial({ color: 0xccaa88, roughness: 0.75 }),
      fence: new THREE.MeshStandardMaterial({ color: 0xc9a87c, roughness: 0.82 }),
      deck: new THREE.MeshStandardMaterial({ color: 0xd8bd89, roughness: 0.72 }),
      cyan: new THREE.MeshStandardMaterial({ color: 0x4ecdc4, emissive: 0x226666, emissiveIntensity: 0.3, roughness: 0.35 }),
      magenta: new THREE.MeshStandardMaterial({ color: 0xff6f61, emissive: 0x662222, emissiveIntensity: 0.22, roughness: 0.35 }),
      green: new THREE.MeshStandardMaterial({ color: 0x9ed93a, emissive: 0x224400, emissiveIntensity: 0.16, roughness: 0.45 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xffe55c, emissive: 0x443300, emissiveIntensity: 0.2, roughness: 0.38 }),
      purple: new THREE.MeshStandardMaterial({ color: 0xcd88ff, emissive: 0x331155, emissiveIntensity: 0.22, roughness: 0.4 })
    };

    const style = { wall: mat.body, floor: mat.deck, roof: mat.trim, lamp: 0xffaa66,
      win: new THREE.MeshBasicMaterial({ color: 0x4ecdc4, side: THREE.DoubleSide }) };
    this.buildMultiFloorStructure(W, 0, 0, 12.4, 11.6, style, {
      floorY: 3.72, stairX: -8.0, stairZ: 7.9, stairLen: 8.4, stairWidth: 2.4, stairAxis: 'z', stairDir: -1,
      steps: 10, stairMat: mat.step, railMat: mat.trim, deckMat: mat.deck, balconyDepth: 2.3,
      doorMat: new THREE.MeshStandardMaterial({ color: 0x593a24, emissive: 0xffaa66, emissiveIntensity: 0.25, roughness: 0.42 })
    });

    const coneRoof = new THREE.Mesh(new THREE.ConeGeometry(9.0, 4.6, 4), mat.roof);
    coneRoof.rotation.y = Math.PI / 4; coneRoof.position.set(0, 6.2, 0); coneRoof.castShadow = true; W.add(coneRoof); this.objects.push(coneRoof);
    this.structureBox(W, 13.0, 0.22, 12.2, 0, 3.62, 0, mat.trim, false, true);
    this.structureBox(W, 1.1, 2.2, 1.1, 4.4, 5.0, 3.8, mat.brick, true, false);
    this.structureBox(W, 1.35, 0.28, 1.35, 4.4, 6.22, 3.8, mat.brick, true, false);
    this.structureBox(W, 2.2, 0.24, 1.05, 0, 0.16, 6.48, mat.step, false, true);
    this.structureBox(W, 2.7, 0.22, 1.25, 0, 0.42, 7.12, mat.step, false, true);

    const addPanel = (w, h, x, y, z, rotY, m) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), m);
      p.position.set(x, y, z); p.rotation.y = rotY || 0; p.castShadow = true; p.receiveShadow = true; W.add(p); return p;
    };
    addPanel(1.65, 1.05, -3.6, 1.72, 5.83, 0, mat.cyan);
    addPanel(1.65, 1.05, 3.6, 1.72, 5.83, 0, mat.magenta);
    addPanel(1.45, 1.0, -6.28, 1.74, -1.7, Math.PI / 2, mat.purple);
    addPanel(1.45, 1.0, 6.28, 1.74, 1.8, -Math.PI / 2, mat.cyan);
    addPanel(1.35, 0.9, 0, 1.78, -5.83, 0, mat.yellow);
    const attic = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 8), mat.magenta);
    attic.rotation.x = Math.PI / 2; attic.position.set(0, 5.18, 5.05); attic.castShadow = true; W.add(attic);

    const sidePorches = [
      { x: -12.2, z: -2.0, w: 6.8, d: 3.0, sx: -12.2, sz: -5.0 },
      { x: 12.2, z: -2.0, w: 6.8, d: 3.0, sx: 12.2, sz: -5.0 }
    ];
    sidePorches.forEach(p => {
      this.structureBox(W, p.w, 0.2, p.d, p.x, 2.35, p.z, mat.deck, false, true);
      this.buildPlayableStairs(W, p.sx, p.sz, 4.0, 1.8, 2.35, 6, mat.step, 'z', -1);
      this.buildStructureRail(W, p.x, 2.95, p.z - p.d / 2, p.w, 'x', mat.trim);
      this.buildStructureRail(W, p.x - p.w / 2, 2.95, p.z, p.d, 'z', mat.trim);
      this.buildStructureRail(W, p.x + p.w / 2, 2.95, p.z, p.d, 'z', mat.trim);
    });

    const fenceR = 58, posts = 72;
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * Math.PI * 2;
      const x = Math.cos(a) * fenceR, z = Math.sin(a) * fenceR;
      const post = this.structureBox(W, 0.34, 1.35, 0.34, x, 0.65, z, mat.fence, i % 3 === 0, false);
      post.rotation.y = a;
      if (i % 2 === 0) {
        const a2 = ((i + 1) % posts) / posts * Math.PI * 2;
        const x2 = Math.cos(a2) * fenceR, z2 = Math.sin(a2) * fenceR;
        const len = Math.hypot(x2 - x, z2 - z);
        const rail = this.structureBox(W, len, 0.14, 0.14, (x + x2) / 2, 0.83, (z + z2) / 2, mat.fence, false, false);
        rail.rotation.y = Math.atan2(z2 - z, x2 - x);
        const rail2 = this.structureBox(W, len, 0.12, 0.12, (x + x2) / 2, 0.38, (z + z2) / 2, mat.fence, false, false);
        rail2.rotation.y = rail.rotation.y;
      }
    }
    this.structureBox(W, 0.5, 2.2, 0.5, -2.8, 1.1, fenceR - 0.4, mat.fence, true, false);
    this.structureBox(W, 0.5, 2.2, 0.5, 2.8, 1.1, fenceR - 0.4, mat.fence, true, false);
    this.structureBox(W, 6.4, 0.24, 0.42, 0, 2.18, fenceR - 0.4, mat.fence, false, false);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.92 });
    const leafMats = [0x5fb05f, 0x7ccd7c, 0x8eda55].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.96, flatShading: true }));
    const addTree = (x, z, s) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.52 * s, 1.5 * s, 6), trunkMat);
      trunk.position.set(x, 0.75 * s, z); trunk.castShadow = true; W.add(trunk); this.objects.push(trunk);
      [1.35, 2.0, 2.58].forEach((y, k) => {
        const f = new THREE.Mesh(new THREE.ConeGeometry((1.15 - k * 0.2) * s, (1.25 - k * 0.16) * s, 8), leafMats[k]);
        f.position.set(x, y * s, z); f.castShadow = true; W.add(f);
      });
    };
    [[-32,26,2.4],[32,24,2.6],[34,-25,2.2],[-34,-24,2.3],[-45,0,2.0],[45,4,2.1],[-18,40,1.8],[18,42,1.9],[-42,34,1.7],[42,36,1.7],[-22,-42,1.9],[22,-40,1.9]].forEach(t => addTree(t[0], t[1], t[2]));

    const bushMats = [0x6aaf4e, 0x7cb357, 0x5c9e3e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
    [[-8,9],[8,9],[-9,-8],[9,-8],[5,17],[-6,18],[21,3],[-21,1],[-16,-18],[17,-18],[0,30],[-28,12],[28,12]].forEach(([x, z], i) => {
      const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.85, 7, 6), bushMats[i % bushMats.length]);
      b1.position.set(x, 0.42, z); b1.castShadow = true; W.add(b1);
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.62, 7, 6), bushMats[(i + 1) % bushMats.length]);
      b2.position.set(x + 0.58, 0.36, z + 0.42); b2.castShadow = true; W.add(b2);
    });

    const flowerCols = [0xff69b4, 0xffdd77, 0xffaa66, 0xdd88ff, 0x66ccff, 0xffffff];
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x77aa55, roughness: 1 });
    for (let i = 0; i < 240; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 15 + Math.random() * 40;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.28, 4), stemMat);
      stem.position.set(x, 0.14, z); W.add(stem);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshStandardMaterial({ color: flowerCols[(Math.random() * flowerCols.length) | 0], emissive: 0x332000, emissiveIntensity: 0.14 }));
      head.position.set(x, 0.33, z); head.castShadow = true; W.add(head);
    }

    const grassMat = new THREE.MeshStandardMaterial({ color: 0x5c9e3e, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 360; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 45;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = 0.12 + Math.random() * 0.22;
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, h, 3), grassMat);
      blade.position.set(x, h / 2 - 0.04, z); blade.rotation.y = Math.random() * Math.PI; W.add(blade);
    }

    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, emissive: 0xeeeeee, emissiveIntensity: 0.1, roughness: 1 });
    [[-48,38,-36],[38,44,24],[0,48,-52],[58,34,-12],[-68,42,22]].forEach(([x, y, z]) => {
      const cg = new THREE.Group();
      [[0,0,0,4.8],[5,-.4,2,5.7],[-4,-.2,-1.6,4.2],[1.8,1.0,-4.2,4.6]].forEach(([px, py, pz, s]) => {
        const c = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 7), cloudMat); c.position.set(px, py, pz); cg.add(c);
      });
      cg.position.set(x, y, z); W.add(cg);
    });

    const sparkGeo = new THREE.BufferGeometry();
    const count = 420, positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 48;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.7 + Math.random() * 7.0;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sparkles = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffdd88, size: 0.09, transparent: true, opacity: 0.58 }));
    W.add(sparkles);
    this.houseYardProps = { sparkles };

    W.add(new THREE.AmbientLight(0x404060, 0.65));
    W.add(new THREE.HemisphereLight(0xb7dcff, 0x69a751, 0.72));
    const sun = new THREE.DirectionalLight(0xfff5d1, 1.35);
    sun.position.set(70, 130, 55); sun.castShadow = true; sun.shadow.camera.left = -95; sun.shadow.camera.right = 95; sun.shadow.camera.top = 95; sun.shadow.camera.bottom = -95; sun.shadow.camera.far = 320; sun.shadow.mapSize.set(1024, 1024); W.add(sun);
    const doorLight = new THREE.PointLight(0xffaa66, 1.0, 15); doorLight.position.set(0, 2.1, 7.2); W.add(doorLight);
    const rimLight = new THREE.PointLight(0xffaa66, 0.55, 28, 2); rimLight.position.set(-8, 4, 8); W.add(rimLight);

    const backPortal = this.createPortal(W, new THREE.Vector3(0, 1.8, fenceR - 5), new THREE.Vector3(0, this.player.height, 0), 0x6da55a, 'COUNTRYSIDE PORTAL');
    backPortal.targetLevel = 'fields';
    this._houseYardSpawn = new THREE.Vector3(0, this.player.height, 31);
  }

  // ================= DAY COUNTRYSIDE =================
  buildFields(W) {
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0x9fd0ee, 90, 360);
    const fsky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 24),
      new THREE.MeshBasicMaterial({ map: TextureGen.createDaySky('#4f8fcf', '#cfe6d8'), side: THREE.BackSide, fog: false }));
    W.add(fsky);

    // rolling grass ground
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
      new THREE.MeshStandardMaterial({ color: 0x3d6e2f, roughness: 0.95, metalness: 0 }));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; W.add(grass);
    // dirt path patch around spawn
    const path = new THREE.Mesh(new THREE.CircleGeometry(10, 32),
      new THREE.MeshStandardMaterial({ color: 0xb8a06a, roughness: 1 }));
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

    // Concept-sheet farm compound: barn loft, farmhouse balcony, stable, silo lookout, fences, and hay cover.
    this.addFieldsPlayableStructures(W);

    const housePortal = this.createPortal(W, new THREE.Vector3(0, 1.8, 62), new THREE.Vector3(0, this.player.height, 31), 0xffaa66, 'BOSS HOUSE PORTAL');
    housePortal.targetLevel = 'houseyard';

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
    sun.shadow.camera.far = 500; sun.shadow.mapSize.set(2048, 2048); W.add(sun);
  }

  // ---------------- WEAPON MODEL ----------------
  createWeaponModel() {
    this.gunGroup = new THREE.Group();
    // shared materials
    this._matDark = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.45, metalness: 0.6 });
    this._matMetal = new THREE.MeshStandardMaterial({ color: 0x4a505c, metalness: 0.9, roughness: 0.25 });
    this._matPoly = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.6, metalness: 0.4 });
    this.gltfLoader = null;

    this.gunModels = {
      pistol:  this._buildPistol(0x19f0ff),
      dualpistol: this._buildDualPistol(0x19f0ff),
      smg:     this._buildSMG(0xffd166),
      shotgun: this._buildShotgun(0xff2d95),
      railgun: this._buildRailgun(0x39ff14),
      plasma:  this._buildPlasma(0x9b5cff),
      pulse:   this._buildPulse(0xff7a18),
      sniper:  this._buildSniper(0x00e5ff),
      katana:  this._buildKatana(),
      shuriken: this._buildShuriken(),
      bow:     this._buildBow()
    };
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
    this._part(g, new THREE.BoxGeometry(0.1, 0.13, 0.36), this._matDark, 0, 0, -0.05);
    const bar = this._part(g, new THREE.CylinderGeometry(0.022, 0.022, 0.34, 12), this._matMetal, 0, 0.03, -0.26); bar.rotation.x = Math.PI / 2;
    this._part(g, new THREE.BoxGeometry(0.08, 0.18, 0.1), this._matDark, 0, -0.15, 0.07, 0.28);
    this._part(g, new THREE.BoxGeometry(0.11, 0.015, 0.2), this._accent(c), 0, 0.02, 0.02);
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.45);
    return g;
  }

  // ---- DUAL PISTOLS: double-tap 1 sidearm mode ----
  _buildDualPistol(c) {
    const g = new THREE.Group();
    const left = this._buildPistol(c);
    const right = this._buildPistol(c);
    left.position.set(-0.18, -0.015, -0.015);
    right.position.set(0.18, 0.015, 0.015);
    left.rotation.y = 0.08;
    right.rotation.y = -0.08;
    left.rotation.z = 0.035;
    right.rotation.z = -0.035;
    g.add(left, right);
    g.userData.muzzle = new THREE.Vector3(0.18, 0.045, -0.48);
    g.userData.altMuzzle = new THREE.Vector3(-0.18, 0.015, -0.50);
    return g;
  }

  // ---- SMG: stocked auto ----
  _buildSMG(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.11, 0.13, 0.5), this._matDark, 0, 0, -0.08);
    const bar = this._part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.34, 12), this._matMetal, 0, 0.03, -0.42); bar.rotation.x = Math.PI / 2;
    this._part(g, new THREE.BoxGeometry(0.07, 0.2, 0.09), this._matMetal, 0, -0.17, -0.05, -0.12); // mag
    this._part(g, new THREE.BoxGeometry(0.09, 0.16, 0.1), this._matDark, 0, -0.13, 0.14, 0.3); // grip
    this._part(g, new THREE.BoxGeometry(0.05, 0.05, 0.16), this._matPoly, 0, 0.0, 0.26); // stock
    this._part(g, new THREE.BoxGeometry(0.12, 0.012, 0.34), this._accent(c), 0, 0.08, -0.05);
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.6);
    return g;
  }

  // ---- SHOTGUN: wide double-barrel ----
  _buildShotgun(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.16, 0.12, 0.42), this._matDark, 0, 0, -0.02);
    [-0.045, 0.045].forEach(dx => {
      const b = this._part(g, new THREE.CylinderGeometry(0.04, 0.04, 0.56, 14), this._matMetal, dx, 0.03, -0.34); b.rotation.x = Math.PI / 2;
    });
    this._part(g, new THREE.BoxGeometry(0.14, 0.05, 0.16), this._matPoly, 0, -0.07, -0.1); // pump
    this._part(g, new THREE.BoxGeometry(0.1, 0.18, 0.11), this._matDark, 0, -0.14, 0.16, 0.32);
    this._part(g, new THREE.BoxGeometry(0.05, 0.05, 0.2), this._matPoly, 0, -0.02, 0.26);
    this._part(g, new THREE.BoxGeometry(0.17, 0.014, 0.14), this._accent(c), 0, 0.09, 0.04);
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.64);
    return g;
  }

  // ---- RAILGUN: long sleek coil rifle ----
  _buildRailgun(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.1, 0.11, 0.62), this._matPoly, 0, 0, -0.12);
    // twin rails with glowing energy line between
    [-0.045, 0.045].forEach(dx => this._part(g, new THREE.BoxGeometry(0.02, 0.05, 0.8), this._matMetal, dx, 0.07, -0.32));
    this._part(g, new THREE.BoxGeometry(0.05, 0.02, 0.8), this._glow(c, 2.2), 0, 0.07, -0.32); // energy core
    // coils
    [-0.34, -0.14, 0.06].forEach(z => { const r = this._part(g, new THREE.TorusGeometry(0.07, 0.018, 8, 16), this._glow(c, 1.6), 0, 0.05, z); });
    this._part(g, new THREE.BoxGeometry(0.09, 0.16, 0.1), this._matDark, 0, -0.13, 0.16, 0.3);
    this._part(g, new THREE.BoxGeometry(0.05, 0.05, 0.18), this._matPoly, 0, 0.0, 0.28);
    g.userData.muzzle = new THREE.Vector3(0, 0.07, -0.78);
    return g;
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

  // ---- SNIPER: precision rifle with long barrel and scope ----
  _buildSniper(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.11, 0.12, 0.7), this._matDark, 0, 0, -0.16);
    this._part(g, new THREE.BoxGeometry(0.09, 0.08, 0.48), this._matPoly, 0, -0.02, 0.12);
    const barrel = this._part(g, new THREE.CylinderGeometry(0.018, 0.018, 0.95, 16), this._matMetal, 0, 0.035, -0.62); barrel.rotation.x = Math.PI / 2;
    const suppressor = this._part(g, new THREE.CylinderGeometry(0.032, 0.032, 0.22, 16), this._matDark, 0, 0.035, -1.08); suppressor.rotation.x = Math.PI / 2;
    const scope = this._part(g, new THREE.CylinderGeometry(0.045, 0.045, 0.34, 16), this._matMetal, 0, 0.16, -0.18); scope.rotation.x = Math.PI / 2;
    this._part(g, new THREE.BoxGeometry(0.07, 0.03, 0.08), this._matPoly, 0, 0.105, -0.18);
    this._part(g, new THREE.BoxGeometry(0.08, 0.2, 0.1), this._matDark, 0, -0.16, 0.12, 0.28);
    this._part(g, new THREE.BoxGeometry(0.07, 0.16, 0.08), this._matMetal, 0, -0.15, -0.16, -0.08);
    this._part(g, new THREE.BoxGeometry(0.05, 0.07, 0.28), this._matPoly, 0, -0.02, 0.44);
    this._part(g, new THREE.BoxGeometry(0.02, 0.17, 0.04), this._matPoly, 0, -0.02, 0.60);
    this._part(g, new THREE.BoxGeometry(0.13, 0.014, 0.64), this._accent(c), 0, 0.075, -0.2);
    this._part(g, new THREE.BoxGeometry(0.05, 0.014, 0.16), this._glow(c, 1.8), 0, 0.18, -0.18);
    g.userData.muzzle = new THREE.Vector3(0, 0.035, -1.20);
    return g;
  }

  // ---- KATANA: held forward, long curved blade ----
  _buildKatana() {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xdfe9f2, metalness: 0.95, roughness: 0.12 });
    const edge = new THREE.MeshBasicMaterial({ color: 0xeaf6ff });
    const wrap = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 0.8 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a24a, metalness: 0.8, roughness: 0.3 });
    // blade (slightly curved via segments)
    const blade = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.12), steel);
      const a = i * 0.02;
      seg.position.set(Math.sin(a) * 0.05, 0, -0.18 - i * 0.12);
      seg.rotation.x = a; blade.add(seg);
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.16, 4), steel);
    tip.rotation.x = -Math.PI / 2; tip.position.set(0.08, 0, -1.5); blade.add(tip);
    const shine = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 1.2), edge);
    shine.position.set(0.02, 0.006, -0.78); blade.add(shine);
    g.add(blade);
    // tsuba (guard)
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), gold);
    tsuba.rotation.x = Math.PI / 2; tsuba.position.set(0, 0, -0.12); g.add(tsuba);
    // handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.34, 8), wrap);
    handle.rotation.x = Math.PI / 2; handle.position.set(0, 0, 0.06); g.add(handle);
    // diamond wrap rings
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 10), gold);
      r.position.set(0, 0, -0.05 + i * 0.05); g.add(r);
    }
    g.position.set(0, 0, 0); g.scale.setScalar(1.1);
    g.userData.muzzle = new THREE.Vector3(0.08, 0, -1.5);
    g.userData.blade = blade;
    return g;
  }

  // ---- SHURIKEN: throwing star held in fingers ----
  _buildShuriken() {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.9, roughness: 0.25 });
    const star = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const pt = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), steel);
      pt.rotation.z = Math.PI / 2; pt.rotation.y = i * Math.PI / 2;
      pt.position.set(Math.cos(i * Math.PI / 2) * 0.13, Math.sin(i * Math.PI / 2) * 0.13, 0);
      pt.rotation.z = i * Math.PI / 2 + Math.PI / 2; star.add(pt);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8), steel);
    hub.rotation.x = Math.PI / 2; star.add(hub);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 8), new THREE.MeshBasicMaterial({ color: 0x111 }));
    hole.rotation.x = Math.PI / 2; star.add(hole);
    star.position.set(0, 0.02, -0.35); star.rotation.x = 0.5; g.add(star);
    g.userData.star = star;
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.5);
    return g;
  }

  // ---- BOW: yumi longbow held vertical, with arrow nocked ----
  _buildBow() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.6 });
    const lac = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.5 });
    // curved limb via segments
    const limb = new THREE.Group();
    for (let i = -8; i <= 8; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), i % 4 === 0 ? lac : wood);
      const a = i * 0.16;
      seg.position.set(-0.02 - Math.cos(a) * 0.06 + 0.06, i * 0.085, 0);
      seg.rotation.z = a * 0.5; limb.add(seg);
    }
    limb.position.set(0.18, 0, -0.2); g.add(limb);
    // string
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.45, 4), new THREE.MeshBasicMaterial({ color: 0xeeeeee }));
    str.position.set(0.12, 0, -0.2); g.add(str);
    g.userData.string = str;
    // nocked arrow
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0xcaa472 }));
    shaft.rotation.x = Math.PI / 2; shaft.position.set(0.12, 0, -0.45); arrow.add(shaft);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4), new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.8, roughness: 0.3 }));
    head.rotation.x = -Math.PI / 2; head.position.set(0.12, 0, -0.82); arrow.add(head);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.06, 0.08), new THREE.MeshBasicMaterial({ color: 0xcc3344, side: THREE.DoubleSide }));
    fl.position.set(0.12, 0, -0.12); arrow.add(fl);
    g.add(arrow); g.userData.arrow = arrow;
    g.userData.arrowBaseZ = arrow.position.z;
    g.userData.stringBaseZ = str.position.z;
    g.userData.muzzle = new THREE.Vector3(0.12, 0, -0.85);
    return g;
  }

  updateWeaponModel(name) {
    const baseKey = (name || 'PISTOL').toLowerCase();
    const key = (this.dualWield && baseKey === 'pistol' && this.gunModels.dualpistol) ? 'dualpistol' : baseKey;
    Object.entries(this.gunModels).forEach(([k, m]) => m.visible = (k === key));
    if (this.weaponSmooth) { this.weaponSmooth.bowDraw = 0; this.weaponSmooth.bowRelease = 0; }
    this.swing = null;
    const bow = this.gunModels && this.gunModels.bow;
    if (bow && bow.userData.arrow) bow.userData.arrow.visible = true;
    const model = this.gunModels[key] || this.gunModels.pistol;
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
      { id: 'jungle', name: 'LOST JUNGLE', desc: 'Dense canopy, ruins & beast patrols.', art: 'jungle' },
      { id: 'houseyard', name: 'BOSS HOUSE YARD', desc: 'Colorful yard arena · five bosses per wave · unlimited ammo.', art: 'houseyard' }
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
      };
      levelSelect.appendChild(c);
    });

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
    const isSniper = w.pierce || w.scope; // railgun and sniper use precision scope
    if (scope) scope.style.opacity = (on && isSniper) ? 1 : 0;
    if (on) document.getElementById('crosshair').classList.add('aiming');
    else document.getElementById('crosshair').classList.remove('aiming');
  }

  // ---------------- INPUT ----------------
  setupInputs() {
    const onKey = (code, down) => {
      if (code === 'KeyW') this.input.w = down;
      if (code === 'KeyS') this.input.s = down;
      if (code === 'KeyA') this.input.a = down;
      if (code === 'KeyD') this.input.d = down;
      if (code === 'Space') { this.input.jump = down; if (down) this.jump(); }
      if (code === 'ShiftLeft') this.input.sprint = down;
      if (code === 'Escape' && down) this.togglePause();
      const digit = /^Digit([1-9])$/.exec(code);
      if (digit && down) this.handleWeaponSlot(parseInt(digit[1], 10) - 1);
      if (code === 'KeyR' && down) this.reload();
    };
    addEventListener('keydown', e => onKey(e.code, true));
    addEventListener('keyup', e => onKey(e.code, false));
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
        const activeWeapon = this.player.weapons[this.player.weaponIdx];
        const s = this.settings.sensitivity * (this.aiming ? ((activeWeapon.pierce || activeWeapon.scope) ? 0.32 : 0.6) : 1);
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
    this.curGameMusic = (this.level === 'desert' || this.level === 'jungle' || this.level === 'houseyard') ? this.gameMusic[1] : this.gameMusic[0];
    if (this.curGameMusic) this.curGameMusic.play().catch(() => {});
    this.buildWorld(this.level || 'city');
    // pick arsenal for the level: all remaining theatres include the neon katana and bow.
    this.player.weapons = this.applyFramePacingWeaponTuning(this.level === 'houseyard' ? this.defaultWeapons.map(w => ({ ...w, ammo: Infinity, maxAmmo: Infinity })) : this.defaultWeapons);
    this.player.weaponIdx = this.startWeaponIdx || 0;
    this.player.hp = this.player.maxHp; this.score = 0; this.wave = 1;
    this.waveCountdown = null; this.boss = null; this.bosses = [];
    this.player.weapons.forEach(w => w.ammo = (this.level === 'houseyard' || w.ammo === Infinity) ? Infinity : Math.floor(w.maxAmmo * 0.6));
    this.camera.position.set(0, this.player.height, 0);
    if (this._railSpawn && this.level === 'rail') this.camera.position.copy(this._railSpawn);
    if (this._desertSpawn && this.level === 'desert') this.camera.position.copy(this._desertSpawn);
    if (this._jungleSpawn && this.level === 'jungle') this.camera.position.copy(this._jungleSpawn);
    if (this._houseYardSpawn && this.level === 'houseyard') this.camera.position.copy(this._houseYardSpawn);
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
    this.startWaveCountdown(1);
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

  handleWeaponSlot(idx) {
    if (idx === 0) {
      const now = performance.now();
      const doubleTap = now - (this.lastPistolTap || 0) <= this.dualWieldTapMs;
      this.lastPistolTap = now;
      if (doubleTap) {
        if (this.player.weaponIdx !== 0) this.switchWeapon(0, { preserveDual: true });
        this.setDualWield(!this.dualWield);
        this.lastPistolTap = 0;
        return;
      }
    } else {
      this.lastPistolTap = 0;
    }
    this.switchWeapon(idx);
  }

  setDualWield(enabled) {
    enabled = !!enabled;
    if (this.dualWield === enabled) return;
    this.dualWield = enabled;
    if (this.player && this.player.weaponIdx === 0 && this.player.weapons[0]) {
      this.updateWeaponModel(this.player.weapons[0].name);
      this.showMessage(enabled ? 'DUAL WIELD READY' : 'SINGLE PISTOL', enabled ? '#19f0ff' : '#ffd166', 900);
    }
    this.updateHUD();
  }

  switchWeapon(idx, opts = {}) {
    if (idx === undefined) idx = (this.player.weaponIdx + 1) % this.player.weapons.length;
    if (idx >= this.player.weapons.length) return;
    if (this.aiming) this.setAim(false);
    this.player.weaponIdx = idx;
    if (idx !== 0 && !opts.preserveDual) this.setDualWield(false);
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
    const hasEnemy = (type) => EnemyFactory && EnemyFactory.TYPES && EnemyFactory.TYPES[type];
    const addIfAvailable = (type, count) => {
      if (!hasEnemy(type)) return;
      for (let i = 0; i < count; i++) list.push(type);
    };
    const jungleLevel = this.level === 'jungle';
    if (this.level === 'houseyard') {
      const bossTypes = [];
      const heavyType = hasEnemy('spider') && n % 5 === 0 ? 'spider' : 'boss';
      bossTypes.push(heavyType);
      while (bossTypes.length < 5) bossTypes.push('boss');
      return bossTypes;
    }

    if (n % 10 === 0 && hasEnemy('spider')) {
      list.push('spider');
      addIfAvailable('dragon', 2 + Math.floor(n / 10));
      addIfAvailable('bramble', 4 + Math.floor(n / 4));
      addIfAvailable('sapling', 6 + Math.floor(n / 2));
      addIfAvailable('shooter', 2 + Math.floor(n / 8));
      return list;
    }

    if (n % 5 === 0) {
      list.push('boss');
      for (let i = 0; i < 3 + Math.floor(n / 5); i++) list.push('runner');
      for (let i = 0; i < 2; i++) list.push('shooter');
      addIfAvailable('dragon', n >= 5 ? 1 + Math.floor(n / 10) : 0);
      if (jungleLevel) {
        addIfAvailable('bramble', 2 + Math.floor(n / 5));
        addIfAvailable('sapling', 3 + Math.floor(n / 4));
      }
      return list;
    }

    if (jungleLevel) {
      addIfAvailable('sapling', 4 + Math.floor(n * 0.9));
      addIfAvailable('bramble', 1 + Math.floor(n * 0.45));
      if (n >= 3) addIfAvailable('treant', 1 + Math.floor(n / 4));
      if (n >= 4) addIfAvailable('dragon', Math.max(1, Math.floor(n / 5)));
      if (list.length < 6) for (let i = 0; i < 4 + Math.floor(n * 0.6); i++) list.push('grunt');
    } else {
      for (let i = 0; i < 3 + Math.floor(n * 0.7); i++) list.push('grunt');
      for (let i = 0; i < Math.floor(n * 0.6); i++) list.push('runner');
      if (n >= 2) for (let i = 0; i < 1 + Math.floor(n / 4); i++) list.push('shooter');
      if (n >= 3) for (let i = 0; i < Math.floor(n / 3); i++) list.push('tank');
      if (n >= 4) addIfAvailable('dragon', Math.max(1, Math.floor(n / 6)));
    }

    // cap for performance
    const targetCount = this.lowMemoryMode ? Math.min(24, 8 + (n - 1) * 4) : Math.min(50, 20 + (n - 1) * 10);
    const pattern = list.length ? list.slice() : ['grunt'];
    while (list.length < targetCount) list.push(pattern[list.length % pattern.length]);
    return list.slice(0, targetCount);
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

  spawnEnemy(type, hpScale) {
    const cfg = EnemyFactory.TYPES[type];
    const mesh = EnemyFactory.build(type, this.level === 'desert' ? 'desert' : 'rock');
    mesh.scale.setScalar(cfg.scale);

    let pos = new THREE.Vector3(), ok = false, tries = 0;
    while (!ok && tries++ < 40) {
      const a = Math.random() * Math.PI * 2, d = this.level === 'houseyard' ? (34 + Math.random() * 22) : ((cfg.boss ? 55 : 38) + Math.random() * 55);
      pos.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      ok = true;
      for (const o of this.objects) if (pos.distanceTo(o.position) < 9) { ok = false; break; }
    }
    mesh.position.copy(pos);
    if (cfg.fly) mesh.position.y = cfg.altitude || 7;
    mesh.userData = Object.assign({}, mesh.userData, {
      type, hp: cfg.hp * hpScale, maxHp: cfg.hp * hpScale,
      speed: cfg.speed, dmg: cfg.dmg, melee: cfg.melee, ranged: cfg.ranged,
      range: cfg.range, projDmg: cfg.projDmg, fireRate: cfg.fireRate, boss: cfg.boss,
      fly: cfg.fly, altitude: cfg.altitude, hover: cfg.fly || cfg.hover,
      score: cfg.score, animOffset: Math.random() * 10, lastFire: 0, hitFlash: 0
    });
    this.applyLowMemoryEnemy(mesh);
    this.scene.add(mesh);
    this.enemies.push(mesh);
    if (cfg.boss) {
      this.bosses ||= [];
      this.bosses.push(mesh);
      this.boss = this.bosses[0] || mesh;
      document.getElementById('boss-bar-wrap').classList.remove('hidden');
      this.sound.boss();
      const bossName = type === 'spider' ? 'SUPER APEX SPIDER' : 'APEX HORROR';
      this.showMessage('⚠ ' + bossName + ' INBOUND', type === 'spider' ? '#8bff36' : '#ff2d95');
    }
  }

  // emoji billboard sprite (always faces camera)
  _emojiSprite(emoji) {
    const tex = this.getEmojiTexture(emoji);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(0.9, 0.9, 0.9);
    return spr;
  }

  spawnAmmo(pos) {
    const spr = this._emojiSprite('🔋');
    spr.position.copy(pos); spr.position.y = 0.7;
    const halo = new THREE.PointLight(0x39ff14, 1.2, 6); spr.add(halo);
    this.scene.add(spr); this.items.push(spr);
  }
  spawnHealth(pos) {
    const spr = this._emojiSprite(Math.random() > 0.5 ? '❤️' : '💊');
    spr.position.copy(pos); spr.position.y = 0.7; spr.userData.health = true;
    const halo = new THREE.PointLight(0xff3355, 1.3, 6); spr.add(halo);
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
    const dualPistol = this.dualWield && w.model === 'pistol';
    const dualMuzzlePos = dualPistol && this.gunModels && this.gunModels.dualpistol
      ? this.gunGroup.localToWorld((this.gunModels.dualpistol.userData.altMuzzle || new THREE.Vector3(-0.18, 0.02, -0.5)).clone())
      : null;
    const isPulse = w.model === 'pulse';
    const emitPulseVisual = !isPulse || this.shouldEmitPulseVisual(w);

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
      // HITSCAN — pistol / smg / shotgun / pulse / sniper
      const pellets = w.pellets || 1;
      const spread = w.spread * (this.aiming ? 0.25 : 1);
      const muzzleOrigins = dualPistol ? [muzzlePos, dualMuzzlePos || muzzlePos] : [muzzlePos];
      for (const shotMuzzle of muzzleOrigins) {
      for (let p = 0; p < pellets; p++) {
        const dir = baseDir.clone();
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();
        this.raycaster.set(camPos, dir); this.raycaster.far = 400;
        const eHits = this.raycaster.intersectObjects(this.enemies, true);
        const wallTargets = (isPulse && this.lowMemoryMode && this.raycastObjects && this.raycastObjects.length) ? this.raycastObjects : this.objects;
        const wHits = this.raycaster.intersectObjects(wallTargets, false);
        const eDist = eHits.length ? eHits[0].distance : Infinity;
        const wDist = wHits.length ? wHits[0].distance : Infinity;
        let endPoint;
        if (eDist < wDist && eHits.length) {
          const root = this.enemyRoot(eHits[0].object);
          endPoint = eHits[0].point;
          if (root) {
            const prevSuppress = this._suppressNextHitFeedback;
            this._suppressNextHitFeedback = isPulse && !emitPulseVisual;
            const hitDamage = w.oneHit ? (root.userData.hp + 9999) : w.dmg;
            this.damageEnemy(root, hitDamage, eHits[0].point);
            this._suppressNextHitFeedback = prevSuppress;
          }
          if (emitPulseVisual) this.spawnSparks(eHits[0].point, w.color, isPulse ? 2 : 6);
        } else if (wHits.length) {
          endPoint = wHits[0].point;
          if (emitPulseVisual) this.spawnSparks(wHits[0].point, 0xffd089, isPulse ? 1 : 4, wHits[0].face ? wHits[0].face.normal : null);
        } else {
          endPoint = camPos.clone().add(dir.multiplyScalar(400));
        }
        if (emitPulseVisual) this.spawnTracer(shotMuzzle, endPoint, w.color);
      }
      }
    }

    // recoil + flash (scaled per weapon)
    this.gunGroup.position.z = -0.42 - (w.kick || 0.01) * 3;
    this.gunGroup.rotation.x = 0.06 + (w.kick || 0.01) * 2.5;
    this.camera.rotation.x += w.kick || 0.012;
    if (!isPulse || emitPulseVisual) {
      this.muzzleFlash.material.opacity = isPulse && this.lowMemoryMode ? 0.45 : 1;
      this.muzzleFlash.rotation.z = Math.random() * Math.PI;
      this.muzzleFlash.scale.setScalar(w.pellets ? 1.6 : (w.pierce ? 1.8 : (w.projectile ? 1.4 : 1)));
      this.muzzleLight.intensity = this.lowMemoryMode && isPulse ? 0.4 : (w.pierce ? 5 : 3);
    }
    if (this.gunModels.pulse.userData.spin && w.model === 'pulse' && emitPulseVisual) this.gunModels.pulse.userData.spinV = this.lowMemoryMode ? 10 : 26;
  }

  // PLASMA projectile
  spawnPlasma(pos, dir, w) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, this.lowMemoryMode ? 8 : 14, this.lowMemoryMode ? 8 : 14),
      new THREE.MeshBasicMaterial({ color: w.color }));
    mesh.position.copy(pos);
    const light = new THREE.PointLight(w.color, 2.2, 8); mesh.add(light);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.26, this.lowMemoryMode ? 8 : 12, this.lowMemoryMode ? 8 : 12),
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
    this.spawnSparks(pos, color, this.lowMemoryMode ? 8 : 26);
    // shockwave ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.5, this.lowMemoryMode ? 12 : 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.copy(pos); ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring); this.rings = this.rings || []; this.rings.push({ mesh: ring, life: 0.4, max: splash });
    if (!this.lowMemoryMode) { const fl = new THREE.PointLight(color, 6, splash * 3); fl.position.copy(pos); this.scene.add(fl); setTimeout(() => this.scene.remove(fl), 90); }
    this.sound.kill();
  }

  spawnBeam(from, to, color) {
    const dist = from.distanceTo(to);
    const geo = new THREE.CylinderGeometry(0.05, 0.05, dist, this.lowMemoryMode ? 5 : 10);
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
    if (!this._suppressNextHitFeedback) {
      this.sound.hit();
      this.showHitmarker(false);
    }
    if (e.userData.hp <= 0) {
      this.killEnemy(e, point);
    }
  }

  killEnemy(e, point) {
    const idx = this.enemies.indexOf(e);
    if (idx === -1) return;
    this.score += e.userData.score;
    this.showHitmarker(true);
    this.sound.kill();
    this.spawnSparks(point || e.position.clone().setY(e.userData.eyeHeight * 0.6), e.userData.cores[0].color.getHex(), 18);
    // drops
    const r = Math.random();
    if (e.userData.boss) { this.spawnHealth(e.position); this.spawnAmmo(e.position); }
    else if (r > 0.82) this.spawnHealth(e.position);
    else if (r > 0.55) this.spawnAmmo(e.position);

    if (e.userData && e.userData.boss) {
      if (this.bosses) this.bosses = this.bosses.filter(b => b !== e);
      this.boss = this.bosses && this.bosses.length ? this.bosses[0] : null;
      if (!this.boss) document.getElementById('boss-bar-wrap').classList.add('hidden');
      this.showMessage(this.level === 'houseyard' ? 'BOSS DOWN' : 'APEX DOWN', '#39ff14');
    }
    this.scene.remove(e);
    this.enemies.splice(idx, 1);
    this.updateHUD();
  }

  worldBlocksSegment(from, to, inset = 0.05) {
    if (!from || !to) return false;
    const delta = to.clone().sub(from);
    const dist = delta.length();
    if (dist <= 0.001) return false;
    const dir = delta.multiplyScalar(1 / dist);
    this.raycaster.set(from, dir);
    this.raycaster.far = Math.max(0, dist - inset);
    const targets = (this.raycastObjects && this.raycastObjects.length) ? this.raycastObjects : this.objects;
    const hits = this.raycaster.intersectObjects(targets || [], true);
    return hits.length > 0;
  }

  canEnemyDamagePlayer(e, melee = false) {
    if (!e || !this.camera) return false;
    const origin = e.position.clone().setY(e.position.y + (e.userData.eyeHeight || 1.5) * (e.userData.boss ? 0.85 : 1));
    const target = this.camera.position.clone().add(new THREE.Vector3(0, -0.15, 0));
    const horizontal = Math.hypot(target.x - origin.x, target.z - origin.z);
    const verticalGap = Math.abs(target.y - origin.y);
    if (melee && verticalGap > 1.65 && horizontal < 5.5) return false;
    return !this.worldBlocksSegment(origin, target, 0.22);
  }

  enemyFire(e) {
    if (!this.canEnemyDamagePlayer(e, false)) return;
    const origin = e.position.clone().setY(e.position.y + e.userData.eyeHeight * (e.userData.boss ? 0.85 : 1));
    const target = this.camera.position.clone();
    const baseDir = target.sub(origin).normalize();
      const shots = e.userData.boss ? (this.lowMemoryMode ? 3 : 5) : 1;
    for (let i = 0; i < shots; i++) {
      const dir = baseDir.clone();
      if (shots > 1) { const a = (i - (shots - 1) / 2) * 0.13; dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), a); }
      const col = e.userData.cores[0].color.getHex();
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, this.lowMemoryMode ? 6 : 10, this.lowMemoryMode ? 6 : 10),
        new THREE.MeshBasicMaterial({ color: col }));
      mesh.position.copy(origin);
      if (!this.lowMemoryMode) { const light = new THREE.PointLight(col, 1.5, 6); mesh.add(light); }
      this.scene.add(mesh);
      this.eBullets.push({ mesh, vel: dir.multiplyScalar(34), life: 3, dmg: e.userData.projDmg });
    }
    this.sound.enemyShoot();
  }

  // ---------------- PARTICLES ----------------
  spawnTracer(from, to, color) {
    const dist = from.distanceTo(to);
    if (this.lowMemoryMode && this.tracers.length > 12) return;
    const geo = new THREE.CylinderGeometry(0.018, 0.018, dist, this.lowMemoryMode ? 4 : 6);
    const mat = this.lowMemoryMode ? this.getEffectMaterial('tracer', color, 0.9) : new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to); m.rotateX(Math.PI / 2);
    this.scene.add(m);
    this.tracers.push({ mesh: m, life: 0.07 });
  }

  spawnSparks(pos, color, count, normal) {
    count = this.lowMemoryMode ? Math.min(count, 5) : count;
    if (this.lowMemoryMode && this.particles.length > 48) return;
    const sharedGeo = this.lowMemoryMode ? this.getSparkGeometry() : null;
    const sharedMat = this.lowMemoryMode ? this.getEffectMaterial('spark', color, 1) : null;
    for (let i = 0; i < count; i++) {
      const geo = sharedGeo || new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const mat = sharedMat || new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
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
    this.updateFramePerf(dt);
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

    // determine support height under player (ground, general upper floors, station deck, or train car top)
    let supportY = P.height;          // world floor
    let support = null;
    if (this.elevatedSupports) {
      for (const pl of this.elevatedSupports) {
        if (Math.abs(this.camera.position.x - pl.x) < pl.hw && Math.abs(this.camera.position.z - pl.z) < pl.hd) {
          const top = pl.top + P.height;
          if (this.camera.position.y <= top + 1.05 && top > supportY) { supportY = top; support = 'structure'; }
        }
      }
    }
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
      // extra Rail City elevated platforms and catwalks
      if (rp.platforms) {
        for (const pl of rp.platforms) {
          if (Math.abs(this.camera.position.x - pl.x) < pl.hw && Math.abs(this.camera.position.z - pl.z) < pl.hd) {
            const top = pl.top + P.height;
            if (this.camera.position.y <= top + 0.75 && top > supportY) { supportY = top; support = 'platform'; }
          }
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

    this.updatePortals(dt);

    // pickups
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.rotation.y += dt * 2; it.position.y = 0.6 + Math.sin(Date.now() * 0.004 + i) * 0.12;
      if (this.camera.position.distanceTo(it.position) < 2) {
        this.sound.collect();
        if (it.userData.health) { P.hp = Math.min(P.maxHp, P.hp + 35); this.showMessage('+ HEALTH', '#ff3355'); }
        else { P.weapons.forEach(w => { if (w.name !== 'PISTOL') w.ammo = this.level === 'houseyard' ? Infinity : Math.min(w.maxAmmo, w.ammo + 30); }); this.showMessage(this.level === 'houseyard' ? 'AMMO ALREADY UNLIMITED' : '+ AMMO', '#39ff14'); }
        this.updateHUD();
        this.scene.remove(it); this.disposeObject3D(it); this.items.splice(i, 1);
      }
    }

    // shooting
    const w = P.weapons[P.weaponIdx];
    const now = Date.now();
    const fireRate = (this.dualWield && w.model === 'pistol') ? Math.max(120, this.effectiveWeaponRate(w) * 0.68) : this.effectiveWeaponRate(w);
    if (this.input.shoot && w.ammo > 0 && !this.gunGroup.userData.reloading && now - (w.lastShot || 0) > fireRate) {
      if (this.level !== 'houseyard') w.ammo--;
      else w.ammo = Infinity;
      w.lastShot = now;
      this.fireWeapon(w);
      if (this.shouldEmitWeaponSound(w)) this.sound.shoot(w.name.toLowerCase());
      this.updateHUD();
    }
    // gun sway/return (ADS pulls weapon toward centre)
    const w0 = this.player.weapons[this.player.weaponIdx];
    const adsX = this.aiming ? 0.0 : (this.dualWield && w0.model === 'pistol' ? 0.18 : 0.32), adsY = this.aiming ? -0.18 : -0.3, adsZ = this.aiming ? -0.46 : -0.6;
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
      if (t.life <= 0) { this.scene.remove(t.mesh); this.disposeObject3D(t.mesh); this.tracers.splice(i, 1); }
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
        this.scene.remove(b.mesh); this.disposeObject3D(b.mesh); this.pProj.splice(i, 1);
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
      if (r.life <= 0) { this.scene.remove(r.mesh); this.disposeObject3D(r.mesh); this.rings.splice(i, 1); }
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
      if (consumed || b.life <= 0) { this.scene.remove(b.mesh); this.disposeObject3D(b.mesh); this.tProj.splice(i, 1); }
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
    // shuriken spin in hand
    const sk = this.gunModels && this.gunModels.shuriken;
    if (sk && sk.visible && sk.userData.star) sk.userData.star.rotation.z += dt * 6;
    // pulse cannon barrel spin
    const pulse = this.gunModels && this.gunModels.pulse;
    if (pulse && pulse.userData.spin) {
      const spinDt = this.lowMemoryMode ? Math.min(dt, 1 / 30) : dt;
      pulse.userData.spinV = THREE.MathUtils.lerp(pulse.userData.spinV || 0, 0, spinDt * (this.lowMemoryMode ? 5 : 3));
      pulse.userData.spin.rotation.z -= (pulse.userData.spinV || 0) * spinDt;
    }

    this.trimTransientEffects();

    this._liveAnimAccum = (this._liveAnimAccum || 0) + dt;
    const liveAnimStep = this.lowMemoryMode ? (this.framePerf && this.framePerf.slow ? 1 / 12 : 1 / 18) : 0;
    const runLiveAnimations = !liveAnimStep || this._liveAnimAccum >= liveAnimStep;
    const animDt = runLiveAnimations ? (liveAnimStep ? this._liveAnimAccum : dt) : 0;
    if (runLiveAnimations) this._liveAnimAccum = 0;

    // MEGAWATT CITY live props
    if (runLiveAnimations) {
    if (this.megaProps) {
      const mp = this.megaProps, t = performance.now() * 0.001;
      mp.vehicles.forEach(v => {
        v.pos += v.dir * v.speed * animDt;
        if (v.pos > mp.span) v.pos = -mp.span; else if (v.pos < -mp.span) v.pos = mp.span;
        if (v.lane.axis === 'x') v.mesh.position.x = v.pos; else v.mesh.position.z = v.pos;
      });
      mp.orbs.forEach((o, i) => {
        o.userData.angle += animDt * o.userData.speed;
        o.position.x = Math.cos(o.userData.angle + i) * o.userData.radius;
        o.position.z = Math.sin(o.userData.angle * 0.7 + i) * o.userData.radius;
        o.position.y = o.userData.yOff + Math.sin(t * 1.8 + i) * 0.4 * mp.S;
      });
      mp.ring.rotation.y += animDt * 0.6;
      mp.ring.rotation.x = Math.sin(t * 0.5) * 0.2;
      mp.orb.rotation.y += animDt * 0.5;
      mp.orbLight.intensity = 2.2 + Math.sin(t * 1.2) * 0.6;
      mp.dust.rotation.y += animDt * 0.02;
    }

    // RAIL CITY live props (rideable train + day/night cycle)
    if (this.railProps) {
      const rp = this.railProps, t = performance.now() * 0.001;
      // move train along the loop; position each car and record movement delta for carrying
      rp.progress = (rp.progress + animDt * 0.018) % 1;
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
        v.pos += v.dir * v.speed * animDt;
        if (v.pos > rp.span) v.pos = -rp.span; else if (v.pos < -rp.span) v.pos = rp.span;
        if (v.lane.axis === 'x') v.mesh.position.x = v.pos; else v.mesh.position.z = v.pos;
      });
      // birds
      rp.birds.forEach(b => {
        b.userData.x += b.userData.vx * animDt; b.userData.z += b.userData.vz * animDt;
        if (Math.abs(b.userData.x) > 50 * rp.S * 0.6) b.userData.vx *= -1;
        if (Math.abs(b.userData.z) > 50 * rp.S * 0.6) b.userData.vz *= -1;
        b.position.set(b.userData.x, b.userData.y + Math.sin(t * 3.5 + b.userData.x) * 1.2, b.userData.z);
        b.userData.flap += animDt * 8; b.rotation.z = Math.sin(b.userData.flap) * 0.55;
        b.rotation.y = Math.atan2(b.userData.vx, b.userData.vz);
      });
      // clouds
      rp.clouds.forEach(c => {
        c.position.x += c.userData.sx * animDt; c.position.z += c.userData.sz * animDt;
        if (Math.abs(c.position.x) > 56 * rp.S * 0.6) c.userData.sx *= -1;
        if (Math.abs(c.position.z) > 56 * rp.S * 0.6) c.userData.sz *= -1;
      });
      rp.monOrb.rotation.y += animDt * 0.5;
      if (rp.orbRing) { rp.orbRing.rotation.y += animDt * 0.55; rp.orbRing.rotation.z = Math.sin(t * 0.7) * 0.22; }
      if (rp.lightProps) rp.lightProps.forEach((mesh, i) => { if (mesh.material && mesh.material.emissiveIntensity !== undefined) mesh.material.emissiveIntensity = (mesh.material.userData && mesh.material.userData.baseGlow) || (0.72 + Math.sin(t * 2.2 + i) * 0.18); });
      if (rp.gantries) rp.gantries.forEach((g, i) => { g.rotation.y += Math.sin(t * 0.22 + i) * 0.0009; });
      if (rp.haze) rp.haze.forEach((h, i) => { h.position.y += Math.sin(t * 0.35 + i) * animDt * 0.18; h.material.opacity = 0.045 + Math.sin(t * 0.5 + i) * 0.018; });

      // day↔night cycle (~90s full loop)
      rp.cycle = (rp.cycle + animDt / 90) % 1;
      const ph = rp.cycle; // 0=dawn .. .5=dusk .. 1=dawn
      // daylight factor: 1 at noon (0.25), 0 at midnight (0.75)
      const day = Math.max(0, Math.cos((ph - 0.25) * Math.PI * 2)) ; // peaks at noon
      const night = 1 - day;
      // modulate bloom with the cycle: subtle by day, strong at night
      if (this.bloom) { this.bloom.strength = 0.3 + night * 0.6; this.bloom.threshold = 0.9 - night * 0.28; }
      const dayCol = new THREE.Color(0x233b70), duskCol = new THREE.Color(0xf2914e), nightCol = new THREE.Color(0x090d22);
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
        f.light.intensity = f.base + Math.sin(t * 9 + f.ph) * 0.7 + Math.random() * 0.2;
        f.fire.scale.setScalar(1 + Math.sin(t * 11 + f.ph) * 0.16);
      });
      dp.ankhs.forEach((a, i) => a.rotation.y += animDt * (i % 2 ? -0.6 : 0.6));
      dp.birds.forEach(b => {
        b.userData.x += b.userData.vx * animDt; b.userData.z += b.userData.vz * animDt;
        if (Math.abs(b.userData.x) > 40 * dp.S * 0.6) b.userData.vx *= -1;
        if (Math.abs(b.userData.z) > 38 * dp.S * 0.6) b.userData.vz *= -1;
        b.position.set(b.userData.x, b.userData.y + Math.sin(t * 2.5 + b.userData.x) * 1.0, b.userData.z);
        b.rotation.y = Math.atan2(b.userData.vx, b.userData.vz);
        b.rotation.z = Math.sin(t * 5 + b.userData.x) * 0.4;
      });
      dp.sandP.rotation.y += animDt * 0.012;
      dp.fireflies.rotation.y += animDt * 0.04;
    }

    // JAPAN live props — falling cherry petals + lantern flicker
    if (this.japanProps) {
      const jp = this.japanProps, t = performance.now() * 0.001;
      const arr = jp.petals.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= animDt * 1.4;                       // fall
        arr[i] += Math.sin(t * 1.5 + i) * animDt * 0.5;   // sway
        if (arr[i + 1] < 0) { arr[i + 1] = 28 + Math.random() * 4; }
      }
      jp.petals.geometry.attributes.position.needsUpdate = true;
      jp.lanternLights.forEach(l => { l.light.intensity = l.base + Math.sin(t * 6 + l.ph) * 0.18; });
      if (jp.hangLanterns) jp.hangLanterns.forEach(l => {
        const pulse = l.base + Math.sin(t * 4 + l.ph) * 0.3;
        if (l.mesh) l.mesh.material.emissiveIntensity = pulse;
        if (l.light) l.light.intensity = 0.7 + Math.sin(t * 4 + l.ph) * 0.2;
        if (l.mesh) l.mesh.position.y += Math.sin(t * 2 + l.ph) * 0.0006;
      });
    }
    }
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.life -= dt;
      if (p.grav) p.vel.y -= 14 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.mesh.material.opacity = Math.max(0, p.life * 2);
      p.mesh.scale.multiplyScalar(1 - dt * 1.5);
      if (p.life <= 0) { this.scene.remove(p.mesh); this.disposeObject3D(p.mesh); this.particles.splice(i, 1); }
    }
    // enemy projectiles
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      const prevBulletPos = b.mesh.position.clone();
      b.mesh.position.add(b.vel.clone().multiplyScalar(dt)); b.life -= dt;
      if (this.worldBlocksSegment(prevBulletPos, b.mesh.position, 0.02)) {
        this.spawnSparks(b.mesh.position.clone(), 0xffd089, 4);
        this.scene.remove(b.mesh); this.disposeObject3D(b.mesh); this.eBullets.splice(i, 1);
        continue;
      }
      if (this.camera.position.distanceTo(b.mesh.position) < 1.1 && !this.worldBlocksSegment(b.mesh.position, this.camera.position.clone(), 0.12)) {
        P.hp -= b.dmg; this.damageFlash(); this.sound.damage(); this.updateHUD();
        this.scene.remove(b.mesh); this.disposeObject3D(b.mesh); this.eBullets.splice(i, 1);
        if (P.hp <= 0) this.endGame();
        continue;
      }
      if (b.life <= 0) { this.scene.remove(b.mesh); this.disposeObject3D(b.mesh); this.eBullets.splice(i, 1); }
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

      if (ud.ranged) {
        // keep at range, strafe a bit
        const desired = ud.range || 26;
        const dir = toPlayer.clone(); dir.y = 0; dir.normalize();
        if (dist2D > desired + 4) e.position.add(dir.multiplyScalar(ud.speed * dt));
        else if (dist2D < desired - 6) e.position.add(dir.multiplyScalar(-ud.speed * dt));
        e.lookAt(this.camera.position.x, e.position.y, this.camera.position.z);
        if (ud.fly) e.position.y = (ud.altitude || 7) + Math.sin(time) * 0.45;
        else if (ud.hover) e.position.y = Math.sin(time) * 0.25;
        // fire
        if (Date.now() - ud.lastFire > ud.fireRate && dist2D < (ud.range || 26) + 12) {
          ud.lastFire = Date.now(); this.enemyFire(e);
          if (ud.parts.orb) ud.parts.orb.scale.setScalar(1.6);
        }
        if (ud.parts && ud.parts.orb) ud.parts.orb.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 4);
        // boss also melees if close
        if (ud.boss && dist2D < 3.5 && this.canEnemyDamagePlayer(e, true)) { P.hp -= ud.dmg * dt; this.damageFlash(); this.updateHUD(); if (P.hp <= 0) this.endGame(); }
      } else {
        // melee chaser
        const atkRange = ud.boss ? 3.5 : 1.6 + (ud.type === 'tank' ? 0.6 : 0);
        if (dist2D > atkRange) {
          const dir = toPlayer.clone(); dir.y = 0; dir.normalize();
          e.position.add(dir.multiplyScalar(ud.speed * dt));
          e.lookAt(this.camera.position.x, e.position.y, this.camera.position.z);
          // walk animation
          const sw = ud.crawl ? 1.2 : 0.6;
          if (ud.parts && ud.parts.legs) ud.parts.legs.forEach((l, k) => l.rotation.x = Math.sin(time * (ud.crawl ? 2 : 1) + (k % 2) * Math.PI) * sw);
          if (ud.parts && ud.parts.arms) ud.parts.arms.forEach((a, k) => a.rotation.x = Math.sin(time + (k % 2) * Math.PI) * 0.5);
        } else if (this.canEnemyDamagePlayer(e, true)) {
          P.hp -= ud.dmg * dt; this.damageFlash(); this.updateHUD();
          if (ud.parts && ud.parts.arms) ud.parts.arms.forEach(a => a.rotation.x = -Math.PI / 2.2);
          if (P.hp <= 0) this.endGame();
        }
      }
    }

    // boss bar
    if (this.bosses && this.bosses.length) {
      const liveBosses = this.bosses.filter(b => this.enemies.includes(b));
      this.bosses = liveBosses;
      this.boss = liveBosses[0] || null;
      const hp = liveBosses.reduce((sum, b) => sum + Math.max(0, b.userData.hp), 0);
      const maxHp = liveBosses.reduce((sum, b) => sum + Math.max(1, b.userData.maxHp), 0);
      document.getElementById('boss-bar-wrap').classList.toggle('hidden', liveBosses.length === 0);
      document.getElementById('boss-bar').style.width = maxHp ? Math.max(0, hp / maxHp * 100) + '%' : '0%';
    } else if (this.boss) {
      document.getElementById('boss-bar').style.width = Math.max(0, this.boss.userData.hp / this.boss.userData.maxHp * 100) + '%';
    }

    // next wave
    this.updateWaveCountdown(dt);
    if (this.enemies.length === 0 && !this.waveCountdown) {
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
    const w = this.player.weapons[this.player.weaponIdx];
    document.getElementById('weapon-name').innerText = (this.dualWield && w.model === 'pistol') ? 'DUAL PISTOLS' : w.name;
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

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
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


Game.setupBootOverlay = function() {
  const overlay = document.getElementById('preload-overlay');
  const dismiss = document.getElementById('preload-dismiss');
  if (dismiss && overlay && !dismiss.dataset.bound) {
    dismiss.dataset.bound = '1';
    dismiss.addEventListener('click', () => Game.hideBootOverlay(true));
  }
};

Game.updateBootStatus = function(label, progress, detail) {
  Game.setupBootOverlay();
  const overlay = document.getElementById('preload-overlay');
  const status = document.getElementById('preload-status');
  const desc = document.getElementById('preload-detail');
  const bar = document.getElementById('preload-bar');
  if (!overlay) return;
  overlay.classList.remove('done');
  overlay.hidden = false;
  if (status) status.textContent = label || 'WARMING UP';
  if (desc) desc.textContent = detail || '';
  if (bar) bar.style.width = Math.max(0, Math.min(100, progress || 0)) + '%';
};

Game.hideBootOverlay = function(manual) {
  const overlay = document.getElementById('preload-overlay');
  if (!overlay) return;
  overlay.classList.add('done');
  if (manual) overlay.dataset.dismissed = '1';
  setTimeout(() => { overlay.hidden = true; }, 520);
};

window.onload = () => {
  Game.updateBootStatus('LOADING TEXTURES', 8, 'Loading photo textures and procedural fallbacks.');
  TextureGen.load(() => {
  Game.updateBootStatus('STARTING ENGINE', 18, 'Creating renderer, controls, weapons, and menu systems.');
    try { window.game = new Game(); }
    catch (err) { Game.showFatalStartupError('The game failed to initialize. Check the browser console for details.', err); }
  });
};
addEventListener('resize', () => {
  if (window.game && game.camera && game.renderer) {
    game.camera.aspect = innerWidth / innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(innerWidth, innerHeight);
    if (game.composer) game.composer.setSize(innerWidth, innerHeight);
  }
});
