import * as THREE from 'three';

let scene, camera, renderer, marsGroup, stars, miniMarsGroup;
let mouseX = 0,
  mouseY = 0;
let isDescriptionOpen = false;

async function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
  );
  camera.position.set(0, 0, 8);

  const canvas = document.getElementById('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  createGalaxy();

  await createMars();

  createMiniMars();

  setupLighting();

  setupEventListeners();

  document.getElementById('loadingScreen').style.opacity = '0';
  setTimeout(() => {
    document.getElementById('loadingScreen').style.display = 'none';
  }, 500);

  animate();
}

function createGalaxy() {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 10000;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const radius = Math.random() * 2000 + 1000;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = radius * Math.cos(phi);

    const color = new THREE.Color();
    color.setHSL(Math.random() * 0.2 + 0.5, 0.3, Math.random() * 0.5 + 0.5);
    starColors[i * 3] = color.r;
    starColors[i * 3 + 1] = color.g;
    starColors[i * 3 + 2] = color.b;
  }

  starGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(starPositions, 3)
  );
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starMaterial = new THREE.PointsMaterial({
    size: 2,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
  });

  stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  const nebulaGeometry = new THREE.SphereGeometry(1500, 32, 32);
  const nebulaMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
    },
    vertexShader: `
            varying vec3 vPosition;
            void main() {
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
    fragmentShader: `
            uniform float time;
            varying vec3 vPosition;
            
            void main() {
                vec3 color1 = vec3(0.1, 0.0, 0.3);
                vec3 color2 = vec3(0.3, 0.1, 0.5);
                vec3 color3 = vec3(0.0, 0.1, 0.4);
                
                float noise = sin(vPosition.x * 0.01 + time * 0.5) * 
                             cos(vPosition.y * 0.01 + time * 0.3) * 
                             sin(vPosition.z * 0.01 + time * 0.7);
                
                vec3 finalColor = mix(color1, color2, noise * 0.5 + 0.5);
                finalColor = mix(finalColor, color3, abs(noise));
                
                gl_FragColor = vec4(finalColor, 0.3);
            }
        `,
    transparent: true,
    side: THREE.BackSide,
  });

  const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
  scene.add(nebula);
}

async function createMars() {
  marsGroup = new THREE.Group();

  const marsGeometry = new THREE.SphereGeometry(2, 128, 128);

  const textureLoader = new THREE.TextureLoader();

  const marsMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500 });
  const marsMap = textureLoader.load('../assets/mars-map.png');

  marsMaterial.map = marsMap;

  const mars = new THREE.Mesh(marsGeometry, marsMaterial);
  mars.userData = { isMars: true };
  marsGroup.add(mars);

  const atmosphereGeometry = new THREE.SphereGeometry(2.1, 64, 64);
  const atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
    },
    vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
    fragmentShader: `
            uniform float time;
            varying vec3 vNormal;
            void main() {
                float intensity = pow(0.8 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
                gl_FragColor = vec4(1.0, 0.3, 0.2, intensity * 0.3);
            }
        `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    side: THREE.BackSide,
  });

  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  marsGroup.add(atmosphere);

  scene.add(marsGroup);
}

function createMiniMars() {
  const miniMarsContainer = document.getElementById('miniMars');

  const miniScene = new THREE.Scene();
  const miniCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  miniCamera.position.set(0, 0, 3);

  const miniRenderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
  });
  miniRenderer.setSize(256, 256);
  miniRenderer.setPixelRatio(window.devicePixelRatio);
  miniMarsContainer.appendChild(miniRenderer.domElement);

  miniMarsGroup = new THREE.Group();
  const miniMarsGeometry = new THREE.SphereGeometry(1, 64, 64);

  const miniMarsMaterial = new THREE.MeshStandardMaterial({
    color: 0xffa500,
  });

  const miniMarsTexture = new THREE.TextureLoader().load(
    '../assets/minimars-map.png'
  );
  miniMarsMaterial.map = miniMarsTexture;

  const miniMars = new THREE.Mesh(miniMarsGeometry, miniMarsMaterial);
  miniMarsGroup.add(miniMars);

  const miniLight = new THREE.DirectionalLight(0xffffff, 1);
  miniLight.position.set(5, 5, 5);
  miniScene.add(miniLight);

  const miniAmbientLight = new THREE.AmbientLight(0x404040, 0.3);
  miniScene.add(miniAmbientLight);

  miniScene.add(miniMarsGroup);

  function animateMiniMars() {
    miniMarsGroup.rotation.y += 0.01;
    miniRenderer.render(miniScene, miniCamera);
    requestAnimationFrame(animateMiniMars);
  }
  animateMiniMars();
}

function setupLighting() {
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
  sunLight.position.set(10, 5, 5);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  scene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  scene.add(ambientLight);

  const marsGlow = new THREE.PointLight(0xff6347, 0.8, 100);
  marsGlow.position.set(0, 0, 0);
  scene.add(marsGlow);
}

function setupEventListeners() {
  window.addEventListener('resize', onWindowResize);

  document.addEventListener('mousemove', onMouseMove);

  document.addEventListener('wheel', onMouseWheel);

  renderer.domElement.addEventListener('dblclick', onDoubleClick);

  document
    .getElementById('closeBtn')
    .addEventListener('click', closeDescription);

  renderer.domElement.addEventListener('touchstart', onTouchStart);
  renderer.domElement.addEventListener('touchmove', onTouchMove);
  renderer.domElement.addEventListener('touchend', onTouchEnd);

  let touchCount = 0;
  let touchTimer = null;

  function onTouchStart(event) {
    touchCount++;

    if (touchCount === 1) {
      touchTimer = setTimeout(() => {
        touchCount = 0;
      }, 300);
    } else if (touchCount === 2) {
      clearTimeout(touchTimer);
      touchCount = 0;
      onDoubleClick(event);
    }
  }

  function onTouchMove(event) {
    event.preventDefault();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      mouseX = (touch.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(touch.clientY / window.innerHeight) * 2 + 1;
    }
  }

  function onTouchEnd(event) {}
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
  mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onMouseWheel(event) {
  if (!isDescriptionOpen) {
    camera.position.z += event.deltaY * 0.01;
    camera.position.z = Math.max(3, Math.min(15, camera.position.z));
  }
}

function onDoubleClick(event) {
  if (!isDescriptionOpen) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      if (intersectedObject.userData.isMars) {
        openDescription();
      }
    }
  }
}

function openDescription() {
  isDescriptionOpen = true;
  document.getElementById('descriptionPanel').classList.add('active');
  document.getElementById('closeBtn').classList.remove('hidden');
  document.getElementById('instructions').style.opacity = '0';
}

function closeDescription() {
  isDescriptionOpen = false;
  document.getElementById('descriptionPanel').classList.remove('active');
  document.getElementById('closeBtn').classList.add('hidden');
  document.getElementById('instructions').style.opacity = '1';
}

function animate() {
  requestAnimationFrame(animate);

  if (!isDescriptionOpen) {
    camera.position.x += (mouseX * 5 - camera.position.x) * 0.05;
    camera.position.y += (-mouseY * 5 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    if (marsGroup) {
      marsGroup.rotation.y += 0.002;
      marsGroup.rotation.x += 0.001;
    }
  }

  if (stars) {
    stars.rotation.y += 0.0002;
  }

  scene.traverse((object) => {
    if (
      object.material &&
      object.material.uniforms &&
      object.material.uniforms.time
    ) {
      object.material.uniforms.time.value += 0.01;
    }
  });

  renderer.render(scene, camera);
}

window.addEventListener('load', init);
