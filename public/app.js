import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ==========================================================================
   CONFIG & STATE
   ========================================================================== */
const STATE = {
  tracks: [],
  stages: {},
  activeStageId: 'GLOBAL',
  hoveredMesh: null,
  selectedTrack: null,
  cameraAnimation: null,
  vinylMeshes: []
};

// Stage Coordinates & Look Targets in World Space (Equidistant Pentagonal Layout)
const STAGE_VIEWS = {
  GLOBAL: {
    cam: { x: 0, y: 64, z: 82 },
    target: { x: 0, y: 0, z: 0 }
  },
  TECHNO: {
    cam: { x: 0, y: 15, z: -10 },
    target: { x: 0, y: 3.5, z: -26 }
  },
  RAP: {
    cam: { x: 12, y: 15, z: 4 },
    target: { x: 25, y: 3.5, z: -8 }
  },
  REGGAE: {
    cam: { x: 8, y: 14, z: 35 },
    target: { x: 15, y: 3, z: 21 }
  },
  CLASSICAL: {
    cam: { x: -8, y: 14, z: 35 },
    target: { x: -15, y: 3, z: 21 }
  },
  ROCK_METAL: {
    cam: { x: -12, y: 15, z: 4 },
    target: { x: -25, y: 3.5, z: -8 }
  }
};

/* ==========================================================================
   THREE.JS SETUP
   ========================================================================== */
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
// Vibrant sunset sky gradient (violet -> pink -> orange horizon) & matching haze
(function setupSunsetSky() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#3a2a7a');
  grad.addColorStop(0.45, '#b04a9c');
  grad.addColorStop(0.75, '#ff7a5c');
  grad.addColorStop(1, '#ffc46b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  scene.fog = new THREE.FogExp2(0xc8607a, 0.0042);
})();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.5,
  500
);
camera.position.set(STAGE_VIEWS.GLOBAL.cam.x, STAGE_VIEWS.GLOBAL.cam.y, STAGE_VIEWS.GLOBAL.cam.z);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.05; // Don't go below ground
controls.minDistance = 8;
controls.maxDistance = 320;
controls.target.set(0, 0, 0);

const textureLoader = new THREE.TextureLoader();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-999, -999);

/* ==========================================================================
   WORLD & ENVIRONMENT (Festival Grounds, Night Sky, Lights)
   ========================================================================== */
const animatedElements = [];

function buildEnvironment() {
  // 1. Warm Golden Ambient & Festival Lantern Moonlight
  const ambientLight = new THREE.AmbientLight(0xffe6cc, 2.3);
  scene.add(ambientLight);

  // Sky/ground bounce light for lively colourful shading
  const hemi = new THREE.HemisphereLight(0xffb3d9, 0x7a5a3a, 1.3);
  scene.add(hemi);

  const moonLight = new THREE.DirectionalLight(0xffcf94, 2.4);
  moonLight.position.set(40, 85, 40);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 1024;
  moonLight.shadow.mapSize.height = 1024;
  scene.add(moonLight);

  // 3. Water Ocean Plane (Warm deep midnight reflection)
  const waterGeo = new THREE.PlaneGeometry(350, 350);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1f6f8f,
    roughness: 0.3,
    metalness: 0.45
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.4;
  scene.add(water);

  // 4. Main Island Terrain (Warm organic dark turf, grid completely removed)
  const islandGeo = new THREE.CylinderGeometry(52, 58, 2, 48);
  const islandMat = new THREE.MeshStandardMaterial({
    color: 0x6c8a4a,
    roughness: 0.9,
    metalness: 0.0
  });
  const island = new THREE.Mesh(islandGeo, islandMat);
  island.position.y = -0.8;
  island.receiveShadow = true;
  scene.add(island);


  // 5. Build Stages & Central Plaza Architecture
  buildCentralPlaza();
  buildTechnoWarehouse();
  buildRapCity();
  buildReggaeOasis();
  buildClassicalAmphitheater();
  buildMetalPit();
}

/* ==========================================================================
   STAGE ARCHITECTURES (5 THEMATIC STAGES & CENTRAL PLAZA)
   ========================================================================== */

