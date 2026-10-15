// A random walk in three dimensions. Every particle starts at the origin and takes one Gaussian
// step per tick in each axis. The cloud's root-mean-square distance after n steps is
// sigma * sqrt(3 n), and the wire sphere is drawn at exactly that radius, so you can watch the
// measured cloud and the prediction grow together.
import * as THREE from 'three';

const N = 6000;
const TICKS_PER_S = 60;
const MAX_TICKS = 2400;          // then the cloud fades and starts again
const FADE = 1.2;

let sigma = 0.08;                // step size (standard deviation per axis per tick)

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

// particles
const pos = new Float32Array(N * 3);
const col = new Float32Array(N * 3);
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
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
const mat = new THREE.PointsMaterial({
  size: 0.12, map: dot(), vertexColors: true, transparent: true, opacity: 0.85,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
});
const cloud = new THREE.Points(geo, mat);
scene.add(cloud);

// the predicted rms radius
const shell = new THREE.Mesh(
  new THREE.SphereGeometry(1, 36, 24),
  new THREE.MeshBasicMaterial({ color: 0x7dd3fc, wireframe: true, transparent: true, opacity: 0.12 }),
);
scene.add(shell);

// a faint origin mark
scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })));

// ---------- the walk ----------
let ticks = 0;
let acc = 0;
let fade = -1;
const color = new THREE.Color();

// Box-Muller: two standard normals per call
let spare = null;
function gauss() {
  if (spare !== null) { const s = spare; spare = null; return s; }
  let u, v, s;
  do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
  const f = Math.sqrt((-2 * Math.log(s)) / s);
  spare = v * f;
  return u * f;
}

function tick() {
  for (let i = 0; i < N * 3; i++) pos[i] += gauss() * sigma;
  ticks++;
}

function measure() {
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    sum += x * x + y * y + z * z;
  }
  return Math.sqrt(sum / N);
}

function recolor(rms) {
  // hue by distance from the origin, relative to the predicted rms: inside is cool, outside warm
  for (let i = 0; i < N; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const r = Math.sqrt(x * x + y * y + z * z) / Math.max(rms, 1e-6);
    color.setHSL(0.62 - Math.min(1.6, r) * 0.25, 0.85, 0.6);
    col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b;
  }
  geo.attributes.color.needsUpdate = true;
}

function reset() {
  pos.fill(0);
  ticks = 0; acc = 0; fade = -1;
  mat.opacity = 0.85;
  shell.material.opacity = 0.12;
  geo.attributes.position.needsUpdate = true;
}

// ---------- controls ----------
const stepInput = document.getElementById('step');
const stepOut = document.getElementById('step-out');
const info = document.getElementById('info');
stepInput.addEventListener('input', () => {
  sigma = Number(stepInput.value);
  stepOut.value = sigma.toFixed(2);
  reset();
});

// ---------- loop ----------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (fade >= 0) {
    fade += dt;
    const s = Math.max(0, 1 - fade / FADE);
    mat.opacity = 0.85 * s;
    shell.material.opacity = 0.12 * s;
    if (fade >= FADE) reset();
  } else {
    acc += dt;
    while (acc >= 1 / TICKS_PER_S) { acc -= 1 / TICKS_PER_S; tick(); }
    geo.attributes.position.needsUpdate = true;
    if (ticks >= MAX_TICKS) fade = 0;
  }

  const predicted = sigma * Math.sqrt(3 * ticks);
  const measured = measure();
  shell.scale.setScalar(Math.max(predicted, 0.01));
  recolor(predicted);

  // the camera backs away as the cloud grows, and circles slowly
  const d = 4 + predicted * 2.2;
  const a = t * 0.12;
  camera.position.set(Math.sin(a) * d, d * 0.3, Math.cos(a) * d);
  camera.lookAt(0, 0, 0);

  info.textContent = `${ticks} steps · rms distance ${measured.toFixed(2)} measured, ${predicted.toFixed(2)} predicted`;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
resize();
frame();
