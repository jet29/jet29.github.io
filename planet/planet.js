// A planet from noise. Every vertex of a sphere samples a few octaves of 3D simplex noise (sampled
// in 3D, so there is no seam and no pole pinch in the terrain), is pushed out by that height, and
// coloured by it: water below the sea level, then sand, grass, forest, rock and snow.
import * as THREE from 'three';

// ---------- simplex noise (Gustavson's 3D version) ----------
const GRAD = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
const perm = new Uint8Array(512);
function seed() {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const F3 = 1 / 3, G3 = 1 / 6;
function noise(x, y, z) {
  const s = (x + y + z) * F3;
  const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
  const t = (i + j + k) * G3;
  const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }
  const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
  const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
  const ii = i & 255, jj = j & 255, kk = k & 255;
  let n = 0;
  const corner = (px, py, pz, gi) => {
    let t = 0.6 - px * px - py * py - pz * pz;
    if (t < 0) return 0;
    t *= t;
    const g = GRAD[gi % 12];
    return t * t * (g[0] * px + g[1] * py + g[2] * pz);
  };
  n += corner(x0, y0, z0, perm[ii + perm[jj + perm[kk]]]);
  n += corner(x1, y1, z1, perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]]);
  n += corner(x2, y2, z2, perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]]);
  n += corner(x3, y3, z3, perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]]);
  return 32 * n;
}
function fbm(x, y, z) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < 6; o++) {
    sum += noise(x * f, y * f, z * f) * amp;
    norm += amp;
    amp *= 0.5; f *= 2.05;
  }
  return sum / norm;
}

// ---------- scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e17);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.set(0, 0.6, Math.max(3.6, 3.6 / camera.aspect));
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

scene.add(new THREE.AmbientLight(0x334466, 0.6));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
sun.position.set(5, 2, 3);
scene.add(sun);

// stars
{
  const n = 1500, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 60;
    a[i * 3] = r * s * Math.cos(t); a[i * 3 + 1] = r * s * Math.sin(t); a[i * 3 + 2] = r * u;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaab4d0, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.7 })));
}

const geo = new THREE.SphereGeometry(1, 256, 160);
const base = geo.attributes.position.array.slice();   // the unit sphere, kept for re-displacement
const count = geo.attributes.position.count;
const heights = new Float32Array(count);
geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
const planet = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: false }));
scene.add(planet);

// a thin atmosphere: a soft glow sprite behind the planet, always facing the camera
{
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0.0, 'rgba(95,168,255,0.55)');
  grad.addColorStop(0.72, 'rgba(95,168,255,0.55)');
  grad.addColorStop(0.8, 'rgba(95,168,255,0.18)');
  grad.addColorStop(1.0, 'rgba(95,168,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(2.9);
  glow.position.z = -0.2;
  scene.add(glow);
}

// ---------- the terrain ----------
let sea = 0;
let offset = new THREE.Vector3();
const c = new THREE.Color();
const RAMP = [
  [-1.00, 0x0b2a5a], [-0.10, 0x0f3f80], [0.00, 0x1a6ab8],   // deep to shallow water
  [0.01, 0xd8c99a],                                          // sand
  [0.05, 0x5f9a3c], [0.18, 0x2f6b2a],                        // grass to forest
  [0.32, 0x6e6a5e], [0.45, 0x8d8a82],                        // rock
  [0.58, 0xf2f5f8],                                          // snow
];
function rampColor(h, out) {
  let i = 0;
  while (i < RAMP.length - 1 && RAMP[i + 1][0] <= h) i++;
  const [h0, c0] = RAMP[i];
  if (i === RAMP.length - 1 || h0 >= 0.45 || (h0 < 0 && RAMP[i + 1][0] > 0)) return out.setHex(c0);
  const [h1, c1] = RAMP[i + 1];
  return out.setHex(c0).lerp(new THREE.Color(c1), (h - h0) / (h1 - h0));
}

function sampleHeights() {
  for (let i = 0; i < count; i++) {
    const x = base[i * 3] + offset.x, y = base[i * 3 + 1] + offset.y, z = base[i * 3 + 2] + offset.z;
    // continents from a low frequency, detail from higher ones, sharpened a little
    const h = fbm(x * 1.6, y * 1.6, z * 1.6);
    heights[i] = Math.sign(h) * Math.abs(h) ** 1.15 * 1.3;
  }
}

function displace() {
  const p = geo.attributes.position.array, col = geo.attributes.color.array;
  let land = 0;
  for (let i = 0; i < count; i++) {
    const h = heights[i] - sea;
    const r = h > 0 ? 1 + h * 0.12 : 1;              // the sea is flat
    p[i * 3] = base[i * 3] * r; p[i * 3 + 1] = base[i * 3 + 1] * r; p[i * 3 + 2] = base[i * 3 + 2] * r;
    rampColor(h, c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    if (h > 0) land++;
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  geo.computeVertexNormals();
  info.textContent = `${Math.round((100 * land) / count)}% land`;
}

function newPlanet() {
  seed();
  offset.set(Math.random() * 100, Math.random() * 100, Math.random() * 100);
  sampleHeights();
  displace();
}

// ---------- controls ----------
const info = document.getElementById('info');
const seaInput = document.getElementById('sea');
const seaOut = document.getElementById('sea-out');
seaInput.addEventListener('input', () => {
  sea = Number(seaInput.value);
  seaOut.value = sea.toFixed(2);
  displace();
});
document.getElementById('new').addEventListener('click', newPlanet);

// ---------- loop ----------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  planet.rotation.y += dt * 0.12;
  planet.rotation.x = 0.25;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
newPlanet();
resize();
frame();
