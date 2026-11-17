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
scene.background = new THREE.Color(0x060810);
scene.fog = new THREE.FogExp2(0x060810, 0.008);

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
controls.maxDistance = 180;
controls.target.set(0, 0, 0);

const textureLoader = new THREE.TextureLoader();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-999, -999);

/* ==========================================================================
   WORLD & ENVIRONMENT (Festival Grounds, Night Sky, Lights)
   ========================================================================== */
const animatedElements = [];

function buildEnvironment() {
  // 1. Ambient & Directional Moonlight
  const ambientLight = new THREE.AmbientLight(0x303550, 1.2);
  scene.add(ambientLight);

  const moonLight = new THREE.DirectionalLight(0xa5c2f0, 1.4);
  moonLight.position.set(40, 90, 40);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 1024;
  moonLight.shadow.mapSize.height = 1024;
  scene.add(moonLight);

  // 2. Starfield
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1500;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i += 3) {
    starPos[i] = (Math.random() - 0.5) * 400;
    starPos[i + 1] = Math.random() * 120 + 20;
    starPos[i + 2] = (Math.random() - 0.5) * 400;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.7 });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // 3. Water Ocean Plane
  const waterGeo = new THREE.PlaneGeometry(350, 350);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x050b18,
    roughness: 0.2,
    metalness: 0.8
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.4;
  scene.add(water);

  // 4. Main Island Terrain (Tighter & denser festival grounds)
  const islandGeo = new THREE.CylinderGeometry(52, 58, 2, 48);
  const islandMat = new THREE.MeshStandardMaterial({
    color: 0x141824,
    roughness: 0.85,
    metalness: 0.1
  });
  const island = new THREE.Mesh(islandGeo, islandMat);
  island.position.y = -0.8;
  island.receiveShadow = true;
  scene.add(island);

  // Decorative festival floor grid
  const gridHelper = new THREE.GridHelper(95, 26, 0x00f0ff, 0x1d2436);
  gridHelper.position.y = 0.22;
  scene.add(gridHelper);

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

  // Circular courtyard floor
  const plazaGeo = new THREE.CylinderGeometry(8.5, 9.2, 0.4, 32);
  const plazaMat = new THREE.MeshStandardMaterial({
    color: 0x181d2a,
    roughness: 0.5,
    metalness: 0.3
  });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.position.y = 0.2;
  plaza.receiveShadow = true;
  group.add(plaza);

  // Outer glowing ring
  const ringGeo = new THREE.RingGeometry(8.6, 9.0, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.42;
  group.add(ring);

  // Central Crystalline Sound Obelisk / Totem
  const totemGeo = new THREE.OctahedronGeometry(1.6, 0);
  const totemMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x0088ff,
    emissiveIntensity: 0.6,
    roughness: 0.1,
    metalness: 0.9,
    wireframe: true
  });
  const totem = new THREE.Mesh(totemGeo, totemMat);
  totem.position.y = 3.5;
  group.add(totem);

  const totemCoreGeo = new THREE.SphereGeometry(0.8, 16, 16);
  const totemCoreMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
  const totemCore = new THREE.Mesh(totemCoreGeo, totemCoreMat);
  totemCore.position.y = 3.5;
  group.add(totemCore);

  // Plaza Ambient Uplight
  const plazaLight = new THREE.PointLight(0x00f0ff, 3.5, 20);
  plazaLight.position.set(0, 4, 0);
  group.add(plazaLight);

  // Slow rotation of central crystal totem
  animatedElements.push((time) => {
    totem.rotation.y = time * 0.8;
    totem.rotation.x = Math.sin(time * 0.5) * 0.2;
    ring.rotation.z = time * 0.2;
  });

  // Pathway strips radiating out to the 5 equidistant stages
  const stageTargets = [
    { x: 0, z: -26 },   // Techno (North)
    { x: 25, z: -8 },   // Rap / Urban Party (East-North-East)
    { x: 15, z: 21 },   // Reggae (South-East)
    { x: -15, z: 21 },  // Classical (South-West)
    { x: -25, z: -8 }   // Metal (West-North-West)
  ];

  for (const st of stageTargets) {
    const dx = st.x;
    const dz = st.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);

    const pathGeo = new THREE.PlaneGeometry(dist - 8, 1.2);
    const pathMat = new THREE.MeshBasicMaterial({
      color: 0x1d273a,
      side: THREE.DoubleSide
    });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = -angle;
    path.position.set((dx / 2), 0.22, (dz / 2));
    group.add(path);
  }

  scene.add(group);
}

