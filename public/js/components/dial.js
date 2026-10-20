/* 3D dial (Three.js) — Glacier colourway, adapted from the Discus watch.
   Three rotating discs: outer ring = day, middle disc = month, centre = day of the year.
   createDial() throws if WebGL is unavailable; the caller shows a fallback. */
/* ============ 3D dial (Three.js) — Glacier colourway, adapted from the Discus watch ============ */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SERIF = '"Fraunces", Georgia, "Times New Roman", serif';
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_DAYS = [31,29,31,30,31,30,31,31,30,31,30,31];       // leap-year lengths, so Feb 29 exists
const MONTH_START = MONTH_DAYS.reduce((a, n, i) => (a.push(i ? a[i-1] + MONTH_DAYS[i-1] : 0), a), []);
const STEP_DAY = 360 / 31, STEP_MONTH = 360 / 12, STEP_YEAR = 360 / 366;

/* Geometry (world units). z = height of each disc's top face. */
const D = { base: 2.9, ringIn: 1.62, ringOut: 2.65, ringTop: .14, midR: 1.46, midTop: .30, ctrR: .62, ctrTop: .46 };

/* Glacier — ice-white faces, with the blue centre disc as the one bold element */
const P = {
  base: '#9fb0ba', ring: '#dfe7ec', mid: '#f1f5f7',
  ctr: '#2f6b94', ctrInk: '#f3f7fa',
  ink: '#14222c', hair: '#2f6b94', metal: '#cfd5da', pin: '#24587c',
};


