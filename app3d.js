/* =====================================================================
   I-CAR — 3D-часть сайта (Three.js): заставка, машина на подиуме, колесо у формы.
   Машина — Lada Niva 4x4, собрана в коде (размеры близки к настоящим, в метрах).
   Свою модель .glb можно подставить в SITE.carModel в начале index.html.
   ===================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const ICAR = window.ICAR; // SITE — глобальная константа из index.html
const rootCSS = getComputedStyle(document.documentElement);
const ACCENT = new THREE.Color(rootCSS.getPropertyValue('--accent').trim() || '#39FF6A');
const BG = new THREE.Color(rootCSS.getPropertyValue('--bg').trim() || '#0A0A0C');
const DPR = Math.min(devicePixelRatio || 1, 1.75);
const V3 = THREE.Vector3;
const clamp01 = v => Math.min(Math.max(v, 0), 1);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (1 - Math.cos(Math.PI * t)) / 2;
const bounce = x => {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375;
  return n * (x -= 2.625 / d) * x + .984375;
};

/* ---------- общие помощники ---------- */
function makeRenderer(canvas, alpha) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
  r.setPixelRatio(DPR);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}
function addEnv(r, scene) {
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  pm.dispose();
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const radialTex = rgba => canvasTex(256, 256, g => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, rgba); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});
const glowMat = (map, color, opacity = 1) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
function flat(geo, mat, y) { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; return m; }
function disposeScene(scene, r) {
  scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  r.dispose(); r.forceContextLoss();
}
function addGroundFx(car) {
  car.add(flat(new THREE.PlaneGeometry(5, 2.7), new THREE.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,.92)'), transparent: true, depthWrite: false }), .004));
  car.add(flat(new THREE.PlaneGeometry(4.2, 2.3), glowMat(radialTex('rgba(255,255,255,.25)'), ACCENT), .008));
}

/* ======================= LADA NIVA 4x4 ======================= */
function nivaMaterials() {
  return {
    paint:   new THREE.MeshPhysicalMaterial({ color: 0x3a3f47, metalness: .6, roughness: .32, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.4 }),
    glass:   new THREE.MeshPhysicalMaterial({ color: 0x020305, metalness: 0, roughness: .04, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: .9 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x141517, roughness: .78, metalness: .05 }),
    chrome:  new THREE.MeshStandardMaterial({ color: 0xd5d9de, metalness: 1, roughness: .16 }),
    rubber:  new THREE.MeshStandardMaterial({ color: 0x131315, roughness: .92, side: THREE.DoubleSide }),
    rim:     new THREE.MeshStandardMaterial({ color: 0xb4b9c0, metalness: .9, roughness: .32, side: THREE.DoubleSide }),
    dark:    new THREE.MeshStandardMaterial({ color: 0x050506, roughness: .6, side: THREE.DoubleSide }),
    lens:    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe9f2ff, emissiveIntensity: 1.3, toneMapped: false }),
    accent:  new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.4, toneMapped: false }),
    tail:    new THREE.MeshStandardMaterial({ color: 0x5a0010, emissive: 0xff1f3d, emissiveIntensity: 1.5, toneMapped: false }),
    amber:   new THREE.MeshStandardMaterial({ color: 0x5a3300, emissive: 0xffa21a, emissiveIntensity: .8, toneMapped: false })
  };
}

// Колесо 175/80 R16: шина с боковинами и протектором, штампованный диск с отверстиями
function nivaWheel(M) {
  const wheel = new THREE.Group(), spin = new THREE.Group();
  wheel.add(spin);
  const lathe = (pts, mat) => {
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), 64), mat);
    m.rotation.x = Math.PI / 2; spin.add(m); return m;
  };
  lathe([[.232, -.1], [.29, -.108], [.326, -.1], [.344, -.075], [.347, 0], [.344, .075], [.326, .1], [.29, .108], [.232, .1]], M.rubber);
  // протектор
  const N = 44, tread = new THREE.InstancedMesh(new THREE.BoxGeometry(.046, .016, .17), M.rubber, N), d = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    d.position.set(Math.cos(a) * .347, Math.sin(a) * .347, 0); d.rotation.set(0, 0, a - Math.PI / 2); d.updateMatrix();
    tread.setMatrixAt(i, d.matrix);
  }
  spin.add(tread);
  // диск
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.236, .236, .19, 48, 1, true), M.dark);
  barrel.rotation.x = Math.PI / 2; spin.add(barrel);
  lathe([[0, .086], [.058, .086], [.074, .07], [.17, .056], [.212, .07], [.236, .092], [.244, .1]], M.rim);
  const holeGeo = new THREE.CylinderGeometry(.03, .03, .03, 20);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, h = new THREE.Mesh(holeGeo, M.dark);
    h.rotation.x = Math.PI / 2; h.position.set(Math.cos(a) * .135, Math.sin(a) * .135, .062); spin.add(h);
  }
  const nutGeo = new THREE.CylinderGeometry(.011, .011, .026, 6);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, n = new THREE.Mesh(nutGeo, M.chrome);
    n.rotation.x = Math.PI / 2; n.position.set(Math.cos(a) * .072, Math.sin(a) * .072, .092); spin.add(n);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.042, .046, .03, 32), M.chrome);
  cap.rotation.x = Math.PI / 2; cap.position.z = .095; spin.add(cap);
  return { wheel, spin };
}

