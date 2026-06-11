// ============================================================
//  HUD + MINIMAP for WOBBLETON TOWER
// ============================================================
const HUD = (() => {
  const $ = id => document.getElementById(id);
  let msgT;
  return {
    hp(hp, max) {
      const pct = Math.max(0, hp / max * 100);
      $('hp-fill').style.width = pct + '%';
      $('hp-fill').style.background = pct > 50 ? 'linear-gradient(90deg,#5fe3a1,#9be84a)' : pct > 25 ? 'linear-gradient(90deg,#ffd23f,#ff8a3d)' : 'linear-gradient(90deg,#ff8a3d,#ff5a5a)';
      $('hp-text').textContent = Math.max(0, Math.round(hp));
    },
    buffs(map) {
      const box = $('buffs'); if (!box) return;
      const defs = { speed: { e: '⚡', c: '#43c6ff', t: 10 }, rapid: { e: '⭐', c: '#ffd23f', t: 10 }, shield: { e: '🛡️', c: '#5fe3a1', t: 8 }, double: { e: '2×', c: '#ff5ca2', t: 14 } };
      let html = '';
      for (const k in defs) { const v = map[k] || 0; if (v > 0) { const p = Math.min(1, v / defs[k].t) * 360; const big = k === 'double' ? ' style2x' : ''; html += `<div class="buff${big}" style="color:${defs[k].c}"><div class="ring" style="--p:${p}deg"></div>${defs[k].e}</div>`; } }
      box.innerHTML = html;
    },
    weapon(w, mag, reserve) {
      $('wpn-name').textContent = w.name;
      $('wpn-name').style.color = '#' + w.color.toString(16).padStart(6, '0');
      $('ammo').innerHTML = `<b>${mag}</b><span>/ ∞</span>`;
      [...document.querySelectorAll('.wslot')].forEach((s, i) => s.classList.toggle('on', '#' + w.color.toString(16).padStart(6, '0') === s.dataset.col));
      const idx = ['pistol','smg','shotgun','railgun','pulse','plasma'].indexOf(w.key);
      [...document.querySelectorAll('.wslot')].forEach((s, i) => s.classList.toggle('on', i === idx));
    },
    score(n) { $('score').textContent = n.toLocaleString(); },
    wave(w, total) { $('wave').textContent = w + ' / ' + total; },
    floor(L) {
      const names = ['LOBBY', '2ND FLOOR', '3RD FLOOR', '4TH FLOOR', '5TH FLOOR', 'PENTHOUSE'];
      $('floor').textContent = names[L] || ('FLOOR ' + (L + 1));
      $('floor-sub').textContent = 'Wobbleton Tower · ' + (L + 1) + '/6';
    },
    floorArea(ad) {
      $('floor').textContent = ad.label;
      $('floor-sub').textContent = ad.sub;
    },
    flash(color, text) {
      const el = $('banner'); el.textContent = text; el.style.color = color; el.style.opacity = 1; el.style.transform = 'translate(-50%,0) scale(1) rotate(-3deg)';
      clearTimeout(msgT); msgT = setTimeout(() => { el.style.opacity = 0; el.style.transform = 'translate(-50%,0) scale(.85) rotate(-3deg)'; }, 1700);
    },
    fade(on) { $('lift-fade').style.opacity = on ? 1 : 0; },
    hint(show) { $('lock-hint').style.display = show ? 'flex' : 'none'; },
  };
})();

