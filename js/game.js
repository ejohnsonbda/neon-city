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
    this.level = 'openworld';
    this.megaProps = null;
    this.railProps = null;
    this.desertProps = null;
    this.japanProps = null;

    // ===== GOLEM RUSH: SINGLE MASSIVE FANTASY REALM (5km x 5km) =====
    // No sectors, no levels — one continuous world
    this.sectors = [
      { name: 'FANTASY REALM', key: 'realm', offset: [0, 0], radius: 2500, color: '#ffb347' },
    ];
    this.currentSector = this.sectors[0];
    this._lastSectorName = '';

    // ---- Animated Gradient Sky ----
    this.scene.background = null;
    this.scene.fog = new THREE.FogExp2(0x8ecae6, 0.00035);
    const skyGeo = new THREE.SphereGeometry(6000, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTime: { value: 0 },
        uLeftColor1: { value: new THREE.Color(0xf5d6a8) },
        uLeftColor2: { value: new THREE.Color(0xf5b56b) },
        uRightColor1: { value: new THREE.Color(0x7a8ba8) },
        uRightColor2: { value: new THREE.Color(0x4a6a8a) },
        uTopColor: { value: new THREE.Color(0xd4e4f7) },
        uBottomColor: { value: new THREE.Color(0xb8c8d8) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uLeftColor1, uLeftColor2, uRightColor1, uRightColor2, uTopColor, uBottomColor;
        varying vec3 vPos;
        void main() {
          vec3 dir = normalize(vPos);
          float t1 = 0.5 + 0.5 * sin(uTime * 0.05);
          float t2 = 0.5 + 0.5 * sin(uTime * 0.07 + 1.2);
          vec3 leftColor = mix(uLeftColor1, uLeftColor2, t1);
          vec3 rightColor = mix(uRightColor1, uRightColor2, t2);
          float t = (dir.x + 1.0) * 0.5;
          vec3 horizonColor = mix(leftColor, rightColor, t);
          float h = (dir.y + 1.0) * 0.5;
          vec3 skyColor = mix(uBottomColor, uTopColor, h);
          float horizonWeight = 1.0 - abs(dir.y) * 0.6;
          vec3 finalColor = mix(skyColor, horizonColor, horizonWeight);
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });
    this._skyMat = skyMat;
    this.worldGroup.add(new THREE.Mesh(skyGeo, skyMat));

    // ---- Clouds (groups of translucent spheres orbiting) ----
    this._clouds = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const cg = new THREE.Group();
      const opacity = 0.3 + Math.random() * 0.3;
      const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: opacity, roughness: 0.1, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
      const count = 8 + Math.floor(Math.random() * 12);
      for (let j = 0; j < count; j++) {
        const size = 20 + Math.random() * 60;
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 6), cloudMat);
        const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 80;
        sphere.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 15, Math.sin(a) * r);
        sphere.scale.y = 0.3 + Math.random() * 0.3;
        cg.add(sphere);
      }
      // Base discs
      const baseMat = new THREE.MeshStandardMaterial({ color: 0xeeeeff, transparent: true, opacity: 0.15, roughness: 0.2, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
      for (let j = 0; j < 4; j++) {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(40 + Math.random() * 60, 8), baseMat);
        disc.rotation.x = -Math.PI / 2;
        disc.position.set((Math.random() - 0.5) * 100, -10 + Math.random() * 10, (Math.random() - 0.5) * 100);
        cg.add(disc);
      }
      const angle = Math.random() * Math.PI * 2;
      const radius = 500 + Math.random() * 2000;
      cg.position.set(Math.cos(angle) * radius, 300 + Math.random() * 200, Math.sin(angle) * radius);
      cg.scale.setScalar(0.6 + Math.random() * 1.2);
      cg.rotation.y = Math.random() * Math.PI * 2;
      cg.userData = { speed: 0.001 + Math.random() * 0.003, angle: angle, radius: radius, drift: (Math.random() - 0.5) * 0.001 };
      this._clouds.add(cg);
    }
    this.worldGroup.add(this._clouds);

    // ---- MASSIVE ROLLING TERRAIN (5km x 5km) ----
    const groundSize = 5000;
    const segments = 128;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, segments, segments);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let y = 0;
      // Large rolling hills
      y += Math.sin(x * 0.0006) * Math.cos(z * 0.00048) * 150.0;
      y += Math.sin(x * 0.001 + z * 0.0008) * 75.0;
      y += Math.max(0, Math.sin((x - 250) * 0.0008) * 100.0 * Math.exp(-z * z * 0.0000008));
      y -= Math.max(0, Math.sin(-x * 0.0006) * 75.0 * Math.exp(-z * z * 0.0000012));
      // Medium bumps
      y += Math.sin(x * 0.0024 + z * 0.002) * 20.0;
      // Small detail
      y += Math.sin(x * 0.008 + z * 0.007) * 3.0;
      pos.setY(i, y);
    }
    groundGeo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x6a9a5a, roughness: 0.9, metalness: 0.0, flatShading: false, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    this.worldGroup.add(ground);
    this._fantasyGround = ground;

    // Helper: sample ground height at (x,z)
    this._getGroundY = (x, z) => {
      let y = 0;
      y += Math.sin(x * 0.0006) * Math.cos(z * 0.00048) * 150.0;
      y += Math.sin(x * 0.001 + z * 0.0008) * 75.0;
      y += Math.max(0, Math.sin((x - 250) * 0.0008) * 100.0 * Math.exp(-z * z * 0.0000008));
      y -= Math.max(0, Math.sin(-x * 0.0006) * 75.0 * Math.exp(-z * z * 0.0000012));
      y += Math.sin(x * 0.0024 + z * 0.002) * 20.0;
      y += Math.sin(x * 0.008 + z * 0.007) * 3.0;
      return y - 2;
    };

    // ---- Tan/dirt patches (scattered across the terrain) ----
    const patchColors = [0x8a7a4a, 0x9a8a5a, 0x7a6a3a, 0x4a7a3a, 0x5a8a4a];
    for (let i = 0; i < 200; i++) {
      const color = patchColors[(Math.random() * patchColors.length) | 0];
      const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 1.0, metalness: 0, transparent: true, opacity: 0.2 + Math.random() * 0.1, depthWrite: false });
      const radius = 30 + Math.random() * 80;
      const patch = new THREE.Mesh(new THREE.CircleGeometry(radius, 6), mat);
      const a = Math.random() * Math.PI * 2, d = 100 + Math.random() * 2000;
      const px = Math.cos(a) * d, pz = Math.sin(a) * d;
      patch.position.set(px, this._getGroundY(px, pz) + 0.1, pz);
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = Math.random() * Math.PI;
      this.worldGroup.add(patch);
    }

    // ---- GIANT STONE COLUMNS (scattered across the realm) ----
    const colMat = new THREE.MeshStandardMaterial({ color: 0x7a7a8a, roughness: 0.8, metalness: 0.05, flatShading: true });
    const columnPositions = [];
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 100 + Math.random() * 2000;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      // Avoid clustering
      let tooClose = false;
      for (const p of columnPositions) {
        if (Math.hypot(p[0] - x, p[1] - z) < 60) { tooClose = true; break; }
      }
      if (tooClose) continue;
      columnPositions.push([x, z]);

      const height = 30 + Math.random() * 60;
      const radius = 4 + Math.random() * 7;
      const g = new THREE.Group();
      // Shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius, height, 8), colMat);
      shaft.position.y = height / 2; shaft.castShadow = true; shaft.receiveShadow = true; g.add(shaft);
      // Capital
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.1, radius * 0.9, height * 0.08, 8), colMat);
      cap.position.y = height + height * 0.04; cap.castShadow = true; g.add(cap);
      // Base
      const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.2, radius * 1.4, height * 0.1, 8), colMat);
      base.position.y = height * 0.05; base.castShadow = true; g.add(base);
      // Crack details
      const detailMat = new THREE.MeshStandardMaterial({ color: 0x5a5a6a, roughness: 0.9, flatShading: true });
      for (let j = 0; j < 4; j++) {
        const detail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1 + Math.random() * 2, 0.5), detailMat);
        const da = Math.random() * Math.PI * 2;
        detail.position.set(Math.cos(da) * radius * 0.6, 5 + Math.random() * (height - 10), Math.sin(da) * radius * 0.6);
        detail.rotation.set(Math.random() * 0.3, Math.random() * 0.3, Math.random() * 0.3);
        g.add(detail);
      }
      const gy = this._getGroundY(x, z);
      g.position.set(x, gy - 1, z);
      g.rotation.y = Math.random() * Math.PI * 2;
      this.worldGroup.add(g);
      this.objects.push(shaft);
    }

    // ---- ROCK ARCHES ----
    const archMat = new THREE.MeshStandardMaterial({ color: 0x7a7a8a, roughness: 0.85, metalness: 0.05, flatShading: true });
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 150 + Math.random() * 2000;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      let tooClose = false;
      for (const p of columnPositions) {
        if (Math.hypot(p[0] - x, p[1] - z) < 80) { tooClose = true; break; }
      }
      if (tooClose) continue;

      const span = 20 + Math.random() * 30;
      const height = 15 + Math.random() * 25;
      const thick = 3.5 + Math.random() * 3;
      const g = new THREE.Group();
      // Two pillars
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.6, thick * 0.8, height, 6), archMat);
      p1.position.set(-span / 2, height / 2, 0); p1.castShadow = true; g.add(p1);
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.6, thick * 0.8, height, 6), archMat);
      p2.position.set(span / 2, height / 2, 0); p2.castShadow = true; g.add(p2);
      // Arch top (torus)
      const archTop = new THREE.Mesh(new THREE.TorusGeometry(span / 2, thick * 0.6, 8, 12, Math.PI), archMat);
      archTop.position.set(0, height, 0); archTop.rotation.x = Math.PI / 2; archTop.rotation.z = Math.PI / 2;
      archTop.scale.y = 1.2; archTop.castShadow = true; g.add(archTop);
      // Extra rocks on top
      const rockDetailMat = new THREE.MeshStandardMaterial({ color: 0x6a6a7a, roughness: 0.9, flatShading: true });
      for (let j = 0; j < 6; j++) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + Math.random() * 2.5, 0), rockDetailMat);
        const ra = (j / 6) * Math.PI + Math.random() * 0.3;
        rock.position.set(Math.cos(ra) * span * 0.35, height + 3 + Math.random() * 4, Math.sin(ra) * span * 0.2);
        rock.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        rock.castShadow = true; g.add(rock);
      }
      const gy = this._getGroundY(x, z);
      g.position.set(x, gy - 1, z);
      g.rotation.y = Math.random() * Math.PI * 2;
      this.worldGroup.add(g);
      this.objects.push(p1);
      this.objects.push(p2);
    }

    // ---- FLOATING ROCKS ----
    this._floatingRocks = [];
    const floatColors = [0x7a8a8a, 0x8a7a7a, 0x6a7a7a, 0x9a8a7a, 0x5a6a7a, 0x7a6a7a];
    for (let i = 0; i < 50; i++) {
      const size = 8 + Math.random() * 25;
      const geo = new THREE.DodecahedronGeometry(size, 0);
      const p = geo.attributes.position;
      for (let j = 0; j < p.count; j++) {
        const scale = 1 + (Math.random() - 0.5) * 0.08;
        p.setXYZ(j, p.getX(j) * scale, p.getY(j) * scale, p.getZ(j) * scale);
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ color: floatColors[(Math.random() * floatColors.length) | 0], roughness: 0.8, metalness: 0.05, flatShading: true });
      const rock = new THREE.Mesh(geo, mat);
      const a = Math.random() * Math.PI * 2, r = 100 + Math.random() * 2000;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const baseGy = this._getGroundY(x, z);
      const y = baseGy + 50 + Math.random() * 150;
      rock.position.set(x, y, z);
      rock.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      rock.scale.set(1, 0.6 + Math.random() * 0.4, 1);
      rock.castShadow = true;
      rock.userData = { floatSpeed: 0.1 + Math.random() * 0.2, floatPhase: Math.random() * Math.PI * 2, baseY: y, rotSpeed: (Math.random() - 0.5) * 0.005 };
      this.worldGroup.add(rock);
      this._floatingRocks.push(rock);
    }
    // Tiny floating pebbles
    for (let i = 0; i < 80; i++) {
      const size = 2 + Math.random() * 5;
      const geo = new THREE.IcosahedronGeometry(size, 1);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8a8a7a, roughness: 0.85, flatShading: true });
      const rock = new THREE.Mesh(geo, mat);
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 2200;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const baseGy = this._getGroundY(x, z);
      const y = baseGy + 30 + Math.random() * 120;
      rock.position.set(x, y, z);
      rock.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      rock.userData = { floatSpeed: 0.15 + Math.random() * 0.3, floatPhase: Math.random() * Math.PI * 2, baseY: y, rotSpeed: (Math.random() - 0.5) * 0.01 };
      this.worldGroup.add(rock);
      this._floatingRocks.push(rock);
    }

    // ---- TREES (Pine, Twisted, Large Canopy) ----
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 });
    const foliageMats = [
      new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 0.8, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x4a8a4a, roughness: 0.7, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x2a6a2a, roughness: 0.8, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x5a9a4a, roughness: 0.7, flatShading: true }),
    ];
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x3a8a3a, roughness: 0.6, flatShading: true });

    // Pine trees (scattered across the realm)
    for (let i = 0; i < 300; i++) {
      const g = new THREE.Group();
      const h = 10 + Math.random() * 20;
      const trunkH = 3 + Math.random() * 4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.0, trunkH, 6), trunkMat);
      trunk.position.y = trunkH / 2; trunk.castShadow = true; g.add(trunk);
      const layers = 3 + Math.floor(Math.random() * 3);
      const fMat = foliageMats[(Math.random() * foliageMats.length) | 0];
      for (let j = 0; j < layers; j++) {
        const r = 2.5 + (layers - j) * 1.5 + Math.random();
        const lh = 3 + Math.random() * 2;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, lh, 7), fMat);
        cone.position.y = trunkH + j * (lh * 0.7) + lh / 2;
        cone.castShadow = true; g.add(cone);
      }
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 2300;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const gy = this._getGroundY(x, z);
      g.position.set(x, gy - 1, z);
      g.scale.setScalar(0.8 + Math.random() * 0.8);
      g.rotation.y = Math.random() * Math.PI * 2;
      this.worldGroup.add(g);
      this.objects.push(trunk);
    }

    // Large canopy trees
    for (let i = 0; i < 60; i++) {
      const g = new THREE.Group();
      const h = 18 + Math.random() * 10;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 3.0, h * 0.5, 8), trunkMat);
      trunk.position.y = h * 0.25; trunk.castShadow = true; g.add(trunk);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(8 + Math.random() * 4, 7, 7), canopyMat);
      canopy.position.y = h * 0.55 + Math.random();
      canopy.scale.set(1 + Math.random() * 0.4, 0.8 + Math.random() * 0.3, 1 + Math.random() * 0.4);
      canopy.castShadow = true; g.add(canopy);
      // Sub-canopy clumps
      for (let j = 0; j < 5; j++) {
        const clump = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 2.5, 6, 6), canopyMat);
        const ca = (j / 5) * Math.PI * 2 + Math.random() * 0.3;
        const cr = 5 + Math.random() * 3;
        clump.position.set(Math.cos(ca) * cr, h * 0.45 + Math.random() * 2, Math.sin(ca) * cr);
        clump.castShadow = true; g.add(clump);
      }
      // Exposed roots
      for (let j = 0; j < 6; j++) {
        const root = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.5, 2 + Math.random() * 2, 4), trunkMat);
        const ra = (j / 6) * Math.PI * 2 + Math.random() * 0.2;
        const rr = 1.5 + Math.random() * 1.2;
        root.position.set(Math.cos(ra) * rr, 0.1, Math.sin(ra) * rr);
        root.rotation.set((Math.random() - 0.5) * 1.0, ra, (Math.random() - 0.5) * 1.0);
        g.add(root);
      }
      const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 2200;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const gy = this._getGroundY(x, z);
      g.position.set(x, gy - 1, z);
      g.scale.setScalar(0.8 + Math.random() * 0.5);
      g.rotation.y = Math.random() * Math.PI * 2;
      this.worldGroup.add(g);
      this.objects.push(trunk);
    }

    // Twisted trees
    for (let i = 0; i < 50; i++) {
      const g = new THREE.Group();
      const twistedMat = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.9 });
      const tFoliage = new THREE.MeshStandardMaterial({ color: 0x4a8a4a, roughness: 0.7, flatShading: true });
      const segs = 5 + Math.floor(Math.random() * 4);
      let yPos = 0, prevX = 0, prevZ = 0;
      for (let j = 0; j < segs; j++) {
        const segH = 2 + Math.random() * 2;
        const rad = 0.7 - j * 0.05;
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.7, rad, segH, 6), twistedMat);
        const ox = (Math.random() - 0.5) * 1.0, oz = (Math.random() - 0.5) * 1.0;
        seg.position.set(prevX + ox * 0.5, yPos + segH / 2, prevZ + oz * 0.5);
        seg.rotation.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
        seg.castShadow = true; g.add(seg);
        yPos += segH; prevX += ox; prevZ += oz;
      }
      const canopySize = 5 + Math.random() * 3;
      const tc = new THREE.Mesh(new THREE.SphereGeometry(canopySize, 6, 6), tFoliage);
      tc.position.set(prevX * 0.5, yPos + 1, prevZ * 0.5);
      tc.scale.y = 0.7 + Math.random() * 0.3;
      tc.castShadow = true; g.add(tc);
      for (let j = 0; j < 4; j++) {
        const sm = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random() * 1.2, 5, 5), tFoliage);
        const sa = Math.random() * Math.PI * 2, sr = 2.5 + Math.random() * 2;
        sm.position.set(prevX * 0.5 + Math.cos(sa) * sr, yPos + 0.5 + Math.random() * 2, prevZ * 0.5 + Math.sin(sa) * sr);
        sm.castShadow = true; g.add(sm);
      }
      const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 2000;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const gy = this._getGroundY(x, z);
      g.position.set(x, gy - 1, z);
      g.scale.setScalar(0.7 + Math.random() * 0.5);
      g.rotation.y = Math.random() * Math.PI * 2;
      this.worldGroup.add(g);
    }

    // ---- BUSHES ----
    for (let i = 0; i < 400; i++) {
      const g = new THREE.Group();
      const baseHue = 0.28 + (Math.random() - 0.5) * 0.06;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(baseHue + Math.random() * 0.06, 0.4, 0.3 + Math.random() * 0.15),
        roughness: 0.8, flatShading: true
      });
      const count = 3 + Math.floor(Math.random() * 5);
      for (let j = 0; j < count; j++) {
        const r = 1.0 + Math.random() * 1.8;
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 5, 5), mat);
        const ba = Math.random() * Math.PI * 2, bd = Math.random() * 1.5;
        sphere.position.set(Math.cos(ba) * bd, r * 0.6, Math.sin(ba) * bd);
        sphere.castShadow = true; g.add(sphere);
      }
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 2300;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const gy = this._getGroundY(x, z);
      g.position.set(x, gy - 1, z);
      g.scale.setScalar(0.6 + Math.random() * 0.8);
      g.rotation.y = Math.random() * Math.PI * 2;
      this.worldGroup.add(g);
    }

    // ---- GRASS TUFTS ----
    const grassColors = [0x4a8a3a, 0x5a9a4a, 0x6a8a4a, 0x3a7a3a, 0x7a9a5a, 0x5a7a3a];
    for (let i = 0; i < 600; i++) {
      const g = new THREE.Group();
      const color = grassColors[(Math.random() * grassColors.length) | 0];
      const gMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.9, flatShading: true });
      const height = 0.8 + Math.random() * 1.5;
      const count = 4 + Math.floor(Math.random() * 6);
      for (let j = 0; j < count; j++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.1, height * (0.5 + Math.random() * 0.8), 3), gMat);
        const ba = Math.random() * Math.PI * 2, bd = Math.random() * 0.8;
        blade.position.set(Math.cos(ba) * bd, height * 0.2, Math.sin(ba) * bd);
        blade.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5);
        g.add(blade);
      }
      const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 2400;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const gy = this._getGroundY(x, z);
      g.position.set(x, gy - 1, z);
      g.scale.setScalar(0.6 + Math.random() * 1.2);
      g.rotation.y = Math.random() * Math.PI * 2;
      this.worldGroup.add(g);
    }

    // ---- WILDFLOWERS ----
    const flowerColors = [0xff6b6b, 0xffb347, 0xffd93d, 0x6bcb77, 0x4d96ff, 0x9b59b6];
    for (let i = 0; i < 300; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: flowerColors[(Math.random() * flowerColors.length) | 0], roughness: 0.7, emissive: 0x221100, emissiveIntensity: 0.02 });
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.2 + Math.random() * 0.25, 5, 5), mat);
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 2200;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const gy = this._getGroundY(x, z);
      flower.position.set(x, gy - 0.8, z);
      this.worldGroup.add(flower);
    }

    // ---- GROUND BOULDERS (for cover during combat) ----
    const boulderMat = new THREE.MeshStandardMaterial({ color: 0x6a6a7a, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 150; i++) {
      const size = 2 + Math.random() * 5;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), boulderMat);
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 2300;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const gy = this._getGroundY(x, z);
      rock.position.set(x, gy - 1 + size * 0.3, z);
      rock.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      rock.scale.set(1, 0.5 + Math.random() * 0.5, 1);
      rock.castShadow = true;
      this.worldGroup.add(rock);
      this.objects.push(rock);
    }

    // ---- LIGHTING (warm fantasy sun) ----
    this.worldGroup.add(new THREE.AmbientLight(0x445566, 0.3));
    this.worldGroup.add(new THREE.HemisphereLight(0xffeedd, 0x445566, 0.5));
    const sun = new THREE.DirectionalLight(0xffcc88, 2.5);
    sun.position.set(-800, 600, 500); sun.castShadow = true; sun.shadow.bias = -0.001;
    sun.shadow.camera.left = -600; sun.shadow.camera.right = 600;
    sun.shadow.camera.top = 600; sun.shadow.camera.bottom = -600;
    sun.shadow.camera.far = 2000; sun.shadow.mapSize.set(2048, 2048);
    this.worldGroup.add(sun);
    this._worldMoon = sun;
    const fill = new THREE.DirectionalLight(0x6688bb, 0.5);
    fill.position.set(400, 300, -400); this.worldGroup.add(fill);
    const rim = new THREE.DirectionalLight(0x8899cc, 0.6);
    rim.position.set(600, 200, 300); this.worldGroup.add(rim);

    // ---- ATMOSPHERIC PARTICLES ----
    const particleCount = 1000;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 100 + Math.random() * 2500;
      const theta = Math.random() * Math.PI * 2;
      particlePos[i * 3] = Math.cos(theta) * r;
      particlePos[i * 3 + 1] = 20 + Math.random() * 150;
      particlePos[i * 3 + 2] = Math.sin(theta) * r;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0xffeedd, size: 0.5, transparent: true, opacity: 0.15, depthWrite: false, sizeAttenuation: true });
    this._fantasyParticles = new THREE.Points(particleGeo, particleMat);
    this.worldGroup.add(this._fantasyParticles);

    // ---- EMBERS ----
    const emberCount = 200;
    const emberGeo = new THREE.BufferGeometry();
    const emberPos = new Float32Array(emberCount * 3);
    this._emberData = [];
    for (let i = 0; i < emberCount; i++) {
      const r = 100 + Math.random() * 1500;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = 10 + Math.random() * 80;
      emberPos[i * 3] = x; emberPos[i * 3 + 1] = y; emberPos[i * 3 + 2] = z;
      this._emberData.push({ speed: 0.15 + Math.random() * 0.4, phase: Math.random() * Math.PI * 2, baseX: x, baseY: y, baseZ: z });
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    const emberMat = new THREE.PointsMaterial({ color: 0xffaa66, size: 0.6, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true });
    this._embers = new THREE.Points(emberGeo, emberMat);
    this.worldGroup.add(this._embers);
  }

  // Single-world update (no sector transitions needed, just animations)
  _updateSectors() {
    const t = performance.now() * 0.001;
    // Show realm name once
    if (!this._lastSectorName) {
      this._lastSectorName = 'FANTASY REALM';
      this.showMessage('GOLEM RUSH: FANTASY REALM', '#ffb347', 3000);
    }
    // Animate floating rocks
    if (this._floatingRocks) {
      for (const rock of this._floatingRocks) {
        const d = rock.userData;
        if (d) {
          rock.position.y = d.baseY + Math.sin(t * d.floatSpeed + d.floatPhase) * 3.0;
          rock.rotation.x += d.rotSpeed * 0.5;
          rock.rotation.y += d.rotSpeed;
        }
      }
    }
    // Animate sky shader
    if (this._skyMat && this._skyMat.uniforms) {
      this._skyMat.uniforms.uTime.value = t;
    }
    // Animate clouds
    if (this._clouds) {
      this._clouds.children.forEach(cloud => {
        const d = cloud.userData;
        if (d) {
          const a = d.angle + t * d.speed;
          cloud.position.x = Math.cos(a) * d.radius;
          cloud.position.z = Math.sin(a) * d.radius;
          cloud.position.y += Math.sin(t * d.drift + d.angle) * 0.02;
        }
      });
    }
    // Animate embers
    if (this._embers && this._emberData) {
      const pos = this._embers.geometry.attributes.position.array;
      for (let i = 0; i < this._emberData.length; i++) {
        const d = this._emberData[i];
        pos[i * 3] = d.baseX + Math.sin(t * d.speed + d.phase) * 3.0;
        pos[i * 3 + 1] = d.baseY + Math.sin(t * d.speed * 0.7 + d.phase * 1.3) * 4.0;
        pos[i * 3 + 2] = d.baseZ + Math.cos(t * d.speed * 0.8 + d.phase * 0.7) * 3.0;
      }
      this._embers.geometry.attributes.position.needsUpdate = true;
    }
    // Rotate particles
    if (this._fantasyParticles) {
      this._fantasyParticles.rotation.y = t * 0.001;
    }
    // Single world — always visible, no sector toggling needed
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
    this.gameMusic.forEach(m => { m.pause(); m.currentTime = 0; });
    this.curGameMusic = this.gameMusic[0];
    if (this.curGameMusic) this.curGameMusic.play().catch(() => {});
    // Build the unified open world
    this.buildWorld('openworld');
    this.player.weapons = this.defaultWeapons;
    this.player.weaponIdx = this.startWeaponIdx || 0;
    this.player.hp = this.player.maxHp; this.player.armor = 0; this.score = 0; this.wave = 1;
    this.waveCountdown = null;
    this.player.weapons.forEach(w => w.ammo = w.ammo === Infinity ? Infinity : Math.floor(w.maxAmmo * 0.6));
    this.camera.position.set(0, this.player.height, 0);
    this.player.ridingCar = null; this.player.floorY = this.player.height;
    this.camera.rotation.set(0, 0, 0);
    const todWrap = document.getElementById('tod-chip');
    if (todWrap) todWrap.style.display = 'none';

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
    // Use rock skin for all sectors (unified golem enemies)
    const mesh = EnemyFactory.build(type, 'rock');
    mesh.scale.setScalar(cfg.scale);

    // Spawn around player's current position (open world)
    const px = this.camera.position.x, pz = this.camera.position.z;
    let pos = new THREE.Vector3(), ok = false, tries = 0;
    while (!ok && tries++ < 40) {
      const a = Math.random() * Math.PI * 2, d = (cfg.boss ? 55 : 38) + Math.random() * 55;
      pos.set(px + Math.cos(a) * d, 0, pz + Math.sin(a) * d);
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
      this.showMessage('\u26A0 APEX HORROR INBOUND', '#ff2d95');
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

  showMessage(text, color, duration) {
    const el = document.getElementById('game-message');
    el.innerText = text; el.style.color = color || '#fff'; el.style.opacity = 1;
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => el.style.opacity = 0, duration || 1800);
    // Also update sector indicator if it exists
    const si = document.getElementById('sector-indicator');
    if (si && text.startsWith('ENTERING:')) {
      si.innerText = text.replace('ENTERING: ', '');
      si.style.color = color || '#19f0ff';
      si.style.opacity = 1;
    }
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
    this._updateSectors();
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
    const ctx = this.mmCtx, cx = 75, cy = 75;
    ctx.clearRect(0, 0, 150, 150);
    ctx.fillStyle = 'rgba(6,10,20,0.75)'; ctx.fillRect(0, 0, 150, 150);
    const rot = this.camera.rotation.y;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    // Draw sector indicators (scaled down massively)
    const mapScale = 0.065;
    if (this.sectors) {
      this.sectors.forEach(sec => {
        const dx = sec.offset[0] - this.camera.position.x;
        const dz = sec.offset[1] - this.camera.position.z;
        const rx = (dx * cosR - dz * sinR) * mapScale;
        const ry = (dx * sinR + dz * cosR) * mapScale;
        if (Math.abs(rx) < 72 && Math.abs(ry) < 72) {
          ctx.fillStyle = sec.color + '44';
          ctx.beginPath(); ctx.arc(cx + rx, cy + ry, 18, 0, 6.28); ctx.fill();
          ctx.fillStyle = sec.color + '88';
          ctx.font = '7px Arial'; ctx.textAlign = 'center';
          ctx.fillText(sec.name.split(' ')[0], cx + rx, cy + ry + 2);
        }
      });
    }
    // Nearby buildings
    const bldgScale = 0.42;
    ctx.fillStyle = '#2a3550';
    for (const o of this.objects) {
      if (o.scale && o.scale.y > 4) {
        const dx = o.position.x - this.camera.position.x, dz = o.position.z - this.camera.position.z;
        if (Math.abs(dx) > 200 || Math.abs(dz) > 200) continue;
        const rx = dx * cosR - dz * sinR, ry = dx * sinR + dz * cosR;
        if (Math.abs(rx) < 150 && Math.abs(ry) < 150) ctx.fillRect(cx + rx * bldgScale - 2, cy + ry * bldgScale - 2, 4, 4);
      }
    }
    // Enemies
    for (const e of this.enemies) {
      const dx = e.position.x - this.camera.position.x, dz = e.position.z - this.camera.position.z;
      const rx = (dx * cosR - dz * sinR) * bldgScale, ry = (dx * sinR + dz * cosR) * bldgScale;
      if (Math.abs(rx) < 72 && Math.abs(ry) < 72) {
        ctx.fillStyle = e.userData.boss ? '#ff2d95' : (e.userData.ranged ? '#9b5cff' : '#ff5555');
        ctx.beginPath(); ctx.arc(cx + rx, cy + ry, e.userData.boss ? 5 : 3, 0, 6.28); ctx.fill();
      }
    }
    // Items
    for (const it of this.items) {
      const dx = it.position.x - this.camera.position.x, dz = it.position.z - this.camera.position.z;
      const rx = (dx * cosR - dz * sinR) * bldgScale, ry = (dx * sinR + dz * cosR) * bldgScale;
      if (Math.abs(rx) < 72 && Math.abs(ry) < 72) { ctx.fillStyle = it.userData.health ? '#ff3355' : '#39ff14'; ctx.fillRect(cx + rx - 2, cy + ry - 2, 4, 4); }
    }
    // Player arrow
    ctx.fillStyle = '#19f0ff';
    ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 4, cy + 5); ctx.lineTo(cx + 4, cy + 5); ctx.fill();
    // Sector name overlay
    if (this.currentSector) {
      ctx.fillStyle = this.currentSector.color || '#19f0ff';
      ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
      ctx.fillText(this.currentSector.name, 75, 146);
    }
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
