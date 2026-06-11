import * as THREE from 'three';
import { RENDERING } from '../config/GameConfig.js';

export class Renderer {
  constructor(root, scene, camera) {
    this.root = root;
    this.scene = scene;
    this.camera = camera;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(RENDERING.clearColor, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDERING.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    root.appendChild(this.renderer.domElement);
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDERING.pixelRatioCap));
  }

  setAnimationLoop(callback) {
    this.renderer.setAnimationLoop(callback);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
