/**
 * OXAGON Digital Twin — Three.js Scene Engine
 * نظام المحاكاة ثلاثية الأبعاد لمدينة أوكساجون
 */
(function () {
  'use strict';

  // ── Zone definitions (matches backend) ──────────────────────
  const ZONES = {
    PORT:        { x: 120,  z: -80,  color: 0x0099ff, label: 'ميناء أوكساجون',    type: 'port'        },
    LOGISTICS:   { x: 60,   z: 20,   color: 0xff8c00, label: 'المنطقة اللوجستية', type: 'logistics'   },
    WAREHOUSE:   { x: 80,   z: 60,   color: 0xffaa33, label: 'مستودع المواد',     type: 'logistics'   },
    CONTAINERS:  { x: 140,  z: -40,  color: 0x0077cc, label: 'منطقة الحاويات',   type: 'port'        },
    FACTORY:     { x: -60,  z: -60,  color: 0xcc4400, label: 'المصنع الرئيسي',   type: 'industry'    },
    ENERGY:      { x: -120, z: 20,   color: 0x00cc66, label: 'محطة الطاقة',      type: 'energy'      },
    CHARGE:      { x: -80,  z: 80,   color: 0x44dd88, label: 'محطة الشحن',       type: 'energy'      },
    RESIDENTIAL: { x: 20,   z: 100,  color: 0x9955ff, label: 'الحي السكني',      type: 'residential' },
    CENTER:      { x: 0,    z: 0,    color: 0xffd700, label: 'مركز أوكساجون',    type: 'hub'         },
    AIRPORT:     { x: -140, z: -80,  color: 0xaaaaaa, label: 'مطار أوكساجون',    type: 'airport'     },
  };

  // ── Scene setup ──────────────────────────────────────────────
  const container = document.getElementById('canvas-container');
  const W = container.clientWidth, H = container.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010a14);
  scene.fog = new THREE.FogExp2(0x010a14, 0.0028);

  // Camera — cinematic angle
  const camera = new THREE.PerspectiveCamera(45, W / H, 1, 2000);
  camera.position.set(0, 220, 280);
  camera.lookAt(0, 0, 0);

  // ── Lighting ─────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x0a1a2e, 2.0));

  const sunLight = new THREE.DirectionalLight(0x80c8ff, 1.2);
  sunLight.position.set(200, 300, 100);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 600;
  sunLight.shadow.camera.left = -250;
  sunLight.shadow.camera.right = 250;
  sunLight.shadow.camera.top = 250;
  sunLight.shadow.camera.bottom = -250;
  scene.add(sunLight);

  const rimLight = new THREE.DirectionalLight(0x00c8ff, 0.4);
  rimLight.position.set(-150, 100, -100);
  scene.add(rimLight);

  // ── Ocean ────────────────────────────────────────────────────
  const oceanGeo = new THREE.PlaneGeometry(2000, 2000, 64, 64);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x003355, roughness: 0.1, metalness: 0.6,
    transparent: true, opacity: 0.85
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -2;
  scene.add(ocean);

  // Animate ocean waves via vertex shader approximation
  const oceanVerts = oceanGeo.attributes.position;
  const oceanBase  = new Float32Array(oceanVerts.array);

  // ── Octagon ground ───────────────────────────────────────────
  function buildOctagon() {
    const R = 180, sides = 8;
    const shape = new THREE.Shape();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 8;
      const x = Math.cos(angle) * R, y = Math.sin(angle) * R;
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
    const mat = new THREE.MeshStandardMaterial({ color: 0x0d1f30, roughness: 0.9, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -1;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Octagon edge glow lines
    const edgeGeo = new THREE.BufferGeometry();
    const edgePts = [];
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 8;
      edgePts.push(Math.cos(angle) * R, 2, Math.sin(angle) * R);
    }
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3));
    const edgeLine = new THREE.Line(edgeGeo, new THREE.LineBasicMaterial({ color: 0x00c8ff, linewidth: 2 }));
    scene.add(edgeLine);

    // Zone rings on ground
    Object.values(ZONES).forEach(z => {
      const ringGeo = new THREE.RingGeometry(14, 16, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: z.color, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(z.x, 2.5, z.z);
      scene.add(ring);
    });
  }
  buildOctagon();

  // ── Zone pads ────────────────────────────────────────────────
  const zonePads = {};
  Object.entries(ZONES).forEach(([id, z]) => {
    const geo = new THREE.CylinderGeometry(12, 12, 0.5, 32);
    const mat = new THREE.MeshStandardMaterial({ color: z.color, roughness: 0.8, metalness: 0.2, transparent: true, opacity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(z.x, 1, z.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    zonePads[id] = mesh;
  });

  // ── Buildings ────────────────────────────────────────────────
  function addBuilding(x, z, w, h, d, color, castShadow = true) {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mat  = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.3 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2 + 1.5, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Roof light
    const light = new THREE.PointLight(color, 0.6, 30);
    light.position.set(x, h + 6, z);
    scene.add(light);
    return mesh;
  }

  // Port buildings
  addBuilding(110, -80, 24, 12, 18, 0x1a4a7a);
  addBuilding(130, -90, 14, 20, 14, 0x1a5a9a);
  addBuilding(125, -65, 10,  8, 10, 0x1a3a6a);
  // Crane arms (port)
  [115, 130, 145].forEach(px => {
    addBuilding(px, -75, 2, 28, 2, 0x334455);
    const armGeo = new THREE.BoxGeometry(20, 1.5, 1.5);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x445566 });
    const arm    = new THREE.Mesh(armGeo, armMat);
    arm.position.set(px + 5, 30, -75);
    scene.add(arm);
  });
  // Logistics
  addBuilding(55, 20, 22, 10, 18, 0x6a3a00);
  addBuilding(75, 55, 18, 7,  16, 0x7a4a00);
  addBuilding(90, 30, 12, 14, 12, 0x5a3000);
  // Factory
  addBuilding(-60, -60, 28, 18, 20, 0x4a1a00);
  addBuilding(-70, -50, 10, 30, 10, 0x5a2a00); // tall chimney
  // Energy
  addBuilding(-120, 20, 20, 14, 20, 0x004a22);
  // Solar panels (flat)
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x003366, metalness: 0.8, roughness: 0.2 }));
    sp.position.set(-130 + i * 4, 4, 10 + i * 2);
    sp.rotation.x = -0.3;
    scene.add(sp);
  }
  // Residential
  [10, 25, 35].forEach((xo, i) => {
    addBuilding(xo, 95 + i * 8, 10, 8 + i * 4, 10, 0x441188);
  });
  // Center hub
  const hubGeo = new THREE.CylinderGeometry(10, 14, 16, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.3 });
  const hub    = new THREE.Mesh(hubGeo, hubMat);
  hub.position.set(0, 9, 0);
  hub.castShadow = true;
  scene.add(hub);
  // Hub glow
  const hubLight = new THREE.PointLight(0xffd700, 2, 60);
  hubLight.position.set(0, 20, 0);
  scene.add(hubLight);

  // ── Grid lines ───────────────────────────────────────────────
  const grid = new THREE.GridHelper(360, 36, 0x0a2a3a, 0x0a2a3a);
  grid.position.y = 1.5;
  scene.add(grid);

  // ── Stars ────────────────────────────────────────────────────
  const starGeo = new THREE.BufferGeometry();
  const starPts = [];
  for (let i = 0; i < 2000; i++) {
    starPts.push((Math.random() - 0.5) * 2000, Math.random() * 600 + 100, (Math.random() - 0.5) * 2000);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0.7 })));

  // ── Vehicles ─────────────────────────────────────────────────
  class Vehicle {
    constructor(id, startZone, color = 0x00c8ff) {
      this.id     = id;
      this.target = null;
      this.speed  = 80; // units/sec
      this.moving = false;
      this.queue  = [];

      const geo  = new THREE.BoxGeometry(7, 3.5, 12);
      const mat  = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.7, emissive: color, emissiveIntensity: 0.15 });
      this.mesh  = new THREE.Mesh(geo, mat);
      this.mesh.castShadow = true;

      const z = ZONES[startZone] || ZONES.CENTER;
      this.mesh.position.set(z.x + Math.random() * 10 - 5, 4, z.z + Math.random() * 10 - 5);
      scene.add(this.mesh);

      // Headlights
      this.lightL = new THREE.PointLight(color, 1.5, 25);
      this.lightR = new THREE.PointLight(color, 1.5, 25);
      scene.add(this.lightL);
      scene.add(this.lightR);
    }

    moveTo(zone, onArrive) {
      if (!ZONES[zone]) return;
      this.target   = new THREE.Vector3(ZONES[zone].x, 4, ZONES[zone].z);
      this.moving   = true;
      this.onArrive = onArrive;
      this.destZone = zone;

      if (window.showHUD) window.showHUD(`🚗 ${this.id} → ${ZONES[zone].label}`);
      if (window.setBarZone) window.setBarZone(ZONES[zone].label);

      // Pulse the destination pad
      const pad = zonePads[zone];
      if (pad) {
        const origOp = pad.material.opacity;
        let t = 0;
        const pulse = setInterval(() => {
          t += 0.1;
          pad.material.opacity = origOp + Math.sin(t * 8) * 0.3;
          if (t > 2) { pad.material.opacity = origOp; clearInterval(pulse); }
        }, 50);
      }
    }

    update(dt) {
      if (!this.moving || !this.target) return;
      const pos  = this.mesh.position;
      const dir  = this.target.clone().sub(pos);
      const dist = dir.length();

      if (dist < 3) {
        this.mesh.position.copy(this.target);
        this.moving = false;
        if (this.onArrive) { this.onArrive(); this.onArrive = null; }
        // Process queue
        if (this.queue.length > 0) {
          const next = this.queue.shift();
          setTimeout(() => this.moveTo(next.zone, next.cb), 400);
        }
        return;
      }

      const step = Math.min(this.speed * dt, dist);
      dir.normalize().multiplyScalar(step);
      pos.add(dir);

      // Face direction of travel
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

      // Lights
      this.lightL.position.set(pos.x - 3, pos.y + 1, pos.z + 5);
      this.lightR.position.set(pos.x + 3, pos.y + 1, pos.z + 5);
    }

    queueMove(zone, cb) { this.queue.push({ zone, cb }); }
  }

  // ── Drones ───────────────────────────────────────────────────
  class Drone {
    constructor(id, startZone, color = 0x00ff88) {
      this.id     = id;
      this.target = null;
      this.moving = false;
      this.hover  = 0;
      this.speed  = 120;
      this.queue  = [];

      // Drone body
      const bodyGeo = new THREE.CylinderGeometry(3, 3, 1.5, 8);
      const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.2, emissive: color, emissiveIntensity: 0.2 });
      this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
      this.mesh.castShadow = true;

      // 4 rotors
      this.rotors = [];
      [[-4,-4],[4,-4],[-4,4],[4,4]].forEach(([rx, rz]) => {
        const rGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.2, 12);
        const rMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9 });
        const r    = new THREE.Mesh(rGeo, rMat);
        r.position.set(rx, 0.5, rz);
        this.mesh.add(r);
        this.rotors.push(r);
      });

      const z = ZONES[startZone] || ZONES.CENTER;
      const baseY = 35 + Math.random() * 20;
      this.mesh.position.set(z.x + Math.random() * 8 - 4, baseY, z.z + Math.random() * 8 - 4);
      this.baseY = baseY;
      scene.add(this.mesh);

      // Drone light
      this.light = new THREE.PointLight(color, 2, 40);
      scene.add(this.light);
    }

    moveTo(zone, onArrive) {
      if (!ZONES[zone]) return;
      const z = ZONES[zone];
      this.target   = new THREE.Vector3(z.x, this.baseY, z.z);
      this.moving   = true;
      this.onArrive = onArrive;
      if (window.showHUD) window.showHUD(`🚁 ${this.id} → ${z.label}`);
    }

    update(dt, t) {
      // Rotor spin
      this.rotors.forEach(r => { r.rotation.y += 15 * dt; });
      // Hover bob
      const pos = this.mesh.position;
      pos.y = this.baseY + Math.sin(t * 2 + this.hover) * 2;

      if (this.moving && this.target) {
        const targetFlat = this.target.clone();
        targetFlat.y     = pos.y;
        const dir  = targetFlat.sub(pos);
        const dist = dir.length();
        if (dist < 4) {
          this.moving = false;
          if (this.onArrive) { this.onArrive(); this.onArrive = null; }
          if (this.queue.length > 0) {
            const next = this.queue.shift();
            setTimeout(() => this.moveTo(next.zone, next.cb), 600);
          }
        } else {
          dir.normalize().multiplyScalar(Math.min(this.speed * dt, dist));
          pos.x += dir.x; pos.z += dir.z;
          this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
      }

      this.light.position.set(pos.x, pos.y - 2, pos.z);
    }

    queueMove(zone, cb) { this.queue.push({ zone, cb }); }
  }

  // Spawn initial vehicles
  const vehicles = [
    new Vehicle('V-001', 'PORT',      0x00c8ff),
    new Vehicle('V-002', 'LOGISTICS', 0xff8c00),
    new Vehicle('V-003', 'CENTER',    0xffd700),
  ];

  const drones = [
    new Drone('D-001', 'CENTER',  0x00ff88),
    new Drone('D-002', 'FACTORY', 0xff44aa),
  ];

  // Autonomous patrol loop
  const PATROL_ROUTES = {
    'V-001': ['PORT', 'CONTAINERS', 'LOGISTICS', 'PORT'],
    'V-002': ['LOGISTICS', 'WAREHOUSE', 'CENTER', 'LOGISTICS'],
    'V-003': ['CENTER', 'RESIDENTIAL', 'CHARGE', 'CENTER'],
  };

  function startPatrol(v) {
    const route = PATROL_ROUTES[v.id];
    if (!route) return;
    let idx = 0;
    function next() {
      idx = (idx + 1) % route.length;
      v.moveTo(route[idx], () => setTimeout(next, 1500));
    }
    setTimeout(next, Math.random() * 3000 + 1000);
  }

  vehicles.forEach(v => startPatrol(v));

  // Drone autonomous scan
  const DRONE_ROUTES = {
    'D-001': ['CENTER', 'PORT', 'FACTORY', 'ENERGY', 'CENTER'],
    'D-002': ['FACTORY', 'AIRPORT', 'LOGISTICS', 'FACTORY'],
  };

  function startDronePatrol(d) {
    const route = DRONE_ROUTES[d.id];
    if (!route) return;
    let idx = 0;
    function next() {
      idx = (idx + 1) % route.length;
      d.moveTo(route[idx], () => setTimeout(next, 2000));
    }
    setTimeout(next, Math.random() * 4000 + 2000);
  }

  drones.forEach(d => startDronePatrol(d));

  // ── Water animation ──────────────────────────────────────────
  function animateOcean(t) {
    for (let i = 0; i < oceanVerts.count; i++) {
      const ox = oceanBase[i * 3], oz = oceanBase[i * 3 + 2];
      oceanVerts.array[i * 3 + 1] = Math.sin(ox * 0.02 + t) * 1.5 + Math.cos(oz * 0.025 + t * 0.8) * 1.2;
    }
    oceanVerts.needsUpdate = true;
  }

  // ── Camera orbit ─────────────────────────────────────────────
  let camAngle  = 0;
  let autoOrbit = true;
  let isDragging = false, prevMouse = { x: 0, y: 0 };
  let camRadius = 340, camTheta = 0.3, camPhi = Math.PI / 4;

  renderer.domElement.addEventListener('mousedown', e => { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY }; autoOrbit = false; });
  renderer.domElement.addEventListener('mouseup',   () => { isDragging = false; });
  renderer.domElement.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = (e.clientX - prevMouse.x) * 0.005;
    const dy = (e.clientY - prevMouse.y) * 0.005;
    camPhi   = Math.max(0.1, Math.min(Math.PI / 2.2, camPhi + dy));
    camTheta += dx;
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener('wheel', e => {
    camRadius = Math.max(100, Math.min(600, camRadius + e.deltaY * 0.4));
  });

  // ── ISA Execution bridge ─────────────────────────────────────
  function executeInstructions(instructions) {
    let delay = 0;
    instructions.forEach(inst => {
      setTimeout(() => {
        dispatchInstruction(inst);
      }, delay);
      delay += 800;
    });
  }

  function dispatchInstruction(inst) {
    const isAerial = inst.vehicle === 'DRONE';
    const actors   = isAerial ? drones : vehicles;
    // Pick first idle or first available
    const actor = actors.find(a => !a.moving) || actors[0];
    if (!actor) return;

    if (inst.opcode === 'MOVE' && inst.target) {
      actor.moveTo(inst.operand, () => {
        if (window.showHUD) window.showHUD(`✓ ${inst.opcode} → ${inst.zone_label || inst.operand}`);
      });
    } else if (inst.opcode === 'SCAN' && inst.target) {
      // Move then pulse
      actor.moveTo(inst.operand, () => {
        doScanEffect(inst.operand);
        if (window.showHUD) window.showHUD(`🔍 SCAN @ ${inst.zone_label || inst.operand}`);
      });
    } else if (inst.opcode === 'CHARGE') {
      actor.moveTo('CHARGE', () => {
        doChargeEffect();
        if (window.showHUD) window.showHUD(`⚡ شحن البطارية @ محطة الشحن`);
      });
    } else if (inst.opcode === 'DELIVER' && inst.target) {
      actor.moveTo(inst.operand, () => {
        if (window.showHUD) window.showHUD(`📦 تسليم @ ${inst.zone_label || inst.operand}`);
      });
    } else if (inst.opcode === 'LAUNCH') {
      const drone = drones.find(d => !d.moving) || drones[0];
      if (drone && inst.target) {
        drone.moveTo(inst.operand, () => {
          if (window.showHUD) window.showHUD(`🚁 درون أقلع → ${inst.zone_label || inst.operand}`);
        });
      }
    } else if (inst.opcode === 'RETURN') {
      actor.moveTo('CENTER', () => {
        if (window.showHUD) window.showHUD(`↩ العودة → مركز أوكساجون`);
      });
    }
  }

  function doScanEffect(zoneId) {
    const z = ZONES[zoneId];
    if (!z) return;
    // Expanding ring effect
    let scale = 1, opacity = 0.9;
    const scanGeo = new THREE.RingGeometry(1, 2, 32);
    const scanMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity });
    const ring    = new THREE.Mesh(scanGeo, scanMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(z.x, 5, z.z);
    scene.add(ring);
    const id = setInterval(() => {
      scale   += 0.8;
      opacity -= 0.04;
      ring.scale.set(scale, scale, scale);
      scanMat.opacity = Math.max(0, opacity);
      if (opacity <= 0) { clearInterval(id); scene.remove(ring); }
    }, 50);
  }

  function doChargeEffect() {
    const z = ZONES.CHARGE;
    let t = 0;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 3, 40, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.6 })
    );
    beam.position.set(z.x, 22, z.z);
    scene.add(beam);
    const id = setInterval(() => {
      t += 0.05; beam.material.opacity = Math.abs(Math.sin(t * 4)) * 0.6;
      if (t > 2) { clearInterval(id); scene.remove(beam); }
    }, 50);
  }

  // ── FPS counter ──────────────────────────────────────────────
  let fps = 60, frameCount = 0, lastFpsTime = performance.now();

  // ── Render loop ──────────────────────────────────────────────
  let lastTime = performance.now();
  let elapsed  = 0;

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt  = Math.min((now - lastTime) / 1000, 0.05);
    lastTime  = now;
    elapsed  += dt;

    // Ocean
    animateOcean(elapsed * 0.5);

    // Camera
    if (autoOrbit) {
      camTheta += 0.0008;
    }
    camera.position.x = camRadius * Math.sin(camTheta) * Math.cos(camPhi);
    camera.position.y = camRadius * Math.sin(camPhi);
    camera.position.z = camRadius * Math.cos(camTheta) * Math.cos(camPhi);
    camera.lookAt(0, 10, 0);

    // Hub pulse
    hubLight.intensity = 1.5 + Math.sin(elapsed * 3) * 0.5;

    // Update actors
    vehicles.forEach(v => v.update(dt));
    drones.forEach(d => d.update(dt, elapsed));

    // FPS
    frameCount++;
    if (now - lastFpsTime >= 1000) {
      fps          = frameCount;
      frameCount   = 0;
      lastFpsTime  = now;
      const el = document.getElementById('bar-fps');
      if (el) el.textContent = fps;
    }

    renderer.render(scene, camera);
  }

  animate();

  // ── Resize ───────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // ── Expose API ───────────────────────────────────────────────
  window.oxagon = { executeInstructions, vehicles, drones, scene };

  // Signal ready
  setTimeout(() => window.dispatchEvent(new Event('oxagon-ready')), 800);

})();