// Central Festival Plaza & Landmark Totem (Connects all 5 stages)
function buildCentralPlaza() {
  const group = new THREE.Group();
  group.position.set(0, 0, 0);

  // Circular courtyard floor - warm timber & terracotta festival plaza
  const plazaGeo = new THREE.CylinderGeometry(8.5, 9.2, 0.4, 32);
  const plazaMat = new THREE.MeshStandardMaterial({
    color: 0x2e2420,
    roughness: 0.65,
    metalness: 0.15
  });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.position.y = 0.2;
  plaza.receiveShadow = true;
  group.add(plaza);

  // Outer warm golden glowing boundary ring
  const ringGeo = new THREE.RingGeometry(8.6, 9.0, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.42;
  group.add(ring);

  // Plaza Warm Golden Lantern Uplight
  const plazaLight = new THREE.PointLight(0xffa238, 3.2, 24);
  plazaLight.position.set(0, 1.8, 0);
  group.add(plazaLight);

  // --- 1. PETITE COUPE DORÉE EN HAUT DU CERCLE (Nord / -Z) ---
  const trophyGroup = new THREE.Group();
  trophyGroup.position.set(0, 0.4, -4.6);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0x4a2e00,
    emissiveIntensity: 0.45,
    metalness: 0.92,
    roughness: 0.16
  });
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x1b1512,
    roughness: 0.35,
    metalness: 0.25
  });

  // Dark marble base plinth + thin gold trim
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.02, 0.42, 24), plinthMat);
  plinth.position.y = 0.21;
  trophyGroup.add(plinth);

  const plinthTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.06, 24), goldMat);
  plinthTrim.position.y = 0.43;
  trophyGroup.add(plinthTrim);

  // Golden foot & slim stem
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.64, 0.24, 20), goldMat);
  foot.position.y = 0.56;
  trophyGroup.add(foot);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.72, 16), goldMat);
  stem.position.y = 1.02;
  trophyGroup.add(stem);

  // Classic trophy goblet chalice via LatheGeometry
  const cupPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.24, 0.04),
    new THREE.Vector2(0.46, 0.28),
    new THREE.Vector2(0.76, 0.82),
    new THREE.Vector2(0.95, 1.38),
    new THREE.Vector2(1.02, 1.54),
    new THREE.Vector2(0.88, 1.54),
    new THREE.Vector2(0.76, 1.2),
    new THREE.Vector2(0.42, 0.4),
    new THREE.Vector2(0.0, 0.22)
  ];
  const chaliceGeo = new THREE.LatheGeometry(cupPoints, 28);
  const chalice = new THREE.Mesh(chaliceGeo, goldMat);
  chalice.position.y = 1.34;
  trophyGroup.add(chalice);

  // Left & Right golden trophy handles
  const handleGeo = new THREE.TorusGeometry(0.42, 0.075, 12, 24, Math.PI * 1.15);
  const leftHandle = new THREE.Mesh(handleGeo, goldMat);
  leftHandle.position.set(-0.84, 2.24, 0);
  leftHandle.rotation.z = Math.PI * 0.45;
  trophyGroup.add(leftHandle);

  const rightHandle = new THREE.Mesh(handleGeo, goldMat);
  rightHandle.position.set(0.84, 2.24, 0);
  rightHandle.rotation.z = -Math.PI * 0.58;
  trophyGroup.add(rightHandle);

  // Warm gleam light dedicated to the trophy cup
  const trophyLight = new THREE.PointLight(0xffd700, 2.6, 12);
  trophyLight.position.set(0, 3.3, 0.8);
  trophyGroup.add(trophyLight);

  animatedElements.push((time) => {
    trophyGroup.rotation.y = Math.sin(time * 0.9) * 0.25;
  });

  group.add(trophyGroup);

  // --- 2. TEXTE DORÉ COURBÉ "MASTERCLASS" SUIVANT LE BAS DU CERCLE (Sud / +Z) ---
  const textCanvas = document.createElement('canvas');
  textCanvas.width = 1024;
  textCanvas.height = 1024;
  const tCtx = textCanvas.getContext('2d');
  const cx = 512;
  const cy = 512;
  const textRadius = 402;
  const label = 'MASTERCLASS';

  tCtx.save();
  tCtx.font = '800 84px "Space Grotesk", "Plus Jakarta Sans", sans-serif';
  tCtx.textAlign = 'center';
  tCtx.textBaseline = 'middle';

  // Spread characters smoothly along the bottom circular arc (left -> bottom -> right)
  const totalArc = Math.PI * 0.62;
  const startAngle = Math.PI / 2 + totalArc / 2;
  const angleStep = totalArc / (label.length - 1);

  for (let i = 0; i < label.length; i++) {
    const angle = startAngle - i * angleStep;
    const x = cx + Math.cos(angle) * textRadius;
    const y = cy + Math.sin(angle) * textRadius;

    tCtx.save();
    tCtx.translate(x, y);
    tCtx.rotate(angle - Math.PI / 2);

    // Metallic gold gradient per letter
    const grad = tCtx.createLinearGradient(0, -42, 0, 42);
    grad.addColorStop(0, '#fff7cc');
    grad.addColorStop(0.45, '#ffd700');
    grad.addColorStop(1, '#c78200');

    // Warm golden glow + dark bronze crisp contour
    tCtx.shadowColor = 'rgba(255, 195, 30, 0.9)';
    tCtx.shadowBlur = 22;
    tCtx.lineWidth = 6;
    tCtx.strokeStyle = '#3d2200';
    tCtx.strokeText(label[i], 0, 0);

    tCtx.fillStyle = grad;
    tCtx.fillText(label[i], 0, 0);
    tCtx.restore();
  }
  tCtx.restore();

  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const textPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(17.0, 17.0),
    new THREE.MeshBasicMaterial({
      map: textTex,
      transparent: true,
      depthWrite: false
    })
  );
  textPlane.rotation.x = -Math.PI / 2;
  textPlane.position.y = 0.43;
  group.add(textPlane);

  // Pathway strips radiating out to the 5 equidistant stages with warm lantern beacons
  const stageTargets = [
    { x: 0, z: -26 },   // Techno (North)
    { x: 25, z: -8 },   // Rap / Urban Party (East-North-East)
    { x: 15, z: 21 },   // Reggae (South-East)
    { x: -15, z: 21 },  // Classical (South-West)
    { x: -25, z: -8 }   // Metal (West-North-West)
  ];

  const lanternGeo = new THREE.SphereGeometry(0.2, 12, 12);
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffb74d });

  for (const st of stageTargets) {
    const dx = st.x;
    const dz = st.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);

    const pathGeo = new THREE.PlaneGeometry(dist - 8, 1.4);
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x2d221e,
      roughness: 0.85
    });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = -angle;
    path.position.set((dx / 2), 0.22, (dz / 2));
    group.add(path);

    // Warm lantern beacons along the pathway
    for (const frac of [0.38, 0.68]) {
      const lx = dx * frac;
      const lz = dz * frac;
      const lantern = new THREE.Mesh(lanternGeo, lanternMat);
      lantern.position.set(lx, 0.45, lz);
      group.add(lantern);
    }
  }

  scene.add(group);
}