const plateTex = () => canvasTex(520, 112, g => {
  g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, 520, 112);
  g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(5, 5, 510, 102);
  g.beginPath(); g.moveTo(398, 5); g.lineTo(398, 107); g.stroke();
  g.fillStyle = '#111'; g.textBaseline = 'middle';
  g.font = 'bold 74px Arial, sans-serif'; g.fillText('А 024 МР', 24, 60);
  g.font = 'bold 52px Arial, sans-serif'; g.fillText('77', 428, 44);
  g.font = 'bold 20px Arial, sans-serif'; g.fillText('RUS', 412, 90);
  [['#fff', 76], ['#1c3fa8', 84], ['#d52b1e', 92]].forEach(([c, y]) => { g.fillStyle = c; g.fillRect(466, y, 34, 8); });
});

function nivaCar() {
  const M = nivaMaterials();
  const car = new THREE.Group(), body = new THREE.Group();
  car.add(body);
  const add = (geo, mat, [x, y, z], [rx, ry, rz] = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); body.add(m); return m;
  };
  const shape = build => { const s = new THREE.Shape(); build(s); return s; };
  const ext = (s, depth, b) => {
    const g = new THREE.ExtrudeGeometry(s, { depth: depth - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b * .8, bevelSegments: 5, curveSegments: 32 });
    g.translate(0, 0, -(depth - 2 * b) / 2); return g;
  };
  const rbox = (w, h, d, r = .03) => new RoundedBoxGeometry(w, h, d, 3, r);
  const sides = fn => [-1, 1].forEach(fn);

  // кузов: профиль сбоку с вырезами арок, выдавлен на ширину 1,66 м
  add(ext(shape(s => {
    s.moveTo(1.80, .36); s.lineTo(1.86, .48); s.lineTo(1.87, .80); s.quadraticCurveTo(1.87, .91, 1.80, .93);
    s.lineTo(.64, 1.0); s.lineTo(-1.78, 1.02); s.quadraticCurveTo(-1.87, 1.02, -1.87, .94);
    s.lineTo(-1.87, .46); s.lineTo(-1.80, .36); s.lineTo(-1.54, .36);
    s.absarc(-1.10, .36, .44, Math.PI, 0, true); s.lineTo(.66, .36);
    s.absarc(1.10, .36, .44, Math.PI, 0, true); s.lineTo(1.80, .36);
  }), 1.66, .05), M.paint, [0, 0, 0]);

  // кабина: уже кузова (завал боковин), высокая крыша
  add(ext(shape(s => {
    s.moveTo(.68, .97); s.lineTo(.16, 1.56); s.quadraticCurveTo(.10, 1.62, 0, 1.62);
    s.lineTo(-1.62, 1.62); s.quadraticCurveTo(-1.74, 1.62, -1.76, 1.52); s.lineTo(-1.84, 1.0); s.lineTo(.68, .97);
  }), 1.48, .06), M.paint, [0, 0, 0]);

  // боковые стёкла
  const pane = (pts, depth, grow = 0) => new THREE.ExtrudeGeometry(shape(s => {
    s.moveTo(...pts[0]); pts.slice(1).forEach(p => s.lineTo(...p));
  }), { depth, bevelEnabled: grow > 0, bevelThickness: .001, bevelSize: grow, bevelSegments: 1 });
  const frontWin = [[.53, 1.06], [.17, 1.5], [.14, 1.53], [-.52, 1.53], [-.52, 1.06]];
  const rearWin = [[-.64, 1.06], [-.64, 1.53], [-1.65, 1.53], [-1.73, 1.06]];
  sides(sd => [frontWin, rearWin].forEach(w => {
    add(pane(w, .004, .025), M.plastic, [0, 0, sd > 0 ? .741 : -.746]); // чёрный уплотнитель вокруг стекла
    add(pane(w, .008), M.glass, [0, 0, sd > 0 ? .744 : -.752]);
  }));
  // лобовое и заднее стекло — пластины по наклону кабины
  const slab = (a, b, width, off) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), nx = dy / len, ny = -dx / len;
    add(new THREE.BoxGeometry(len - .1, .012, width), M.glass, [(a[0] + b[0]) / 2 + nx * off, (a[1] + b[1]) / 2 + ny * off, 0], [0, 0, Math.atan2(dy, dx)]);
  };
  slab([.16, 1.56], [.68, .97], 1.3, .05);
  slab([-1.84, 1.0], [-1.76, 1.52], 1.26, .05);

  // рейлинги
  sides(sd => {
    add(rbox(1.5, .035, .04, .015), M.plastic, [-.8, 1.71, sd * .58]);
    [-1.45, -.8, -.15].forEach(x => add(new THREE.BoxGeometry(.05, .06, .04), M.plastic, [x, 1.675, sd * .58]));
  });

  // перед: решётка, круглые фары, поворотники, бампер, противотуманки, номер
  add(new THREE.BoxGeometry(.025, .17, .78), M.dark, [1.915, .70, 0]);
  [.64, .70, .76].forEach(y => add(new THREE.BoxGeometry(.012, .014, .76), M.chrome, [1.93, y, 0]));
  sides(sd => {
    add(new THREE.CylinderGeometry(.096, .096, .05, 40), M.dark, [1.915, .72, sd * .56], [0, 0, Math.PI / 2]);
    add(new THREE.CylinderGeometry(.078, .078, .02, 40), M.lens, [1.94, .72, sd * .56], [0, 0, Math.PI / 2]);
    add(new THREE.TorusGeometry(.088, .012, 12, 40), M.chrome, [1.942, .72, sd * .56], [0, Math.PI / 2, 0]);
    add(new THREE.TorusGeometry(.066, .006, 8, 40), M.accent, [1.953, .72, sd * .56], [0, Math.PI / 2, 0]);
    add(new THREE.BoxGeometry(.02, .05, .13), M.amber, [1.92, .585, sd * .56]);
    add(new THREE.CylinderGeometry(.035, .035, .02, 24), M.lens, [2.0, .40, sd * .62], [0, 0, Math.PI / 2]);
  });
  add(rbox(.16, .15, 1.72, .04), M.plastic, [1.92, .42, 0]);
  const plate = new THREE.MeshStandardMaterial({ map: plateTex(), roughness: .5 });
  add(new THREE.PlaneGeometry(.52, .112), plate, [2.003, .43, 0], [0, Math.PI / 2, 0]);

  // зад: фонари, ручка двери багажника, бампер, номер
  sides(sd => {
    add(new THREE.BoxGeometry(.03, .24, .16), M.tail, [-1.905, .79, sd * .70]);
    add(new THREE.BoxGeometry(.03, .08, .16), M.amber, [-1.905, .63, sd * .70]);
  });
  add(new THREE.BoxGeometry(.012, .03, .18), M.chrome, [-1.915, .93, 0]);
  add(rbox(.16, .15, 1.72, .04), M.plastic, [-1.92, .42, 0]);
  add(new THREE.PlaneGeometry(.52, .112), plate, [-2.003, .43, 0], [0, -Math.PI / 2, 0]);

  // расширители арок, пороги, днище
  const flare = new THREE.ExtrudeGeometry(shape(s => { s.absarc(0, 0, .5, 0, Math.PI, false); s.absarc(0, 0, .43, Math.PI, 0, true); }), { depth: .07, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 2 });
  [1.10, -1.10].forEach(x => sides(sd => add(flare, M.plastic, [x, .36, sd > 0 ? .80 : -.87])));
  add(rbox(1.2, .1, 1.74, .03), M.plastic, [0, .33, 0]);
  add(new THREE.BoxGeometry(3.2, .12, 1.1), M.dark, [0, .33, 0]);

  // двери: швы, ручки, зеркала
  sides(sd => {
    [.62, -.56].forEach(x => add(new THREE.BoxGeometry(.006, .58, .004), M.dark, [x, .71, sd * .832]));
    add(new THREE.BoxGeometry(.12, .025, .012), M.chrome, [-.42, .92, sd * .836]);
    add(new THREE.BoxGeometry(.06, .03, .1), M.plastic, [.55, 1.08, sd * .88]);
    add(rbox(.07, .1, .15, .02), M.plastic, [.55, 1.12, sd * .97]);
  });

  // колёса
  const wheels = [];
  [1.10, -1.10].forEach(x => sides(sd => {
    const w = nivaWheel(M);
    w.wheel.position.set(x, .347, sd * .70);
    if (sd < 0) w.wheel.rotation.y = Math.PI;
    body.add(w.wheel); wheels.push({ spin: w.spin, sign: sd });
  }));

  // подгоняем под размер сцены: длина 3,6
  const k = 3.6 / 4.0;
  body.scale.setScalar(k);
  addGroundFx(car);

  return {
    car, custom: false, paint: M.paint, target: M.paint.color.clone(), frontX: 2.0 * k, rearX: -2.0 * k,
    anchors: [
      new V3(-.6 * k, 1.72 * k, 0),      // крыша — диагностика
      new V3(-1.95 * k, .8 * k, 0),      // корма — эвакуатор
      new V3(1.3 * k, .97 * k, 0),       // капот — масло
      new V3(1.10 * k, .347 * k, .82 * k) // переднее колесо — шиномонтаж
    ],
    roll(dist) { const a = dist / (.347 * k); wheels.forEach(w => { w.spin.rotation.z = -a * w.sign; }); },
    setLights(on) {
      M.lens.emissiveIntensity = on ? 1.3 : .02;
      M.accent.emissiveIntensity = on ? 2.4 : .05;
      M.tail.emissiveIntensity = on ? 1.5 : .1;
    }
  };
}
function nivaWheelObj() {
  const w = nivaWheel(nivaMaterials());
  return { wheel: w.wheel, R: .347, setSpin(a) { w.spin.rotation.z = a; } };
}

