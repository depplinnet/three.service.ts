import { Injectable } from '@angular/core';
import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Injectable({
  providedIn: 'root'  
})
export class ThreeService {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  
  constructor() {
    this.scene = new THREE.Scene();
    // Por defecto creamos una cámara y un renderer, pero se pueden configurar después
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer();
  }

  initRenderer(canvas: HTMLCanvasElement, width: number, height: number): void {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Configurar cámara
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 5;
    
    // Añadir controles OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
  }

  createBasicScene(): void {
    // Añadir luz
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
    
    // Añadir un cubo
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    this.scene.add(cube);
    
    // Animación del cubo
    const animate = () => {
      requestAnimationFrame(animate);
      
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    
    animate();
  }

  onWindowResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // Método para añadir objetos a la escena
  addObject(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  // Método para crear un objeto
  createCube(size: number = 1, color: number = 0xff0000): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({ color });
    return new THREE.Mesh(geometry, material);
  }

  createSphere(radius: number = 1, color: number = 0x0000ff): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color });
    return new THREE.Mesh(geometry, material);
  }
}
