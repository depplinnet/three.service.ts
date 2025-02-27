import { Injectable, NgZone } from '@angular/core';
import * as THREE from 'three';

// Controles
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { FlyControls } from 'three/examples/jsm/controls/FlyControls';

// Loaders
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

// Post-procesamiento
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader';

// Físicas
// Nota: Deberás instalar cannon-es con: npm install cannon-es
// import * as CANNON from 'cannon-es';

// Interfaces para tipado
interface SceneObject {
  id: string;
  object: THREE.Object3D;
  update?: (delta: number) => void;
}

interface AudioSource {
  id: string;
  audio: THREE.Audio | THREE.PositionalAudio;
}

type ControlType = 'orbit' | 'firstPerson' | 'pointerLock' | 'trackball' | 'fly';

@Injectable({
  providedIn: 'root'
})
export class ThreeService {
  // Core Three.js objects
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  clock: THREE.Clock;
  raycaster: THREE.Raycaster;
  
  // Controles
  currentControl: any;
  controlType: ControlType = 'orbit';
  
  // Post-procesamiento
  composer: EffectComposer;
  
  // Audio
  listener: THREE.AudioListener;
  audioLoader: THREE.AudioLoader;
  audioSources: Map<string, AudioSource> = new Map();
  
  // Gestión de objetos
  objects: Map<string, SceneObject> = new Map();
  
  // Loaders
  textureLoader: THREE.TextureLoader;
  gltfLoader: GLTFLoader;
  fbxLoader: FBXLoader;
  objLoader: OBJLoader;
  
  // Física
  // world: CANNON.World;
  // physicsBodies: Map<string, CANNON.Body> = new Map();
  
  // Gestión de recursos
  loadingManager: THREE.LoadingManager;
  
  // Event handling
  private mousePosition: THREE.Vector2 = new THREE.Vector2();
  private keyStates: Map<string, boolean> = new Map();
  
  // Animation mixers
  private mixers: THREE.AnimationMixer[] = [];
  
  // Otros
  stats: any; // Para las estadísticas de rendimiento

  constructor(private ngZone: NgZone) {
    // Inicializar objetos básicos
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    
    // Inicializar loadingManager
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onProgress = (url, loaded, total) => {
      console.log(`Cargando: ${Math.round((loaded / total) * 100)}% (${url})`);
    };
    
    // Inicializar loaders
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);
    this.gltfLoader = new GLTFLoader(this.loadingManager);
    this.fbxLoader = new FBXLoader(this.loadingManager);
    this.objLoader = new OBJLoader(this.loadingManager);
    
    // Configurar DracoLoader para comprimir modelos
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('assets/draco/');
    this.gltfLoader.setDRACOLoader(dracoLoader);
    
    // Audio
    this.listener = new THREE.AudioListener();
    this.audioLoader = new THREE.AudioLoader(this.loadingManager);
    