/* ======================= своя модель .glb (SITE.carModel) ======================= */
async function loadModel(onProgress) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
  const draco = new DRACOLoader();
  draco.setDecoderPath('assets/draco/');
  draco.setDecoderConfig({ type: 'js' });
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync(SITE.carModel, e => { if (e.total) onProgress(e.loaded / e.total); });
  draco.dispose();
  return gltf.scene;
}
function modelCar(raw) {
  const model = raw.clone(true);
  const car = new THREE.Group();
  car.add(model);
  const s0 = new THREE.Box3().setFromObject(model).getSize(new V3());
  if (s0.z > s0.x) model.rotation.y = Math.PI / 2;
  let box = new THREE.Box3().setFromObject(car);
  model.scale.setScalar(3.6 / box.getSize(new V3()).x);
  box.setFromObject(car);
  const c = box.getCenter(new V3());
  model.position.set(-c.x, -box.min.y, -c.z);
  car.updateMatrixWorld(true);
  box.setFromObject(car);
  addGroundFx(car);
  const paint = new THREE.MeshStandardMaterial(); // у чужой модели цвет кузова не меняем
  return {
    car, custom: true, paint, target: paint.color.clone(), frontX: box.max.x, rearX: box.min.x,
    anchors: [new V3(0, box.max.y, 0), new V3(box.min.x, box.max.y * .5, 0), new V3(box.max.x * .6, box.max.y * .6, 0), new V3(box.max.x * .55, box.max.y * .2, box.max.z)],
    roll() {}, setLights() {}
  };
}