export function createDial({ canvas, date: initialDate, onScrub, onCommit }) {
const stage = canvas;
const wrap = stage.parentElement;
const RM = matchMedia('(prefers-reduced-motion: reduce)');

const renderer = new THREE.WebGLRenderer({canvas: stage, antialias: true, alpha: true, powerPreference: 'high-performance'});
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .55;                                  // soft fill only — no mirror glare
const camera = new THREE.PerspectiveCamera(28, 1, .1, 100);
const watch = new THREE.Group();
scene.add(watch);

/* ---------- canvas painting helpers ---------- */
function rng(seed){
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const makeCanvas = s => { const c = document.createElement('canvas'); c.width = c.height = s; return [c, c.getContext('2d')]; };
const toTexture = cv => {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
};
function atPolar(ctx, c, angle, r, draw){
  ctx.save(); ctx.translate(c, c); ctx.rotate(angle); ctx.translate(0, -r); draw(); ctx.restore();
}
function brush(ctx, S, rIn, rOut, k, count, alpha, rand){   // hairline radial grain, matte
  ctx.save(); ctx.translate(S/2, S/2); ctx.lineWidth = Math.max(1, S/2048);
  for(let i = 0; i < count; i++){
    const a = rand() * TAU;
    const r0 = (rIn + (rOut - rIn) * rand() * .4) * k, r1 = (rIn + (rOut - rIn) * (.6 + rand() * .4)) * k;
    ctx.strokeStyle = rand() < .5 ? `rgba(255,255,255,${alpha * rand()})` : `rgba(0,0,0,${alpha * rand()})`;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
  }
  ctx.restore();
}

/* ---------- printed faces ---------- */
function paintBase(){
  const S = 2048, R = D.base, k = S / (2 * R), c = S / 2;
  const [cv, ctx] = makeCanvas(S);
  ctx.fillStyle = P.base; ctx.fillRect(0, 0, S, S);
  brush(ctx, S, .3, R, k, 2600, .05, rng(11));
  ctx.strokeStyle = P.hair; ctx.globalAlpha = .5; ctx.lineWidth = .008 * k;
  ctx.beginPath(); ctx.arc(c, c, 2.69 * k, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  // title set along the bottom of the flange
  const text = 'ON THIS DAY', r = 2.79 * k;
  ctx.font = `500 ${.082 * k}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = P.ink; ctx.globalAlpha = .7;
  const gap = .05 * k, w = [...text].map(ch => ctx.measureText(ch).width);
  const total = w.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let acc = 0;
  [...text].forEach((ch, i) => {
    const theta = total / 2 / r - (acc + w[i] / 2) / r;
    ctx.save(); ctx.translate(c, c); ctx.rotate(theta); ctx.translate(0, r); ctx.fillText(ch, 0, 0); ctx.restore();
    acc += w[i] + gap;
  });
  return cv;
}
function paintRing(){   // outer ring: day of month, 1–31
  const S = 2048, R = D.ringOut, k = S / (2 * R), c = S / 2;
  const [cv, ctx] = makeCanvas(S);
  ctx.fillStyle = P.ring; ctx.fillRect(0, 0, S, S);
  brush(ctx, S, D.ringIn, R, k, 5200, .05, rng(23));
  ctx.strokeStyle = P.hair; ctx.lineWidth = .008 * k; ctx.globalAlpha = .65;
  [1.72, 2.6].forEach(r => { ctx.beginPath(); ctx.arc(c, c, r * k, 0, TAU); ctx.stroke(); });
  ctx.strokeStyle = P.ink;
  for(let n = 0; n < 62; n++){
    const whole = n % 2 === 0, five = whole && (n / 2) % 5 === 0;
    ctx.save(); ctx.translate(c, c); ctx.rotate(n * STEP_DAY / 2 * DEG);
    ctx.lineWidth = (five ? .024 : whole ? .016 : .009) * k; ctx.globalAlpha = whole ? .9 : .5;
    ctx.beginPath(); ctx.moveTo(0, -(R - .07) * k); ctx.lineTo(0, -(R - (five ? .22 : whole ? .17 : .12)) * k); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for(let d = 1; d <= 31; d++){
    ctx.font = `${d % 5 === 1 ? 600 : 500} ${.23 * k}px ${SERIF}`;
    ctx.fillStyle = P.ink;
    atPolar(ctx, c, (d - 1) * STEP_DAY * DEG, 2.14 * k, () => ctx.fillText(String(d), 0, 0));
  }
  return cv;
}
function paintMid(){    // middle disc: month
  const S = 2048, R = D.midR, k = S / (2 * R), c = S / 2;
  const [cv, ctx] = makeCanvas(S);
  ctx.fillStyle = P.mid; ctx.fillRect(0, 0, S, S);
  const rand = rng(37);
  for(let i = 0; i < 140; i++){            // spun-metal concentric grain, matte
    ctx.strokeStyle = rand() < .5 ? `rgba(255,255,255,${.05 * rand()})` : `rgba(0,0,0,${.05 * rand()})`;
    ctx.lineWidth = Math.max(1, rand() * 2.5);
    ctx.beginPath(); ctx.arc(c, c, (.1 + rand() * (R - .1)) * k, 0, TAU); ctx.stroke();
  }
  ctx.strokeStyle = P.hair; ctx.globalAlpha = .65; ctx.lineWidth = .01 * k;
  [.84, 1.4].forEach(r => { ctx.beginPath(); ctx.arc(c, c, r * k, 0, TAU); ctx.stroke(); });
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for(let m = 0; m < 12; m++){
    ctx.font = `500 ${.2 * k}px ${MONO}`; ctx.fillStyle = P.ink;
    atPolar(ctx, c, m * STEP_MONTH * DEG, 1.12 * k, () => ctx.fillText(MONTH_ABBR[m], 0, 0));
    ctx.fillStyle = P.hair;
    atPolar(ctx, c, (m * STEP_MONTH + 15) * DEG, 1.12 * k, () => { ctx.beginPath(); ctx.arc(0, 0, .026 * k, 0, TAU); ctx.fill(); });
  }
  return cv;
}
function paintCtr(){    // centre: a blue sunburst, one tick per day of the year
  const S = 1024, R = D.ctrR, k = S / (2 * R), c = S / 2, rand = rng(53);
  const [cv, ctx] = makeCanvas(S);
  ctx.fillStyle = P.ctr; ctx.fillRect(0, 0, S, S);
  for(let i = 0; i < 240; i++){
    const a0 = i / 240 * TAU - Math.PI / 2, a1 = (i + 1) / 240 * TAU - Math.PI / 2;
    ctx.fillStyle = i % 2 ? `rgba(0,0,0,${.07 + rand() * .06})` : `rgba(255,255,255,${.09 + rand() * .07})`;
    ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R * k * 1.05, a0, a1); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = P.ctrInk;
  for(let n = 0; n < 366; n++){
    const first = MONTH_START.includes(n);
    ctx.save(); ctx.translate(c, c); ctx.rotate(n * STEP_YEAR * DEG);
    ctx.lineWidth = (first ? .02 : .006) * k; ctx.globalAlpha = first ? 1 : .55;
    ctx.beginPath(); ctx.moveTo(0, -(R - .03) * k); ctx.lineTo(0, -(R - (first ? .13 : .06)) * k); ctx.stroke();
    ctx.restore();
  }
  return cv;
}

/* ---------- materials: matte, no clearcoat, no glass ---------- */
const mat = (extra) => new THREE.MeshStandardMaterial({roughness: .7, metalness: .05, ...extra});
const mats = {
  base: mat({roughness: .8}), ring: mat({roughness: .65}), mid: mat({roughness: .65}),
  ctr: mat({roughness: .55, metalness: .35}),
  edge: new THREE.MeshStandardMaterial({color: P.metal, metalness: .5, roughness: .45, side: THREE.DoubleSide}),
  pin: new THREE.MeshStandardMaterial({color: P.pin, metalness: .8, roughness: .35}),
  cas: new THREE.MeshStandardMaterial({color: P.metal, metalness: .45, roughness: .5, side: THREE.DoubleSide}),
};
['base','ring','mid','ctr'].forEach(k => { mats[k].shadowSide = THREE.DoubleSide; });
const tex = {paint: {base: paintBase, ring: paintRing, mid: paintMid, ctr: paintCtr}};
function applyTextures(){
  for(const k in tex.paint){
    mats[k].map?.dispose();
    mats[k].map = toTexture(tex.paint[k]());
    mats[k].needsUpdate = true;
  }
}

/* ---------- geometry ---------- */
const SEGS = 192;
function makeDisc({outer, inner = 0, top, faceMat}){
  const g = new THREE.Group(); g.position.z = top;
  const face = new THREE.Mesh(inner ? new THREE.RingGeometry(inner, outer, SEGS, 1) : new THREE.CircleGeometry(outer, SEGS), faceMat);
  face.castShadow = face.receiveShadow = true; g.add(face);
  const wall = r => {
    const geo = new THREE.CylinderGeometry(r, r, top, SEGS, 1, true); geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, mats.edge); m.position.z = -top / 2; m.castShadow = m.receiveShadow = true; return m;
  };
  const bevel = r => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, .011, 10, SEGS), mats.edge); m.castShadow = true; return m; };
  g.add(wall(outer), bevel(outer));
  if(inner) g.add(wall(inner), bevel(inner));
  return g;
}
function makePin({width, length, height, y, z = 0}){
  const s = new THREE.Shape(); s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(0, -length); s.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, {depth: height, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2}), mats.pin);
  m.position.set(0, y, z); m.castShadow = m.receiveShadow = true; return m;
}
const basePlate = new THREE.Mesh(new THREE.CircleGeometry(D.base, SEGS), mats.base);
basePlate.receiveShadow = true; watch.add(basePlate);

const dayRing = makeDisc({outer: D.ringOut, inner: D.ringIn, top: D.ringTop, faceMat: mats.ring});
const monthDisc = makeDisc({outer: D.midR, top: D.midTop, faceMat: mats.mid});
const yearDisc = makeDisc({outer: D.ctrR, top: D.ctrTop, faceMat: mats.ctr});
watch.add(dayRing, monthDisc, yearDisc);

const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .1, 48).rotateX(Math.PI / 2), mats.pin);
post.position.z = D.ctrTop + .03; post.castShadow = true; watch.add(post);
watch.add(
  makePin({width: .15, length: .18, height: .22, y: D.ringOut + .21}),
  makePin({width: .11, length: .12, height: .34, y: D.ringIn - .01}),
  makePin({width: .12, length: .13, height: .18, y: D.ctrR + .16, z: D.midTop}),
);
{   // polished case (a plain metal bezel — no crystal dome over the dial)
  const profile = [[2.86,-.35],[2.86,.28],[2.89,.36],[2.96,.41],[3.1,.46],[3.24,.44],[3.35,.36],[3.42,.22],[3.44,0],[3.44,-.35]].map(([r, h]) => new THREE.Vector2(r, h));
  const geo = new THREE.LatheGeometry(profile, 160); geo.rotateX(Math.PI / 2);
  const bezel = new THREE.Mesh(geo, mats.cas); bezel.castShadow = bezel.receiveShadow = true; watch.add(bezel);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(3.44, 3.44, .9, 160).rotateX(Math.PI / 2), mats.cas);
  back.position.z = -.8; watch.add(back);
}

/* ---------- light ---------- */
const key = new THREE.SpotLight(0xfff4e2, 760, 0, .5, .85, 2);
key.position.set(-6, 7, 11); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 6; key.shadow.camera.far = 30;
key.shadow.bias = -.0004; key.shadow.normalBias = .015; key.shadow.radius = 4;
scene.add(key);
scene.add(new THREE.AmbientLight(0xffffff, .45));

/* ---------- state ---------- */
const cur = {day: 0, month: 0, year: 0};    // current rotations, degrees (positive = counter-clockwise, brings the next value to 12 o'clock)
const tgt = {day: 0, month: 0, year: 0};
const drag = {on: null, startAng: 0, startVal: 0, startRot: 0, last: '', start: ''};
const tilt = {x: 0, y: 0, sx: 0, sy: 0};
let intro = {t0: -1, dur: 2.6, k: 1};
const OFFS = {day: -7, month: 5.1, year: -11.5};
const ease = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const dayOfYear = (m, d) => MONTH_START[m - 1] + d - 1;
let date = initialDate;

function setTargets(skip){
  const {m, d} = date;
  const want = {day: (d - 1) * STEP_DAY, month: (m - 1) * STEP_MONTH, year: dayOfYear(m, d) * STEP_YEAR};
  for(const k in want){
    if(k === skip) continue;
    tgt[k] += ((want[k] - tgt[k]) % 360 + 540) % 360 - 180;      // shortest way round
  }
  wake();
}
function setDate(next){ date = next; setTargets(drag.on); }

/* ---------- drag ---------- */
const nowPt = {x: 0, y: 0};
function geom(){
  const r = stage.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const v = new THREE.Vector3(D.ringOut, 0, D.ringTop).project(camera);
  const edgeX = (v.x * .5 + .5) * r.width + r.left;
  return {cx, cy, R: Math.max(20, Math.abs(edgeX - cx))};
}
const angleOf = (e, g) => Math.atan2(e.clientX - g.cx, -(e.clientY - g.cy)) / DEG;       // clockwise from 12
function pick(e){
  const g = geom(), rr = Math.hypot(e.clientX - g.cx, e.clientY - g.cy) / g.R;
  if(rr > 1.02) return null;
  if(rr >= D.ringIn / D.ringOut - .02) return 'day';
  if(rr >= D.ctrR / D.ringOut + .05) return 'month';
  return 'year';
}
const spec = {day: [31, STEP_DAY], month: [12, STEP_MONTH], year: [366, STEP_YEAR]};
function dateFor(k, val){
  const n = spec[k][0], i = ((Math.round(val) % n) + n) % n;
  const {m, d} = date;
  if(k === 'day') return {m, d: Math.min(i + 1, MONTH_DAYS[m - 1])};
  if(k === 'month') return {m: i + 1, d: Math.min(d, MONTH_DAYS[i])};
  let mm = 11; while(MONTH_START[mm] > i) mm--;
  return {m: mm + 1, d: i - MONTH_START[mm] + 1};
}
stage.addEventListener('pointerdown', e => {
  const k = pick(e); if(!k) return;
  const g = geom();
  drag.on = k; drag.startAng = angleOf(e, g); drag.startRot = cur[k]; drag.last = drag.start = `${date.m}-${date.d}`;
  stage.setPointerCapture(e.pointerId);
  stage.classList.add('grab');
  e.preventDefault(); wake();
});
stage.addEventListener('pointermove', e => {
  tilt.x = (e.clientX / innerWidth) * 2 - 1; tilt.y = -((e.clientY / innerHeight) * 2 - 1);
  if(!drag.on){
    stage.style.cursor = pick(e) ? 'grab' : 'default';
    wake(); return;
  }
  const k = drag.on, g = geom();
  let delta = angleOf(e, g) - drag.startAng;
  delta = ((delta + 540) % 360) - 180;                      // unwrap across the 12 o'clock seam
  drag.startAng += delta;                                   // accumulate so several turns work
  tgt[k] = cur[k] = (drag.startRot -= delta);               // clockwise drag turns the face clockwise
  const next = dateFor(k, drag.startRot / spec[k][1]);
  const sig = `${next.m}-${next.d}`;
  if(sig !== drag.last){
    drag.last = sig;
    date = next; setTargets(drag.on);
    onScrub(next);
  }
  wake();
});
function release(){
  if(!drag.on) return;
  drag.on = null;
  stage.classList.remove('grab');
  if(drag.last !== drag.start) onCommit({...date});
  setTargets();
}
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);
addEventListener('pointerleave', () => { tilt.x = tilt.y = 0; wake(); });
document.addEventListener('pointerleave', () => { tilt.x = tilt.y = 0; wake(); });

/* ---------- sizing + render-on-demand ---------- */
function fit(){
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.z = 3.95 / Math.tan(camera.fov * DEG / 2);
  camera.updateProjectionMatrix();
  wake();
}
new ResizeObserver(fit).observe(wrap);

let raf = 0, lastT = 0, visible = true;
new IntersectionObserver(([en]) => { visible = en.isIntersecting; if(visible) wake(); }).observe(wrap);
function wake(){ if(!raf && visible) raf = requestAnimationFrame(frame); }

function frame(t){
  raf = 0;
  const dt = Math.min(.1, (t - lastT) / 1000 || .016); lastT = t;
  let busy = false;

  if(intro.t0 < 0) intro.t0 = t;
  const prog = RM.matches ? 1 : Math.min(1, (t - intro.t0) / 1000 / intro.dur);
  const spin = (1 - ease(prog)) * intro.k;
  if(prog < 1) busy = true;

  const f = RM.matches ? 1 : 1 - Math.exp(-dt * 9);
  for(const k in cur){
    if(drag.on === k) continue;
    const diff = tgt[k] - cur[k];
    if(Math.abs(diff) > .01){ cur[k] += diff * f; busy = true; } else cur[k] = tgt[k];
  }
  if(drag.on) busy = true;
  dayRing.rotation.z = cur.day * DEG + spin * OFFS.day;
  monthDisc.rotation.z = cur.month * DEG + spin * OFFS.month;
  yearDisc.rotation.z = cur.year * DEG + spin * OFFS.year;

  const tf = 1 - Math.exp(-dt * 5), mag = RM.matches || drag.on ? 0 : 1;
  tilt.sx += (tilt.x * mag - tilt.sx) * tf; tilt.sy += (tilt.y * mag - tilt.sy) * tf;
  if(Math.abs(tilt.x * mag - tilt.sx) + Math.abs(tilt.y * mag - tilt.sy) > .002) busy = true;
  watch.rotation.y = tilt.sx * .16; watch.rotation.x = -tilt.sy * .13;
  key.position.set(-6 + tilt.sx * 1.6, 7 + tilt.sy * 1.2, 11);

  renderer.render(scene, camera);
  if(!stage.classList.contains('ready')) stage.classList.add('ready');
  if(busy) raf = requestAnimationFrame(frame);
}

/* ---------- boot: wait for the site typefaces so numerals print right ---------- */
(async () => {
  try{
    if(document.fonts?.load){
      await Promise.race([
        Promise.all([document.fonts.load('500 64px "Fraunces"'), document.fonts.load('600 64px "Fraunces"'), document.fonts.load('500 64px "IBM Plex Mono"')]),
        new Promise(r => setTimeout(r, 2500)),
      ]);
    }
  }catch{}
  fit();
  applyTextures();
  for(const k in cur){ cur[k] = tgt[k] = 0; }
  setTargets();
  for(const k in cur){ cur[k] = tgt[k]; }                 // start settled; the intro supplies the motion
  wake();
})();

return { setDate };
}
