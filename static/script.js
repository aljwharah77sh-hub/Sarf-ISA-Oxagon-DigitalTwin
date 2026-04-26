(function () {
  const container = document.getElementById('cv');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010a14);
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(0, 200, 300);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // إضاءة وبناء أرضية بسيطة لأوكساجون
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const grid = new THREE.GridHelper(400, 40, 0x004466, 0x002233);
  scene.add(grid);

  window.oxagon = { 
    exec: (insts) => console.log("Executing:", insts) 
  };

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  // إخفاء شاشة التحميل
  setTimeout(() => window.dispatchEvent(new Event('oxagon-ready')), 1500);
})();