// 2. Techno Warehouse (Bunker néon, lasers & Mur d'enceintes Sound System)
function buildTechnoWarehouse() {
  const group = new THREE.Group();
  group.position.set(0, 0, -26);

  // Industrial warm-black metal bunker floor
  const floorGeo = new THREE.BoxGeometry(22, 0.8, 22);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x141217, roughness: 0.25, metalness: 0.85 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.4;
  group.add(floor);

  // Warm amber halogen uplight to balance the neon with cozy warmth
  const warmBunkerGlow = new THREE.PointLight(0xff8833, 3.2, 22);
  warmBunkerGlow.position.set(0, 1.8, 3);
  group.add(warmBunkerGlow);

  // Cyberpunk Neon U-Shaped Trusses Structure (Open in front for 100% unobstructed view)
  const pillarGeo = new THREE.CylinderGeometry(0.35, 0.35, 10.5);
  const pillarMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  // 4 Corner Pillars: Left-Back, Right-Back, Left-Front, Right-Front (flanked to the sides)
  const pillarPositions = [
    { x: -9.5, z: -9.5 }, // Left-Back
    { x: 9.5, z: -9.5 },  // Right-Back
    { x: -9.5, z: 8.5 },  // Left-Front (on the far left flank)
    { x: 9.5, z: 8.5 }   // Right-Front (on the far right flank)
  ];

  for (const pos of pillarPositions) {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(pos.x, 5.25, pos.z);
    group.add(p);
  }

  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff007f });

  // 1. Back Cross Beam (connecting Left-Back to Right-Back above sound system)
  const backBeamGeo = new THREE.BoxGeometry(19.4, 0.4, 0.4);
  const backBeam = new THREE.Mesh(backBeamGeo, beamMat);
  backBeam.position.set(0, 10.5, -9.5);
  group.add(backBeam);

  // 2. Left Lateral Beam (along Z connecting Left-Back to Left-Front)
  const sideBeamGeo = new THREE.BoxGeometry(0.4, 0.4, 18.0);
  const leftBeam = new THREE.Mesh(sideBeamGeo, beamMat);
  leftBeam.position.set(-9.5, 10.5, -0.5);
  group.add(leftBeam);

  // 3. Right Lateral Beam (along Z connecting Right-Back to Right-Front)
  const rightBeam = new THREE.Mesh(sideBeamGeo, beamMat);
  rightBeam.position.set(9.5, 10.5, -0.5);
  group.add(rightBeam);

  // FRONT IS A 100% OPEN "U" SHAPE -> ZERO HORIZONTAL BARS IN CAMERA VIEW!

  /* --- MASSIVE SPEAKER WALL (Sound System d'enceintes techno en fond) --- */
  const speakerWallGroup = new THREE.Group();
  speakerWallGroup.position.set(0, 0, -9.2);

  const speakerCabMat = new THREE.MeshStandardMaterial({ color: 0x171415, roughness: 0.7, metalness: 0.3 });
  const wooferConeMat = new THREE.MeshStandardMaterial({ color: 0x27242c, roughness: 0.4, metalness: 0.6 });
  const dustCapMat = new THREE.MeshStandardMaterial({ color: 0x9099a8, roughness: 0.2, metalness: 0.9 });
  const glowingTrimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  const speakerCones = [];

  // 6 columns x 3 rows of subwoofers
  const cols = 6;
  const rows = 3;
  const cabWidth = 2.8;
  const cabHeight = 2.4;
  const startX = -((cols - 1) * cabWidth) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cabX = startX + c * cabWidth;
      const cabY = 1.3 + r * cabHeight;

      // Wooden speaker cabinet
      const cabGeo = new THREE.BoxGeometry(cabWidth - 0.2, cabHeight - 0.2, 1.8);
      const cab = new THREE.Mesh(cabGeo, speakerCabMat);
      cab.position.set(cabX, cabY, 0);
      speakerWallGroup.add(cab);

      // Woofer driver cone
      const coneGeo = new THREE.CylinderGeometry(0.85, 0.5, 0.2, 24);
      const cone = new THREE.Mesh(coneGeo, wooferConeMat);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(cabX, cabY, 0.85);
      speakerWallGroup.add(cone);
      speakerCones.push(cone);

      // Center silver dust cap
      const capGeo = new THREE.SphereGeometry(0.3, 16, 16);
      const cap = new THREE.Mesh(capGeo, dustCapMat);
      cap.position.set(cabX, cabY, 0.95);
      speakerWallGroup.add(cap);
    }
  }

  // Top Neon Trim over the speaker wall
  const topTrimGeo = new THREE.BoxGeometry(cols * cabWidth, 0.15, 0.15);
  const topTrim = new THREE.Mesh(topTrimGeo, glowingTrimMat);
  topTrim.position.set(0, 1.3 + rows * cabHeight, 0.9);
  speakerWallGroup.add(topTrim);

  group.add(speakerWallGroup);

  // Upward Laser Beams
  const laserGeo = new THREE.CylinderGeometry(0.12, 0.25, 55);
  const laserMat1 = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.65 });
  const laserMat2 = new THREE.MeshBasicMaterial({ color: 0xff007f, transparent: true, opacity: 0.65 });

  const l1 = new THREE.Mesh(laserGeo, laserMat1);
  l1.position.set(-6, 27, 0);
  group.add(l1);

  const l2 = new THREE.Mesh(laserGeo, laserMat2);
  l2.position.set(6, 27, 0);
  group.add(l2);

  // Strobe Light
  const strobe = new THREE.PointLight(0x00f0ff, 4.5, 30);
  strobe.position.set(0, 6, 0);
  group.add(strobe);

  // Animations: Strobe, swinging lasers, and PUMPING BASS WOOFERS
  animatedElements.push((time) => {
    strobe.intensity = Math.sin(time * 12) > 0.25 ? 5.5 : 1;
    l1.rotation.z = Math.sin(time * 1.5) * 0.18;
    l2.rotation.z = -Math.sin(time * 1.5) * 0.18;

    // Bass vibration on speaker cones
    const bassPunch = 1 + Math.max(0, Math.sin(time * 10)) * 0.25;
    for (const cone of speakerCones) {
      cone.scale.set(bassPunch, 1, bassPunch);
    }
  });

  // Stage title placed high above the back sound system to keep the view totally clear
  createStageSign("⚡ RAVE BUNKER", 0, 12.5, -34, 0x00f0ff);
  scene.add(group);
}

