// ============================================================
//  WORLD — WOBBLETON: a 6-floor brick building + wacky town.
//  Solid stacked floors (lift between them) and a continuous
//  street level you walk out into through the front door.
// ============================================================
const World = (() => {
  const FLOOR_H = 5;
  const FLOOR_COUNT = 6;
  const INT = 15;          // interior half-extent (30x30 room)
  const WALL = 1;
  const TOWN_R = 228;      // walkable town radius (expanded 240%)
  const DOOR_HALF = 2.4;   // door half-width on front (-z) wall

  // ---------- procedural textures ----------
  function brickTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#3a2350'; x.fillRect(0, 0, 256, 256);          // bold dark mortar (toon outline)
    const bw = 64, bh = 32;
    // candy brick palette — mostly warm, with the odd wacky colourful brick
    const warm = [[255, 138, 110], [255, 165, 120], [240, 120, 95], [255, 190, 140]];
    const wacky = [[255, 92, 162], [95, 227, 161], [67, 198, 255], [255, 210, 63], [176, 108, 246]];
    for (let row = 0; row * bh < 256; row++) {
      const off = (row % 2) * (bw / 2);
      for (let col = -1; col * bw < 256; col++) {
        const bx = col * bw + off + 4, by = row * bh + 4;
        const pal = Math.random() < 0.12 ? wacky[Math.random() * wacky.length | 0] : warm[Math.random() * warm.length | 0];
        const j = (Math.random() - 0.5) * 22;
        x.fillStyle = `rgb(${Math.min(255, pal[0] + j) | 0},${Math.min(255, pal[1] + j) | 0},${Math.min(255, pal[2] + j) | 0})`;
        // rounded chunky brick
        roundRect(x, bx, by, bw - 8, bh - 8, 6); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.18)'; roundRect(x, bx, by, bw - 8, 5, 3); x.fill();
      }
    }
    const t = new THREE.Texture(c); t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function roundRect(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
  function floorTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#3a3340'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 64; i++) { x.fillStyle = `rgba(${20 + Math.random() * 40 | 0},${20 + Math.random() * 30 | 0},${30 + Math.random() * 40 | 0},.5)`; x.fillRect(Math.random() * 256, Math.random() * 256, 40, 40); }
    for (let i = 0; i <= 256; i += 64) { x.strokeStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
    const t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function groundTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#4f7a3a'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${40 + Math.random() * 60 | 0},${90 + Math.random() * 70 | 0},${40 + Math.random() * 40 | 0},.6)`; x.fillRect(Math.random() * 256, Math.random() * 256, 3, 7); }
    const t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  let brickTex, floorTex, groundTex;

  function brickMat(repeat) {
    const t = brickTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, metalness: 0 });
  }

  function box(scene, w, h, d, x, y, z, mat, coll, colliders) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    if (coll && colliders) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: y - h / 2, maxY: y + h / 2 });
    return m;
  }

  function build(scene) {
    brickTex = brickTexture(); floorTex = floorTexture(); groundTex = groundTexture();
    const colliders = [];           // town building footprints (AABB)
    const accents = ['#ff2d95', '#19f0ff', '#ffd166', '#9be84a', '#c24bff', '#ff7a18'];

    // ---- sky ----
    scene.background = new THREE.Color('#7fd0ff');
    scene.fog = new THREE.Fog('#9fe0ff', 80, 200);

    // ---- town ground ----
    groundTex.repeat.set(60, 60);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(TOWN_R + 40, 48), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    // plaza around building
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(34, 40), new THREE.MeshStandardMaterial({ color: '#9a93a8', roughness: 1 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true; scene.add(plaza);

    // ---- the 6-floor building ----
    floorTex.repeat.set(6, 6);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#aee9ff', transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0.3, side: THREE.DoubleSide });
    const trimMat = brickMat([2, 0.3]);

    const wallColliders = [];       // building wall AABBs (per floor handled by clamp instead)
    for (let L = 0; L < FLOOR_COUNT; L++) {
      const y0 = L * FLOOR_H;
      // floor slab
      const slab = new THREE.Mesh(new THREE.BoxGeometry((INT + WALL) * 2, 0.4, (INT + WALL) * 2), floorMat);
      slab.position.set(0, y0 - 0.2, 0); slab.receiveShadow = true; scene.add(slab);

      const wm = brickMat([8, 1.5]);
      const hh = FLOOR_H;          // wall height
      const cy = y0 + hh / 2;
      // back wall (+z) and side walls — solid brick
      box(scene, (INT + WALL) * 2, hh, WALL, 0, cy, INT + WALL / 2, brickMat([8, 1.5]));     // +z back
      box(scene, WALL, hh, (INT + WALL) * 2, -(INT + WALL / 2), cy, 0, brickMat([8, 1.5]));  // -x
      box(scene, WALL, hh, (INT + WALL) * 2, INT + WALL / 2, cy, 0, brickMat([8, 1.5]));     // +x
      // front wall (-z): sill + header bands of brick, glass band between, door gap on L0
      const fz = -(INT + WALL / 2);
      const sill = 1.4, head = 1.2;
      // header
      box(scene, (INT + WALL) * 2, head, WALL, 0, y0 + hh - head / 2, fz, brickMat([8, 0.4]));
      if (L === 0) {
        // sill split for door
        const segW = (INT + WALL) - DOOR_HALF;
        box(scene, segW, sill, WALL, -(DOOR_HALF + segW / 2), y0 + sill / 2, fz, brickMat([3, 0.4]));
        box(scene, segW, sill, WALL, (DOOR_HALF + segW / 2), y0 + sill / 2, fz, brickMat([3, 0.4]));
        // door frame trim
        box(scene, DOOR_HALF * 2 + 0.4, 0.3, WALL + 0.1, 0, y0 + hh - head - 0.15, fz, trimMat);
      } else {
        box(scene, (INT + WALL) * 2, sill, WALL, 0, y0 + sill / 2, fz, brickMat([8, 0.4]));
      }
      // glass band + mullions
      const gy = y0 + sill + (hh - sill - head) / 2, gh = hh - sill - head;
      const glass = new THREE.Mesh(new THREE.BoxGeometry((INT + WALL) * 2 - 0.2, gh, 0.1), glassMat);
      glass.position.set(0, gy, fz); scene.add(glass);
      for (let mx = -INT + 2; mx <= INT - 2; mx += 4) box(scene, 0.4, gh, WALL + 0.05, mx, gy, fz, trimMat);

      // ceiling for top floor = roof handled below; floors get a thin ceiling rim light strip
      const strip = new THREE.Mesh(new THREE.BoxGeometry((INT) * 2, 0.15, 0.6), new THREE.MeshStandardMaterial({ color: accents[L % accents.length], emissive: accents[L % accents.length], emissiveIntensity: 0.9 }));
      strip.position.set(0, y0 + hh - 0.2, 0); scene.add(strip);
      // soft fill light per floor
      const pl = new THREE.PointLight(0xffffff, 0.32, 40, 1.6); pl.position.set(0, y0 + hh - 0.7, 0); scene.add(pl);

      // ---- stairwell pad (corner +x,+z) ----
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.12, 24), new THREE.MeshStandardMaterial({ color: '#19f0ff', emissive: '#19f0ff', emissiveIntensity: 0.4, transparent: true, opacity: 0.85 }));
      pad.position.set(INT - 3, y0 + 0.08, INT - 3); scene.add(pad);
      pad.userData.isPad = true; pad.userData.level = L;
      PADS.push(pad);
      // glowing ring marker
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 8, 32), new THREE.MeshStandardMaterial({ color: '#19f0ff', emissive: '#19f0ff', emissiveIntensity: 1.5 }));
      ring.rotation.x = Math.PI / 2; ring.position.set(INT - 3, y0 + 0.2, INT - 3); scene.add(ring);
      RINGS.push(ring);
    }

    // top roof slab
    const roofY = FLOOR_COUNT * FLOOR_H;
    const roof = new THREE.Mesh(new THREE.BoxGeometry((INT + WALL) * 2 + 1, 0.5, (INT + WALL) * 2 + 1), brickMat([10, 10]));
    roof.position.set(0, roofY, 0); roof.castShadow = true; scene.add(roof);
    // rooftop sign
    makeSign(scene, roofY + 0.3);

    // ---- WOBBLETON: wacky crooked houses ----
    const houseColors = ['#ff7eb6', '#ffd166', '#7ee0ff', '#b388ff', '#9be84a', '#ff9e6d', '#5ce0c0'];
    const ringDefs = [{ r: 48, n: 9 }, { r: 70, n: 12 }, { r: 88, n: 14 }];
    ringDefs.forEach(rd => {
      for (let i = 0; i < rd.n; i++) {
        const a = (i / rd.n) * Math.PI * 2 + Math.random() * 0.3;
        const x = Math.cos(a) * rd.r + (Math.random() - 0.5) * 8;
        const z = Math.sin(a) * rd.r + (Math.random() - 0.5) * 8;
        wackyHouse(scene, x, z, houseColors[(i + rd.r) % houseColors.length], colliders);
      }
    });

    // street props: lampposts + trees + a fountain
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r = 30;
      lamppost(scene, Math.cos(a) * r, Math.sin(a) * r);
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, r = 38 + Math.random() * 50;
      tree(scene, Math.cos(a) * r, Math.sin(a) * r, colliders);
    }
    fountain(scene, 0, 26, colliders);

    // ---- OPEN AREAS reached by portals ----
    const AREAS = {
      town:   { center: new THREE.Vector3(0, 0, 0),     R: TOWN_R, obstacles: colliders, group: scene, pool: ['runner', 'runner', 'grunt', 'grunt', 'spider'], boss: 'spider', bossEvery: 5, label: 'THE STREETS', sub: 'Wobbleton · open streets' },
      jungle: { center: new THREE.Vector3(900, 0, 0),   R: 221, obstacles: [], group: new THREE.Group(), pool: ['runner', 'runner', 'shooter', 'runner', 'grunt'], boss: 'ape', bossEvery: 5, label: 'THE JUNGLE', sub: 'Wibblewood · deep jungle' },
      castle: { center: new THREE.Vector3(-900, 0, 0), R: 216, obstacles: [], group: new THREE.Group(), pool: ['grunt', 'grunt', 'tank', 'runner', 'shooter'], boss: 'boss', bossEvery: 5, label: 'WACKY CASTLE', sub: 'Castle Cattywumpus' },
      maze:   { center: new THREE.Vector3(0, 0, 900),   R: 158, obstacles: [], group: new THREE.Group(), pool: ['grunt', 'runner', 'runner', 'shooter', 'grunt'], boss: 'ape', bossEvery: 6, label: 'HEDGE MAZE', sub: 'Maze of Maziness' },
    };
    buildJungle(AREAS.jungle.group, AREAS.jungle.center, AREAS.jungle.R, AREAS.jungle.obstacles);
    buildCastle(AREAS.castle.group, AREAS.castle.center, AREAS.castle.R, AREAS.castle.obstacles);
    buildMaze(AREAS.maze.group, AREAS.maze.center, AREAS.maze.R, AREAS.maze.obstacles);
    // remote areas start hidden — only the active one is shown (huge perf win:
    // an invisible group is fully skipped — no frustum cull, no shadow pass, no draw calls)
    ['jungle', 'castle', 'maze'].forEach(k => { AREAS[k].group.visible = false; scene.add(AREAS[k].group); });

    // portals: each lives in `area`, sits at world `pos`, and sends you to `target`
    function addPortal(area, x, z, col, label, target) { portal(scene, x, z, col, label); PORTALS.push({ area, pos: new THREE.Vector3(x, 0, z), target, color: col }); }

    // ---- lights ----
    scene.add(new THREE.HemisphereLight(0xcdeeff, 0x4f7a3a, 0.85));
    scene.add(new THREE.AmbientLight(0xffffff, 0.14));
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.25);
    sun.position.set(60, 90, 40); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    // tight frustum that follows the player (set each frame) → sharp, cheap shadows
    const sc = sun.shadow.camera; sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 10; sc.far = 240;
    sun.shadow.bias = -0.0004;
    scene.add(sun); scene.add(sun.target);
    // single modest fill is plenty — the previous per-area hemisphere lights were
    // global (not localized) and stacked, washing every colour to near-white.

    return {
      FLOOR_H, FLOOR_COUNT, INT, WALL, TOWN_R, DOOR_HALF,
      doorZ: -(INT + WALL / 2),
      pads: PADS, rings: RINGS,
      obstacles: colliders,
      areas: AREAS,
      portals: PORTALS,
      ambientMonkeys: AMB,
      sun,
      padPos: (L) => new THREE.Vector3(INT - 3, L * FLOOR_H, INT - 3),
      floorY: (L) => L * FLOOR_H,
    };
  }

  const PADS = [], RINGS = [], PORTALS = [], AMB = [];

  // ---------- props ----------
  function wackyHouse(scene, x, z, col, colliders) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const h = 5 + Math.random() * 9, w = 6 + Math.random() * 5, d = 6 + Math.random() * 4;
    const tilt = (Math.random() - 0.5) * 0.16;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, flatShading: true }));
    body.position.y = h / 2; body.rotation.z = tilt; body.castShadow = true; body.receiveShadow = true; g.add(body);
    // roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, 3 + Math.random() * 2, 4), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, flatShading: true }).clone());
    roof.material.color.offsetHSL(0, 0, -0.18);
    roof.position.y = h + 1.4; roof.rotation.y = Math.PI / 4; roof.rotation.z = tilt; roof.castShadow = true; g.add(roof);
    // windows (glowy)
    const wc = ['#ffd166', '#7ee0ff', '#ff7eb6'][Math.floor(Math.random() * 3)];
    for (let wy = 1.5; wy < h - 1; wy += 2.4) for (const sx of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.2), new THREE.MeshStandardMaterial({ color: wc, emissive: wc, emissiveIntensity: 0.5 }));
      win.position.set(sx * w * 0.26, wy, d / 2 + 0.05); win.rotation.z = tilt; g.add(win);
    }
    // a crooked door
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.2), new THREE.MeshStandardMaterial({ color: '#5a3a2a' }));
    door.position.set(0, 1.1, d / 2 + 0.05); door.rotation.z = tilt; g.add(door);
    scene.add(g);
    const rr = Math.max(w, d) / 2 + 0.5;
    colliders.push({ minX: x - rr, maxX: x + rr, minZ: z - rr, maxZ: z + rr, minY: 0, maxY: h });
  }
  function lamppost(scene, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 8), new THREE.MeshStandardMaterial({ color: '#2a2a33' }));
    pole.position.y = 2.5; pole.castShadow = true; g.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshStandardMaterial({ color: '#fff2b0', emissive: '#ffd166', emissiveIntensity: 1.4 }));
    head.position.y = 5.1; g.add(head);
    const lp = new THREE.PointLight(0xffd166, 0.6, 18, 1.8); lp.position.set(0, 5, 0); g.add(lp);
    scene.add(g);
  }
  function tree(scene, x, z, colliders) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3, 7), new THREE.MeshStandardMaterial({ color: '#6b4a2a', flatShading: true }));
    trunk.position.y = 1.5; trunk.castShadow = true; g.add(trunk);
    const cols = ['#9be84a', '#5ce0c0', '#7ee0ff', '#ffd166'];
    for (let i = 0; i < 3; i++) {
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 - i * 0.2, 0), new THREE.MeshStandardMaterial({ color: cols[Math.floor(Math.random() * cols.length)], flatShading: true, roughness: 0.9 }));
      ball.position.set((Math.random() - 0.5), 3.2 + i * 0.9, (Math.random() - 0.5)); ball.castShadow = true; g.add(ball);
    }
    scene.add(g);
    colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6, minY: 0, maxY: 3 });
  }
  function fountain(scene, x, z, colliders) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 1, 24), new THREE.MeshStandardMaterial({ color: '#c8c0d0', roughness: 0.9 }));
    basin.position.y = 0.5; g.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.3, 24), new THREE.MeshStandardMaterial({ color: '#7ee0ff', transparent: true, opacity: 0.7, emissive: '#19f0ff', emissiveIntensity: 0.3 }));
    water.position.y = 0.9; g.add(water);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 3, 10), new THREE.MeshStandardMaterial({ color: '#c8c0d0' }));
    spout.position.y = 2; g.add(spout);
    scene.add(g);
    colliders.push({ minX: x - 4.4, maxX: x + 4.4, minZ: z - 4.4, maxZ: z + 4.4, minY: 0, maxY: 2.5 });
  }
  function makeSign(scene, y) {
    const cnv = document.createElement('canvas'); cnv.width = 1024; cnv.height = 256;
    const c = cnv.getContext('2d');
    c.clearRect(0, 0, 1024, 256);
    c.font = '150px "Luckiest Guy", cursive'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 14; c.strokeStyle = '#3a2350'; c.strokeText('WOBBLETON', 512, 135);
    c.fillStyle = '#ffd23f'; c.fillText('WOBBLETON', 512, 135);
    const tex = new THREE.Texture(cnv); tex.needsUpdate = true;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 0.4), new THREE.MeshStandardMaterial({ map: tex, transparent: true }));
    sign.position.set(0, y + 3, 0); scene.add(sign);
  }

  // ====================== JUNGLE ======================
  function buildJungle(scene, JC, JR, obs) {
    const cx = JC.x, cz = JC.z;
    // mossy ground
    const gtex = jungleGroundTex(); gtex.repeat.set(40, 40);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(JR + 30, 48), new THREE.MeshStandardMaterial({ map: gtex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, 0.01, cz); ground.receiveShadow = true; scene.add(ground);

    // winding river (translucent water ribbon, wade-able), running N-S, wiggling in x
    const riverMat = new THREE.MeshStandardMaterial({ color: '#5fc8e8', transparent: true, opacity: 0.78, roughness: 0.2, metalness: 0.1 });
    const bankMat = new THREE.MeshStandardMaterial({ color: '#c8b48a', roughness: 1, flatShading: true });
    for (let z = -JR; z <= JR; z += 8) {
      const wob = Math.sin(z * 0.05) * 16;        // serpentine
      const seg = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 8.4), riverMat);
      seg.position.set(cx + wob, 0.12, cz + z); scene.add(seg);
      // sandy banks
      [-7.2, 7.2].forEach(s => { const b = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 8.4), bankMat); b.position.set(cx + wob + s, 0.1, cz + z); scene.add(b); });
    }
    // a couple of stepping-stone rocks + a log bridge across the middle
    const logMat = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.9, flatShading: true });
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 14, 8), logMat);
    bridge.rotation.x = Math.PI / 2; bridge.position.set(cx, 0.6, cz); scene.add(bridge);

    // DENSE pale-trunk trees
    const palette = ['#7fe87a', '#5fd0a8', '#46c4d8', '#a6e85a', '#5fb86a'];
    let placed = 0, guard = 0;
    while (placed < 90 && guard < 600) {
      guard++;
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * (JR - 8);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const wob = Math.sin((z - cz) * 0.05) * 16;
      if (Math.abs((x - cx) - wob) < 8) continue;       // keep trees out of the river
      if (Math.hypot(x - (cx - 70), z - cz) < 8) continue; // clear around portal
      paleTree(scene, x, z, palette[(Math.random() * palette.length) | 0], obs);
      placed++;
    }
    // ferns / undergrowth (no collision, just lush)
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (JR - 4);
      fern(scene, cx + Math.cos(a) * r, cz + Math.sin(a) * r, palette[(Math.random() * palette.length) | 0]);
    }
    // glowing jungle flowers
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * (JR - 6);
      flower(scene, cx + Math.cos(a) * r, cz + Math.sin(a) * r, ['#ff5ca2', '#ffd23f', '#b06cf6', '#43c6ff'][(Math.random() * 4) | 0]);
    }
    // ambient swinging monkeys up in the canopy (decor, animated by game loop)
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * (JR - 16);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const m = EnemyFactory.build('monkey'); m.scale.setScalar(0.7);
      m.position.set(x, 5.5 + Math.random() * 2, z); scene.add(m);
      AMB.push({ group: m, base: m.position.y, phase: Math.random() * 6 });
    }
    // big stone idol head (jungle landmark)
    idol(scene, cx + 40, cz - 30);
  }

  function jungleGroundTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#2f5a2a'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${30 + Math.random() * 50 | 0},${70 + Math.random() * 80 | 0},${30 + Math.random() * 40 | 0},.7)`; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 0, 7); x.fill(); }
    const t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function paleTree(scene, x, z, leaf, obs) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const h = 9 + Math.random() * 9, lean = (Math.random() - 0.5) * 0.12;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, h, 8), new THREE.MeshStandardMaterial({ color: '#efe7d6', roughness: 0.85, flatShading: true }));
    trunk.position.y = h / 2; trunk.rotation.z = lean; trunk.castShadow = true; g.add(trunk);
    // pale bark rings
    for (let i = 1; i < h - 1; i += 2) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 12), new THREE.MeshStandardMaterial({ color: '#cdb5a0', roughness: 0.9 })); ring.rotation.x = Math.PI / 2; ring.position.set(Math.sin(lean) * -i, i, 0); g.add(ring); }
    // big leafy canopy (stacked blobs)
    const lm = new THREE.MeshStandardMaterial({ color: leaf, roughness: 0.85, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const rr = 2.6 - i * 0.3;
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 0), lm);
      ball.position.set(Math.sin(lean) * -h + (Math.random() - 0.5) * 1.2, h + i * 0.8, (Math.random() - 0.5) * 1.2);
      ball.castShadow = true; g.add(ball);
    }
    // hanging vines
    for (let i = 0; i < 3; i++) { const vl = 2 + Math.random() * 3; const v = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, vl, 5), new THREE.MeshStandardMaterial({ color: '#4f8a3a', roughness: 0.9 })); const va = Math.random() * Math.PI * 2; v.position.set(Math.sin(lean) * -h + Math.cos(va) * 1.6, h - vl / 2, Math.sin(va) * 1.6); g.add(v); }
    scene.add(g);
    obs.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7, minY: 0, maxY: h });
  }
  function fern(scene, x, z, col) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const blade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.4, 4), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, flatShading: true })); blade.position.set(Math.cos(a) * 0.3, 0.7, Math.sin(a) * 0.3); blade.rotation.z = Math.cos(a) * 0.5; blade.rotation.x = Math.sin(a) * 0.5; g.add(blade); }
    scene.add(g);
  }
  function flower(scene, x, z, col) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 5), new THREE.MeshStandardMaterial({ color: '#4f8a3a' })); stem.position.y = 0.5; g.add(stem);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, flatShading: true })); head.position.y = 1.05; g.add(head);
    scene.add(g);
  }
  function idol(scene, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const stone = new THREE.MeshStandardMaterial({ color: '#8a8f7a', roughness: 1, flatShading: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), stone); base.position.y = 1.5; g.add(base);
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 0), stone); head.position.y = 5; g.add(head);
    [-0.9, 0.9].forEach(s => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ffd23f', emissiveIntensity: 0.8 })); e.position.set(s, 5.2, 2.2); g.add(e); });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.4), stone); mouth.position.set(0, 4.2, 2.3); g.add(mouth);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
  }

  function grassTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#10200f'; x.fillRect(0, 0, 256, 256);   // very deep green so it stays dark in full sun
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${16 + Math.random() * 22 | 0},${34 + Math.random() * 34 | 0},${18 + Math.random() * 20 | 0},.6)`; x.fillRect(Math.random() * 256, Math.random() * 256, 3, 6); }
    const t = new THREE.Texture(c); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  // ====================== WACKY CASTLE ======================
  function buildCastle(scene, C, R, obs) {
    const cx = C.x, cz = C.z;
    const gt = grassTex(); gt.repeat.set(28, 28);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 25, 48), new THREE.MeshStandardMaterial({ map: gt, color: 0x8a9a8a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, 0.01, cz); ground.receiveShadow = true; scene.add(ground);
    const court = new THREE.Mesh(new THREE.CircleGeometry(60, 40), new THREE.MeshStandardMaterial({ color: '#a59caa', roughness: 1 }));
    court.rotation.x = -Math.PI / 2; court.position.set(cx, 0.02, cz); court.receiveShadow = true; scene.add(court);

    const stone = new THREE.MeshStandardMaterial({ color: '#c3bcc8', roughness: 0.92, flatShading: true });
    const stoneD = new THREE.MeshStandardMaterial({ color: '#9f97ad', roughness: 0.95, flatShading: true });
    const S2 = 60, wallH = 11, wallT = 3, gate = 12;
    function crenellate(x, z, along, horiz) {
      const n = Math.floor(along / 4);
      for (let i = 0; i <= n; i++) { const t = -along / 2 + i * 4; const bx = horiz ? x + t : x, bz = horiz ? z : z + t; const cb = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 2 : wallT + 0.5, 1.8, horiz ? wallT + 0.5 : 2), stoneD); cb.position.set(bx, wallH + 0.9, bz); scene.add(cb); }
    }
    function wall(x, z, w, d) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), stone); m.position.set(x, wallH / 2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); obs.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: 0, maxY: wallH }); crenellate(x, z, w > d ? w : d, w > d); }
    wall(cx, cz - S2, S2 * 2, wallT);                 // back (-z)
    wall(cx - S2, cz, wallT, S2 * 2);                 // left (-x)
    wall(cx, cz + S2, S2 * 2, wallT);                 // side (+z)
    // front (+x, faces town) with central gate gap
    const segL = (S2 * 2 - gate) / 2;
    wall(cx + S2, cz + (gate / 2 + segL / 2), wallT, segL);
    wall(cx + S2, cz - (gate / 2 + segL / 2), wallT, segL);
    // gate arch
    const arch = new THREE.Mesh(new THREE.BoxGeometry(wallT + 0.5, 2.4, gate + 1), stoneD); arch.position.set(cx + S2, wallH - 1, cz); arch.castShadow = true; scene.add(arch);

    function tower(x, z, flag) {
      const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.z = (Math.random() - 0.5) * 0.08;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 17, 12), stone); body.position.y = 8.5; body.castShadow = true; t.add(body);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const cb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.6), stoneD); cb.position.set(Math.cos(a) * 5, 17.4, Math.sin(a) * 5); t.add(cb); }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(6, 6, 8), new THREE.MeshStandardMaterial({ color: flag, roughness: 0.7, flatShading: true })); roof.position.y = 21; roof.castShadow = true; t.add(roof);
      // wacky flag
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), stoneD); pole.position.y = 25; t.add(pole);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.08), new THREE.MeshStandardMaterial({ color: flag, side: THREE.DoubleSide })); fl.position.set(1.2, 26, 0); t.add(fl);
      scene.add(t);
      obs.push({ minX: x - 5, maxX: x + 5, minZ: z - 5, maxZ: z + 5, minY: 0, maxY: 17 });
    }
    const flagCols = ['#ff5ca2', '#ffd23f', '#43c6ff', '#9be84a'];
    [[-S2, -S2], [S2, -S2], [-S2, S2], [S2, S2]].forEach((p, i) => tower(cx + p[0], cz + p[1], flagCols[i]));
    // central keep with a giant clock/face
    const keep = new THREE.Mesh(new THREE.BoxGeometry(18, 26, 18), stone); keep.position.set(cx, 13, cz - 6); keep.castShadow = true; scene.add(keep);
    obs.push({ minX: cx - 9, maxX: cx + 9, minZ: cz - 15, maxZ: cz + 3, minY: 0, maxY: 26 });
    const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(14, 9, 4), new THREE.MeshStandardMaterial({ color: '#ff5ca2', roughness: 0.7, flatShading: true })); keepRoof.position.set(cx, 30, cz - 6); keepRoof.rotation.y = Math.PI / 4; keepRoof.castShadow = true; scene.add(keepRoof);
    // banners on the keep
    [-5, 0, 5].forEach((o, i) => { const ban = new THREE.Mesh(new THREE.PlaneGeometry(3, 7), new THREE.MeshStandardMaterial({ color: flagCols[i], side: THREE.DoubleSide })); ban.position.set(cx + o, 18, cz + 3.1); scene.add(ban); });
    // torches (few lights) along the gate
    [[cx + S2 - 2, cz + 7], [cx + S2 - 2, cz - 7]].forEach(p => {
      const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: '#ff8a3d', emissive: '#ff8a3d', emissiveIntensity: 1.5, flatShading: true }));
      fire.position.set(p[0], 5, p[1]); scene.add(fire);
      const fl = new THREE.PointLight(0xff8a3d, 0.7, 22, 1.8); fl.position.set(p[0], 5.5, p[1]); scene.add(fl);
    });
    // crates + barrels (cover)
    for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 28; crate(scene, cx + Math.cos(a) * r, cz + Math.sin(a) * r, obs); }
  }
  function crate(scene, x, z, obs) {
    const crateMat = new THREE.MeshStandardMaterial({ color: Math.random() < 0.5 ? '#b07a3a' : '#8a5a2a', roughness: 0.85, flatShading: true });
    const s = 1.6 + Math.random() * 0.8;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat); m.position.set(x, s / 2, z); m.rotation.y = Math.random(); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    obs.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2, minY: 0, maxY: s });
  }

  // ====================== GRASS HEDGE MAZE ======================
  function buildMaze(scene, C, R, obs) {
    const cx = C.x, cz = C.z;
    const gt = grassTex(); gt.repeat.set(30, 30);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 25, 48), new THREE.MeshStandardMaterial({ map: gt, color: 0x8a9a8a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, 0.01, cz); ground.receiveShadow = true; scene.add(ground);
    const hedge = new THREE.MeshStandardMaterial({ color: '#253D2C', roughness: 0.95, flatShading: true });
    const hedgeT = new THREE.MeshStandardMaterial({ color: '#35563C', roughness: 0.95, flatShading: true });
    const cell = 12, half = 54, H = 3.8, T = 1.8;
    function hedgeSeg(x, z, horiz, len) {
      len = len || cell;
      const w = horiz ? len : T, d = horiz ? T : len;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), hedge); m.position.set(x, H / 2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), hedgeT); b.position.set(x + (horiz ? (i - 1) * len * 0.32 : 0), H + 0.2, z + (horiz ? 0 : (i - 1) * len * 0.32)); scene.add(b); }
      obs.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: 0, maxY: H });
    }
    // solid perimeter with a south entrance gap
    for (let g = -half; g < half; g += cell) {
      hedgeSeg(cx + g + cell / 2, cz - half, true);            // north (-z)
      if (!(g > -cell && g < cell)) hedgeSeg(cx + g + cell / 2, cz + half, true); // south with gap at center
      hedgeSeg(cx - half, cz + g + cell / 2, false);           // west
      hedgeSeg(cx + half, cz + g + cell / 2, false);           // east
    }
    // interior maze walls (loose, traversable)
    for (let gx = -half + cell; gx < half; gx += cell) {
      for (let gz = -half; gz < half; gz += cell) {
        if (Math.random() < 0.42) hedgeSeg(cx + gx, cz + gz + cell / 2, false);
      }
    }
    for (let gz = -half + cell; gz < half; gz += cell) {
      for (let gx = -half; gx < half; gx += cell) {
        if (Math.random() < 0.42) hedgeSeg(cx + gx + cell / 2, cz + gz, true);
      }
    }
    // topiary flowers + a fountain centerpiece
    for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * (half - 6); flower(scene, cx + Math.cos(a) * r, cz + Math.sin(a) * r, ['#ff5ca2', '#ffd23f', '#b06cf6'][(Math.random() * 3) | 0]); }
  }
  function portal(scene, x, z, col, label) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.32, 12, 32), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4, roughness: 0.4, flatShading: true }));
    ring.position.y = 2.6; g.add(ring);
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(2.0, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
    swirl.position.y = 2.6; g.add(swirl); g.userData.swirl = swirl;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.4, 24), new THREE.MeshStandardMaterial({ color: '#3a2350', roughness: 0.8 })); base.position.y = 0.2; g.add(base);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.12, 24), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 })); pad.position.y = 0.42; g.add(pad);
    // floating sign
    const cnv = document.createElement('canvas'); cnv.width = 512; cnv.height = 160;
    const c = cnv.getContext('2d'); c.font = '84px "Luckiest Guy", cursive'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 10; c.strokeStyle = '#3a2350'; c.strokeText('→ ' + label, 256, 88); c.fillStyle = '#fffaf0'; c.fillText('→ ' + label, 256, 88);
    const tex = new THREE.Texture(cnv); tex.needsUpdate = true;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.56), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); sign.position.y = 5.4; g.add(sign);
    g.userData.sign = sign;
    PORTAL_FX.push(g);
    scene.add(g);
    return g;
  }
  const PORTAL_FX = [];

  return { build, portalFX: PORTAL_FX };
})();

if (typeof window !== 'undefined') window.World = World;
