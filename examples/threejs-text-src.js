/**
 * Three.js WebGPU Text Demo (Source)
 *
 * Demonstrates canvas texture text rendering with Three.js WebGPU.
 * Uses antialias: false for compatibility with MystralNative screenshot capture.
 *
 * REQUIREMENTS:
 *   npm install three@0.182.0
 *
 * BUNDLING (required before running):
 *   npx esbuild examples/threejs-text-src.js --bundle --outfile=examples/threejs-text.js --format=esm --platform=browser
 *
 * RUN:
 *   mystral run examples/threejs-text.js
 */

import * as THREE from 'three/webgpu';

async function main() {
  console.log('[Three.js] Starting text demo...');

  // Create WebGPU renderer - antialias: false for MystralNative compatibility
  const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    antialias: false,
  });

  await renderer.init();
  console.log('[Three.js] WebGPU initialized');

  const width = canvas.width || 1280;
  const height = canvas.height || 720;
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // Create camera
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 4;

  // Create spinning cube
  const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    metalness: 0.4,
    roughness: 0.3,
  });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.y = -0.3;
  scene.add(cube);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // Create text using canvas texture
  function createTextPlane(text, fontSize = 64, color = '#ffffff') {
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 1024;
    textCanvas.height = 128;
    const ctx = textCanvas.getContext('2d');

    // Clear with transparency
    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);

    // Draw text with shadow
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shadow
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // Stroke outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.strokeText(text, textCanvas.width / 2, textCanvas.height / 2);

    // Fill
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = color;
    ctx.fillText(text, textCanvas.width / 2, textCanvas.height / 2);

    // Create Three.js texture from canvas
    const texture = new THREE.CanvasTexture(textCanvas);
    texture.needsUpdate = true;

    // Create plane with the texture
    const planeGeometry = new THREE.PlaneGeometry(8, 1);
    const planeMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(planeGeometry, planeMaterial);
  }

  // Add text planes
  const titleText = createTextPlane('Three.js on Mystral', 72, '#ffffff');
  titleText.position.set(0, 1.8, 0);
  scene.add(titleText);

  const subtitleText = createTextPlane('WebGPU Renderer', 48, '#00ff88');
  subtitleText.position.set(0, -2.2, 0);
  scene.add(subtitleText);

  console.log('[Three.js] Scene created with text planes');

  // Animation loop
  let frameCount = 0;
  function animate() {
    frameCount++;

    // Rotate cube
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.015;

    // Render
    renderer.render(scene, camera);

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