// 3. Urban Party (Briques chaudes, buildings new-yorkais aux fenêtres allumées & lampadaires dorés)
function buildRapCity() {
  const group = new THREE.Group();
  group.position.set(25, 0, -8);

  // Warm dark cobblestone/asphalt ground
  const groundGeo = new THREE.BoxGeometry(22, 0.8, 22);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x271e1d, roughness: 0.85 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = 0.4;
  group.add(ground);

  // Stylized Warm Brick Building Silhouettes in background with glowing golden windows
  const heights = [8, 14, 10, 16, 11, 7];
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd15c });
  const winGeo = new THREE.BoxGeometry(0.4, 0.6, 0.1);

  for (let i = 0; i < heights.length; i++) {
    const bHeight = heights[i];
    const bGeo = new THREE.BoxGeometry(2.8, bHeight, 3.2);
    const bMat = new THREE.MeshStandardMaterial({ color: 0x3d2722, roughness: 0.75 });
    const building = new THREE.Mesh(bGeo, bMat);
    const bX = -7.5 + i * 3;
    const bZ = -7.5;
    building.position.set(bX, bHeight / 2, bZ);
    group.add(building);

    // Warm glowing windows along the facade
    const floors = Math.floor(bHeight / 2.2);
    for (let f = 1; f < floors; f++) {
      for (const colOffset of [-0.7, 0.7]) {
        const win = new THREE.Mesh(winGeo, windowMat);
        win.position.set(bX + colOffset, f * 2.2, bZ + 1.62);
        group.add(win);
      }
    }
  }

  // Warm Amber Incandescent Street Lamp
  const streetLight = new THREE.PointLight(0xffa12b, 5.5, 30);
  streetLight.position.set(0, 7.5, 2);
  group.add(streetLight);

  const poleGeo = new THREE.CylinderGeometry(0.18, 0.18, 7.5);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x231d1b });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(0, 3.75, 2);
  group.add(pole);

  // Glowing lantern cap
  const lanternCap = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), windowMat);
  lanternCap.position.set(0, 7.4, 2);
  group.add(lanternCap);

  createStageSign("🎤 URBAN PARTY", 25, 10.5, -8, 0xffa834);
  scene.add(group);
}

// 4. Reggae Oasis (Sable doré chaud, palmiers tropicaux, feu de camp chaleureux)
function buildReggaeOasis() {
  const group = new THREE.Group();
  group.position.set(15, 0, 21);

  // Warm golden sand dune floor
  const sandGeo = new THREE.CylinderGeometry(11.5, 13, 1, 32);
  const sandMat = new THREE.MeshStandardMaterial({ color: 0x6e522f, roughness: 0.95 });
  const sand = new THREE.Mesh(sandGeo, sandMat);
  sand.position.y = 0.5;
  group.add(sand);

  // Palm trees with rich tropical warm foliage
  function createPalm(x, z, h) {
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, h, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x563c26 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, h / 2, z);
    trunk.rotation.z = (Math.random() - 0.5) * 0.15;
    group.add(trunk);

    const leavesGeo = new THREE.ConeGeometry(3.0, 1.5, 8);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x3aa34e, roughness: 0.65 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(x, h, z);
    group.add(leaves);
  }

  createPalm(-5.5, -4, 7);
  createPalm(5.5, 3, 6.5);
  createPalm(0, -6, 6);

  // Fire pit stone circle
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x2b231d, roughness: 0.9 });
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), stoneMat);
    stone.position.set(Math.cos(angle) * 1.2, 1.05, Math.sin(angle) * 1.2);
    group.add(stone);
  }

  // Glowing campfire core & warm flame light
  const flameCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff6600 })
  );
  flameCore.position.set(0, 1.2, 0);
  group.add(flameCore);

  const fireLight = new THREE.PointLight(0xff6812, 5.5, 28);
  fireLight.position.set(0, 1.8, 0);
  group.add(fireLight);

  animatedElements.push((time) => {
    fireLight.intensity = 4.8 + Math.sin(time * 8) * 1.2;
    flameCore.scale.setScalar(1 + Math.sin(time * 12) * 0.15);
  });

  createStageSign("🌴 ONE LOVE OASIS", 15, 8.5, 21, 0x44c965);
  scene.add(group);
}

