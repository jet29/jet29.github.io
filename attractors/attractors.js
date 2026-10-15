// Strange attractors. Each particle is a point moving under one set of differential equations;
// nothing is random after the start, yet the swarm never settles and never repeats. Four classic
// systems, each with its own time step, framing and scale. Colour is speed.
import * as THREE from 'three';

const N = 30000;

const SYSTEMS = {
  lorenz: {
    dt: 0.004, sub: 3, scale: 0.42, center: [0, 0, 27], spawn: 20, vmax: 180,
    f: (x, y, z, o) => { o[0] = 10 * (y - x); o[1] = x * (28 - z) - y; o[2] = x * y - (8 / 3) * z; },
  },
  aizawa: {
    dt: 0.008, sub: 2, scale: 7, center: [0, 0, 0.6], spawn: 0.8, vmax: 5,
    f: (x, y, z, o) => {
      const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, g = 0.1;
      o[0] = (z - b) * x - d * y;
      o[1] = d * x + (z - b) * y;
      o[2] = c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + g * z * x * x * x;
    },
  },
  thomas: {
    dt: 0.04, sub: 2, scale: 2.6, center: [0, 0, 0], spawn: 3, vmax: 1.4,
    f: (x, y, z, o) => { const b = 0.208186; o[0] = Math.sin(y) - b * x; o[1] = Math.sin(z) - b * y; o[2] = Math.sin(x) - b * z; },
  },
  halvorsen: {
    dt: 0.004, sub: 3, scale: 0.95, center: [-1.5, -1.5, -1.5], spawn: 4, vmax: 120,
    f: (x, y, z, o) => {
      const a = 1.89;
      o[0] = -a * x - 4 * y - 4 * z - y * y;
      o[1] = -a * y - 4 * z - 4 * x - z * z;
      o[2] = -a * z - 4 * x - 4 * y - x * x;
    },
  },
};

// ---------- scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e17);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

const pos = new Float32Array(N * 3);     // in the system's own coordinates
const draw = new Float32Array(N * 3);    // scaled and centred for the screen
const col = new Float32Array(N * 3);
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(draw, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
// a soft round dot, so the points are not the default squares
function dot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const swarm = new THREE.Points(geo, new THREE.PointsMaterial({
  size: 0.16, map: dot(), vertexColors: true, transparent: true, opacity: 0.75,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
}));
scene.add(swarm);

// ---------- integration ----------
let sys = SYSTEMS.lorenz;
const d = [0, 0, 0];
const color = new THREE.Color();

function start(name) {
  sys = SYSTEMS[name];
  for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() * 2 - 1) * sys.spawn;
}

function step() {
  const { dt, f, scale, center, vmax } = sys;
  const [cx, cy, cz] = center;
  for (let i = 0; i < N; i++) {
    let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    let v = 0;
    for (let s = 0; s < sys.sub; s++) {
      f(x, y, z, d);
      x += d[0] * dt; y += d[1] * dt; z += d[2] * dt;
      v = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    }
    // a particle that escaped (a few do, from a bad start) is put back near the attractor
    if (!Number.isFinite(x + y + z) || Math.abs(x) + Math.abs(y) + Math.abs(z) > sys.spawn * 50) {
      x = cx + (Math.random() - 0.5) * sys.spawn; y = cy + (Math.random() - 0.5) * sys.spawn; z = cz + (Math.random() - 0.5) * sys.spawn;
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    draw[i * 3] = (x - cx) * scale; draw[i * 3 + 1] = (z - cz) * scale; draw[i * 3 + 2] = -(y - cy) * scale;
    const t = Math.min(1, Math.sqrt(v) / vmax);
    color.setHSL(0.72 - t * 0.6, 0.9, 0.5 + t * 0.2);
    col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b;
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
}

// ---------- controls ----------
const select = document.getElementById('system');
const info = document.getElementById('info');
select.addEventListener('change', () => start(select.value));

// ---------- loop ----------
const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime();
  step();
  const dist = 26 / Math.min(1, camera.aspect) ** 0.5;
  const a = t * 0.1;
  camera.position.set(Math.sin(a) * dist, 6 + Math.sin(t * 0.05) * 4, Math.cos(a) * dist);
  camera.lookAt(0, 0, 0);
  info.textContent = `${N.toLocaleString()} particles`;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
start('lorenz');
resize();
frame();
