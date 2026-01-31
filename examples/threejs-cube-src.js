/**
 * Three.js WebGPU Spinning Cube Example (Source)
 *
 * This example demonstrates Three.js WebGPU renderer working with MystralNative.
 *
 * REQUIREMENTS:
 *   npm install three@0.182.0
 *
 * BUNDLING (required before running):
 *   npx esbuild examples/threejs-cube-src.js --bundle --outfile=examples/threejs-cube-bundle.js --format=esm --platform=browser
 *
 * RUN:
 *   mystral run examples/threejs-cube-bundle.js
 *
 * Tested with: three@0.182.0
 */

import * as THREE from 'three/webgpu';

// MystralNative provides the canvas element globally
// TypeScript users: declare const canvas: HTMLCanvasElement;

async function main() {
  console.log('[Three.js] Starting WebGPU renderer...');

  // Create WebGPU renderer using the global canvas
  const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    antialias: false,
  });

  // Initialize WebGPU (required for three/webgpu)
  await renderer.init();
  console.log('[Three.js] WebGPU initialized');

  // Setup renderer size
  const width = canvas.width || 1280;
  const height = canvas.height || 720;
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);

  // Create scene with dark blue background
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // Create camera
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 3;

  // Create a green cube with standard material (PBR lighting)
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    metalness: 0.3,
    roughness: 0.4,
  });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  // Add ambient light for base illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Add directional light for shadows and highlights
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  console.log('[Three.js] Scene created, starting render loop...');

  // Animation loop
  let frameCount = 0;
  function animate() {
    frameCount++;

    // Rotate cube
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    // Render the scene
    renderer.render(scene, camera);

    // Log progress every 60 frames
    if (frameCount % 60 === 0) {
      console.log(`[Three.js] Frame ${frameCount}`);
    }

    requestAnimationFrame(animate);
  }

  animate();
}

main().catch((e) => {
  console.error('[Three.js] Error:', e.message);
  console.error('[Three.js] Stack:', e.stack);
});
