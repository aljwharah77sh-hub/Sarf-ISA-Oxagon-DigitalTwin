(function () {
'use strict';

// ── Zone registry (mirrors backend) ──────────────────────
const ZONES = {
  BERTH_1:   {x:120,  z:-80,  color:0xC46832, label:'رصيف 1',           type:'berth'    },
  BERTH_2:   {x:160,  z:-30,  color:0xC46832, label:'رصيف 2',           type:'berth'    },
  CONTAINERS:{x:140,  z: 40,  color:0xff8c00, label:'منطقة الحاويات',   type:'cargo'    },
  CUSTOMS:   {x: 80,  z: 60,  color:0x6B5B45, label:'الجمارك',          type:'admin'    },
  LOGISTICS: {x: 50,  z: 20,  color:0x8B6914, label:'اللوجستية',        type:'logistics'},
  WAREHOUSE: {x: 30,  z:-20,  color:0x5A4A3A, label:'المستودع',         type:'storage'  },
  CHARGE_A:  {x:-60,  z: 60,  color:0x00C853, label:'محطة شحن A',       type:'charge'   },
  CHARGE_B:  {x:-80,  z:-20,  color:0x00C853, label:'محطة شحن B',       type:'charge'   },
  CONTROL:   {x:  0,  z:  0,  color:0xC46832, label:'مركز التحكم',      type:'hub'      },
  GATE_N:    {x:  0,  z: 180, color:0x4A4A4A, label:'البوابة الشمالية', type:'gate'     },
  CRANE_1:   {x:110,  z:-90,  color:0x3A3A3A, label:'رافعة 1',          type:'crane'    },
  CRANE_2:   {x:155,  z:-40,  color:0x3A3A3A, label:'رافعة 2',          type:'crane'    },
  DRONE_HUB: {x:-40,  z:-60,  color:0x1E3A5F, label:'محطة الدرونز',    type:'drone'    },
};

// ── Renderer ──────────────────────────────────────────────
const container = document.getElementById('cv');
const W = container.clientWidth, H = container.clientHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;
container.appendChild(renderer.domElement);

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x060A0F);
scene.fog = new THREE.FogExp2(0x060A0F, 0.0022);

const camera = new THREE.PerspectiveCamera(42, W/H, 1, 2000);
camera.position.set(0, 240, 320);
camera.lookAt(0, 0, 0);

// ── Lights ────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x080C10, 3.0));

const sun = new THREE.DirectionalLight(0xFFD9A0, 0.9);
sun.position.set(150, 280, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{near:10,far:600,left:-280,right:280,top:280,bottom:-280});
scene.add(sun);

// Copper accent light (brand color)
const copperL = new THREE.PointLight(0xC46832, 1.2, 120);
copperL.position.set(0, 40, 0);
scene.add(copperL);

const rimL = new THREE.DirectionalLight(0xC46832, 0.25);
rimL.position.set(-200, 80, -100);
scene.add(rimL);

// ── Ocean ─────────────────────────────────────────────────
const ogeo = new THREE.PlaneGeometry(2400, 2400, 64, 64);
const omat = new THREE.MeshStandardMaterial({
  color:0x03080F, roughness:0.05, metalness:0.7,
  transparent:true, opacity:0.88
});
const ocean = new THREE.Mesh(ogeo, omat);
ocean.rotation.x = -Math.PI/2;
ocean.position.y = -4;
scene.add(ocean);
const oceanBase = new Float32Array(ogeo.attributes.position.array);

// ── Ground (port slab) ────────────────────────────────────
const groundGeo = new THREE.PlaneGeometry(380, 380);
const groundMat = new THREE.MeshStandardMaterial({color:0x0E1218,roughness:0.95,metalness:0.05});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI/2;
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// Port edge — copper accent strip
const edgeGeo = new THREE.BoxGeometry(380, 0.3, 0.3);
const edgeMat = new THREE.MeshStandardMaterial({color:0xC46832,emissive:0xC46832,emissiveIntensity:0.4});
[-190,190].forEach(z => {
  const e = new THREE.Mesh(edgeGeo, edgeMat);
  e.position.set(0, 0, z);
  scene.add(e);
});

// Grid
const grid = new THREE.GridHelper(380, 38, 0x0C1420, 0x0C1420);
grid.position.y = 0;
scene.add(grid);

// ── Zone pads ─────────────────────────────────────────────
const zonePads = {};
Object.entries(ZONES).forEach(([id,z]) => {
  const g = new THREE.CylinderGeometry(11, 11, 0.3, 32);
  const m = new THREE.MeshStandardMaterial({color:z.color,roughness:0.7,metalness:0.3,transparent:true,opacity:0.35});
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(z.x, 0, z.z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  zonePads[id] = mesh;

  // Zone ring
  const rg = new THREE.RingGeometry(12, 13.5, 32);
  const rm = new THREE.MeshBasicMaterial({color:z.color,side:THREE.DoubleSide,transparent:true,opacity:0.25});
  const ring = new THREE.Mesh(rg, rm);
  ring.rotation.x = -Math.PI/2;
  ring.position.set(z.x, 0.2, z.z);
  scene.add(ring);
});

// ── Helper builders ───────────────────────────────────────
function box(x,y,z,w,h,d,color,emissive=0,ei=0) {
  const g = new THREE.BoxGeometry(w,h,d);
  const m = new THREE.MeshStandardMaterial({color,roughness:0.65,metalness:0.4,emissive,emissiveIntensity:ei});
  const mesh = new THREE.Mesh(g,m);
  mesh.position.set(x,y+h/2,z);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
function addLight(x,y,z,color,intensity,dist) {
  const pl = new THREE.PointLight(color,intensity,dist);
  pl.position.set(x,y,z);
  scene.add(pl);
}

// ── Buildings ─────────────────────────────────────────────
// Control tower (center hub)
box(0,-0.5,0, 16,38,16, 0x141820, 0xC46832, 0.12);
box(0,-0.5,0, 20,5, 20, 0x0E1218);
box(0,-0.5,0, 22,2, 22, 0x1A2028);
// Copper crown
box(0,-0.5,0, 18,1, 18, 0xC46832, 0xC46832, 0.5);
addLight(0,42,0, 0xC46832, 2.5, 80);

// Control tower glass strips (copper verticals)
[-7,7].forEach(ox => {
  box(ox,-0.5,0, 1,34,1, 0xC46832, 0xC46832, 0.3);
});

// Warehouses
box(30,-0.5,-20, 28,10,18, 0x10151C); addLight(30,12,-20, 0xC46832,0.6,35);
box(-30,-0.5,30, 24,8, 16, 0x12181E); addLight(-30,10,30, 0x8B6914,0.5,30);

// Logistics building
box(50,-0.5,20, 22,12,16, 0x111820); addLight(50,14,20, 0xC46832,0.7,30);

// Customs
box(80,-0.5,60, 18,9, 14, 0x0E1318); addLight(80,11,60, 0x6B5B45,0.5,25);

// Berth infrastructure
// Berth 1
box(110,-0.5,-80, 30,4,40, 0x0A0F14);  // pier slab
box(110,-0.5,-100, 6,28,6, 0x1A1F28, 0xC46832,0.1);  // crane tower 1
box(120,-0.5,-90,  6,26,6, 0x1A1F28, 0xC46832,0.1);  // crane tower 2
// Crane arms
const craneArm1 = new THREE.Mesh(new THREE.BoxGeometry(30,2,2), new THREE.MeshStandardMaterial({color:0xC46832,emissive:0xC46832,emissiveIntensity:0.2}));
craneArm1.position.set(118,30,-95); scene.add(craneArm1);
const craneArm2 = new THREE.Mesh(new THREE.BoxGeometry(28,2,2), new THREE.MeshStandardMaterial({color:0xC46832,emissive:0xC46832,emissiveIntensity:0.2}));
craneArm2.position.set(128,28,-45); scene.add(craneArm2);
addLight(120,32,-80, 0xC46832, 1.5, 50);

// Berth 2
box(160,-0.5,-30, 28,4,36, 0x0A0F14);
box(152,-0.5,-50, 6,26,6, 0x1A1F28, 0xC46832,0.1);
addLight(160,28,-30, 0xC46832, 1.2, 45);

// Charging stations
[-60,60].forEach((x,i) => {
  const z = i===0 ? 60 : -20;
  box(x,-0.5,z, 8,6,6, 0x0A1A0A);
  box(x,-0.5,z, 10,0.5,8, 0x00C853, 0x00C853, 0.4); // green glow pad
  addLight(x,8,z, 0x00C853, 1.2, 30);
});

// Solar panels
for(let i=0;i<8;i++) {
  const sp = new THREE.Mesh(new THREE.BoxGeometry(10,0.4,6), new THREE.MeshStandardMaterial({color:0x0A1A35,metalness:0.9,roughness:0.1}));
  sp.position.set(-120+i*5, 4, 100+i*3);
  sp.rotation.x = -0.3;
  scene.add(sp);
}

// Containers (stacks)
const containerColors = [0x1A2530, 0x0E1A20, 0x151E28, 0x0A1520];
for(let row=0;row<4;row++) for(let col=0;col<6;col++) for(let h=0;h<3;h++) {
  if(Math.random()<0.3) continue;
  const c = new THREE.Mesh(
    new THREE.BoxGeometry(9.5,4.5,19.5),
    new THREE.MeshStandardMaterial({color:containerColors[row%4],roughness:0.8,metalness:0.2})
  );
  c.position.set(125+col*11, 2.5+h*4.8, 20+row*22);
  c.castShadow = true;
  scene.add(c);
  // Copper stripe on containers
  if(Math.random()<0.4) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(9.6,0.3,0.3),new THREE.MeshStandardMaterial({color:0xC46832,emissive:0xC46832,emissiveIntensity:0.3}));
    stripe.position.set(125+col*11, 4.5+h*4.8, 20+row*22+9.5);
    scene.add(stripe);
  }
}

// Gate
box(0,-0.5,180, 40,16,4, 0x141820);
box(0,-0.5,180, 44,2,6, 0x1E2530);
// Gate copper bar
const gatebar = new THREE.Mesh(new THREE.BoxGeometry(44,1,1),new THREE.MeshStandardMaterial({color:0xC46832,emissive:0xC46832,emissiveIntensity:0.5}));
gatebar.position.set(0,17,180);
scene.add(gatebar);
addLight(0,18,180, 0xC46832, 2, 50);

// Stars
const sg=new THREE.BufferGeometry(),sp2=[];
for(let i=0;i<2500;i++) sp2.push((Math.random()-.5)*2400,Math.random()*700+100,(Math.random()-.5)*2400);
sg.setAttribute('position',new THREE.Float32BufferAttribute(sp2,3));
scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:0.5,transparent:true,opacity:0.6})));

