import Stats from 'stats-js';
import * as dat from 'dat.gui';
import {
  PerspectiveCamera,
  WebGLRenderer,
  Scene,
  AmbientLight,
  DirectionalLight,
  BasicShadowMap,
  Vector3,
  TextureLoader,
  Mesh,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  SphereGeometry,
  Box3,
  Sphere,
  PointsMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  Vector2,
  AnimationMixer,
  ShaderMaterial,
  Raycaster,
  FrontSide,
  MathUtils,
  SpotLight,
  PointLight,
  DirectionalLightHelper,
  PointLightHelper,
} from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const stats = new Stats();
document.body.appendChild(stats.dom);

export default class App {
  constructor() {
    this._renderer = undefined;
    this._camera = undefined;
    this._controls = undefined;
    this._composer = undefined;

    this.raycaster = new Raycaster();
    this.mouse = new Vector2();
    this.santaMesh = null;
    this.santaAction = null;

    this._scene = new Scene();
    this.tempVector3 = new Vector3();

    this.nightSkyTexture = new TextureLoader().load('/sky/night2.jpeg');
    this.sunsetSkyTexture = new TextureLoader().load('/sky/sunset.jpeg');

    this.audio = new Audio('/music/music.mp3');
    this.audio.loop = false;
    this.bloomOptions = {
      strength: 0.5,
      radius: 0.4,
      threshold: 0.85,
    };

    this._init();
  }