/* ======================= ЗАСТАВКА ======================= */
function runIntro(makeWheelFn) {
  const el = document.getElementById('intro');
  if (!el || ICAR.introDone || el.classList.contains('intro--css')) return;
  el.classList.add('is-loaded');

  const r = makeRenderer(el.querySelector('canvas'), false);
  r.setClearColor(BG, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 9, 30);
  addEnv(r, scene);
  const cam = new THREE.PerspectiveCamera(35, 1, .1, 100);
  const look = new V3(0, .9, 0);

  scene.add(flat(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: 0x0b0c0f, metalness: .75, roughness: .35 }), 0));
  const grid = new THREE.GridHelper(140, 140, 0x24272d, 0x24272d);
  grid.material.transparent = true; grid.material.opacity = .22; grid.position.y = .002;
  scene.add(grid);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x080808, .5));
  const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(3, 6, 6); scene.add(key);
  const back = new THREE.DirectionalLight(0xffffff, 1); back.position.set(-4, 3, -5); scene.add(back);

  // Машина в заставке плоская (SVG поверх сцены). В 3D — только «пустышка» той же длины,
  // к которой привязан свет фар; SVG каждый кадр ставится на её место.
  const C = { car: new THREE.Group(), frontX: 1.8, rearX: -1.8 };
  C.car.position.z = .2; scene.add(C.car);
  const flatCar = el.querySelector('.intro__car');
  const flatWheels = [...el.querySelectorAll('.intro__car .iw')];
  C.roll = dist => {
    const deg = (dist / .29 * 180 / Math.PI).toFixed(1); // радиус колеса ≈ 0.29 в единицах сцены
    flatWheels.forEach(w => w.setAttribute('transform', `translate(${w.dataset.x} 238) rotate(${deg})`));
  };
  const spot = new THREE.SpotLight(0xffffff, 14, 10, .42, .8, 1.5);
  spot.position.set(C.frontX - .05, .55, 0); spot.target.position.set(7, 0, 0);
  C.car.add(spot, spot.target);

  let WS = 2.3;
  const WB = makeWheelFn();
  WB.wheel.position.set(60, .28 * WS, 1.6); scene.add(WB.wheel);
  const ring = flat(new THREE.RingGeometry(.9, .95, 96), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false }), .01);
  ring.position.z = 1.6; scene.add(ring);
  const wheelGlow = flat(new THREE.PlaneGeometry(2.4, 2.4), glowMat(radialTex('rgba(255,255,255,.6)'), ACCENT, 0), .006);
  wheelGlow.position.z = 1.6; scene.add(wheelGlow);

  const letters = [...el.querySelectorAll('.intro__brand span')];
  let centers = [];
  const visW = z => 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (cam.position.z - z) * cam.aspect;
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    r.setSize(w, h, false);
    cam.aspect = w / h;
    cam.position.set(0, 1.5, Math.max(10, 8.6 / cam.aspect)); // на узком экране отъезжаем, чтобы машина влезала
    cam.updateProjectionMatrix();
    WS = cam.aspect < .9 ? 3.8 : 2.3; // на телефоне колесо крупнее
    WB.wheel.scale.setScalar(.28 * WS / WB.R); WB.wheel.position.y = .28 * WS;
    ring.scale.setScalar(WS / 2.3); wheelGlow.scale.setScalar(WS / 2.3);
    centers = letters.map(s => { const b = s.getBoundingClientRect(); return b.left + b.width / 2; });
  };
  resize(); addEventListener('resize', resize);

  const v = new V3();
  const t0 = performance.now();
  let finalT = 0;
  r.setAnimationLoop(() => {
    if (ICAR.introDone) {
      r.setAnimationLoop(null); removeEventListener('resize', resize);
      setTimeout(() => disposeScene(scene, r), 1200);
      return;
    }
    const t = ICAR.freezeT ?? (performance.now() - t0) / 1000; // freezeT — для отладки кадра

    // 1) машина проезжает через экран, за ней появляются буквы
    const half = visW(C.car.position.z) / 2 + 2.4;
    const p = clamp01((t - .3) / 2.3);
    const x = lerp(-half, half, easeInOut(p));
    C.car.position.x = x; C.roll(x + half);
    cam.position.x = x * .06;
    cam.lookAt(look.x + x * .08, look.y, look.z);
    cam.updateMatrixWorld();
    // плоская машина: ширина = проекция длины кузова, низ колёс — на линии пола
    const z = C.car.position.z;
    v.set(x + C.rearX, 0, z).project(cam);
    const lx = (v.x + 1) / 2 * innerWidth, gy = (1 - v.y) / 2 * innerHeight;
    v.set(x + C.frontX, 0, z).project(cam);
    const L = (v.x + 1) / 2 * innerWidth - lx, Wpx = L * 820 / 692, Hpx = Wpx * 300 / 820;
    flatCar.style.width = Wpx.toFixed(1) + 'px';
    flatCar.style.transform = `translate(${(lx - 70 / 692 * L).toFixed(1)}px, ${(gy - 294 / 300 * Hpx).toFixed(1)}px)`;
    v.set(x + C.rearX, .6, z).project(cam);
    const sx = (v.x + 1) / 2 * innerWidth;
    letters.forEach((s, i) => { if (!s.classList.contains('on') && (sx > centers[i] || p >= 1)) s.classList.add('on'); });

    // 2) когда название открыто — выкатывается колесо
    if (t > 2.55) {
      const q = clamp01((t - 2.55) / 1.3), start = visW(1.6) / 2 + 1.5;
      const wx = lerp(start, 0, easeOut(q));
      WB.wheel.position.x = wx;
      WB.setSpin((start - wx) / (.28 * WS));
      if (q >= 1 && !finalT) { finalT = t; el.classList.add('is-final'); }
    }
    // 3) колесо разворачивается к зрителю, по полу расходится неоновое кольцо
    if (finalT) {
      const k = clamp01((t - finalT) / 1.1);
      WB.wheel.rotation.y = -.55 * easeOut(clamp01((t - finalT) / .8));
      ring.scale.setScalar((1 + k * 2.2) * WS / 2.3); ring.material.opacity = (1 - k) * .9;
      wheelGlow.material.opacity = easeOut(clamp01((t - finalT) / .5));
      if (t - finalT > 1.5) ICAR.finishIntro();
    }
    r.render(scene, cam);
  });
}

