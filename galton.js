// A Galton board. Balls are not simulated with physics: each one rolls its whole path when it is
// spawned (one coin per peg row), then is animated peg to peg along that path. That keeps the
// motion smooth at any frame rate and makes the pile exactly binomial, which is the point.
import * as THREE from 'three';

const ROWS = 14;                 // peg rows; the bins are ROWS + 1
const BINS = ROWS + 1;
const S = 1;                     // peg spacing
const R = 0.23;                  // ball radius
const PEG_R = 0.09;
const REST = R + PEG_R;          // a ball sitting on a peg
const BIN_H = 12;
const TOP_Y = 0;                 // first peg row
const BIN_TOP = TOP_Y - ROWS * S;
const BIN_BOTTOM = BIN_TOP - BIN_H;
const SPAWN_Y = TOP_Y + 3;
const COLS = 2;                  // settled balls stack two per row
const COL_X = 0.235;
const CAPACITY = COLS * Math.floor(BIN_H / (2 * R));
const MAX_BALLS = 800;
const HOP = 0.16;                // seconds from one peg row to the next
const SPAWN_EVERY = 0.1;
const FADE = 0.8;

let p = 0.5;                     // chance of going right at a peg

// ---------- scene ----------
const canvas = document.getElementById('board');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e17);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
const FRAME_H = SPAWN_Y + 1 - (BIN_BOTTOM - 1);
const FRAME_W = BINS * S + 2;
const FRAME_CY = (SPAWN_Y + 1 + BIN_BOTTOM - 1) / 2;

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = Math.max(FRAME_H / (2 * t), FRAME_W / (2 * t * camera.aspect));
  camera.position.set(0, FRAME_CY, d * 1.05);
  camera.lookAt(0, FRAME_CY, 0);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x202030, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(6, 10, 14);
scene.add(sun);
const fill = new THREE.PointLight(0x7dd3fc, 60, 0, 2);
fill.position.set(-8, 2, 8);
scene.add(fill);

const board = new THREE.Group();
scene.add(board);

// back plate
board.add(new THREE.Mesh(
  new THREE.PlaneGeometry(FRAME_W, FRAME_H),
  new THREE.MeshStandardMaterial({ color: 0x131828, roughness: 0.9, metalness: 0 }),
).translateY(FRAME_CY).translateZ(-0.6));

// pegs
const pegGeo = new THREE.CylinderGeometry(PEG_R, PEG_R, 0.6, 16);
pegGeo.rotateX(Math.PI / 2);
const pegs = new THREE.InstancedMesh(
  pegGeo,
  new THREE.MeshStandardMaterial({ color: 0x9aa4bf, roughness: 0.35, metalness: 0.6 }),
  (ROWS * (ROWS + 1)) / 2,
);
{
  const m = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j <= i; j++) {
      m.makeTranslation((j - i / 2) * S, TOP_Y - i * S, 0);
      pegs.setMatrixAt(n++, m);
    }
  }
}
board.add(pegs);

// bins
const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a4460, roughness: 0.5, metalness: 0.2, transparent: true, opacity: 0.85 });
for (let k = 0; k <= BINS; k++) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.06, BIN_H, 0.6), wallMat);
  wall.position.set((k - BINS / 2) * S, BIN_TOP - BIN_H / 2, 0);
  board.add(wall);
}
const floor = new THREE.Mesh(new THREE.BoxGeometry(BINS * S + 0.06, 0.06, 0.6), wallMat);
floor.position.set(0, BIN_BOTTOM - 0.03, 0);
board.add(floor);

// balls
const balls = new THREE.InstancedMesh(
  new THREE.SphereGeometry(R, 20, 14),
  new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.1 }),
  MAX_BALLS,
);
balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
{
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < MAX_BALLS; i++) { balls.setMatrixAt(i, hidden); balls.setColorAt(i, white); }
}
board.add(balls);

