/**
 * OXAGON Digital Twin — Three.js Scene Engine
 * static/script.js
 * الجملة العربية هي الشرارة التي تحرّك كل شيء
 */
(function () {
'use strict';

// ── Zone registry (mirrors backend) ─────────────────────────
const Z = {
  PORT:        { x: 120,  z: -80,  color: 0x0099ff, label: 'ميناء أوكساجون'    },
  LOGISTICS:   { x: 60,   z:  20,  color: 0xff8c00, label: 'المنطقة اللوجستية' },
  WAREHOUSE:   { x: 80,   z:  60,  color: 0xffaa33, label: 'مستودع المواد'     },
  CONTAINERS:  { x: 140,  z: -40,  color: 0x0077cc, label: 'منطقة الحاويات'   },
  FACTORY:     { x: -60,  z: -60,  color: 0xcc4400, label: 'المصنع الرئيسي'   },
  ENERGY:      { x: -120, z:  20,  color: 0x00cc66, label: 'محطة الطاقة'      },
  CHARGE:      { x: -80,  z:  80,  color: 0x44dd88, label: 'محطة الشحن'       },
  RESIDENTIAL: { x: 20,   z: 100,  color: 0x9955ff, label: 'الحي السكني'      },
  CENTER:      { x: 0,    z:   0,  color: 0xffd700, label: 'مركز أوكساجون'    },
  AIRPORT:     { x: -140, z: -80,  color: 0xaaaaaa, label: 'مطار أوكساجون'    },
};

// ── Renderer ─────────────────────────────────────────────────
const container = document.getElementById('cv');
const W = container.clientWidth, H = container.clientHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010a14);
scene.fog = new THREE.FogExp2(0x010a14, 0.0026);

const camera = new THREE.PerspectiveCamera(45, W / H, 1, 2000);
camera.position.set(0, 220, 290);
camera.lookAt(0, 0, 0);

// ── Lighting ─────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x0a1a2e, 2.2));

const sun = new THREE.DirectionalLight(0x80c8ff, 1.2);
sun.position.set(200, 300, 100);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { near:10, far:600, left:-260, right:260, top:260, bottom:-260 });
scene.add(sun);

scene.add(Object.assign(new THREE.DirectionalLight(0x00c8ff, 0.35), { position: new THREE.Vector3(-150, 100, -100) }));

// ── Ocean ────────────────────────────────────────────────────
const oceanGeo = new THREE.PlaneGeometry(2200, 2200, 60, 60);
const oceanMat = new THREE.MeshStandardMaterial({ color: 0x002f4a, roughness: 0.1, metalness: 0.65, transparent: true, opacity: 0.82 });
const ocean = new THREE.Mesh(oceanGeo, oceanMat);
ocean.rotation.x = -Math.PI / 2;
ocean.position.y = -2.5;
scene.add(ocean);
const oceanBase = new Float32Array(oceanGeo.attributes.position.array);

// ── Octagon ground ───────────────────────────────────────────
(function buildGround() {
  const R = 182, N = 8;
  const shape = new THREE.Shape();
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 8;
    const x = Math.cos(a) * R, y = Math.sin(a) * R;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
  const mat = new THREE.MeshStandardMaterial({ color: 0x0b1c2c, roughness: 0.88, metalness: 0.12 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Edge glow
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 8;
    pts.push(Math.cos(a) * R, 2.2, Math.sin(a) * R);
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Line(eg, new THREE.LineBasicMaterial({ color: 0x00c8ff })));

  // Zone rings
  Object.values(Z).forEach(z => {
    const rg = new THREE.RingGeometry(13, 15.5, 32);
    const rm = new THREE.MeshBasicMaterial({ color: z.color, side: THREE.DoubleSide, transparent: true, opacity: 0.38 });
    const r  = new THREE.Mesh(rg, rm);
    r.rotation.x = -Math.PI / 2;
    r.position.set(z.x, 2.4, z.z);
    scene.add(r);
  });

  // Grid
  const grid = new THREE.GridHelper(364, 36, 0x0a2233, 0x0a2233);
  grid.position.y = 1.4;
  scene.add(grid);
})();

// ── Zone pads (clickable highlight targets) ──────────────────
const pads = {};
Object.entries(Z).forEach(([id, z]) => {
  const g = new THREE.CylinderGeometry(11.5, 11.5, 0.4, 32);
  const m = new THREE.MeshStandardMaterial({ color: z.color, roughness: 0.75, metalness: 0.25, transparent: true, opacity: 0.45 });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(z.x, 1, z.z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  pads[id] = mesh;
});

// ── Buildings ────────────────────────────────────────────────
function box(x, y, z, w, h, d, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.32 });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  const pl = new THREE.PointLight(color, 0.5, 28);
  pl.position.set(x, y + h + 5, z);
  scene.add(pl);
  return mesh;
}