/* ======================= HERO: машина на подиуме ======================= */
function runHero(makeCar) {
  const stage = ICAR.stage;
  const canvas = document.createElement('canvas');
  canvas.className = 'car3d';
  canvas.setAttribute('aria-label', '3D-модель Lada Niva — потяните, чтобы повернуть');
  stage.prepend(canvas);

  const r = makeRenderer(canvas, true);
  const scene = new THREE.Scene();
  addEnv(r, scene);
  const cam = new THREE.PerspectiveCamera(30, 4 / 3, .1, 100);
  cam.position.set(5.1, 2.1, 5.1);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x080808, .45));
  const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(4, 6, 3); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, .8); fill.position.set(-5, 3, -3); scene.add(fill);
  const g1 = new THREE.PointLight(ACCENT, 10, 9); g1.position.set(-3, 1.4, -2.2); scene.add(g1);
  const g2 = new THREE.PointLight(ACCENT, 6, 9); g2.position.set(3, .9, 2.6); scene.add(g2);

  // подиум
  const podium = new THREE.Group(); scene.add(podium);
  podium.add(flat(new THREE.CircleGeometry(2.5, 96), new THREE.MeshStandardMaterial({ color: 0x08090b, metalness: .3, roughness: .6, envMapIntensity: .25 }), 0));
  podium.add(flat(new THREE.RingGeometry(2.47, 2.52, 128), new THREE.MeshBasicMaterial({ color: ACCENT, toneMapped: false }), .002));
  const dashes = new THREE.Group();
  for (let i = 0; i < 40; i++) {
    dashes.add(flat(new THREE.RingGeometry(2.66, 2.69, 6, 1, i / 40 * Math.PI * 2, Math.PI / 40), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: .55 }), .002));
  }
  podium.add(dashes);
  const pulse = flat(new THREE.RingGeometry(2.5, 2.56, 128), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false }), .003);
  podium.add(pulse);

  const C = makeCar(); scene.add(C.car);
  C.car.visible = false;

  const controls = new OrbitControls(cam, canvas);
  controls.target.set(0, .6, 0);
  Object.assign(controls, { enableDamping: true, dampingFactor: .08, enablePan: false, enableZoom: false, autoRotate: true, autoRotateSpeed: 1.6, minPolarAngle: .55, maxPolarAngle: 1.45 });
  const coarse = matchMedia('(pointer: coarse)').matches;
  const setDrag = on => { controls.enabled = on; canvas.style.touchAction = on ? 'none' : 'pan-y'; };
  if (coarse) setDrag(false);

  const fit = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  };
  new ResizeObserver(fit).observe(stage); fit();

  let visible = true, enterT = 0, pulseT = 0;
  // конфигуратор
  const cfg = document.getElementById('config');
  if (C.custom) cfg.querySelector('.config__colors').style.display = 'none';
  cfg.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
    cfg.querySelectorAll('[data-color]').forEach(x => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-checked', x === b); });
    C.target = b.dataset.color === 'accent' ? ACCENT.clone() : new THREE.Color(b.dataset.color);
    pulseT = performance.now();
  }));
  cfg.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on);
    if (b.dataset.toggle === 'lights') C.setLights(on);
    if (b.dataset.toggle === 'rotate') controls.autoRotate = on;
    if (b.dataset.toggle === 'drag') setDrag(on);
  }));

  const anchors = C.anchors;
  const v = new V3();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);
  ICAR.whenIntroDone(() => { enterT = performance.now(); C.car.visible = true; });

  stage.classList.add('is-3d');
  document.documentElement.classList.add('has-3d');

  r.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    const now = performance.now();
    // въезд: машина падает на подиум и раскручивается
    if (enterT) {
      const p = clamp01((now - enterT) / 1500);
      C.car.position.y = 1.6 * (1 - bounce(p));
      C.car.rotation.y = -Math.PI * 1.2 * (1 - easeOut(p));
      controls.autoRotateSpeed = lerp(10, 1.6, easeOut(clamp01((now - enterT) / 2600)));
    }
    C.paint.color.lerp(C.target, .08);
    if (pulseT) {
      const k = clamp01((now - pulseT) / 900);
      pulse.scale.setScalar(1 + k * .35); pulse.material.opacity = (1 - k) * .8;
    }
    dashes.rotation.z += .0015;
    controls.update();
    r.render(scene, cam);

    // линии от бейджей следуют за точками на кузове
    const w = stage.clientWidth, h = stage.clientHeight;
    ICAR.setAnchors(anchors.map(a => {
      v.copy(a).applyMatrix4(C.car.matrixWorld).project(cam);
      return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h];
    }));
  });
}

