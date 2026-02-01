/**
 * Ray Tracing with Atmospheric Scattering
 *
 * Demonstrates hardware ray tracing combined with procedural atmosphere
 * rendering using physical scattering models (Rayleigh + Mie).
 *
 * Features:
 *   - Real-time ray-traced shadows
 *   - Procedural atmospheric scattering (sky gradient)
 *   - Day/night cycle with sun and stars
 *   - Ground plane with horizon fog blending
 *   - Interactive sun position control
 *
 * The atmosphere is rendered using compute shaders that simulate:
 *   - Rayleigh scattering (blue sky during day)
 *   - Mie scattering (sun glow/haze)
 *   - Absorption (warm colors at sunset)
 *
 * Requirements:
 *   - GPU with hardware RT support (or software fallback)
 *   - MystralNative built with MYSTRAL_USE_RAYTRACING=ON
 *
 * Usage:
 *   ./mystral run examples/rt-atmosphere.js
 *
 * Controls:
 *   Arrow keys   - Adjust sun azimuth/elevation
 *   Space        - Pause/resume sun animation
 *   T            - Toggle RT shadows
 *   N            - Toggle night mode (fast forward to night)
 *   R            - Reset camera position
 */

// ============================================================================
// Configuration
// ============================================================================

const width = 1280;
const height = 720;

// Sun state
let sunAzimuth = 90;      // degrees (0 = north, 90 = east)
let sunElevation = 45;    // degrees (0 = horizon, 90 = zenith)
let sunAnimating = true;
let sunSpeed = 5;         // degrees per second

// Camera state
let cameraDistance = 15;
let cameraAzimuth = 30;
let cameraElevation = 20;
let cameraTarget = [0, 0.5, 0];

// RT state
let rtEnabled = true;

// Check RT support
console.log('');
console.log('=== Ray Tracing + Atmosphere Demo ===');
console.log('');
console.log('Ray Tracing Backend:', mystralRT.getBackend());
console.log('Ray Tracing Supported:', mystralRT.isSupported());

if (!mystralRT.isSupported()) {
    console.log('');
    console.log('Hardware ray tracing not available.');
    console.log('This example requires:');
    console.log('  - macOS: Apple Silicon (M1/M2/M3) with macOS 13+');
    console.log('  - Linux/Windows: GPU with Vulkan RT support');
    if (typeof process !== 'undefined') {
        process.exit(0);
    }
}

// ============================================================================
// Math Utilities
// ============================================================================

function normalize(v) {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
}

function subtract(a, b) {
    return [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
}

function cross(a, b) {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0],
    ];
}

