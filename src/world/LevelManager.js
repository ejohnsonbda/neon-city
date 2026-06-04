import * as THREE from 'three';
import { LEVELS } from '../config/GameConfig.js';
import { GeometryFactory } from '../utils/GeometryFactory.js';
import { createNeonCityLevel } from './levels/NeonCityLevel.js';
import { createJapanLevel } from './levels/JapanLevel.js';
import { createLostJungleLevel } from './levels/LostJungleLevel.js';
import { createUndergroundLevel } from './levels/UndergroundLevel.js';

const LEVEL_BUILDERS = {
  'neon-city': createNeonCityLevel,
  japan: createJapanLevel,
  'lost-jungle': createLostJungleLevel,
  underground: createUndergroundLevel
};

export class LevelManager {
  constructor(scene, physicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.current = null;
    this.factory = new GeometryFactory(physicsWorld);
  }

  load(id) {
    if (this.current?.group) this.scene.remove(this.current.group);
    this.physicsWorld.clear(this.scene);
    const builder = LEVEL_BUILDERS[id] || LEVEL_BUILDERS['neon-city'];
    this.current = { id, label: LEVELS[id]?.label || 'Neon City', ...builder({ factory: this.factory, THREE }) };
    this.scene.add(this.current.group);
    this.scene.fog = this.current.fog;
    this.scene.background = new THREE.Color(this.current.background);
    return this.current;
  }
}