// 5. Classical Amphitheater (Marbre champagne chaleureux, colonnes à la bougie & lueur dorée acoustique)
function buildClassicalAmphitheater() {
  const group = new THREE.Group();
  group.position.set(-15, 0, 21);

  // Warm Antique Marble circular base
  const baseGeo = new THREE.CylinderGeometry(11, 12, 1, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d3035, roughness: 0.35, metalness: 0.1 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.5;
  group.add(base);

  // Semicircle Alabaster & Candlelit Marble Columns
  const radius = 8.5;
  const colCount = 10;
  for (let i = 0; i < colCount; i++) {
    const angle = (Math.PI / (colCount - 1)) * i;
    const x = Math.cos(angle) * radius;
    const z = -Math.sin(angle) * radius;

    const colGeo = new THREE.CylinderGeometry(0.35, 0.4, 7, 12);
    const colMat = new THREE.MeshStandardMaterial({ color: 0xb5a396, roughness: 0.3 });
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(x, 4, z);
    group.add(col);

    // Candle beacon atop each column
    const candleGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const candleMat = new THREE.MeshBasicMaterial({ color: 0xffd27d });
    const candle = new THREE.Mesh(candleGeo, candleMat);
    candle.position.set(x, 7.6, z);
    group.add(candle);
  }

  // Warm Golden Chandelier / Candlelit Acoustic Glow
  const domeLight = new THREE.PointLight(0xffc57a, 5.2, 30);
  domeLight.position.set(0, 5, -2);
  group.add(domeLight);

  createStageSign("🎻 CRYSTAL DOME", -15, 8.8, 21, 0xe2ba77);
  scene.add(group);
}

// 6. Metal & Rock Volcanic Pit (Roches volcaniques sombres, braises et lueur de lave ardente)
function buildMetalPit() {
  const group = new THREE.Group();
  group.position.set(-25, 0, -8);

  // Dark volcanic stone
  const stoneGeo = new THREE.CylinderGeometry(9.5, 10.5, 1, 20);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x221315, roughness: 0.95 });
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  stone.position.y = 0.5;
  group.add(stone);

  // Glowing lava circle / magma fissure on the floor
  const lavaGeo = new THREE.RingGeometry(3.5, 5.5, 24);
  const lavaMat = new THREE.MeshBasicMaterial({
    color: 0xff3b00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65
  });
  const lava = new THREE.Mesh(lavaGeo, lavaMat);
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = 1.02;
  group.add(lava);

  // Fiery Pit Light
  const flameLight = new THREE.PointLight(0xff3300, 5.5, 28);
  flameLight.position.set(0, 2.2, 0);
  group.add(flameLight);

  animatedElements.push((time) => {
    flameLight.intensity = 4.8 + Math.sin(time * 10) * 1.5;
    lava.scale.setScalar(1 + Math.sin(time * 4) * 0.05);
  });

  createStageSign("🔥 VOLCANIC PIT", -25, 8, -8, 0xff4810);
  scene.add(group);
}

// Helper to create glowing 3D floating signs
function createStageSign(text, x, y, z, colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
  ctx.roundRect(10, 10, 492, 108, 24);
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
  ctx.stroke();

  ctx.font = 'bold 44px Space Grotesk, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(x, y, z);
  sprite.scale.set(10, 2.5, 1);
  scene.add(sprite);
}

/* ==========================================================================
   VINYL RECORDS GENERATION (Tracks as 3D Holographic Discs)
   ========================================================================== */
function clearVinyls() {
  for (const v of STATE.vinylMeshes) {
    scene.remove(v);
    if (v.geometry) v.geometry.dispose();
  }
  STATE.vinylMeshes = [];
}

function createFallbackLabelMaterial(track) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const isMasterclass = track.stage?.id === 'MASTERCLASS';

  if (isMasterclass) {
    // Luxury gold & obsidian radial label for the Masterclass centerpiece
    const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
    grad.addColorStop(0, '#fff3b0');
    grad.addColorStop(0.55, '#f5b800');
    grad.addColorStop(1, '#7a4900');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(20, 12, 0, 0.45)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(256, 256, 224, 0, Math.PI * 2);
    ctx.stroke();

    // Spindle center hole
    ctx.fillStyle = '#120d08';
    ctx.beginPath();
    ctx.arc(256, 256, 34, 0, Math.PI * 2);
    ctx.fill();

    // Bold dark typography for crisp contrast on gold
    ctx.fillStyle = '#1b1100';
    ctx.font = '800 50px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((track.artist || 'KAVINSKY').toUpperCase().slice(0, 16), 256, 155);

    ctx.font = '700 42px Plus Jakarta Sans, sans-serif';
    ctx.fillText((track.name || 'OUTSIDER').toUpperCase().slice(0, 20), 256, 355);
  } else {
    // Gradient background using stage colors
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, track.stage?.color || '#00f0ff');
    grad.addColorStop(1, track.stage?.secondaryColor || '#ff007f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Concentric vinyl ring lines on label
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(256, 256, 220, 0, Math.PI * 2);
    ctx.stroke();

    // Spindle center hole
    ctx.fillStyle = '#060810';
    ctx.beginPath();
    ctx.arc(256, 256, 36, 0, Math.PI * 2);
    ctx.fill();

    // Typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cleanArtist = (track.artist || 'Artiste').slice(0, 18);
    ctx.fillText(cleanArtist, 256, 170);

    ctx.font = '600 24px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const cleanTrack = (track.name || 'Titre').slice(0, 24);
    ctx.fillText(cleanTrack, 256, 340);
  }

  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
}

/**
 * Creates a circular vinyl record with album art in the center
 */