// Port
box(110,-1,-80,24,13,18,0x1a4a7a); box(130,-1,-90,14,20,14,0x1a5a9a); box(125,-1,-65,10,8,10,0x1a3a6a);
[115,130,145].forEach(px => {
  box(px,-1,-75,2,28,2,0x334455);
  const ag = new THREE.BoxGeometry(22,1.5,1.5);
  const am = new THREE.MeshStandardMaterial({ color:0x445566 });
  const a  = new THREE.Mesh(ag, am); a.position.set(px+6,28,-75); scene.add(a);
});
// Logistics
box(55,-1,20,22,10,18,0x6a3a00); box(75,-1,55,18,7,16,0x7a4a00); box(90,-1,30,12,14,12,0x5a3000);
// Factory
box(-60,-1,-60,28,18,20,0x4a1a00); box(-70,-1,-50,10,30,10,0x5a2a00);
// Energy
box(-120,-1,20,20,14,20,0x004a22);
for (let i=0;i<6;i++) {
  const s=new THREE.Mesh(new THREE.BoxGeometry(10,.5,6),new THREE.MeshStandardMaterial({color:0x003366,metalness:.8,roughness:.2}));
  s.position.set(-130+i*4,4,10+i*2); s.rotation.x=-0.3; scene.add(s);
}
// Residential
[10,25,35].forEach((xo,i)=>box(xo,-1,96+i*8,10,8+i*4,10,0x441188));
// Hub
const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(10,14,16,8), new THREE.MeshStandardMaterial({color:0xffd700,metalness:.65,roughness:.3}));
hubMesh.position.set(0,9,0); hubMesh.castShadow=true; scene.add(hubMesh);
const hubPL = new THREE.PointLight(0xffd700,2,65); hubPL.position.set(0,22,0); scene.add(hubPL);
// Airport runway
const rwy=new THREE.Mesh(new THREE.BoxGeometry(60,0.3,14),new THREE.MeshStandardMaterial({color:0x222222}));
rwy.position.set(-140,1.5,-80); scene.add(rwy);

// ── Stars ────────────────────────────────────────────────────
const sg=new THREE.BufferGeometry(), sp=[];
for(let i=0;i<2000;i++) sp.push((Math.random()-.5)*2000,Math.random()*600+120,(Math.random()-.5)*2000);
sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:.55,transparent:true,opacity:.65})));

// ── Pulse pad helper ─────────────────────────────────────────
function pulsePad(id) {
  const pad = pads[id]; if (!pad) return;
  const orig = pad.material.opacity;
  let t=0, iv=setInterval(()=>{
    t+=.12; pad.material.opacity = orig + Math.sin(t*8)*.35;
    if(t>2.2){ pad.material.opacity=orig; clearInterval(iv); }
  },40);
}

// ── Scan ring effect ─────────────────────────────────────────
function scanEffect(zid) {
  const z=Z[zid]; if(!z) return;
  const g=new THREE.RingGeometry(1,2,32);
  const m=new THREE.MeshBasicMaterial({color:0x00ff88,side:THREE.DoubleSide,transparent:true,opacity:.85});
  const r=new THREE.Mesh(g,m);
  r.rotation.x=-Math.PI/2; r.position.set(z.x,5.5,z.z); scene.add(r);
  let s=1,op=.85,iv=setInterval(()=>{
    s+=.9; op-=.045; r.scale.set(s,s,s); m.opacity=Math.max(0,op);
    if(op<=0){clearInterval(iv);scene.remove(r);}
  },45);
}