// Sunrise glow (horizon)
const horizonGeo = new THREE.PlaneGeometry(800, 200);
const horizonMat = new THREE.MeshBasicMaterial({color:0xC46832,transparent:true,opacity:0.04,side:THREE.DoubleSide});
const horizon = new THREE.Mesh(horizonGeo, horizonMat);
horizon.rotation.x = -Math.PI/2;
horizon.position.set(0, -3, -600);
scene.add(horizon);

// ── Effects ───────────────────────────────────────────────
function pulsePad(id) {
  const p = zonePads[id]; if(!p) return;
  const orig=p.material.opacity; let t=0;
  const iv=setInterval(()=>{t+=.1;p.material.opacity=orig+Math.sin(t*8)*.3;if(t>2.5){p.material.opacity=orig;clearInterval(iv);}},40);
}
function scanFx(zid) {
  const z=ZONES[zid]; if(!z) return;
  const g=new THREE.RingGeometry(1,2,32);
  const m=new THREE.MeshBasicMaterial({color:0xC46832,side:THREE.DoubleSide,transparent:true,opacity:0.9});
  const r=new THREE.Mesh(g,m);
  r.rotation.x=-Math.PI/2; r.position.set(z.x,2,z.z); scene.add(r);
  let s=1,op=0.9; const iv=setInterval(()=>{s+=0.9;op-=0.04;r.scale.set(s,s,s);m.opacity=Math.max(0,op);if(op<=0){clearInterval(iv);scene.remove(r);}},45);
}
function chargeFx(zid) {
  const z=ZONES[zid]||ZONES.CHARGE_A;
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.4,2.5,36,8),new THREE.MeshBasicMaterial({color:0x00C853,transparent:true,opacity:0.5}));
  b.position.set(z.x,20,z.z); scene.add(b);
  let t=0; const iv=setInterval(()=>{t+=.05;b.material.opacity=Math.abs(Math.sin(t*4))*.5;if(t>2){clearInterval(iv);scene.remove(b);}},45);
}
function emergencyFx(zid) {
  const z=ZONES[zid]||ZONES.CONTROL;
  for(let i=0;i<3;i++) {
    const g=new THREE.RingGeometry(1,3,32);
    const m=new THREE.MeshBasicMaterial({color:0xff2222,side:THREE.DoubleSide,transparent:true,opacity:0.8});
    const r=new THREE.Mesh(g,m); r.rotation.x=-Math.PI/2; r.position.set(z.x,1+i,z.z); scene.add(r);
    let s=1,op=0.8; const delay=i*200;
    setTimeout(()=>{const iv=setInterval(()=>{s+=1.2;op-=0.04;r.scale.set(s,s,s);m.opacity=Math.max(0,op);if(op<=0){clearInterval(iv);scene.remove(r);}},45);},delay);
  }
}

