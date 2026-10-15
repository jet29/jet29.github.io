// Diffusion-limited aggregation on a cubic lattice. One seed sits at the centre. Walkers are
// released on a sphere just outside the cluster, wander one lattice step at a time, and stick
// when they land next to it (with the given probability; a lower one lets them slip deeper in
// and the cluster grows denser). A walker that drifts too far away is thrown out and replaced.
import * as THREE from 'three';

const G = 112;                   // lattice side
const C = G / 2;
const MAX_R = C - 6;             // the cluster may grow to this radius, then it starts over
const MAX_N = 24000;
const STEPS_PER_FRAME = 40000;
const FADE = 1;

let stick = 1;

// ---------- scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e17);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x202030, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(1, 1.5, 1);
scene.add(sun);

const particles = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.62, 8, 6),
  new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1 }),
  MAX_N,
);
particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
particles.count = 0;
scene.add(particles);

// ---------- the lattice ----------
const cells = new Uint8Array(G * G * G);
const at = (x, y, z) => (x * G + y) * G + z;
let n = 0;                       // particles in the cluster
let radius = 0;                  // farthest one from the seed
let fade = -1;
const m = new THREE.Matrix4();
const color = new THREE.Color();

function add(x, y, z) {
  cells[at(x, y, z)] = 1;
  const dx = x - C, dy = y - C, dz = z - C;
  const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
  radius = Math.max(radius, r);
  // colour by distance from the seed: the core is pale violet, the tips run to cyan and green
  color.setHSL(0.74 - (r / MAX_R) * 0.42, 0.8, 0.62);
  particles.setColorAt(n, color);
  particles.setMatrixAt(n, m.makeTranslation(dx, dy, dz));
  n++;
  particles.count = n;
}

function neighbourTouches(x, y, z) {
  return (x > 0 && cells[at(x - 1, y, z)]) || (x < G - 1 && cells[at(x + 1, y, z)])
    || (y > 0 && cells[at(x, y - 1, z)]) || (y < G - 1 && cells[at(x, y + 1, z)])
    || (z > 0 && cells[at(x, y, z - 1)]) || (z < G - 1 && cells[at(x, y, z + 1)]);
}

let wx = 0, wy = 0, wz = 0;
function release() {
  // a random point on a sphere a little outside the cluster
  const r = radius + 4;
  const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  wx = Math.round(C + r * s * Math.cos(a));
  wy = Math.round(C + r * s * Math.sin(a));
  wz = Math.round(C + r * u);
}

function grow(steps) {
  const kill2 = (radius + 14) ** 2;
  for (let i = 0; i < steps; i++) {
    const d = (Math.random() * 6) | 0;
    if (d === 0) wx++; else if (d === 1) wx--; else if (d === 2) wy++; else if (d === 3) wy--; else if (d === 4) wz++; else wz--;
    const dx = wx - C, dy = wy - C, dz = wz - C;
    if (dx * dx + dy * dy + dz * dz > kill2 || wx <= 0 || wy <= 0 || wz <= 0 || wx >= G - 1 || wy >= G - 1 || wz >= G - 1) { release(); continue; }
    if (neighbourTouches(wx, wy, wz) && Math.random() < stick) {
      add(wx, wy, wz);
      release();
      if (n >= MAX_N || radius >= MAX_R) return;
    }
  }
}

function reset() {
  cells.fill(0);
  n = 0; radius = 0; fade = -1;
  particles.count = 0;
  particles.material.opacity = 1;
  particles.material.transparent = false;
  add(C, C, C);
  release();
}

// ---------- controls ----------
const stickInput = document.getElementById('stick');
const stickOut = document.getElementById('stick-out');
const info = document.getElementById('info');
stickInput.addEventListener('input', () => {
  stick = Number(stickInput.value);
  stickOut.value = stick.toFixed(2);
  reset();
});

// ---------- loop ----------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (fade >= 0) {
    fade += dt;
    particles.material.transparent = true;
    particles.material.opacity = Math.max(0, 1 - fade / FADE);
    if (fade >= FADE) reset();
  } else {
    grow(STEPS_PER_FRAME);
    particles.instanceMatrix.needsUpdate = true;
    particles.instanceColor.needsUpdate = true;
    if (n >= MAX_N || radius >= MAX_R) fade = 0;
  }

  const d = Math.max(40, radius * 3.2);
  const a = t * 0.15;
  camera.position.set(Math.sin(a) * d, Math.sin(t * 0.07) * d * 0.35, Math.cos(a) * d);
  camera.lookAt(0, 0, 0);

  info.textContent = `${n} particles · radius ${radius.toFixed(0)}`;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
reset();
resize();
frame();