// 2. Techno Warehouse (Bunker néon, lasers & Mur d'enceintes Sound System)
function buildTechnoWarehouse() {
  const group = new THREE.Group();
  group.position.set(0, 0, -26);

  // Larger dark industrial metal bunker
  const floorGeo = new THREE.BoxGeometry(22, 0.8, 22);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0c0f18, roughness: 0.2, metalness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.4;
  group.add(floor);

  // Cyberpunk Neon Trusses
  for (let x = -9.5; x <= 9.5; x += 19) {
    const pillarGeo = new THREE.CylinderGeometry(0.35, 0.35, 10.5);
    const pillarMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const p1 = new THREE.Mesh(pillarGeo, pillarMat);
    p1.position.set(x, 5.25, -9.5);
    group.add(p1);

    const p2 = new THREE.Mesh(pillarGeo, pillarMat);
    p2.position.set(x, 5.25, 9.5);
    group.add(p2);
  }

  // Cross Beams
  const beamGeo = new THREE.BoxGeometry(19.6, 0.4, 0.4);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
  const b1 = new THREE.Mesh(beamGeo, beamMat);
  b1.position.set(0, 10.5, -9.5);
  group.add(b1);
  const b2 = new THREE.Mesh(beamGeo, beamMat);
  b2.position.set(0, 10.5, 9.5);
  group.add(b2);

  /* --- MASSIVE SPEAKER WALL (Sound System d'enceintes techno en fond) --- */
  const speakerWallGroup = new THREE.Group();
  speakerWallGroup.position.set(0, 0, -9.2);

  const speakerCabMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.7, metalness: 0.3 });
  const wooferConeMat = new THREE.MeshStandardMaterial({ color: 0x242832, roughness: 0.4, metalness: 0.6 });
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

  createStageSign("⚡ RAVE BUNKER", 0, 11, -26, 0x00f0ff);
  scene.add(group);
}

// 3. Urban Party (Briques, buildings urbains & lampadaires)
function buildRapCity() {
  const group = new THREE.Group();
  group.position.set(25, 0, -8);

  // Larger asphalt ground
  const groundGeo = new THREE.BoxGeometry(22, 0.8, 22);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = 0.4;
  group.add(ground);

  // Stylized Building Silhouettes in background
  const heights = [8, 14, 10, 16, 11, 7];
  for (let i = 0; i < heights.length; i++) {
    const bGeo = new THREE.BoxGeometry(2.8, heights[i], 3.2);
    const bMat = new THREE.MeshStandardMaterial({ color: 0x24283b, roughness: 0.8 });
    const building = new THREE.Mesh(bGeo, bMat);
    building.position.set(-7.5 + i * 3, heights[i] / 2, -7.5);
    group.add(building);
  }

  // Warm Amber Street Lamps
  const streetLight = new THREE.PointLight(0xffaa00, 4.5, 28);
  streetLight.position.set(0, 7.5, 2);
  group.add(streetLight);

  const poleGeo = new THREE.CylinderGeometry(0.18, 0.18, 7.5);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x111 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(0, 3.75, 2);
  group.add(pole);

  createStageSign("🎤 URBAN PARTY", 25, 10.5, -8, 0xffaa00);
  scene.add(group);
}

// 4. Reggae Oasis (Sable agrandi, palmiers, chill)
function buildReggaeOasis() {
  const group = new THREE.Group();
  group.position.set(15, 0, 21);

  // Larger sand dune floor
  const sandGeo = new THREE.CylinderGeometry(11.5, 13, 1, 32);
  const sandMat = new THREE.MeshStandardMaterial({ color: 0x3d3522, roughness: 0.95 });
  const sand = new THREE.Mesh(sandGeo, sandMat);
  sand.position.y = 0.5;
  group.add(sand);

  // Palm trees
  function createPalm(x, z, h) {
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, h, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, h / 2, z);
    trunk.rotation.z = (Math.random() - 0.5) * 0.15;
    group.add(trunk);

    const leavesGeo = new THREE.ConeGeometry(2.8, 1.4, 6);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.6 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(x, h, z);
    group.add(leaves);
  }

  createPalm(-5.5, -4, 7);
  createPalm(5.5, 3, 6.5);
  createPalm(0, -6, 6);

  // Campfire glow
  const fireLight = new THREE.PointLight(0xf1c40f, 4, 24);
  fireLight.position.set(0, 1.5, 0);
  group.add(fireLight);

  animatedElements.push((time) => {
    fireLight.intensity = 3.5 + Math.sin(time * 8) * 0.9;
  });

  createStageSign("🌴 SUNKEN OASIS", 15, 8.5, 21, 0x2ecc71);
  scene.add(group);
}