// ── Charge beam effect ───────────────────────────────────────
function chargeEffect() {
  const z=Z.CHARGE;
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.5,3,42,8),new THREE.MeshBasicMaterial({color:0x00ffcc,transparent:true,opacity:.55}));
  b.position.set(z.x,23,z.z); scene.add(b);
  let t=0,iv=setInterval(()=>{
    t+=.05; b.material.opacity=Math.abs(Math.sin(t*4))*.55;
    if(t>2.2){clearInterval(iv);scene.remove(b);}
  },45);
}

// ── Vehicle class ─────────────────────────────────────────────
class Vehicle {
  constructor(id, zone, color=0x00c8ff) {
    this.id=id; this.moving=false; this.target=null; this.onArr=null; this.queue=[];
    this.speed=80;
    const g=new THREE.BoxGeometry(7,3.5,12);
    const m=new THREE.MeshStandardMaterial({color,roughness:.4,metalness:.7,emissive:color,emissiveIntensity:.14});
    this.mesh=new THREE.Mesh(g,m); this.mesh.castShadow=true;
    const z=Z[zone]||Z.CENTER;
    this.mesh.position.set(z.x+Math.random()*8-4,4,z.z+Math.random()*8-4);
    scene.add(this.mesh);
    this.lL=new THREE.PointLight(color,1.4,24); this.lR=new THREE.PointLight(color,1.4,24);
    scene.add(this.lL); scene.add(this.lR);
  }
  moveTo(zone,cb) {
    const z=Z[zone]; if(!z) return;
    this.target=new THREE.Vector3(z.x,4,z.z); this.moving=true; this.onArr=cb; this.destZone=zone;
    if(window.showHUD) window.showHUD(`🚗 ${this.id} → ${z.label}`);
    if(window.setZone) window.setZone(z.label);
    pulsePad(zone);
  }
  queueMove(zone,cb){ this.queue.push({zone,cb}); }
  update(dt) {
    if(!this.moving||!this.target) return;
    const pos=this.mesh.position, dir=this.target.clone().sub(pos), dist=dir.length();
    if(dist<2.8){
      pos.copy(this.target); this.moving=false;
      if(this.onArr){this.onArr();this.onArr=null;}
      if(this.queue.length){const nx=this.queue.shift();setTimeout(()=>this.moveTo(nx.zone,nx.cb),400);}
      return;
    }
    const step=Math.min(this.speed*dt,dist);
    dir.normalize().multiplyScalar(step); pos.add(dir);
    this.mesh.rotation.y=Math.atan2(dir.x,dir.z);
    this.lL.position.set(pos.x-3,pos.y+1,pos.z+5);
    this.lR.position.set(pos.x+3,pos.y+1,pos.z+5);
  }
}