// ── Vehicle ───────────────────────────────────────────────
class Vehicle {
  constructor(id,zone,color=0xC46832) {
    this.id=id; this.moving=false; this.target=null; this.onA=null; this.q=[]; this.speed=75;
    // Sarf-branded truck shape
    const body=new THREE.Mesh(new THREE.BoxGeometry(8,3.5,14),new THREE.MeshStandardMaterial({color:0x0A0E14,roughness:0.3,metalness:0.8}));
    body.castShadow=true;
    // Copper brand stripe
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(8.1,.6,14.1),new THREE.MeshStandardMaterial({color:0xC46832,emissive:0xC46832,emissiveIntensity:0.4}));
    stripe.position.y=1.3;
    body.add(stripe);
    // Logo on front
    const logo=new THREE.Mesh(new THREE.BoxGeometry(3,.2,1),new THREE.MeshStandardMaterial({color:0xC46832,emissive:0xC46832,emissiveIntensity:0.6}));
    logo.position.set(0,0.5,7.1);
    body.add(logo);
    this.mesh=body;
    const z=ZONES[zone]||ZONES.CONTROL;
    body.position.set(z.x+Math.random()*8-4,2,z.z+Math.random()*8-4);
    scene.add(body);
    this.lL=new THREE.PointLight(0xC46832,1.2,22); this.lR=new THREE.PointLight(0xC46832,1.2,22);
    scene.add(this.lL); scene.add(this.lR);
  }
  moveTo(zone,cb) {
    const z=ZONES[zone]; if(!z) return;
    this.target=new THREE.Vector3(z.x,2,z.z); this.moving=true; this.onA=cb;
    if(window.showHUD) window.showHUD(`🚛 ${this.id} → ${z.label}`);
    if(window.setZone) window.setZone(z.label);
    pulsePad(zone);
  }
  update(dt) {
    if(!this.moving||!this.target) return;
    const pos=this.mesh.position,dir=this.target.clone().sub(pos),dist=dir.length();
    if(dist<2.5){pos.copy(this.target);this.moving=false;if(this.onA){this.onA();this.onA=null;}if(this.q.length){const n=this.q.shift();setTimeout(()=>this.moveTo(n.z,n.c),350);} return;}
    dir.normalize().multiplyScalar(Math.min(this.speed*dt,dist)); pos.add(dir);
    this.mesh.rotation.y=Math.atan2(dir.x,dir.z);
    this.lL.position.set(pos.x-3,pos.y+.8,pos.z+5); this.lR.position.set(pos.x+3,pos.y+.8,pos.z+5);
  }
  queue(zone,cb){this.q.push({z:zone,c:cb});}
}