// 5. Classical Amphitheater (Colonnes de marbre agrandies, dôme & lueur mystique)
function buildClassicalAmphitheater() {
  const group = new THREE.Group();
  group.position.set(-15, 0, 21);

  // Larger Marble circular base
  const baseGeo = new THREE.CylinderGeometry(11, 12, 1, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2c2638, roughness: 0.3 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.5;
  group.add(base);

  // Semicircle Marble Columns
  const radius = 8.5;
  const colCount = 10;
  for (let i = 0; i < colCount; i++) {
    const angle = (Math.PI / (colCount - 1)) * i;
    const x = Math.cos(angle) * radius;
    const z = -Math.sin(angle) * radius;

    const colGeo = new THREE.CylinderGeometry(0.35, 0.4, 7, 12);
    const colMat = new THREE.MeshStandardMaterial({ color: 0x7c7294, roughness: 0.2 });
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(x, 4, z);
    group.add(col);
  }

  // Soft Purple/Blue Dome Light
  const domeLight = new THREE.PointLight(0x9b59b6, 4, 26);
  domeLight.position.set(0, 5, -2);
  group.add(domeLight);

  createStageSign("🎻 CRYSTAL DOME", -15, 8.8, 21, 0x9b59b6);
  scene.add(group);
}

// 6. Metal & Rock Volcanic Pit
function buildMetalPit() {
  const group = new THREE.Group();
  group.position.set(-25, 0, -8);

  // Dark volcanic stone (Larger)
  const stoneGeo = new THREE.CylinderGeometry(9.5, 10.5, 1, 20);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x181012, roughness: 0.95 });
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  stone.position.y = 0.5;
  group.add(stone);

  // Fiery Pit Light
  const flameLight = new THREE.PointLight(0xe74c3c, 4.5, 24);
  flameLight.position.set(0, 2, 0);
  group.add(flameLight);

  animatedElements.push((time) => {
    flameLight.intensity = 4 + Math.sin(time * 10) * 1.3;
  });

  createStageSign("🔥 VOLCANIC PIT", -25, 8, -8, 0xe74c3c);
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

  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
}

/**
 * Creates a circular vinyl record with album art in the center
 */
function createVinylMesh(track, index, stageTracksCount) {
  const stagePos = track.stage?.position || { x: 0, y: 0, z: 0 };

  // Calculate distributed slot on the stage (adapted to larger stage sizes)
  const angle = (index / Math.max(1, stageTracksCount)) * Math.PI * 2;
  const radius = stageTracksCount > 1 ? 4.8 : 0;
  const posX = stagePos.x + Math.cos(angle) * radius;
  const posZ = stagePos.z + Math.sin(angle) * radius;
  const posY = 2.5 + (index % 3) * 0.4;

  const vinylGroup = new THREE.Group();
  vinylGroup.position.set(posX, posY, posZ);

  // 1. Vinyl Body (Black grooved disc)
  const discGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.06, 32);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x0f1115,
    roughness: 0.35,
    metalness: 0.8
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.castShadow = true;
  vinylGroup.add(disc);

  // 2. Vinyl Center Label (Album Artwork)
  const labelGeo = new THREE.CircleGeometry(0.75, 32);
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

  // 3. Now Playing Aura & Glowing Ring
  if (track.nowPlaying) {
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

    vinylGroup.scale.set(1.25, 1.25, 1.25);
  }

  // Metadata attached to user data for Raycasting
  vinylGroup.userData = {
    track,
    baseY: posY,
    baseScale: track.nowPlaying ? 1.25 : 1.0,
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
}

/* ==========================================================================
   CAMERA TRANSITIONS (Smooth Lerp to Stages)
   ========================================================================== */
function flyToStage(stageKey) {
  const view = STAGE_VIEWS[stageKey] || STAGE_VIEWS.GLOBAL;

  STATE.cameraAnimation = {
    startCam: camera.position.clone(),
    endCam: new THREE.Vector3(view.cam.x, view.cam.y, view.cam.z),
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

  // Rotate & float vinyl records
  for (const vg of STATE.vinylMeshes) {
    vg.rotation.y += 0.015;
    vg.position.y = vg.userData.baseY + Math.sin(time * 2.5 + vg.position.x) * 0.12;
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
buildEnvironment();
setLoaderStep(45, 'Construction des scènes et éclairages...');
initEvents();
fetchTracks();
animate();

// Auto refresh scrobbles every 30 seconds
setInterval(() => {
  fetchTracks();
}, 30000);