function dot(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function lookAt(eye, target, up) {
    const zAxis = normalize(subtract(eye, target));
    const xAxis = normalize(cross(up, zAxis));
    const yAxis = cross(zAxis, xAxis);

    return new Float32Array([
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
    ]);
}

function invertMatrix(m) {
    const inv = new Float32Array(16);
    inv[0] = m[0]; inv[1] = m[4]; inv[2] = m[8]; inv[3] = 0;
    inv[4] = m[1]; inv[5] = m[5]; inv[6] = m[9]; inv[7] = 0;
    inv[8] = m[2]; inv[9] = m[6]; inv[10] = m[10]; inv[11] = 0;
    inv[12] = -(m[0]*m[12] + m[1]*m[13] + m[2]*m[14]);
    inv[13] = -(m[4]*m[12] + m[5]*m[13] + m[6]*m[14]);
    inv[14] = -(m[8]*m[12] + m[9]*m[13] + m[10]*m[14]);
    inv[15] = 1;
    return inv;
}

function perspectiveProjectionInverse(fovY, aspect, near, far) {
    const tanHalfFovy = Math.tan(fovY / 2);
    return new Float32Array([
        tanHalfFovy * aspect, 0, 0, 0,
        0, tanHalfFovy, 0, 0,
        0, 0, 0, (near - far) / (2 * far * near),
        0, 0, -1, (near + far) / (2 * far * near),
    ]);
}

function getSunDirection() {
    const azRad = (sunAzimuth * Math.PI) / 180;
    const elRad = (sunElevation * Math.PI) / 180;
    return [
        Math.cos(elRad) * Math.sin(azRad),
        Math.sin(elRad),
        Math.cos(elRad) * Math.cos(azRad),
    ];
}

function getCameraPosition() {
    const azRad = (cameraAzimuth * Math.PI) / 180;
    const elRad = (cameraElevation * Math.PI) / 180;
    return [
        cameraTarget[0] + cameraDistance * Math.cos(elRad) * Math.sin(azRad),
        cameraTarget[1] + cameraDistance * Math.sin(elRad),
        cameraTarget[2] + cameraDistance * Math.cos(elRad) * Math.cos(azRad),
    ];
}

// ============================================================================
// Scene Geometry
// ============================================================================

// Ground plane (large, with grid-like texture through normals)
function createGroundGeometry() {
    const size = 50;
    const vertices = new Float32Array([
        -size, 0, -size,
         size, 0, -size,
         size, 0,  size,
        -size, 0,  size,
    ]);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
    return { vertices, indices };
}

// Sphere (for testing shadows)
function createSphereGeometry(radius, segments, rings) {
    const vertices = [];
    const indices = [];

    for (let r = 0; r <= rings; r++) {
        const phi = (r / rings) * Math.PI;
        for (let s = 0; s <= segments; s++) {
            const theta = (s / segments) * Math.PI * 2;
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.cos(phi);
            const z = radius * Math.sin(phi) * Math.sin(theta);
            vertices.push(x, y, z);
        }
    }

    for (let r = 0; r < rings; r++) {
        for (let s = 0; s < segments; s++) {
            const i0 = r * (segments + 1) + s;
            const i1 = i0 + 1;
            const i2 = i0 + segments + 1;
            const i3 = i2 + 1;
            indices.push(i0, i2, i1);
            indices.push(i1, i2, i3);
        }
    }

    return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

// Box geometry
function createBoxGeometry(w, h, d) {
    const hw = w/2, hh = h/2, hd = d/2;
    const vertices = new Float32Array([
        // Front
        -hw, -hh,  hd,  hw, -hh,  hd,  hw,  hh,  hd, -hw,  hh,  hd,
        // Back
        -hw, -hh, -hd, -hw,  hh, -hd,  hw,  hh, -hd,  hw, -hh, -hd,
        // Top
        -hw,  hh, -hd, -hw,  hh,  hd,  hw,  hh,  hd,  hw,  hh, -hd,
        // Bottom
        -hw, -hh, -hd,  hw, -hh, -hd,  hw, -hh,  hd, -hw, -hh,  hd,
        // Left
        -hw, -hh, -hd, -hw, -hh,  hd, -hw,  hh,  hd, -hw,  hh, -hd,
        // Right
         hw, -hh, -hd,  hw,  hh, -hd,  hw,  hh,  hd,  hw, -hh,  hd,
    ]);
    const indices = new Uint32Array([
        0,1,2, 0,2,3,     // front
        4,5,6, 4,6,7,     // back
        8,9,10, 8,10,11,  // top
        12,13,14, 12,14,15, // bottom
        16,17,18, 16,18,19, // left
        20,21,22, 20,22,23, // right
    ]);
    return { vertices, indices };
}

// Create scene geometry
console.log('Creating scene geometry...');

const ground = createGroundGeometry();
const sphere = createSphereGeometry(1.0, 24, 16);
const box1 = createBoxGeometry(1.5, 2.0, 1.5);
const box2 = createBoxGeometry(0.8, 0.8, 0.8);
const pillar = createBoxGeometry(0.6, 4.0, 0.6);

// Transform sphere up
for (let i = 1; i < sphere.vertices.length; i += 3) {
    sphere.vertices[i] += 1.0; // Move up by 1
}

// Transform box1
for (let i = 0; i < box1.vertices.length; i += 3) {
    box1.vertices[i] -= 3;     // Move left
    box1.vertices[i+1] += 1.0; // Move up
}

// Transform box2
for (let i = 0; i < box2.vertices.length; i += 3) {
    box2.vertices[i] += 2.5;   // Move right
    box2.vertices[i+1] += 0.4; // Move up
    box2.vertices[i+2] += 2;   // Move forward
}

// Transform pillar
for (let i = 0; i < pillar.vertices.length; i += 3) {
    pillar.vertices[i] += 4;   // Move right
    pillar.vertices[i+1] += 2.0; // Move up
    pillar.vertices[i+2] -= 2; // Move back
}

// Create RT geometry
console.log('Creating RT acceleration structures...');

const groundGeom = mystralRT.createGeometry({
    vertices: ground.vertices,
    indices: ground.indices,
    vertexStride: 12,
});

const sphereGeom = mystralRT.createGeometry({
    vertices: sphere.vertices,
    indices: sphere.indices,
    vertexStride: 12,
});

const box1Geom = mystralRT.createGeometry({
    vertices: box1.vertices,
    indices: box1.indices,
    vertexStride: 12,
});

const box2Geom = mystralRT.createGeometry({
    vertices: box2.vertices,
    indices: box2.indices,
    vertexStride: 12,
});

const pillarGeom = mystralRT.createGeometry({
    vertices: pillar.vertices,
    indices: pillar.indices,
    vertexStride: 12,
});

// Build BLASes
console.log('Building BLAS...');
const groundBLAS = mystralRT.createBLAS([groundGeom]);
const sphereBLAS = mystralRT.createBLAS([sphereGeom]);
const box1BLAS = mystralRT.createBLAS([box1Geom]);
const box2BLAS = mystralRT.createBLAS([box2Geom]);
const pillarBLAS = mystralRT.createBLAS([pillarGeom]);

// Identity matrix
const identity = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);

// Build TLAS
console.log('Building TLAS...');
const tlas = mystralRT.createTLAS([
    { blas: groundBLAS, transform: identity, instanceId: 0 },
    { blas: sphereBLAS, transform: identity, instanceId: 1 },
    { blas: box1BLAS, transform: identity, instanceId: 2 },
    { blas: box2BLAS, transform: identity, instanceId: 3 },
    { blas: pillarBLAS, transform: identity, instanceId: 4 },
]);

// ============================================================================
// Atmosphere Calculation (for logging)
// ============================================================================

function getAtmosphereColor(sunDir) {
    const sunY = sunDir[1];

    // Sky color based on sun elevation
    let skyR, skyG, skyB;

    if (sunY > 0.2) {
        // Day - blue sky
        skyR = 0.4;
        skyG = 0.6;
        skyB = 1.0;
    } else if (sunY > 0.0) {
        // Sunset transition
        const t = sunY / 0.2;
        skyR = 0.4 + (0.6 - 0.4) * (1 - t) + 0.4 * t;
        skyG = 0.3 + (0.4 - 0.3) * (1 - t) + 0.6 * t;
        skyB = 0.4 + (0.5 - 0.4) * (1 - t) + 1.0 * t;
    } else if (sunY > -0.2) {
        // Twilight
        const t = (sunY + 0.2) / 0.2;
        skyR = 0.1 + (0.6 - 0.1) * t;
        skyG = 0.1 + (0.3 - 0.1) * t;
        skyB = 0.2 + (0.4 - 0.2) * t;
    } else {
        // Night
        skyR = 0.02;
        skyG = 0.02;
        skyB = 0.05;
    }

    return [skyR, skyG, skyB];
}

function getTimeOfDay(sunY) {
    if (sunY > 0.5) return 'Day';
    if (sunY > 0.2) return 'Late Afternoon';
    if (sunY > 0.0) return 'Sunset';
    if (sunY > -0.2) return 'Twilight';
    return 'Night';
}

// ============================================================================
// Camera Setup
// ============================================================================

const cameraPos = getCameraPosition();
const cameraUp = [0, 1, 0];
const viewMatrix = lookAt(cameraPos, cameraTarget, cameraUp);
const viewInverse = invertMatrix(viewMatrix);
const projInverse = perspectiveProjectionInverse(
    Math.PI / 3,  // 60 degree FOV
    width / height,
    0.01,
    1000.0
);

// Combine into uniform buffer
const uniforms = new Float32Array(32);
uniforms.set(viewInverse, 0);
uniforms.set(projInverse, 16);

// ============================================================================
// Render Loop
// ============================================================================

console.log('');
console.log('Controls:');
console.log('  Arrow keys - Adjust sun azimuth/elevation');
console.log('  Space      - Pause/resume sun animation');
console.log('  T          - Toggle RT shadows');
console.log('  N          - Night mode (jump to nighttime)');
console.log('  R          - Reset camera');
console.log('');

let running = true;
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;
let lastTime = performance.now();

function updateCamera() {
    const camPos = getCameraPosition();
    const view = lookAt(camPos, cameraTarget, cameraUp);
    const viewInv = invertMatrix(view);
    uniforms.set(viewInv, 0);
}

function render() {
    if (!running) return;

    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // Update sun animation
    if (sunAnimating) {
        sunAzimuth = (sunAzimuth + sunSpeed * dt) % 360;

        // Sinusoidal elevation for day/night cycle
        const t = (sunAzimuth / 360) * Math.PI * 2;
        sunElevation = 30 + 50 * Math.sin(t);
    }

    // Get sun direction for atmosphere color
    const sunDir = getSunDirection();
    const atmosColor = getAtmosphereColor(sunDir);

    // Update camera for slight rotation
    cameraAzimuth += 2 * dt;
    updateCamera();

    // Trace rays
    if (rtEnabled) {
        mystralRT.traceRays({
            tlas: tlas,
            width: width,
            height: height,
            outputTexture: null,
            uniforms: uniforms,
            sunDirection: sunDir,
            atmosphereColor: atmosColor,
        });
    }

    // FPS tracking
    frameCount++;
    if (now - lastFpsTime >= 2000) {
        fps = frameCount / ((now - lastFpsTime) / 1000);
        frameCount = 0;
        lastFpsTime = now;

        const timeOfDay = getTimeOfDay(sunDir[1]);
        console.log('────────────────────────────────────────');
        console.log(`FPS: ${fps.toFixed(1)} | RT: ${rtEnabled ? 'ON' : 'OFF'}`);
        console.log(`Time: ${timeOfDay} | Sun El: ${sunElevation.toFixed(1)}°`);
        console.log(`Sky: RGB(${(atmosColor[0]*255).toFixed(0)}, ${(atmosColor[1]*255).toFixed(0)}, ${(atmosColor[2]*255).toFixed(0)})`);
    }

    requestAnimationFrame(render);
}

// ============================================================================
// Input Handling
// ============================================================================

if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case ' ':
                sunAnimating = !sunAnimating;
                console.log('Sun animation:', sunAnimating ? 'ON' : 'OFF');
                break;

            case 't':
                rtEnabled = !rtEnabled;
                console.log('RT shadows:', rtEnabled ? 'ON' : 'OFF');
                break;

            case 'n':
                // Jump to night
                sunElevation = -15;
                sunAzimuth = 270;
                sunAnimating = false;
                console.log('Jumped to nighttime');
                break;

            case 'r':
                cameraDistance = 15;
                cameraAzimuth = 30;
                cameraElevation = 20;
                cameraTarget = [0, 0.5, 0];
                updateCamera();
                console.log('Camera reset');
                break;

            case 'arrowup':
                sunElevation = Math.min(89, sunElevation + 5);
                sunAnimating = false;
                console.log(`Sun elevation: ${sunElevation.toFixed(1)}°`);
                break;

            case 'arrowdown':
                sunElevation = Math.max(-30, sunElevation - 5);
                sunAnimating = false;
                console.log(`Sun elevation: ${sunElevation.toFixed(1)}°`);
                break;

            case 'arrowleft':
                sunAzimuth = (sunAzimuth - 10 + 360) % 360;
                sunAnimating = false;
                console.log(`Sun azimuth: ${sunAzimuth.toFixed(1)}°`);
                break;

            case 'arrowright':
                sunAzimuth = (sunAzimuth + 10) % 360;
                sunAnimating = false;
                console.log(`Sun azimuth: ${sunAzimuth.toFixed(1)}°`);
                break;
        }
    });
}

// ============================================================================
// Start
// ============================================================================

console.log('Starting render loop with day/night cycle...');
render();

// ============================================================================
// Cleanup
// ============================================================================

if (typeof process !== 'undefined') {
    process.on('exit', () => {
        console.log('Cleaning up...');
        running = false;

        mystralRT.destroyTLAS(tlas);
        mystralRT.destroyBLAS(groundBLAS);
        mystralRT.destroyBLAS(sphereBLAS);
        mystralRT.destroyBLAS(box1BLAS);
        mystralRT.destroyBLAS(box2BLAS);
        mystralRT.destroyBLAS(pillarBLAS);

        console.log('Done!');
    });
}