function createVinylMesh(track, index, stageTracksCount) {
  const isMasterclass = track.stage?.id === 'MASTERCLASS';
  const stagePos = track.stage?.position || { x: 0, y: 0, z: 0 };

  // Calculate distributed slot on the stage (Masterclass stays centered under the trophy cup)
  const angle = isMasterclass ? 0 : (index / Math.max(1, stageTracksCount)) * Math.PI * 2;
  const radius = isMasterclass ? 0 : (stageTracksCount > 1 ? 4.8 : 0);
  const posX = isMasterclass ? 0 : stagePos.x + Math.cos(angle) * radius;
  const posZ = isMasterclass ? 0.7 : stagePos.z + Math.sin(angle) * radius;
  const posY = isMasterclass ? 1.9 : 2.5 + (index % 3) * 0.4;

  const vinylGroup = new THREE.Group();
  vinylGroup.position.set(posX, posY, posZ);

  // 1. Vinyl Body (Black grooved disc; gold-accented sheen for Masterclass)
  const discGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.06, 32);
  const discMat = new THREE.MeshStandardMaterial({
    color: isMasterclass ? 0x1a150e : 0x0f1115,
    roughness: isMasterclass ? 0.25 : 0.35,
    metalness: isMasterclass ? 0.88 : 0.8
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.castShadow = true;
  vinylGroup.add(disc);

  // 2. Vinyl Center Label (Album Artwork)
  const labelGeo = new THREE.CircleGeometry(isMasterclass ? 0.92 : 0.75, 32);
  let labelMat;

  if (track.image) {
    const texture = textureLoader.load(
      track.image,
      undefined,
      undefined,
      () => {
        // Fallback on load error
        labelTop.material = createFallbackLabelMaterial(track);
        labelBottom.material = labelTop.material;
      }
    );
    labelMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  } else {
    labelMat = createFallbackLabelMaterial(track);
  }

  const labelTop = new THREE.Mesh(labelGeo, labelMat);
  labelTop.rotation.x = -Math.PI / 2;
  labelTop.position.y = 0.035;
  vinylGroup.add(labelTop);

  const labelBottom = new THREE.Mesh(labelGeo, labelMat);
  labelBottom.rotation.x = Math.PI / 2;
  labelBottom.position.y = -0.035;
  vinylGroup.add(labelBottom);

  // 3. Masterclass Golden Ring & Spotlight OR Now Playing Aura
  let baseScale = 1.0;

  if (isMasterclass) {
    const goldRingGeo = new THREE.RingGeometry(1.65, 1.88, 40);
    const goldRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    });
    const goldRing = new THREE.Mesh(goldRingGeo, goldRingMat);
    goldRing.rotation.x = -Math.PI / 2;
    vinylGroup.add(goldRing);

    const masterLight = new THREE.PointLight(0xffd700, 2.8, 14);
    masterLight.position.set(0, 3.2, 0);
    vinylGroup.add(masterLight);

    baseScale = 1.38;
    vinylGroup.scale.set(baseScale, baseScale, baseScale);
  } else if (track.nowPlaying) {
    const ringGeo = new THREE.RingGeometry(1.65, 1.85, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    vinylGroup.add(ring);

    // Spotlight beam on the active track
    const spot = new THREE.SpotLight(0xff0055, 6, 20, Math.PI / 8, 0.5);
    spot.position.set(0, 10, 0);
    spot.target = vinylGroup;
    vinylGroup.add(spot);

    baseScale = 1.25;
    vinylGroup.scale.set(baseScale, baseScale, baseScale);
  }

  // Metadata attached to user data for Raycasting & orbital carousel rotation
  vinylGroup.userData = {
    track,
    baseAngle: angle,
    radius,
    stageCenterX: stagePos.x,
    stageCenterZ: stagePos.z,
    baseY: posY,
    baseScale,
    discMesh: disc
  };

  scene.add(vinylGroup);
  STATE.vinylMeshes.push(vinylGroup);
}

function renderTracksTo3D(tracks) {
  clearVinyls();

  // Group tracks by stage to layout nicely across the 5 thematic stages
  const stageGroups = {};
  for (const track of tracks) {
    const stageId = track.stage?.id || 'REGGAE';
    if (!stageGroups[stageId]) stageGroups[stageId] = [];
    stageGroups[stageId].push(track);
  }

  for (const [stageId, stageTracks] of Object.entries(stageGroups)) {
    stageTracks.forEach((track, idx) => {
      createVinylMesh(track, idx, stageTracks.length);
    });
  }
}

/* ==========================================================================
   DATA FETCHING & CACHE MANAGEMENT
   ========================================================================== */
const cacheStatusText = document.getElementById('cache-status-text');
const cachePill = document.getElementById('cache-pill');
const nowPlayingPill = document.getElementById('now-playing-pill');
const nowTitle = document.getElementById('now-title');
const alertBanner = document.getElementById('alert-banner');
const alertMessage = document.getElementById('alert-message');
const loader = document.getElementById('loader');
const loaderSub = document.getElementById('loader-sub');
const loaderProgress = document.getElementById('loader-progress');
const loaderPercentage = document.getElementById('loader-percentage');

function setLoaderStep(percent, message) {
  if (loaderProgress) loaderProgress.style.width = `${percent}%`;
  if (loaderPercentage) loaderPercentage.textContent = `${percent}%`;
  if (loaderSub && message) loaderSub.textContent = message;
}