// the expected pile, as a line
const CURVE_N = 120;
const curveGeo = new THREE.BufferGeometry();
curveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CURVE_N * 3), 3));
const curve = new THREE.Line(curveGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
curve.position.z = 0.45;
board.add(curve);

// ---------- the binomial ----------
const CHOOSE = [];
for (let k = 0, c = 1; k <= ROWS; k++) { CHOOSE.push(c); c = (c * (ROWS - k)) / (k + 1); }
const pmf = (k) => CHOOSE[k] * p ** k * (1 - p) ** (ROWS - k);
const binX = (k) => (k - ROWS / 2) * S;

function updateCurve(total) {
  const pts = [new THREE.Vector3(binX(0) - S, BIN_BOTTOM, 0)];
  for (let k = 0; k < BINS; k++) pts.push(new THREE.Vector3(binX(k), BIN_BOTTOM + total * pmf(k) * R, 0));
  pts.push(new THREE.Vector3(binX(ROWS) + S, BIN_BOTTOM, 0));
  const pos = curveGeo.attributes.position;
  new THREE.CatmullRomCurve3(pts).getPoints(CURVE_N - 1).forEach((v, i) => pos.setXYZ(i, v.x, v.y, v.z));
  pos.needsUpdate = true;
}

// ---------- balls in flight ----------
const live = [];                 // balls not yet settled
const free = [];                 // unused instance slots
for (let i = MAX_BALLS - 1; i >= 0; i--) free.push(i);
const counts = new Array(BINS).fill(0);
let settled = 0;
let spawnClock = 0;
let draining = false;            // a bin is full: no new balls, wait for the rest to land
let fade = -1;                   // > 0 while the pile shrinks away
const color = new THREE.Color();
const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const one = new THREE.Vector3(1, 1, 1);
const pos = new THREE.Vector3();

function spawn() {
  const idx = free.pop();
  if (idx === undefined) return;
  let k = 0;
  const path = new Uint8Array(ROWS);
  for (let i = 0; i < ROWS; i++) { path[i] = Math.random() < p ? 1 : 0; k += path[i]; }
  // colour by where it will land, so a biased board shows its bias
  color.setHSL(0.55 + (k / ROWS) * 0.35, 0.8, 0.62);
  balls.setColorAt(idx, color);
  balls.instanceColor.needsUpdate = true;
  // its place in the pile is taken now: balls land in the order they leave, the curve counts it
  // already, and a bin can never be given more than it holds
  const slot = counts[k]++;
  if (counts[k] >= CAPACITY) draining = true;
  live.push({
    idx, path, k, slot, row: -1, t: 0, dur: 0.35,
    x0: 0, y0: SPAWN_Y, x1: 0, y1: TOP_Y + REST, z: (Math.random() - 0.5) * 0.16,
  });
}

function advance(b) {
  b.t = 0;
  b.row++;
  b.x0 = b.x1; b.y0 = b.y1;
  if (b.row < ROWS) {
    // bounce off this row's peg to the next row (or to the mouth of the bin after the last row)
    b.x1 = b.x0 + (b.path[b.row] ? 0.5 : -0.5) * S;
    b.y1 = TOP_Y - (b.row + 1) * S + REST;
    b.dur = HOP;
    return;
  }
  // into the bin, onto the place reserved for it
  b.x1 = binX(b.k) + (b.slot % COLS ? COL_X : -COL_X);
  b.y1 = BIN_BOTTOM + R + Math.floor(b.slot / COLS) * 2 * R;
  b.dur = 0.1 + (b.y0 - b.y1) * 0.04;
}

const ease = (u) => u * u * (3 - 2 * u);

function step(dt) {
  if (fade >= 0) {
    fade += dt;
    const s = Math.max(0, 1 - fade / FADE);
    const unused = new Set(free);
    for (let i = 0; i < MAX_BALLS; i++) {
      if (unused.has(i)) continue;
      balls.getMatrixAt(i, m);
      pos.setFromMatrixPosition(m);
      balls.setMatrixAt(i, m.compose(pos, q, one.clone().multiplyScalar(s)));
    }
    balls.instanceMatrix.needsUpdate = true;
    if (fade >= FADE) reset();
    return;
  }

  if (!draining) {
    spawnClock += dt;
    while (spawnClock >= SPAWN_EVERY) { spawnClock -= SPAWN_EVERY; spawn(); }
  }

  for (let i = live.length - 1; i >= 0; i--) {
    const b = live[i];
    b.t += dt;
    let u = Math.min(1, b.t / b.dur);
    let x, y;
    if (b.row < 0) {                       // falling in from the top
      x = b.x0; y = THREE.MathUtils.lerp(b.y0, b.y1, u * u);
    } else if (b.row < ROWS) {             // hopping peg to peg
      x = THREE.MathUtils.lerp(b.x0, b.x1, ease(u));
      y = THREE.MathUtils.lerp(b.y0, b.y1, u) + Math.sin(Math.PI * u) * 0.2;
    } else {                               // dropping into the bin
      x = THREE.MathUtils.lerp(b.x0, b.x1, Math.min(1, u * 3));
      y = THREE.MathUtils.lerp(b.y0, b.y1, u * u);
    }
    balls.setMatrixAt(b.idx, m.makeTranslation(x, y, b.z));
    if (u < 1) continue;
    if (b.row >= ROWS) { settled++; live.splice(i, 1); continue; }
    advance(b);
  }
  balls.instanceMatrix.needsUpdate = true;

  if (draining && live.length === 0) fade = 0;
}

function reset() {
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX_BALLS; i++) balls.setMatrixAt(i, hidden);
  balls.instanceMatrix.needsUpdate = true;
  free.length = 0;
  for (let i = MAX_BALLS - 1; i >= 0; i--) free.push(i);
  live.length = 0;
  counts.fill(0);
  settled = 0;
  spawnClock = 0;
  draining = false;
  fade = -1;
}

// ---------- controls ----------
const biasInput = document.getElementById('bias');
const biasOut = document.getElementById('bias-out');
const countOut = document.getElementById('count');
biasInput.addEventListener('input', () => {
  p = Number(biasInput.value);
  biasOut.value = p.toFixed(2);
  if (fade < 0) { draining = true; }   // let the balls in flight land, then start over with the new bias
});

// ---------- loop ----------
const clock = new THREE.Clock();
let shown = -1;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  step(dt);
  const t = clock.elapsedTime;
  board.rotation.y = Math.sin(t * 0.25) * 0.28;
  board.rotation.x = -0.04;
  updateCurve(counts.reduce((a, b) => a + b, 0));
  if (settled !== shown) { shown = settled; countOut.textContent = `${settled} ball${settled === 1 ? '' : 's'}`; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
resize();
frame();