// ── Drone ─────────────────────────────────────────────────
class Drone {
  constructor(id,zone,color=0xC46832) {
    this.id=id; this.moving=false; this.target=null; this.onA=null; this.q=[]; this.speed=130; this.hover=Math.random()*6;
    // Sleek drone body
    const body=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,1.2,8),new THREE.MeshStandardMaterial({color:0x080C10,metalness:.9,roughness:.1}));
    body.castShadow=true;
    // Copper ring
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2.5,.2,8,32),new THREE.MeshStandardMaterial({color:0xC46832,emissive:0xC46832,emissiveIntensity:.5}));
    ring.rotation.x=Math.PI/2; body.add(ring);
    this.rotors=[];
    [[-3.5,-3.5],[3.5,-3.5],[-3.5,3.5],[3.5,3.5]].forEach(([rx,rz])=>{
      const r=new THREE.Mesh(new THREE.CylinderGeometry(2,2,.15,12),new THREE.MeshStandardMaterial({color:0x1A1A20,metalness:.8}));
      r.position.set(rx,.5,rz); body.add(r); this.rotors.push(r);
    });
    this.mesh=body;
    const z=ZONES[zone]||ZONES.DRONE_HUB;
    this.baseY=40+Math.random()*16;
    body.position.set(z.x+Math.random()*8-4,this.baseY,z.z+Math.random()*8-4);
    scene.add(body);
    this.pl=new THREE.PointLight(0xC46832,1.5,35); scene.add(this.pl);
  }
  moveTo(zone,cb) {
    const z=ZONES[zone]; if(!z) return;
    this.target=new THREE.Vector3(z.x,this.baseY,z.z); this.moving=true; this.onA=cb;
    if(window.showHUD) window.showHUD(`🚁 ${this.id} → ${z.label}`);
    pulsePad(zone);
  }
  update(dt,t) {
    this.rotors.forEach(r=>r.rotation.y+=16*dt);
    const pos=this.mesh.position; pos.y=this.baseY+Math.sin(t*2+this.hover)*2;
    if(this.moving&&this.target){
      const tf=this.target.clone(); tf.y=pos.y;
      const dir=tf.sub(pos),dist=dir.length();
      if(dist<3.5){this.moving=false;if(this.onA){this.onA();this.onA=null;}if(this.q.length){const n=this.q.shift();setTimeout(()=>this.moveTo(n.z,n.c),450);}
      } else {dir.normalize().multiplyScalar(Math.min(this.speed*dt,dist)); pos.x+=dir.x; pos.z+=dir.z; this.mesh.rotation.y=Math.atan2(dir.x,dir.z);}
    }
    this.pl.position.set(pos.x,pos.y-2,pos.z);
  }
  queue(zone,cb){this.q.push({z:zone,c:cb});}
}

