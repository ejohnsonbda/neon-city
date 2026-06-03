// ============================================================
//  TEXTURE GENERATOR — Neon Night City
//  All procedural canvas textures. Returns THREE.CanvasTexture.
// ============================================================
const NEON = {
  cyan:    '#19f0ff',
  magenta: '#ff2d95',
  purple:  '#9b5cff',
  amber:   '#ffb347',
  green:   '#39ff14',
  blue:    '#2a6fff'
};

const TextureGen = {
  _palette: ['#19f0ff', '#ff2d95', '#9b5cff', '#ffd166', '#39ff14'],
  img: {},

  // Preload the real photo textures (from the neon-city kit) then run cb
  load(cb) {
    const R = window.__resources || {};
    const srcs = {
      asphalt: R.texAsphalt || 'T_Concrete_Asphalt_BaseColor.png',
      concrete: R.texConcrete || 'T_Concrete_BaseColor.png',
      lit1: R.texLit1 || 'T_lit_interior_1.png',
      lit2: R.texLit2 || 'T_lit_interior_2.png',
      dark: R.texDark || 'T_dark_interior.png'
    };
    const keys = Object.keys(srcs);
    let n = keys.length;
    keys.forEach(k => {
      const im = new Image();
      im.onload = im.onerror = () => { if (--n === 0) cb(); };
      im.src = srcs[k];
      this.img[k] = im;
    });
  },

  // A lit-window building using the real interior photo textures.
  // Returns { map, emissive } so windows glow at night.
  createBuilding(hue) {
    const W = 256, H = 512;
    const base = document.createElement('canvas'); base.width = W; base.height = H;
    const emis = document.createElement('canvas'); emis.width = W; emis.height = H;
    const b = base.getContext('2d');
    const e = emis.getContext('2d');
    const lits = [this.img.lit1, this.img.lit2].filter(i => i && i.width);
    const dark = this.img.dark;
    const concrete = this.img.concrete;

    // Facade wall = real concrete, darkened for night
    if (concrete && concrete.width) {
      b.drawImage(concrete, 0, 0, W, H);
      b.fillStyle = 'rgba(6,9,16,0.74)'; b.fillRect(0, 0, W, H);
    } else {
      const g = b.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0c1018'); g.addColorStop(1, '#05070b');
      b.fillStyle = g; b.fillRect(0, 0, W, H);
    }
    e.fillStyle = '#000'; e.fillRect(0, 0, W, H);

    const litColor = hue || this._palette[(Math.random() * this._palette.length) | 0];
    const cols = 6, rows = 16;
    const cw = W / cols, rh = H / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const fx = c * cw, fy = r * rh;
        const x = fx + cw * 0.16, y = fy + rh * 0.14;
        const w = cw * 0.68, h = rh * 0.66;
        // mullion / frame
        b.fillStyle = '#0a0d14'; b.fillRect(fx + 1, fy + 1, cw - 2, rh - 2);
        const roll = Math.random();
        if (roll > 0.5 && lits.length) {
          // LIT window — draw a real interior room behind the glass
          const room = lits[(Math.random() * lits.length) | 0];
          // sample a sub-rect of the room so windows differ
          const sx = Math.random() * room.width * 0.3, sy = Math.random() * room.height * 0.3;
          const sw = room.width * (0.55 + Math.random() * 0.3), sh = room.height * (0.55 + Math.random() * 0.3);
          b.drawImage(room, sx, sy, sw, sh, x, y, w, h);
          e.drawImage(room, sx, sy, sw, sh, x, y, w, h);
          // ~22% of lit windows get a neon tint for the cyberpunk palette
          if (Math.random() > 0.78) {
            b.fillStyle = litColor + '66'; b.fillRect(x, y, w, h);
            e.fillStyle = litColor + '88'; e.fillRect(x, y, w, h);
          }
          // glass reflection sheen
          b.fillStyle = 'rgba(120,160,200,0.10)'; b.fillRect(x, y, w, h * 0.4);
        } else if (dark && dark.width) {
          // DARK window
          const sx = Math.random() * dark.width * 0.3, sy = Math.random() * dark.height * 0.3;
          b.drawImage(dark, sx, sy, dark.width * 0.6, dark.height * 0.6, x, y, w, h);
          b.fillStyle = 'rgba(4,7,12,0.55)'; b.fillRect(x, y, w, h);
        } else {
          b.fillStyle = '#0a0e14'; b.fillRect(x, y, w, h);
        }
      }
    }
    // rooftop neon trim
    b.fillStyle = litColor; b.fillRect(0, 0, W, 4);
    e.fillStyle = litColor; e.fillRect(0, 0, W, 4);

    return {
      map: new THREE.CanvasTexture(base),
      emissive: new THREE.CanvasTexture(emis),
      hue: litColor
    };
  },

  // A glowing neon billboard sign (fully emissive look)
  createBillboard() {
    const W = 512, H = 256;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
    const col = this._palette[(Math.random() * this._palette.length) | 0];
    const words = ['NOVA', 'SYNTH', '電脳', 'ZER0', 'KAIJU', 'PULSE', 'X-9', 'NEON', 'お得', '24H'];
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 40;
    ctx.fillStyle = col;
    ctx.font = '900 120px Orbitron, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(words[(Math.random() * words.length) | 0], W / 2, H / 2);
    // border
    ctx.lineWidth = 8; ctx.strokeStyle = col; ctx.strokeRect(16, 16, W - 32, H - 32);
    ctx.restore();
    return new THREE.CanvasTexture(c);
  },

  // Wet night asphalt — dark, subtle sheen, faint lane markings
  createAsphalt() {
    const S = 512;
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#08090d'; ctx.fillRect(0, 0, S, S);
    // grain
    for (let i = 0; i < 22000; i++) {
      const v = Math.random();
      ctx.fillStyle = v > 0.5 ? 'rgba(120,130,150,0.04)' : 'rgba(0,0,0,0.5)';
      ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    // a few cracks
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); let x = Math.random() * S, y = Math.random() * S; ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 90; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // faint lane markings
    ctx.strokeStyle = 'rgba(200,185,120,0.10)';
    ctx.lineWidth = 5; ctx.setLineDash([38, 42]);
    ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.stroke();
    ctx.setLineDash([]);
    return new THREE.CanvasTexture(c);
  },

  // Rippled desert sand (tileable) with dune shading + grain
  createSand() {
    const S = 512;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cda971'; ctx.fillRect(0, 0, S, S);
    // soft dune ripples
    for (let i = 0; i < 40; i++) {
      const y = (i / 40) * S + Math.sin(i) * 6;
      ctx.strokeStyle = `rgba(${150 + Math.random() * 30},${120 + Math.random() * 25},${70},0.10)`;
      ctx.lineWidth = 3 + Math.random() * 4;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 7);
      ctx.stroke();
    }
    // darker ripple troughs
    for (let i = 0; i < 24; i++) {
      const y = Math.random() * S;
      ctx.strokeStyle = 'rgba(120,92,50,0.10)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 14) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 9);
      ctx.stroke();
    }
    // grain
    for (let i = 0; i < 16000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,235,190,0.05)' : 'rgba(110,85,45,0.06)';
      ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    return new THREE.CanvasTexture(c);
  },

  // Sandstone block masonry for pyramids / temples
  createSandstone() {
    const S = 512;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c9a87c'; ctx.fillRect(0, 0, S, S);
    const bw = 64, bh = 42;
    for (let r = 0; r * bh < S; r++) {
      const off = (r % 2) * bw / 2;
      for (let cx = -1; cx * bw < S; cx++) {
        const x = cx * bw + off, y = r * bh;
        const shade = 175 + (Math.random() * 40 - 20);
        ctx.fillStyle = `rgb(${shade},${shade - 30},${shade - 70})`;
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        // weathering speckle
        for (let k = 0; k < 18; k++) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(120,90,50,0.18)' : 'rgba(230,210,160,0.16)';
          ctx.fillRect(x + 2 + Math.random() * (bw - 6), y + 2 + Math.random() * (bh - 6), 3, 3);
        }
      }
    }
    // mortar lines
    ctx.strokeStyle = 'rgba(80,58,32,0.5)'; ctx.lineWidth = 3;
    for (let r = 0; r * bh <= S; r++) { ctx.beginPath(); ctx.moveTo(0, r * bh); ctx.lineTo(S, r * bh); ctx.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  },

  // ---- JAPAN / advanced material textures ----

  // Vertical wood planks (shrine timber). dark = stained beam color
  createWood(dark) {
    const S = 512;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const base = dark ? '#3a241a' : '#7a4a2b';
    ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
    const planks = 7, pw = S / planks;
    for (let p = 0; p < planks; p++) {
      const x = p * pw;
      const shade = (Math.random() * 26 - 13) | 0;
      ctx.fillStyle = this._shift(base, shade);
      ctx.fillRect(x + 1, 0, pw - 2, S);
      // grain streaks
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `rgba(${dark ? '20,12,6' : '60,34,16'},${0.06 + Math.random() * 0.12})`;
        ctx.lineWidth = 0.7 + Math.random();
        ctx.beginPath();
        const gx = x + 3 + Math.random() * (pw - 6);
        ctx.moveTo(gx, 0);
        for (let y = 0; y <= S; y += 24) ctx.lineTo(gx + Math.sin(y * 0.05 + p) * 2.4, y);
        ctx.stroke();
      }
      // plank gap shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, 0, 2, S);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  },

  // Kawara roof tiles — rows of dark ridged ceramic
  createRoofTile(col) {
    const S = 512;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const base = col || '#2b3540';
    ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
    const rows = 11, rh = S / rows, cols = 14, cw = S / cols;
    for (let r = 0; r < rows; r++) {
      const ry = r * rh;
      for (let cc = 0; cc < cols; cc++) {
        const x = cc * cw, y = ry;
        const g = ctx.createLinearGradient(x, 0, x + cw, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.4)');
        g.addColorStop(0.5, this._shift(base, 22));
        g.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, cw - 1, rh - 1);
        // highlight curve on top
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + cw * 0.35, y + 2, cw * 0.3, 3);
      }
      // row shadow line
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, ry, S, 3);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  },

  // Shoji paper screen — warm rice paper with wood lattice
  createShoji() {
    const S = 256;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#f4ecd6'); g.addColorStop(1, '#e6d6b0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    // fibers
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(150,130,90,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * S, Math.random() * S, 3 + Math.random() * 6, 1);
    }
    // lattice
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 5;
    const n = 4, step = S / n;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(S, i * step); ctx.stroke();
    }
    return new THREE.CanvasTexture(c);
  },

  // Lush grass blades (advanced ground for fields/japan)
  createGrass(dark) {
    const S = 512;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = dark ? '#27401d' : '#3c6b2c'; ctx.fillRect(0, 0, S, S);
    // soft patches
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 18 + Math.random() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const lit = Math.random() > 0.5;
      g.addColorStop(0, lit ? 'rgba(120,170,70,0.18)' : 'rgba(20,40,15,0.18)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
    }
    // blades
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const h = 3 + Math.random() * 7;
      const shade = 40 + (Math.random() * 90) | 0;
      ctx.strokeStyle = `rgb(${shade * 0.5 | 0},${shade + 30},${shade * 0.4 | 0})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 3, y - h); ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  },

  // Stone path slabs
  createStonePath() {
    const S = 512;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5b5750'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 16; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 30 + Math.random() * 46;
      ctx.fillStyle = this._shift('#8a857a', (Math.random() * 40 - 20) | 0);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      for (let a = 0; a < 7; a++) { const ang = (a / 7) * 6.28; const rr = r * (0.7 + Math.random() * 0.4); ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  },

  // Soft day sky (blue gradient + sun glow + haze)
  createDaySky(top, horizon) {
    const W = 1024, H = 1024;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top || '#3f78c4');
    g.addColorStop(0.5, '#8fc0e8');
    g.addColorStop(0.82, horizon || '#e7d3c0');
    g.addColorStop(1, '#f3e6d2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // sun
    const sx = W * 0.7, sy = H * 0.24;
    const sun = ctx.createRadialGradient(sx, sy, 10, sx, sy, 260);
    sun.addColorStop(0, 'rgba(255,250,230,0.7)');
    sun.addColorStop(0.2, 'rgba(255,240,200,0.3)');
    sun.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    // soft clouds
    for (let i = 0; i < 14; i++) {
      const cx = Math.random() * W, cy = H * (0.15 + Math.random() * 0.45), r = 40 + Math.random() * 90;
      const cl = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      cl.addColorStop(0, 'rgba(255,255,255,0.35)'); cl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cl; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.5, 0, 0, 6.28); ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  },

  _shift(hex, d) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + d, g = ((n >> 8) & 255) + d, b = (n & 255) + d;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return `rgb(${r},${g},${b})`;
  },

  // Night sky dome: deep gradient, stars, moon, city glow at horizon
  createSky() {
    const W = 1024, H = 1024;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04030a');
    g.addColorStop(0.45, '#0a1030');
    g.addColorStop(0.72, '#241246');
    g.addColorStop(0.88, '#3a1a4a');
    g.addColorStop(1, '#0a0612');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // stars (upper region)
    for (let i = 0; i < 700; i++) {
      const y = Math.random() * H * 0.55;
      const a = Math.random() * 0.8 + 0.1;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      const s = Math.random() > 0.92 ? 2 : 1;
      ctx.fillRect(Math.random() * W, y, s, s);
    }
    // moon
    const mx = W * 0.74, my = H * 0.2, mr = 46;
    const moon = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 2.4);
    moon.addColorStop(0, 'rgba(220,230,255,0.9)');
    moon.addColorStop(0.25, 'rgba(180,200,255,0.5)');
    moon.addColorStop(1, 'rgba(120,140,255,0)');
    ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(mx, my, mr * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();

    // horizon city glow (cyan/magenta wash near bottom)
    const glow = ctx.createLinearGradient(0, H * 0.78, 0, H);
    glow.addColorStop(0, 'rgba(0,0,0,0)');
    glow.addColorStop(0.6, 'rgba(255,45,149,0.10)');
    glow.addColorStop(1, 'rgba(25,240,255,0.22)');
    ctx.fillStyle = glow; ctx.fillRect(0, H * 0.78, W, H * 0.22);

    return new THREE.CanvasTexture(c);
  }
};