    // Configurar eventos
    this.setupEvents();
  }

  //================================================
  // CONFIGURACIÓN INICIAL
  //================================================
  
  /**
   * Inicializa el WebGL renderer
   */
  initRenderer(canvas: HTMLCanvasElement, width: number, height: number, options: THREE.WebGLRendererParameters = {}): void {
    const defaultOptions: THREE.WebGLRendererParameters = {
      canvas,
      antialias: true,
      alpha: true,
      ...options
    };
    
    this.renderer = new THREE.WebGLRenderer(defaultOptions);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limitar para rendimiento
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    
    // Configurar cámara
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 2, 5);
    this.camera.lookAt(0, 0, 0);
    
    // Añadir listener de audio a la cámara
    this.camera.add(this.listener);
    
    // Configurar post-procesamiento básico
    this.setupPostProcessing();
  }
  
  /**
   * Configura los controles de la cámara
   */
  setupControls(type: ControlType = 'orbit'): void {
    this.controlType = type;
    
    // Limpiar controles anteriores si existen
    if (this.currentControl) {
      if (typeof this.currentControl.dispose === 'function') {
        this.currentControl.dispose();
      }
      this.currentControl = null;
    }
    
    switch (type) {
      case 'orbit':
        this.currentControl = new OrbitControls(this.camera, this.renderer.domElement);
        (this.currentControl as OrbitControls).enableDamping = true;
        (this.currentControl as OrbitControls).dampingFactor = 0.05;
        break;
        
      case 'firstPerson':
        this.currentControl = new FirstPersonControls(this.camera, this.renderer.domElement);
        (this.currentControl as FirstPersonControls).lookSpeed = 0.1;
        (this.currentControl as FirstPersonControls).movementSpeed = 10;
        break;
        
      case 'pointerLock':
        this.currentControl = new PointerLockControls(this.camera, this.renderer.domElement);
        break;
        
      case 'trackball':
        this.currentControl = new TrackballControls(this.camera, this.renderer.domElement);
        break;
        
      case 'fly':
        this.currentControl = new FlyControls(this.camera, this.renderer.domElement);
        (this.currentControl as FlyControls).movementSpeed = 10;
        (this.currentControl as FlyControls).rollSpeed = 0.1;
        break;
    }
  }
  
  /**
   * Configura la post-procesamiento para efectos visuales
   */
  setupPostProcessing(): void {
    // Crear el composer
    this.composer = new EffectComposer(this.renderer);
    
    // Añadir pase de renderizado
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    
    // Añadir FXAA para anti-aliasing
    const fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = this.renderer.getPixelRatio();
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
    this.composer.addPass(fxaaPass);
    
    // Añadir corrección gamma
    const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader);
    this.composer.addPass(gammaCorrectionPass);
  }
  
  /**
   * Configura un entorno básico con luces, suelo y objetos simples
   */
  createBasicScene(): void {
    // Color de fondo
    this.scene.background = new THREE.Color(0x87ceeb);
    
    // Niebla para efectos de distancia
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.01);
    
    // Añadir luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    this.scene.add(directionalLight);
    
    // Añadir hemisferio light para simular rebote
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    this.scene.add(hemisphereLight);
    
    // Suelo
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x999999, 
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.objects.set('ground', { id: 'ground', object: ground });
    
    // Añadir grid helper
    const gridHelper = new THREE.GridHelper(100, 100);
    this.scene.add(gridHelper);
    
    // Añadir eje de coordenadas
    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);
    
    // Cubo para ejemplo
    const cube = this.createCube(1, 0x00ff00);
    cube.position.set(0, 0.5, 0);
    cube.castShadow = true;
    this.scene.add(cube);
    this.objects.set('cube', { 
      id: 'cube', 
      object: cube,
      update: (delta: number) => {
        cube.rotation.x += 0.5 * delta;
        cube.rotation.y += 0.2 * delta;
      }
    });
    
    // Configurar HDRI para iluminación ambiental (opcional)
    this.loadHDRI('assets/hdri/sunset.hdr');
  }
  
  /**
   * Iniciar el bucle de renderizado
   */
  startRenderLoop(): void {
    // Usar NgZone para que el bucle se ejecute fuera de la zona de detección de Angular
    this.ngZone.runOutsideAngular(() => {
      this.clock.start();
      this.animate();
    });
  }
  
  /**
   * Función de animación principal
   */
  private animate(): void {
    requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    
    // Actualizar controles
    if (this.currentControl) {
      if (this.controlType === 'orbit' || this.controlType === 'trackball') {
        this.currentControl.update();
      } else if (this.controlType !== 'pointerLock') {
        this.currentControl.update(delta);
      }
    }
    
    // Actualizar animaciones
    this.mixers.forEach(mixer => mixer.update(delta));
    
    // Actualizar objetos con función update
    this.objects.forEach(obj => {
      if (obj.update) {
        obj.update(delta);
      }
    });
    
    // Actualizar físicas
    // if (this.world) {
    //   this.world.step(1/60, delta, 3);
    //   // Actualizar posiciones de objetos físicos
    //   this.updatePhysics();
    // }
    
    // Renderizar la escena
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    
    // Actualizar stats si existen
    if (this.stats) {
      this.stats.update();
    }
  }
  
  /**
   * Manejar cambio de tamaño de ventana
   */
  onWindowResize(width: number, height: number): void {
    // Actualizar cámara
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    // Actualizar renderer
    this.renderer.setSize(width, height);
    
    // Actualizar composer
    if (this.composer) {
      this.composer.setSize(width, height);
      
      // Actualizar pases de shader que dependen de la resolución
      this.composer.passes.forEach(pass => {
        if (pass instanceof ShaderPass && pass.material.uniforms['resolution']) {
          const pixelRatio = this.renderer.getPixelRatio();
          pass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
          pass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio);
        }
      });
    }
    
    // Actualizar controles específicos que necesitan saber el tamaño
    if (this.controlType === 'firstPerson') {
      (this.currentControl as FirstPersonControls).handleResize();
    }
  }
  
  //================================================
  // GESTIÓN DE ESCENA Y OBJETOS
  //================================================
  
  /**
   * Añadir objeto a la escena con id para seguimiento
   */
  addObject(id: string, object: THREE.Object3D, updateFn?: (delta: number) => void): void {
    this.scene.add(object);
    this.objects.set(id, { id, object, update: updateFn });
  }
  
  /**
   * Eliminar objeto de la escena por id
   */
  removeObject(id: string): void {
    const sceneObj = this.objects.get(id);
    if (sceneObj) {
      this.scene.remove(sceneObj.object);
      this.objects.delete(id);
      
      // Si el objeto tiene geometría y material, liberarlos
      if (sceneObj.object instanceof THREE.Mesh) {
        const mesh = sceneObj.object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => mat.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    }
  }
  
  /**
   * Obtener objeto por id
   */
  getObject(id: string): THREE.Object3D | undefined {
    return this.objects.get(id)?.object;
  }
  
  /**
   * Crear un cubo
   */
  createCube(size: number = 1, color: number = 0xff0000, options: any = {}): THREE.Mesh {
    const { wireframe = false, metalness = 0.3, roughness = 0.4 } = options;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({ 
      color, 
      wireframe,
      metalness,
      roughness
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  
  /**
   * Crear una esfera
   */
  createSphere(radius: number = 1, color: number = 0x0000ff, options: any = {}): THREE.Mesh {
    const { wireframe = false, segments = 32, metalness = 0.3, roughness = 0.4 } = options;
    const geometry = new THREE.SphereGeometry(radius, segments, segments);
    const material = new THREE.MeshStandardMaterial({ 
      color, 
      wireframe,
      metalness,
      roughness
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  
  /**
   * Crear un cilindro
   */
  createCylinder(radiusTop: number = 1, radiusBottom: number = 1, height: number = 2, color: number = 0xffff00): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32);
    const material = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  
  /**
   * Crear un plano
   */
  createPlane(width: number = 10, height: number = 10, color: number = 0xffffff): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }
  
  /**
   * Crear un torus (dona)
   */
  createTorus(radius: number = 1, tubeRadius: number = 0.4, color: number = 0xff00ff): THREE.Mesh {
    const geometry = new THREE.TorusGeometry(radius, tubeRadius, 16, 100);
    const material = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  
  /**
   * Crear un texto 3D (requiere cargar fuente)
   */
  createText3D(text: string, options: any = {}): Promise<THREE.Mesh> {
    return new Promise((resolve, reject) => {
      const { 
        font = 'assets/fonts/helvetiker_regular.typeface.json',
        size = 0.5, 
        height = 0.2, 
        curveSegments = 4,
        bevelEnabled = false,
        color = 0xffffff
      } = options;
      
      const loader = new THREE.FontLoader();
      loader.load(font, (loadedFont) => {
        const geometry = new THREE.TextGeometry(text, {
          font: loadedFont,
          size,
          height,
          curveSegments,
          bevelEnabled
        });
        
        const material = new THREE.MeshStandardMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        
        // Centrar el texto
        geometry.computeBoundingBox();
        const textWidth = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
        mesh.position.x = -textWidth / 2;
        
        mesh.castShadow = true;
        
        resolve(mesh);
      }, undefined, reject);
    });
  }
  
  //================================================
  // CARGA DE MODELOS Y RECURSOS
  //================================================
  
  /**
   * Cargar modelo GLTF
   */
  loadGLTF(path: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          
          // Permitir sombras en todo el modelo
          model.traverse((node) => {
            if (node instanceof THREE.Mesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          
          resolve(model);
        },
        (xhr) => {
          console.log(`${path}: ${(xhr.loaded / xhr.total) * 100}% loaded`);
        },
        (error) => {
          console.error('Error loading GLTF model:', error);
          reject(error);
        }
      );
    });
  }
  
  /**
   * Cargar modelo FBX
   */
  loadFBX(path: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        path,
        (object) => {
          // Permitir sombras en todo el modelo
          object.traverse((node) => {
            if (node instanceof THREE.Mesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          
          resolve(object);
        },
        (xhr) => {
          console.log(`${path}: ${(xhr.loaded / xhr.total) * 100}% loaded`);
        },
        (error) => {
          console.error('Error loading FBX model:', error);
          reject(error);
        }
      );
    });
  }
  
  /**
   * Cargar textura
   */
  loadTexture(path: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        (error) => {
          console.error('Error loading texture:', error);
          reject(error);
        }
      );
    });
  }
  
  /**
   * Cargar mapa HDRI para iluminación
   */
  loadHDRI(path: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const rgbeLoader = new RGBELoader();
      rgbeLoader.load(
        path,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          
          // Aplicar el entorno a la escena
          this.scene.environment = texture;
          
          // Si se desea aplicar como fondo también
          // this.scene.background = texture;
          
          resolve(texture);
        },
        undefined,
        (error) => {
          console.error('Error loading HDRI:', error);
          reject(error);
        }
      );
    });
  }
  
  //================================================
  // ANIMACIONES
  //================================================
  
  /**
   * Crear un mezclador para animaciones
   */
  createAnimationMixer(model: THREE.Object3D): THREE.AnimationMixer {
    const mixer = new THREE.AnimationMixer(model);
    this.mixers.push(mixer);
    return mixer;
  }
  
  /**
   * Obtener animación de un modelo GLTF
   */
  async playGLTFAnimation(path: string, animationIndex: number = 0): Promise<THREE.AnimationAction> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          this.scene.add(model);
          
          const mixer = this.createAnimationMixer(model);
          const animations = gltf.animations;
          
          if (animations && animations.length > 0) {
            const animation = animations[animationIndex];
            const action = mixer.clipAction(animation);
            action.play();
            resolve(action);
          } else {
            reject(new Error('No animations found in model'));
          }
        },
        undefined,
        reject
      );
    });
  }
  
  //================================================
  // INTERACCIÓN
  //================================================
  
  /**
   * Configurar eventos del mouse y teclado
   */
  private setupEvents(): void {
    // Eventos de mouse
    document.addEventListener('mousemove', (event) => {
      this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mousePosition.y = - (event.clientY / window.innerHeight) * 2 + 1;
    });
    
    // Eventos de teclado
    document.addEventListener('keydown', (event) => {
      this.keyStates.set(event.code, true);
    });
    
    document.addEventListener('keyup', (event) => {
      this.keyStates.set(event.code, false);
    });
  }
  
  /**
   * Verificar si una tecla está presionada
   */
  isKeyPressed(code: string): boolean {
    return this.keyStates.get(code) === true;
  }
  
  /**
   * Realizar raycasting para selección de objetos
   */
  raycast(objects: THREE.Object3D[] = []): THREE.Intersection[] {
    this.raycaster.setFromCamera(this.mousePosition, this.camera);
    
    // Si no se proporcionan objetos, usar todos los objetos de la escena
    const targets = objects.length > 0 ? objects : this.scene.children;
    
    return this.raycaster.intersectObjects(targets, true);
  }
  
  //================================================
  // AUDIO
  //================================================
  
  /**
   * Cargar y reproducir audio global
   */
  playAudio(id: string, path: string, options: any = {}): Promise<THREE.Audio> {
    return new Promise((resolve, reject) => {
      const { volume = 1, loop = false, autoplay = true } = options;
      
      // Verificar si el audio ya existe
      const existingAudio = this.audioSources.get(id);
      if (existingAudio) {
        const audio = existingAudio.audio as THREE.Audio;
        if (autoplay) {
          audio.play();
        }
        resolve(audio);
        return;
      }
      
      // Crear nuevo audio
      const audio = new THREE.Audio(this.listener);
      
      this.audioLoader.load(
        path,
        (buffer) => {
          audio.setBuffer(buffer);
          audio.setVolume(volume);
          audio.setLoop(loop);
          
          this.audioSources.set(id, { id, audio });
          
          if (autoplay) {
            audio.play();
          }
          
          resolve(audio);
        },
        undefined,
        (error) => {
          console.error('Error loading audio:', error);
          reject(error);
        }
      );
    });
  }
  
  /**
   * Crear audio posicional 3D
   */
  playPositionalAudio(id: string, path: string, position: THREE.Vector3, options: any = {}): Promise<THREE.PositionalAudio> {
    return new Promise((resolve, reject) => {
      const { 
        volume = 1, 
        loop = false, 
        autoplay = true,
        refDistance = 1,
        maxDistance = 100
      } = options;
      
      // Verificar si el audio ya existe
      const existingAudio = this.audioSources.get(id);
      if (existingAudio) {
        const audio = existingAudio.audio as THREE.PositionalAudio;
        // Actualizar posición
        audio.position.copy(position);
        if (autoplay) {
          audio.play();
        }
        resolve(audio);
        return;
      }
      
      // Crear nuevo audio posicional
      const audio = new THREE.PositionalAudio(this.listener);
      audio.position.copy(position);
      
      this.audioLoader.load(
        path,
        (buffer) => {
          audio.setBuffer(buffer);
          audio.setVolume(volume);
          audio.setLoop(loop);
          audio.setRefDistance(refDistance);
          audio.setMaxDistance(maxDistance);
          
          // Añadir a la escena
          this.scene.add(audio);
          
          this.audioSources.set(id, { id, audio });
          
          if (autoplay) {
            audio.play();
          }
          
          resolve(audio);
        },
        undefined,
        (error) => {
          console.error('Error loading positional audio:', error);
          reject(error);
        }
      );
    });
  }