// ── Spawn actors ──────────────────────────────────────────
const vehicles = [
  new Vehicle('V-001','BERTH_1',   0xC46832),
  new Vehicle('V-002','LOGISTICS', 0xC46832),
  new Vehicle('V-003','CONTROL',   0xC46832),
  new Vehicle('V-004','WAREHOUSE', 0xC46832),
];
const drones = [
  new Drone('D-001','DRONE_HUB', 0xC46832),
  new Drone('D-002','CONTROL',   0xC46832),
  new Drone('D-003','BERTH_2',   0xC46832),
];

// ── Patrol routes ─────────────────────────────────────────
const VPATROL={
  'V-001':['BERTH_1','CRANE_1','CONTAINERS','CUSTOMS','BERTH_1'],
  'V-002':['LOGISTICS','WAREHOUSE','CONTROL','LOGISTICS'],
  'V-003':['CONTROL','CHARGE_A','GATE_N','CONTROL'],
  'V-004':['WAREHOUSE','LOGISTICS','BERTH_2','WAREHOUSE'],
};
const DPATROL={
  'D-001':['DRONE_HUB','BERTH_1','CONTAINERS','CUSTOMS','DRONE_HUB'],
  'D-002':['CONTROL','BERTH_2','LOGISTICS','CONTROL'],
  'D-003':['BERTH_2','CRANE_2','CONTAINERS','BERTH_2'],
};
function patrol(a,routes){
  const r=routes[a.id]; if(!r) return; let i=0;
  const next=()=>{i=(i+1)%r.length;a.moveTo(r[i],()=>setTimeout(next,1800));};
  setTimeout(next,Math.random()*4000+800);
}
vehicles.forEach(v=>patrol(v,VPATROL));
drones.forEach(d=>patrol(d,DPATROL));