async function fetchTracks() {
  try {
    setLoaderStep(65, 'Connexion au proxy Last.fm...');

    const res = await fetch('/api/recent-tracks');
    const data = await res.json();

    if (!res.ok && !data.fromCache) {
      throw new Error(data.error || 'Erreur de connexion au serveur.');
    }

    setLoaderStep(85, 'Génération des vinyles 3D...');

    STATE.tracks = data.tracks || [];
    STATE.stages = data.stages || {};

    // Update Cache Status Pill
    if (data.fromCache) {
      cachePill.classList.remove('miss');
      const timeRemaining = data.cacheExpiresInSeconds ?? 60;
      cacheStatusText.textContent = `En cache (${timeRemaining}s)`;
    } else {
      cachePill.classList.add('miss');
      cacheStatusText.textContent = 'En direct de Last.fm';
    }

    // Handle Offline / Simulation Warning
    if (data.warning || !res.ok) {
      showAlert(data.warning || data.error);
    } else {
      hideAlert();
    }

    // Now Playing Track
    const activeTrack = STATE.tracks.find((t) => t.nowPlaying);
    if (activeTrack) {
      nowPlayingPill.classList.remove('hidden');
      nowTitle.textContent = `${activeTrack.artist} — ${activeTrack.name}`;
    } else {
      nowPlayingPill.classList.add('hidden');
    }

    // Render in 3D
    renderTracksTo3D(STATE.tracks);

    // Complete loading sequence
    setLoaderStep(100, 'Bienvenue à Soundland 3D !');
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.classList.add('hidden'), 600);
      }, 300);
    }
  } catch (err) {
    console.error('Fetch error:', err);
    showAlert(`Erreur serveur : ${err.message}`);
    if (loader) loader.classList.add('hidden');
  }
}

function showAlert(msg) {
  alertMessage.textContent = msg;
  alertBanner.classList.remove('hidden');
}

function hideAlert() {
  alertBanner.classList.add('hidden');
}

/* ==========================================================================
   INTERACTIONS & RAYCASTING
   ========================================================================== */
function onPointerMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Check collision with any vinyl group children
  const intersectables = [];
  for (const vg of STATE.vinylMeshes) {
    vg.traverse((child) => {
      if (child.isMesh) {
        child.userData.parentGroup = vg;
        intersectables.push(child);
      }
    });
  }

  const intersects = raycaster.intersectObjects(intersectables, false);

  if (intersects.length > 0) {
    const parent = intersects[0].object.userData.parentGroup;
    if (parent && STATE.hoveredMesh !== parent) {
      // Unhover previous
      if (STATE.hoveredMesh) {
        const s = STATE.hoveredMesh.userData.baseScale;
        STATE.hoveredMesh.scale.set(s, s, s);
      }
      STATE.hoveredMesh = parent;
      document.body.style.cursor = 'pointer';
      const s = parent.userData.baseScale * 1.15;
      parent.scale.set(s, s, s);
    }
  } else if (STATE.hoveredMesh) {
    const s = STATE.hoveredMesh.userData.baseScale;
    STATE.hoveredMesh.scale.set(s, s, s);
    STATE.hoveredMesh = null;
    document.body.style.cursor = 'default';
  }
}

function onPointerClick(event) {
  if (STATE.hoveredMesh) {
    openTrackModal(STATE.hoveredMesh.userData.track);
  }
}

/* ==========================================================================
   TRACK DETAIL MODAL (Glassmorphism Card)
   ========================================================================== */
const modal = document.getElementById('track-modal');
const modalClose = document.getElementById('modal-close');
const cardImage = document.getElementById('card-image');
const cardTrackName = document.getElementById('card-track-name');
const cardArtistName = document.getElementById('card-artist-name');
const cardAlbumName = document.getElementById('card-album-name');
const cardStageName = document.getElementById('card-stage-name');
const cardDate = document.getElementById('card-date');
const cardBadgeNow = document.getElementById('card-badge-now');
const cardTagsList = document.getElementById('card-tags-list');
const cardLink = document.getElementById('card-link');

function openTrackModal(track) {
  if (!track) return;
  resetPlayer();
  STATE.selectedTrack = track;

  cardTrackName.textContent = track.name;
  cardArtistName.textContent = track.artist;
  cardAlbumName.textContent = track.album || 'Single / Inconnu';
  cardStageName.textContent = track.stage?.name || 'Scène Centrale';
  cardStageName.style.color = track.stage?.color || '#00f0ff';
  cardDate.textContent = track.nowPlaying ? 'En cours d\'écoute' : `Écouté : ${track.dateText}`;
  cardImage.src = track.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect fill="%23111" width="300" height="300"/><text fill="%23666" font-size="20" x="50%" y="50%" text-anchor="middle">Pas de pochette</text></svg>';
  cardLink.href = track.url;

  if (track.nowPlaying) {
    cardBadgeNow.classList.remove('hidden');
  } else {
    cardBadgeNow.classList.add('hidden');
  }

  // Tags and Confidence Badge
  cardTagsList.innerHTML = '';
  if (track.confidence) {
    const confSpan = document.createElement('span');
    confSpan.className = 'tag-badge';
    confSpan.style.borderColor = 'rgba(0, 240, 255, 0.4)';
    confSpan.style.color = '#00f0ff';
    confSpan.style.fontWeight = '700';
    confSpan.textContent = `🎯 Confiance : ${track.confidence}%`;
    cardTagsList.appendChild(confSpan);
  }

  if (track.tags && track.tags.length > 0) {
    track.tags.forEach((tag) => {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'tag-badge';
      tagSpan.textContent = `#${tag}`;
      cardTagsList.appendChild(tagSpan);
    });
  }

  modal.classList.remove('hidden');
}

function closeTrackModal() {
  modal.classList.add('hidden');
  STATE.selectedTrack = null;
  cardAudio.pause();
  cardAudio.removeAttribute('src');
}

/* --- Audio preview (30s) through the local proxy --- */
const cardPlay = document.getElementById('card-play');
const cardAudio = document.getElementById('card-audio');
const cardPlayMsg = document.getElementById('card-play-msg');

function resetPlayer() {
  cardAudio.pause();
  cardAudio.removeAttribute('src');
  cardPlay.textContent = '▶ Écouter un extrait';
  cardPlay.disabled = false;
  cardPlayMsg.textContent = '';
}