const Minimap = (() => {
  let cv, x, last = 0;
  return {
    draw(S, W) {
      const now = performance.now(); if (now - last < 60) return; last = now;
      if (!cv) { cv = document.getElementById('minimap'); x = cv.getContext('2d'); }
      const w = cv.width, h = cv.height, cx = w / 2, cy = h / 2;
      x.clearRect(0, 0, w, h);
      x.save();
      // rotate so player faces up
      x.translate(cx, cy); x.rotate(S.yaw);
      const open = S.area !== 'building';
      const ad = open ? W.areas[S.area] : null;
      const scale = open ? (cx - 6) / ad.R : (cx - 8) / (W.INT + 2);

      if (open) {
        const C = ad.center;
        x.save(); x.translate(-(S.pos.x) * scale, -(S.pos.z) * scale);
        // ground ring
        x.fillStyle = 'rgba(60,110,60,.5)'; x.beginPath(); x.arc(C.x * scale, C.z * scale, ad.R * scale, 0, 7); x.fill();
        // jungle river
        if (S.area === 'jungle') {
          x.strokeStyle = 'rgba(95,200,232,.85)'; x.lineWidth = 7 * scale; x.beginPath();
          for (let zz = -ad.R; zz <= ad.R; zz += 6) { const wob = Math.sin(zz * 0.05) * 16; const px = (C.x + wob) * scale, pz = (C.z + zz) * scale; if (zz === -ad.R) x.moveTo(px, pz); else x.lineTo(px, pz); }
          x.stroke();
        }
        // obstacles (buildings / trees / walls / hedges)
        x.fillStyle = 'rgba(110,95,80,.75)';
        ad.obstacles.forEach(o => x.fillRect(o.minX * scale, o.minZ * scale, (o.maxX - o.minX) * scale, (o.maxZ - o.minZ) * scale));
        // the building footprint (only matters in town)
        if (S.area === 'town') { x.fillStyle = 'rgba(150,110,90,.9)'; const b = (W.INT + 1) * scale; x.fillRect(-b, -b, b * 2, b * 2); }
        // portals in this area
        W.portals.forEach(p => { if (p.area !== S.area) return; x.fillStyle = p.color; x.beginPath(); x.arc(p.pos.x * scale, p.pos.z * scale, 4, 0, 7); x.fill(); });
        x.restore();
      } else {
        // room
        x.fillStyle = 'rgba(60,52,70,.85)'; x.strokeStyle = 'rgba(170,130,100,.9)'; x.lineWidth = 2;
        const b = W.INT * scale;
        x.save(); x.translate(-S.pos.x * scale, -S.pos.z * scale);
        x.fillRect(-b, -b, b * 2, b * 2); x.strokeRect(-b, -b, b * 2, b * 2);
        const pad = W.padPos(S.level);
        x.fillStyle = S.cleared[S.level] ? '#39ff14' : '#19f0ff';
        x.beginPath(); x.arc(pad.x * scale, pad.z * scale, 4, 0, 7); x.fill();
        x.restore();
      }
      // enemies (relative to player)
      S.enemies.forEach(e => {
        if (e.dead) return;
        const ex = (e.group.position.x - S.pos.x) * scale, ez = (e.group.position.z - S.pos.z) * scale;
        x.fillStyle = e.cfg.col;
        const sz = (e.type === 'boss' || e.type === 'spider' || e.type === 'tank') ? 4 : 2.5;
        x.beginPath(); x.arc(ex, ez, sz, 0, 7); x.fill();
      });
      // pickups
      S.pickups.forEach(p => {
        const px = (p.group.position.x - S.pos.x) * scale, pz = (p.group.position.z - S.pos.z) * scale;
        x.fillStyle = '#' + (p.def ? p.def.disc.toString(16).padStart(6, '0') : 'ffffff');
        x.beginPath(); x.arc(px, pz, 3.5, 0, 7); x.fill();
      });
      x.restore();
      // player arrow (always center, pointing up)
      x.fillStyle = '#fff'; x.beginPath();
      x.moveTo(cx, cy - 6); x.lineTo(cx - 4, cy + 4); x.lineTo(cx + 4, cy + 4); x.closePath(); x.fill();
      // frame
      x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, cx - 2, 0, 7); x.stroke();
    }
  };
})();

if (typeof window !== 'undefined') { window.HUD = HUD; window.Minimap = Minimap; }