// ── ISA dispatch ──────────────────────────────────────────
function execInstructions(insts) {
  let delay=0;
  insts.forEach(inst=>{setTimeout(()=>dispatch(inst),delay);delay+=700;});
}
function dispatch(inst) {
  const aerial = inst.vehicle==='DRONE';
  const pool   = aerial ? drones : vehicles;
  const actor  = pool.find(a=>!a.moving)||pool[0];
  if(!actor) return;
  const done=()=>{if(window.showHUD)window.showHUD(`✓ ${inst.opcode} → ${inst.zone_info?.name||inst.zone||'—'}`);}

  // Emergency FX
  if(inst.opcode==='EMERGENCY') { emergencyFx(inst.zone||'CONTROL'); done(); return; }

  switch(inst.opcode) {
    case 'DOCK': case 'MOVE':
      if(inst.zone) actor.moveTo(inst.zone, done);
      break;
    case 'SCAN':
      if(inst.zone) actor.moveTo(inst.zone, ()=>{ scanFx(inst.zone); done(); });
      break;
    case 'CHARGE':
      const cz = inst.zone||'CHARGE_A';
      actor.moveTo(cz, ()=>{ chargeFx(cz); done(); });
      break;
    case 'PREPARE': case 'DELIVER':
      if(inst.zone) actor.moveTo(inst.zone, done);
      break;
    case 'LAUNCH':
      const dr=drones.find(d=>!d.moving)||drones[0];
      if(dr&&inst.zone) dr.moveTo(inst.zone, done);
      break;
    case 'SECURE':
      if(inst.zone) actor.moveTo(inst.zone, ()=>{ scanFx(inst.zone); done(); });
      break;
    case 'COMPLETE': case 'RELEASE':
      actor.moveTo('CONTROL', done);
      break;
    default:
      if(inst.zone) actor.moveTo(inst.zone, done);
  }
}

// ── Camera ────────────────────────────────────────────────
let camR=360,camTh=.4,camPh=.38,autoOrb=true,drag=false,pm={x:0,y:0};
document.addEventListener('mousedown',e=>{drag=true;pm={x:e.clientX,y:e.clientY};autoOrb=false;});
document.addEventListener('mouseup',  ()=>drag=false);
document.addEventListener('mousemove',e=>{if(!drag)return;camTh+=(e.clientX-pm.x)*.005;camPh=Math.max(.08,Math.min(Math.PI/2.1,camPh+(e.clientY-pm.y)*.005));pm={x:e.clientX,y:e.clientY};});
document.addEventListener('wheel',    e=>{camR=Math.max(130,Math.min(650,camR+e.deltaY*.4));});
document.addEventListener('touchstart',e=>{drag=true;pm={x:e.touches[0].clientX,y:e.touches[0].clientY};autoOrb=false;},{passive:true});
document.addEventListener('touchend', ()=>drag=false);
document.addEventListener('touchmove', e=>{if(!drag)return;camTh+=(e.touches[0].clientX-pm.x)*.005;camPh=Math.max(.08,Math.min(Math.PI/2.1,camPh+(e.touches[0].clientY-pm.y)*.005));pm={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});

// ── Control tower rotation ────────────────────────────────
let elapsed=0, lastT=performance.now(), fc=0, fpt=performance.now();

(function animate(){
  requestAnimationFrame(animate);
  const now=performance.now(),dt=Math.min((now-lastT)/1000,.05);
  lastT=now; elapsed+=dt;

  // Ocean waves
  const ov=ogeo.attributes.position;
  for(let i=0;i<ov.count;i++){
    const ox=oceanBase[i*3],oz=oceanBase[i*3+2];
    ov.array[i*3+1]=Math.sin(ox*.02+elapsed*.4)*1.8+Math.cos(oz*.025+elapsed*.6)*1.3;
  }
  ov.needsUpdate=true;

  // Camera
  if(autoOrb) camTh+=.0006;
  camera.position.set(
    camR*Math.sin(camTh)*Math.cos(camPh),
    camR*Math.sin(camPh),
    camR*Math.cos(camTh)*Math.cos(camPh)
  );
  camera.lookAt(0,8,0);

  // Hub copper light pulse
  copperL.intensity=1.0+Math.sin(elapsed*2.2)*.4;

  // Actors
  vehicles.forEach(v=>v.update(dt));
  drones.forEach(d=>d.update(dt,elapsed));

  // FPS
  fc++; if(now-fpt>=1000){const el=document.getElementById('b-fps');if(el)el.textContent=fc;fc=0;fpt=now;}

  renderer.render(scene,camera);
})();

window.addEventListener('resize',()=>{
  const w=container.clientWidth,h=container.clientHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h);
});

// ── Public API ────────────────────────────────────────────
window.sarfPort = { execInstructions, vehicles, drones, scanFx, chargeFx, emergencyFx, pulsePad };
setTimeout(()=>window.dispatchEvent(new Event('sarf-ready')),1000);
})();