/* ======================= колесо у формы ======================= */
function runSideWheel(makeWheelFn) {
  const host = document.getElementById('wheel3d');
  if (!host) return;
  const canvas = document.createElement('canvas');
  host.prepend(canvas);
  const r = makeRenderer(canvas, true);
  const scene = new THREE.Scene(); addEnv(r, scene);
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 50); cam.position.set(0, 0, 3.4);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rimL = new THREE.DirectionalLight(0xffffff, 1); rimL.position.set(-3, 1, -2); scene.add(rimL);
  const g = new THREE.PointLight(ACCENT, 8, 8); g.position.set(-2, -1, 1.5); scene.add(g);
  const W = makeWheelFn();
  W.wheel.scale.setScalar(.72 / W.R);
  scene.add(W.wheel);

  const fit = () => { const s = host.clientWidth; r.setSize(s, s, false); };
  new ResizeObserver(fit).observe(host); fit();

  let visible = false, angle = 0, speed = .012, boost = 0, lastY = scrollY, mx = 0, my = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
  host.addEventListener('pointermove', e => {
    const b = host.getBoundingClientRect();
    mx = (e.clientX - b.left) / b.width - .5; my = (e.clientY - b.top) / b.height - .5;
  });
  host.addEventListener('pointerleave', () => { mx = my = 0; });
  const kick = () => { boost = .5; };
  host.addEventListener('click', kick);
  host.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kick(); } });

  r.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    const dy = scrollY - lastY; lastY = scrollY;
    speed = lerp(speed, .012 + Math.min(Math.abs(dy) * .004, .4), .08);
    boost *= .965;
    angle += speed + boost;
    W.setSpin(angle);
    W.wheel.rotation.y = lerp(W.wheel.rotation.y, -.6 + mx * .9, .08);
    W.wheel.rotation.x = lerp(W.wheel.rotation.x, my * .6, .08);
    r.render(scene, cam);
  });
}

/* ======================= запуск ======================= */
(async () => {
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) return; // без WebGL остаётся плоская машина
  ICAR.introStarted = true;
  let model = null;
  if (SITE.carModel) {
    const tooSlow = setTimeout(() => ICAR.finishIntro(), 9000); // медленный интернет — не держим заставку
    try { model = await loadModel(p => ICAR.setLoad(p)); }
    catch (e) { console.warn('Своя модель не загрузилась — показываю Ниву', e); }
    clearTimeout(tooSlow);
  }
  ICAR.setLoad(1);

  const makeCar = () => model ? modelCar(model) : nivaCar();
  try { runIntro(nivaWheelObj); } catch (e) { console.error(e); ICAR.finishIntro(); }
  try { runHero(makeCar); } catch (e) { console.error(e); }
  try { runSideWheel(nivaWheelObj); } catch (e) { console.error(e); }
})();