// ── Drone class ───────────────────────────────────────────────
class Drone {
  constructor(id, zone, color=0x00ff88) {
    this.id=id; this.moving=false; this.target=null; this.onArr=null; this.queue=[];
    this.speed=130; this.hover=Math.random()*6;
    const body=new THREE.Mesh(new THREE.CylinderGeometry(3,3,1.5,8),new THREE.MeshStandardMaterial({color,metalness:.8,roughness:.2,emissive:color,emissiveIntensity:.18}));
    this.mesh=body; this.mesh.castShadow=true;
    this.rotors=[];
    [[-4,-4],[4,-4],[-4,4],[4,4]].forEach(([rx,rz])=>{
      const r=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,.2,12),new THREE.MeshStandardMaterial({color:0x888888,metalness:.9}));
      r.position.set(rx,.5,rz); this.mesh.add(r); this.rotors.push(r);
    });
    const z=Z[zone]||Z.CENTER;
    this.baseY=36+Math.random()*18;
    this.mesh.position.set(z.x+Math.random()*8-4,this.baseY,z.z+Math.random()*8-4);
    scene.add(this.mesh);
    this.pl=new THREE.PointLight(color,1.8,38); scene.add(this.pl);
  }
  moveTo(zone,cb) {
    const z=Z[zone]; if(!z) return;
    this.target=new THREE.Vector3(z.x,this.baseY,z.z); this.moving=true; this.onArr=cb;
    if(window.showHUD) window.showHUD(`🚁 ${this.id} → ${z.label}`);
    pulsePad(zone);
  }
  queueMove(zone,cb){ this.queue.push({zone,cb}); }
  update(dt,t) {
    this.rotors.forEach(r=>r.rotation.y+=14*dt);
    const pos=this.mesh.position;
    pos.y=this.baseY+Math.sin(t*2+this.hover)*2;
    if(this.moving&&this.target){
      const tf=this.target.clone(); tf.y=pos.y;
      const dir=tf.sub(pos), dist=dir.length();
      if(dist<3.5){
        this.moving=false;
        if(this.onArr){this.onArr();this.onArr=null;}
        if(this.queue.length){const nx=this.queue.shift();setTimeout(()=>this.moveTo(nx.zone,nx.cb),500);}
      } else {
        dir.normalize().multiplyScalar(Math.min(this.speed*dt,dist));
        pos.x+=dir.x; pos.z+=dir.z;
        this.mesh.rotation.y=Math.atan2(dir.x,dir.z);
      }
    }
    this.pl.position.set(pos.x,pos.y-2,pos.z);
  }
}

// ── Spawn actors ──────────────────────────────────────────────
const vehicles = [
  new Vehicle('V-001','PORT',      0x00c8ff),
  new Vehicle('V-002','LOGISTICS', 0xff8c00),
  new Vehicle('V-003','CENTER',    0xffd700),
];
const drones = [
  new Drone('D-001','CENTER',  0x00ff88),
  new Drone('D-002','FACTORY', 0xff44aa),
];

// ── Autonomous patrol ─────────────────────────────────────────
const VPATROL = {
  'V-001':['PORT','CONTAINERS','LOGISTICS','WAREHOUSE','PORT'],
  'V-002':['LOGISTICS','CENTER','WAREHOUSE','LOGISTICS'],
  'V-003':['CENTER','RESIDENTIAL','CHARGE','CENTER'],
};
const DPATROL = {
  'D-001':['CENTER','PORT','FACTORY','ENERGY','CENTER'],
  'D-002':['FACTORY','AIRPORT','LOGISTICS','FACTORY'],
};

function patrol(actor, routes) {
  const route=routes[actor.id]; if(!route) return;
  let i=0;
  const next=()=>{i=(i+1)%route.length; actor.moveTo(route[i],()=>setTimeout(next,1600));};
  setTimeout(next, Math.random()*3000+800);
}
vehicles.forEach(v=>patrol(v,VPATROL));
drones.forEach(d=>patrol(d,DPATROL));

// ── ISA execution bridge ──────────────────────────────────────
function exec(instructions) {
  let delay=0;
  instructions.forEach(inst => {
    setTimeout(() => dispatch(inst), delay);
    delay += 700;
  });
}

function dispatch(inst) {
  const aerial = inst.vehicle === 'DRONE';
  const actors  = aerial ? drones : vehicles;
  const actor   = actors.find(a=>!a.moving) || actors[0];
  if (!actor) return;

  const arrive = () => {
    if(window.showHUD) window.showHUD(`✓ ${inst.opcode} → ${inst.zone_label||inst.operand}`);
  };

  switch(inst.opcode) {
    case 'MOVE':
      if(inst.target) actor.moveTo(inst.operand, arrive);
      break;
    case 'SCAN':
      if(inst.target) actor.moveTo(inst.operand, ()=>{ scanEffect(inst.operand); arrive(); });
      break;
    case 'CHARGE':
      actor.moveTo('CHARGE', ()=>{ chargeEffect(); arrive(); });
      break;
    case 'DELIVER':
      if(inst.target) actor.moveTo(inst.operand, arrive);
      break;
    case 'LAUNCH':
      const drone = drones.find(d=>!d.moving)||drones[0];
      if(drone && inst.target) drone.moveTo(inst.operand, arrive);
      break;
    case 'RETURN':
      actor.moveTo('CENTER', arrive);
      break;
    case 'STOP':
      actor.moving=false;
      if(window.showHUD) window.showHUD(`⏹ ${actor.id} توقف`);
      break;
  }
}