cardPlay.addEventListener('click', async () => {
  const track = STATE.selectedTrack;
  if (!track) return;

  if (!cardAudio.paused) {
    cardAudio.pause();
    cardPlay.textContent = '▶ Écouter un extrait';
    return;
  }
  if (cardAudio.src && cardAudio.currentTime > 0 && !cardAudio.ended) {
    cardAudio.play();
    cardPlay.textContent = '⏸ Pause';
    return;
  }

  cardPlay.disabled = true;
  cardPlayMsg.textContent = 'Recherche de l\'extrait…';
  try {
    const res = await fetch(`/api/preview?artist=${encodeURIComponent(track.artist)}&track=${encodeURIComponent(track.name)}`);
    const data = await res.json();
    if (!data.found) {
      cardPlayMsg.textContent = 'Aucun extrait disponible pour ce titre.';
      cardPlay.disabled = false;
      return;
    }
    cardAudio.src = data.audioUrl;
    await cardAudio.play();
    cardPlay.textContent = '⏸ Pause';
    cardPlayMsg.textContent = 'Extrait de 30 s';
  } catch (e) {
    cardPlayMsg.textContent = 'Lecture impossible.';
  }
  cardPlay.disabled = false;
});

cardAudio.addEventListener('ended', () => {
  cardPlay.textContent = '▶ Réécouter';
  cardAudio.currentTime = 0;
});

/* ==========================================================================
   CAMERA TRANSITIONS (Smooth Lerp to Stages)
   ========================================================================== */
/* Pull the camera back on narrow/portrait screens so the whole scene stays in frame */
function adaptCamToAspect(view) {
  const aspect = window.innerWidth / window.innerHeight;
  const k = aspect < 1.2 ? Math.min(2.6, 1 + (1.2 / aspect - 1) * 0.75) : 1;
  const t = new THREE.Vector3(view.target.x, view.target.y, view.target.z);
  const c = new THREE.Vector3(view.cam.x, view.cam.y, view.cam.z);
  return t.add(c.sub(t).multiplyScalar(k));
}

window.addEventListener('resize', () => {
  if (STATE.cameraAnimation) return;
  const key = STATE.activeStageId || 'GLOBAL';
  const view = STAGE_VIEWS[key] || STAGE_VIEWS.GLOBAL;
  camera.position.copy(adaptCamToAspect(view));
});

function flyToStage(stageKey) {
  const view = STAGE_VIEWS[stageKey] || STAGE_VIEWS.GLOBAL;
  STATE.activeStageId = stageKey;
  const endCam = adaptCamToAspect(view);

  STATE.cameraAnimation = {
    startCam: camera.position.clone(),
    endCam,
    startTarget: controls.target.clone(),
    endTarget: new THREE.Vector3(view.target.x, view.target.y, view.target.z),
    progress: 0,
    duration: 1.0 // seconds
  };

  // Update navigation button states
  document.querySelectorAll('.stage-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.stage === stageKey);
  });
}

/* ==========================================================================
   ANIMATION & RENDER LOOP
   ========================================================================== */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Run stage environment animations (lasers, strobe, spotlights)
  for (const fn of animatedElements) {
    fn(time);
  }

  // Rotate vinyl carousel around each stage (1 full revolution in 45s) & float vinyls
  const orbitAngle = (time / 45) * Math.PI * 2;
  for (const vg of STATE.vinylMeshes) {
    const u = vg.userData;
    if (u.radius > 0) {
      const currentAngle = u.baseAngle + orbitAngle;
      vg.position.x = u.stageCenterX + Math.cos(currentAngle) * u.radius;
      vg.position.z = u.stageCenterZ + Math.sin(currentAngle) * u.radius;
    }

    // Individual disc self-spin and gentle floating bob
    vg.rotation.y += 0.015;
    vg.position.y = u.baseY + Math.sin(time * 2.5 + vg.position.x) * 0.12;
  }

  // Handle camera fly-to transition
  if (STATE.cameraAnimation) {
    const anim = STATE.cameraAnimation;
    anim.progress += delta / anim.duration;

    if (anim.progress >= 1) {
      camera.position.copy(anim.endCam);
      controls.target.copy(anim.endTarget);
      STATE.cameraAnimation = null;
    } else {
      // Ease out cubic
      const t = 1 - Math.pow(1 - anim.progress, 3);
      camera.position.lerpVectors(anim.startCam, anim.endCam, t);
      controls.target.lerpVectors(anim.startTarget, anim.endTarget, t);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

/* ==========================================================================
   UI EVENT LISTENERS
   ========================================================================== */
function initEvents() {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('click', onPointerClick);

  // Stage Navigator Buttons
  document.querySelectorAll('.stage-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stage = btn.dataset.stage;
      flyToStage(stage);
    });
  });

  // Modal Close
  modalClose.addEventListener('click', closeTrackModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeTrackModal();
  });

  // Alert Close
  document.getElementById('alert-close').addEventListener('click', hideAlert);

  // Manual Refresh Button
  document.getElementById('btn-refresh').addEventListener('click', () => {
    fetchTracks();
  });

  // Escape key to close modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTrackModal();
  });
}

/* ==========================================================================
   BOOTSTRAP
   ========================================================================== */
setLoaderStep(20, 'Initialisation du moteur Three.js...');
camera.position.copy(adaptCamToAspect(STAGE_VIEWS.GLOBAL));
buildEnvironment();
setLoaderStep(45, 'Construction des scènes et éclairages...');
initEvents();
fetchTracks();
animate();

// Auto refresh scrobbles every 30 seconds
setInterval(() => {
  fetchTracks();
}, 30000);