  async _loadModel(path) {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(path, resolve);
    });
  }

  async _init() {
    this._renderer = new WebGLRenderer({
      canvas: document.getElementById('canvas'),
    });
    this._renderer.setSize(window.innerWidth, window.innerHeight);

    // Camera
    this._camera = new PerspectiveCamera(
      100,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this._camera.position.set(0, 5, 20);

    this._loadSanta();
    this._loadSnowman();

    //_______________________________________ICE TEXTURE_________________________________________
    const iceDiffuseTexture = new TextureLoader().load(
      '/texture/Blue_Ice_001_OCC.jpg'
    );
    const iceNormalMap = new TextureLoader().load(
      '/texture/Blue_Ice_001_NORM.jpg'
    );
    const iceDisplacementMap = new TextureLoader().load(
      '/texture/Blue_Ice_001_DISP.png'
    );
    const iceRoughnessMap = new TextureLoader().load(
      '/texture/Blue_Ice_001_ROUGH.jpg'
    );
    const iceAOMap = new TextureLoader().load('/texture/Blue_Ice_001_OCC.jpg');

    const iceMaterial = new MeshStandardMaterial({
      color: 0xadd8e6,
      map: iceDiffuseTexture,
      normalMap: iceNormalMap,
      displacementMap: iceDisplacementMap,
      roughnessMap: iceRoughnessMap,
      aoMap: iceAOMap,
      side: FrontSide,
    });

    iceMaterial.displacementScale = 0;
    iceMaterial.displacementBias = 0.02;
    //___________________________________________________________________________________________

    const mainSceneModel = await this._loadModel('/models/mainscene2.glb');
    const mainSceneMesh = mainSceneModel.scene;

    mainSceneMesh.traverse((child) => {
      if (child.isMesh) {
        child.material.side = FrontSide;
        mainSceneMesh.receiveShadow = true;
      }
    });

    this._scene.add(mainSceneMesh);

    this.applyIceTextureToMesh(this._scene, 'Ice_Sheet_phong2_0', iceMaterial);

    mainSceneMesh.scale.set(1.7, 1.7, 1.7);
    mainSceneMesh.position.set(0, -20, 0);
    this._scene.add(mainSceneMesh);
    this._initAnimations(mainSceneModel.animations);

    this._composer = new EffectComposer(this._renderer);
    const renderPass = new RenderPass(this._scene, this._camera);
    this._composer.addPass(renderPass);

    this._bloomPass = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      this.bloomOptions.strength,
      this.bloomOptions.radius,
      this.bloomOptions.threshold
    );

    this._composer.addPass(this._bloomPass);

    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.05;
    this._controls.screenSpacePanning = false;
    this._controls.minDistance = 1;
    this._controls.maxDistance = 100;

    this._setSky('sunset');

    this.sphereRadius = this._addGlassSphere(mainSceneMesh);
    this._addSnowParticles(this.sphereRadius);

    this._initLights();
    this._initGUI();
    this._initEvents();
    this._start();
  }

  //snowman
  async _loadSnowman() {
    const snowmanModel = await this._loadModel('/models/snowman.glb');
    this.snowmanMesh = snowmanModel.scene;
    this.snowmanMesh.castShadow = true;

    this.snowmanMesh.traverse((node) => {
      if (node.isMesh) {
        node.material.side = FrontSide;
      }
    });

    const scaleFactor = 1.5;
    this.snowmanMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

    this.snowmanMesh.position.set(25, -18, -4);
    this.snowmanMesh.rotation.y -= Math.PI / 2;

    this._scene.add(this.snowmanMesh);
  }

  // Santa
  async _loadSanta() {
    const santaModel = await this._loadModel('/models/santa.glb');
    this.santaMesh = santaModel.scene;

    this.santaMesh.traverse((node) => {
      if (node.isMesh) {
        node.material.side = FrontSide;
      }
    });

    const scaleFactor = 0.07;
    this.santaMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

    this.santaMesh.position.set(0, -20, 5);
    this.santaMesh.rotation.y -= Math.PI / 3;

    this._scene.add(this.santaMesh);

    if (santaModel.animations && santaModel.animations.length > 0) {
      this.santaMixer = new AnimationMixer(this.santaMesh);
      this.santaAction = this.santaMixer.clipAction(santaModel.animations[0]);
    }
  }

  applyIceTextureToMesh(parent, meshName, material) {
    parent.traverse((child) => {
      if (child.isMesh && child.name === meshName) {
        child.material = material;
      }
    });
  }

  _initAnimations(animations) {
    if (animations && animations.length > 0) {
      this.mixer = new AnimationMixer(this._scene);

      animations.forEach((clip) => {
        this.mixer.clipAction(clip).play();
      });
    }
  }
  //_______________________________________GLASS SPHERE_____________________________________________
  _addGlassSphere(centerObject, customScale = 0.7) {
    const boundingBox = new Box3().setFromObject(centerObject);
    const sphereRadius =
      boundingBox.getBoundingSphere(new Sphere()).radius * customScale;
    const sphereGeometry = new SphereGeometry(sphereRadius, 80, 80);
    const glassMaterial = new MeshPhysicalMaterial({
      roughness: 0,
      transmission: 1,
      thickness: 0.1, // This will add refraction!
      side: FrontSide,
    });

    const glassSphere = new Mesh(sphereGeometry, glassMaterial);
    this._scene.add(glassSphere);

    return sphereRadius;
  }
  //_______________________________________LIGHTS___________________________________________________
  _initLights() {
    // Ambient Light
    const ambientLight = new AmbientLight(0x404040, 15.0);
    this._scene.add(ambientLight);

    // Directional Light
    const directionalLight = this._createDirectionalLight();
    this._scene.add(directionalLight);

    //   // Add DirectionalLightHelper
    //   const directionalLightHelper = new DirectionalLightHelper(
    //     directionalLight,
    //     5
    //   );
    //   this._scene.add(directionalLightHelper);
  }

  _createDirectionalLight() {
    const light = new DirectionalLight(0xffffff, 1);
    light.position.set(2, 60, 10);
    light.castShadow = true;
    light.receiveShadow = true;

    this._scene.add(light);

    light.shadow.mapSize.width = 256;
    light.shadow.mapSize.height = 256;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 100;
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;
    light.shadow.camera.top = 10;
    light.shadow.camera.bottom = -10;

    light.shadow.bias = 0.001;

    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = BasicShadowMap;

    return light;
  }

  //_______________________________________SNOW______________________________________________________
  _addSnowParticles(sphereRadius) {
    const snowParticlesCount = 10000;
    const snowVertices = [];
    this.velocities = [];
    const TWO_PI = 2 * Math.PI;
    const HALF_SPHERE_RADIUS = sphereRadius / 2;

    for (let i = 0; i < snowParticlesCount; i++) {
      const theta = TWO_PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * sphereRadius;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      if (y > -HALF_SPHERE_RADIUS && y < HALF_SPHERE_RADIUS) {
        snowVertices.push(x, y, z);
        this.velocities.push((Math.random() - 0.5) * 0.05);
      }
    }
    const snowColors = new Array(snowParticlesCount * 3).fill(1);

    const snowGeometry = new BufferGeometry();
    snowGeometry.setAttribute(
      'position',
      new Float32BufferAttribute(snowVertices, 3)
    );
    snowGeometry.setAttribute(
      'color',
      new Float32BufferAttribute(snowColors, 3)
    );

    const snowMaterial = new PointsMaterial({
      color: 0xffffff,
      size: 0.03,
      vertexColors: true,
    });

    this.snowParticles = new Points(snowGeometry, snowMaterial);
    this._scene.add(this.snowParticles);
  }

  _updateSnowParticles() {
    const positions = this.snowParticles.geometry.attributes.position.array;
    const origin = new Vector3();
    const tempVector = new Vector3();
    const TWO_PI = 2 * Math.PI;
    const HALF_SPHERE_RADIUS = this.sphereRadius / 2;

    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] -= this.velocities[i / 3];
      tempVector.set(positions[i], positions[i + 1], positions[i + 2]);
      const distanceFromCenter = origin.distanceTo(tempVector);

      if (
        distanceFromCenter >= this.sphereRadius ||
        positions[i + 1] < -HALF_SPHERE_RADIUS
      ) {
        const theta = TWO_PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.random() * this.sphereRadius;

        positions[i] = r * Math.sin(phi) * Math.cos(theta);
        positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i + 2] = r * Math.cos(phi);
      }
    }

    this.snowParticles.geometry.attributes.position.needsUpdate = true;
  }

  //_______________________________________GUI______________________________________________________
  _initGUI() {
    this.gui = new dat.GUI();
    const skyFolder = this.gui.addFolder('Sky');
    skyFolder.open();
    const skyConfig = { sky: 'sunset' }; // default value

    skyFolder
      .add(skyConfig, 'sky', ['sunset', 'night'])
      .name('Sky Type')
      .onChange((value) => {
        this._setSky(value);
      });

    const bloomFolder = this.gui.addFolder('Bloom Effect');
    bloomFolder.open();
    bloomFolder
      .add(this.bloomOptions, 'strength', 0, 3)
      .onChange((value) => (this._bloomPass.strength = value));
    bloomFolder
      .add(this.bloomOptions, 'radius', 0, 1)
      .onChange((value) => (this._bloomPass.radius = value));
    bloomFolder
      .add(this.bloomOptions, 'threshold', 0, 1)
      .onChange((value) => (this._bloomPass.threshold = value));
  }
  _setSky(skyType) {
    switch (skyType) {
      case 'sunset':
        this._scene.background = this.sunsetSkyTexture;
        break;
      case 'night':
        this._scene.background = this.nightSkyTexture;
        break;
    }
  }
  //_____________________________________________________________________________________________

  _start() {
    this._animate();
  }

  _onResize() {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      const aspect = window.innerWidth / window.innerHeight;
      this._camera.aspect = aspect;
      this._camera.updateProjectionMatrix();
      this._renderer.setSize(window.innerWidth, window.innerHeight);
    }, 100);
  }

  _initEvents() {
    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
    window.addEventListener('resize', this._onResize.bind(this));

    // Detect if the device is a phone (or touch device)
    const isPhone = 'ontouchstart' in window;

    if (isPhone) {
      this._renderer.domElement.addEventListener(
        'touchstart',
        this._onSantaClick.bind(this)
      );
    } else {
      this._renderer.domElement.addEventListener(
        'click',
        this._onSantaClick.bind(this)
      );
    }
  }

  //___________________________________________Santa Anim_______________________________________
  //change snow to colorful
  _changeSnowColors() {
    const colors = this.snowParticles.geometry.attributes.color.array;

    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = Math.random();
      colors[i + 1] = Math.random();
      colors[i + 2] = Math.random();
    }

    this.snowParticles.geometry.attributes.color.needsUpdate = true;
  }

  //change strengt evry sec
  _setPartyMode() {
    if (this.bloomAnimationInterval) {
      clearInterval(this.bloomAnimationInterval);
      this.bloomAnimationInterval = null;
    } else {
      this.bloomAnimationInterval = setInterval(() => {
        this.bloomOptions.strength = (this.bloomOptions.strength + 3) % 4;
        this._bloomPass.strength = this.bloomOptions.strength;
      }, 100);
    }
  }

  _onSantaClick(event) {
    event.preventDefault();

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this._camera);

    // Santa was clicked
    const intersects = this.raycaster.intersectObject(this.santaMesh, true);

    if (intersects.length > 0) {
      if (this.santaAction) {
        this.santaAction.play();
        this.audio.play();
        this._changeSnowColors();
        this._setPartyMode();
        this._setSky('night');

        this._camera.position.set(-20, -18, 0);
      }
    }
  }
  //______________________________________________________________________________________________
  _animate() {
    this._updateSnowParticles();

    stats.begin();
    this._controls.update();
    this._composer.render();

    if (this.mixer) {
      this.mixer.update(0.01);
    }

    if (this.santaMixer) {
      this.santaMixer.update(0.01);
    }

    stats.end();

    window.requestAnimationFrame(this._animate.bind(this));
  }
}

const app = new App();