// ── Camera control ────────────────────────────────────────────
let camR=340, camTheta=Math.PI/6, camPhi=Math.PI/5, autoOrbit=true;
let drag=false, pm={x:0,y:0};

renderer.domElement.addEventListener('mousedown', e=>{drag=true; pm={x:e.clientX,y:e.clientY}; autoOrbit=false;});
renderer.domElement.addEventListener('mouseup',   ()=>drag=false);
renderer.domElement.addEventListener('mousemove', e=>{
  if(!drag) return;
  camTheta += (e.clientX-pm.x)*.005;
  camPhi    = Math.max(.1,Math.min(Math.PI/2.1, camPhi+(e.clientY-pm.y)*.005));
  pm={x:e.clientX,y:e.clientY};
});
renderer.domElement.addEventListener('wheel', e=>{
  camR=Math.max(100,Math.min(620,camR+e.deltaY*.4));
});
// Touch
renderer.domElement.addEventListener('touchstart', e=>{ drag=true; pm={x:e.touches[0].clientX,y:e.touches[0].clientY}; autoOrbit=false; });
renderer.domElement.addEventListener('touchend',   ()=>drag=false);
renderer.domElement.addEventListener('touchmove',  e=>{
  if(!drag) return;
  camTheta += (e.touches[0].clientX-pm.x)*.005;
  camPhi    = Math.max(.1,Math.min(Math.PI/2.1, camPhi+(e.touches[0].clientY-pm.y)*.005));
  pm={x:e.touches[0].clientX,y:e.touches[0].clientY};
  e.preventDefault();
},{passive:false});

// ── FPS ───────────────────────────────────────────────────────
let fps=60, fc=0, fpt=performance.now();

// ── Render loop ───────────────────────────────────────────────
let last=performance.now(), elapsed=0;

(function animate() {
  requestAnimationFrame(animate);
  const now=performance.now(), dt=Math.min((now-last)/1000,.05);
  last=now; elapsed+=dt;

  // Ocean waves
  const ov=oceanGeo.attributes.position;
  for(let i=0;i<ov.count;i++){
    const ox=oceanBase[i*3], oz=oceanBase[i*3+2];
    ov.array[i*3+1]=Math.sin(ox*.022+elapsed*.5)*1.6+Math.cos(oz*.026+elapsed*.7)*1.1;
  }
  ov.needsUpdate=true;

  // Camera
  if(autoOrbit) camTheta+=.0007;
  camera.position.set(
    camR*Math.sin(camTheta)*Math.cos(camPhi),
    camR*Math.sin(camPhi),
    camR*Math.cos(camTheta)*Math.cos(camPhi)
  );
  camera.lookAt(0,8,0);

  // Hub pulse
  hubPL.intensity=1.5+Math.sin(elapsed*2.8)*.55;
  hubMesh.rotation.y+=.003;

  // Actors
  vehicles.forEach(v=>v.update(dt));
  drones.forEach(d=>d.update(dt,elapsed));

  // FPS
  fc++;
  if(now-fpt>=1000){
    fps=fc; fc=0; fpt=now;
    const el=document.getElementById('b-fps');
    if(el) el.textContent=fps;
  }

  renderer.render(scene,camera);
})();

// ── Resize ────────────────────────────────────────────────────
window.addEventListener('resize',()=>{
  const w=container.clientWidth,h=container.clientHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h);
});

// ── Public API ────────────────────────────────────────────────
window.oxagon = { exec, vehicles, drones, scene };

// Signal ready
setTimeout(()=>window.dispatchEvent(new Event('oxagon-ready')), 900);

})();
