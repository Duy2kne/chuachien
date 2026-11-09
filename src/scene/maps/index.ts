// Tạo thế giới 3D theo bản đồ của phòng
import * as THREE from 'three';
import { TempleWorld } from '../templeWorld.js';
import type { MapId } from '../../shared/maps.js';
import { buildPagodaMap } from './pagodaMap.js';
import { buildHellMap } from './hellMap.js';
import { buildZenMap } from './zenMap.js';

const BUILDERS: Partial<Record<MapId, (w: TempleWorld) => void>> = {
  pagoda: buildPagodaMap,
  hell: buildHellMap,
  zen: buildZenMap
};

export function createWorld(scene: THREE.Scene, mapId: MapId = 'main') {
  return new TempleWorld(scene, mapId, BUILDERS[mapId]);
}
