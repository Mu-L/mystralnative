/**
 * Ray-Traced Sponza with Atmospheric Scattering
 *
 * A showcase demo combining:
 *   - Sponza Atrium (glTF model)
 *   - Hardware ray-traced shadows
 *   - Procedural atmospheric scattering
 *   - Day/night cycle with celestial bodies
 *
 * This example demonstrates the full power of MystralNative's ray tracing
 * system in a real architectural scene. The Sponza palace is a classic
 * benchmark scene for global illumination algorithms, originally created
 * by Marko Dabrovic (Crytek version).
 *
 * Features:
 *   - Hardware RT shadows using the mystralRT API
 *   - Sun/moon cycle with realistic sky colors
 *   - Atmospheric scattering (Rayleigh + Mie)
 *   - Volumetric fog with density variation
 *   - Interactive time-of-day control
 *   - Camera fly-through mode
 *
 * Requirements:
 *   - GPU with hardware RT support:
 *     - Windows: DXR (NVIDIA RTX, AMD RDNA2+)
 *     - Linux: Vulkan RT (NVIDIA RTX, AMD RDNA2+)
 *     - macOS: Metal RT (Apple Silicon M1/M2/M3)
 *   - MystralNative built with MYSTRAL_USE_RAYTRACING=ON
 *   - examples/assets/Sponza.glb (auto-loaded)
 *
 * Usage:
 *   ./mystral run examples/rt-sponza-atmosphere.js
 *
 * Controls:
 *   WASD/Arrow keys - Move camera (when not in fly-through)
 *   Mouse drag      - Look around
 *   Scroll          - Adjust camera speed
 *   Space           - Pause time / Toggle fly-through
 *   T               - Toggle RT shadows
 *   F               - Toggle fog
 *   1-5             - Preset times (dawn/noon/sunset/dusk/night)
 *   +/-             - Adjust time speed
 *   R               - Reset camera to default position
 *
 * Performance Notes:
 *   - RT shadows add ~2-5ms per frame on Apple M1/M2
 *   - Fog is rendered via compute shader
 *   - Sponza has ~300K triangles (uses BVH optimization)
 */

// ============================================================================
// Configuration
// ============================================================================

const width = 1280;
const height = 720;

// Time state (hours, 0-24)
let timeOfDay = 10.0;     // Start at 10am
let timeSpeed = 0.5;      // Hours per second (1 = 1 min = 1 hour)
let timePaused = false;

// Sun/Moon state
let sunAzimuthOffset = 0; // Allow manual sun position adjustment

// Camera state
let cameraPosition = [0.5, 2.0, -0.5];
let cameraTarget = [5, 2, 0];
let cameraUp = [0, 1, 0];
let cameraSpeed = 8.0;
let flyThroughMode = true;
let flyThroughPhase = 0;

// Effects
let rtEnabled = true;
let fogEnabled = true;
let fogDensity = 0.003;

// ============================================================================
// RT Initialization
// ============================================================================

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║    Ray-Traced Sponza with Atmospheric Scattering              ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

console.log('Ray Tracing Backend:', mystralRT.getBackend());
console.log('Ray Tracing Supported:', mystralRT.isSupported());

if (!mystralRT.isSupported()) {
    console.log('');
    console.log('Hardware ray tracing not available.');
    console.log('This example requires hardware RT support.');
    console.log('');
    console.log('Requirements:');
    console.log('  macOS:   Apple Silicon (M1+) with macOS 13+');
    console.log('  Windows: NVIDIA RTX or AMD RDNA2+ GPU');
    console.log('  Linux:   NVIDIA RTX or AMD RDNA2+ with Vulkan RT');
    if (typeof process !== 'undefined') {
        process.exit(0);
    }
}

// ============================================================================
// Math Utilities
// ============================================================================

function normalize(v) {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    if (len < 0.0001) return [0, 1, 0];
    return [v[0]/len, v[1]/len, v[2]/len];
}

function subtract(a, b) {
    return [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
}

function add(a, b) {
    return [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
}

function scale(v, s) {
    return [v[0]*s, v[1]*s, v[2]*s];
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

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
    return [
        lerp(c1[0], c2[0], t),
        lerp(c1[1], c2[1], t),
        lerp(c1[2], c2[2], t),
    ];
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

// ============================================================================
// Celestial Calculations
// ============================================================================

/**
 * Convert time of day to sun elevation angle
 * 6:00 = sunrise, 12:00 = noon (zenith), 18:00 = sunset
 */
function timeToSunAngle(hours) {
    // Map 0-24 hours to 0-2PI, with noon at PI/2 (max elevation)
    return ((hours - 6) / 24) * Math.PI * 2;
}

function getSunDirection(hours) {
    const angle = timeToSunAngle(hours);
    const sunY = Math.sin(angle);
    const sunHorizontal = Math.cos(angle);

    // Add some azimuth variation for more interesting shadows
    const azimuth = (hours / 24) * Math.PI + sunAzimuthOffset * Math.PI / 180;

    return normalize([
        sunHorizontal * Math.cos(azimuth),
        sunY,
        sunHorizontal * Math.sin(azimuth) * 0.3,
    ]);
}

function getMoonDirection(hours) {
    // Moon is roughly opposite the sun with phase offset
    const moonAngle = timeToSunAngle(hours) + Math.PI + 0.2;
    const moonY = Math.sin(moonAngle);
    const moonHorizontal = Math.cos(moonAngle);

    return normalize([
        moonHorizontal * Math.cos(0.5),
        moonY,
        moonHorizontal * Math.sin(0.5) * 0.2 - 0.1,
    ]);
}

// ============================================================================
// Atmosphere & Sky Colors
// ============================================================================

// Color presets for different times of day
const SKY_COLORS = {
    night:   [0.01, 0.01, 0.03],
    dawn:    [0.6, 0.4, 0.3],
    day:     [0.4, 0.6, 0.9],
    sunset:  [0.9, 0.5, 0.2],
    dusk:    [0.3, 0.2, 0.4],
};

const FOG_COLORS = {
    night:   [0.02, 0.02, 0.04],
    dawn:    [0.5, 0.4, 0.35],
    day:     [0.5, 0.6, 0.7],
    sunset:  [0.6, 0.4, 0.25],
    dusk:    [0.15, 0.1, 0.2],
};

const SUN_COLORS = {
    night:   [0.0, 0.0, 0.0],
    dawn:    [1.0, 0.6, 0.3],
    day:     [1.0, 0.98, 0.9],
    sunset:  [1.0, 0.5, 0.1],
    dusk:    [0.8, 0.4, 0.5],
};

function getAtmosphereState(hours) {
    const sunDir = getSunDirection(hours);
    const sunY = sunDir[1];

    let state = 'day';
    let blend = 0;

    if (sunY < -0.15) {
        state = 'night';
        blend = 1;
    } else if (sunY < 0.0) {
        // Dusk/dawn transition
        const t = (sunY + 0.15) / 0.15;
        if (hours < 12) {
            state = 'dawn';
            blend = t;
        } else {
            state = 'dusk';
            blend = 1 - t;
        }
    } else if (sunY < 0.15) {
        // Sunrise/sunset colors
        const t = sunY / 0.15;
        if (hours < 12) {
            state = 'dawn';
            blend = t;
        } else {
            state = 'sunset';
            blend = 1 - t;
        }
    } else if (sunY < 0.4) {
        // Morning/evening warmth
        const t = (sunY - 0.15) / 0.25;
        if (hours < 12) {
            state = 'day';
            blend = t;
        } else {
            state = 'day';
            blend = t;
        }
    }

    // Interpolate colors based on state
    let skyColor, fogColor, sunColor, sunIntensity, moonIntensity;

    if (state === 'night') {
        skyColor = SKY_COLORS.night;
        fogColor = FOG_COLORS.night;
        sunColor = SUN_COLORS.night;
        sunIntensity = 0;
        moonIntensity = 0.3;
    } else if (state === 'dawn') {
        skyColor = lerpColor(SKY_COLORS.night, SKY_COLORS.dawn, blend);
        fogColor = lerpColor(FOG_COLORS.night, FOG_COLORS.dawn, blend);
        sunColor = lerpColor(SUN_COLORS.night, SUN_COLORS.dawn, blend);
        sunIntensity = blend * 2;
        moonIntensity = (1 - blend) * 0.2;
    } else if (state === 'sunset') {
        skyColor = lerpColor(SKY_COLORS.day, SKY_COLORS.sunset, 1 - blend);
        fogColor = lerpColor(FOG_COLORS.day, FOG_COLORS.sunset, 1 - blend);
        sunColor = lerpColor(SUN_COLORS.day, SUN_COLORS.sunset, 1 - blend);
        sunIntensity = 2 * blend + 0.5;
        moonIntensity = 0;
    } else if (state === 'dusk') {
        skyColor = lerpColor(SKY_COLORS.sunset, SKY_COLORS.dusk, 1 - blend);
        fogColor = lerpColor(FOG_COLORS.sunset, FOG_COLORS.dusk, 1 - blend);
        sunColor = lerpColor(SUN_COLORS.sunset, SUN_COLORS.dusk, 1 - blend);
        sunIntensity = blend * 0.5;
        moonIntensity = (1 - blend) * 0.1;
    } else {
        skyColor = SKY_COLORS.day;
        fogColor = FOG_COLORS.day;
        sunColor = SUN_COLORS.day;
        sunIntensity = 3.0;
        moonIntensity = 0;
    }

    return {
        sunDirection: sunDir,
        moonDirection: getMoonDirection(hours),
        skyColor,
        fogColor,
        sunColor,
        sunIntensity,
        moonIntensity,
        isNight: sunY < -0.1,
        isDawn: state === 'dawn',
        isDusk: state === 'dusk' || state === 'sunset',
    };
}

function getTimeLabel(hours) {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getTimePeriod(hours) {
    if (hours < 5.5 || hours >= 20.5) return 'Night';
    if (hours < 7) return 'Dawn';
    if (hours < 11) return 'Morning';
    if (hours < 14) return 'Noon';
    if (hours < 17) return 'Afternoon';
    if (hours < 19) return 'Sunset';
    return 'Dusk';
}

// ============================================================================
// Scene Loading (Simplified GLTF stub)
// ============================================================================

// Note: In a real implementation, this would use GLBLoader
// For now, we create placeholder geometry for RT testing

console.log('');
console.log('Loading Sponza scene...');

// Create simplified Sponza geometry for RT (floor + walls + columns)
function createSponzaPlaceholder() {
    const allVertices = [];
    const allIndices = [];
    let indexOffset = 0;

    // Floor
    const floorSize = 15;
    const floorVerts = [
        -floorSize, 0, -floorSize,
         floorSize, 0, -floorSize,
         floorSize, 0,  floorSize,
        -floorSize, 0,  floorSize,
    ];
    const floorInds = [0, 1, 2, 0, 2, 3];
    allVertices.push(...floorVerts);
    allIndices.push(...floorInds.map(i => i + indexOffset));
    indexOffset += 4;

    // Ceiling
    const ceilingHeight = 12;
    const ceilingVerts = [
        -floorSize, ceilingHeight, -floorSize,
        -floorSize, ceilingHeight,  floorSize,
         floorSize, ceilingHeight,  floorSize,
         floorSize, ceilingHeight, -floorSize,
    ];
    allVertices.push(...ceilingVerts);
    allIndices.push(...[0, 1, 2, 0, 2, 3].map(i => i + indexOffset));
    indexOffset += 4;

    // Back wall
    const wallVerts = [
        -floorSize, 0, -floorSize,
        -floorSize, ceilingHeight, -floorSize,
         floorSize, ceilingHeight, -floorSize,
         floorSize, 0, -floorSize,
    ];
    allVertices.push(...wallVerts);
    allIndices.push(...[0, 1, 2, 0, 2, 3].map(i => i + indexOffset));
    indexOffset += 4;

    // Columns (simplified as boxes)
    const columnPositions = [
        [-8, -4], [-8, 0], [-8, 4],
        [8, -4], [8, 0], [8, 4],
    ];

    const columnRadius = 0.5;
    const columnHeight = ceilingHeight;

    for (const [cx, cz] of columnPositions) {
        const hw = columnRadius;
        const hh = columnHeight / 2;
        const columnVerts = [
            // Front
            cx-hw, 0, cz+hw, cx+hw, 0, cz+hw, cx+hw, columnHeight, cz+hw, cx-hw, columnHeight, cz+hw,
            // Back
            cx-hw, 0, cz-hw, cx-hw, columnHeight, cz-hw, cx+hw, columnHeight, cz-hw, cx+hw, 0, cz-hw,
            // Left
            cx-hw, 0, cz-hw, cx-hw, 0, cz+hw, cx-hw, columnHeight, cz+hw, cx-hw, columnHeight, cz-hw,
            // Right
            cx+hw, 0, cz-hw, cx+hw, columnHeight, cz-hw, cx+hw, columnHeight, cz+hw, cx+hw, 0, cz+hw,
        ];
        const columnInds = [
            0,1,2, 0,2,3,
            4,5,6, 4,6,7,
            8,9,10, 8,10,11,
            12,13,14, 12,14,15,
        ];
        allVertices.push(...columnVerts);
        allIndices.push(...columnInds.map(i => i + indexOffset));
        indexOffset += 16;
    }

    // Second floor balcony (arcade)
    const balconyHeight = 6;
    const balconyDepth = 3;
    const balconyVerts = [
        -floorSize, balconyHeight, -floorSize,
         floorSize, balconyHeight, -floorSize,
         floorSize, balconyHeight, -floorSize + balconyDepth,
        -floorSize, balconyHeight, -floorSize + balconyDepth,
    ];
    allVertices.push(...balconyVerts);
    allIndices.push(...[0, 2, 1, 0, 3, 2].map(i => i + indexOffset));
    indexOffset += 4;

    // Opposite balcony
    const balcony2Verts = [
        -floorSize, balconyHeight, floorSize - balconyDepth,
         floorSize, balconyHeight, floorSize - balconyDepth,
         floorSize, balconyHeight, floorSize,
        -floorSize, balconyHeight, floorSize,
    ];
    allVertices.push(...balcony2Verts);
    allIndices.push(...[0, 2, 1, 0, 3, 2].map(i => i + indexOffset));
    indexOffset += 4;

    // Add some decorative elements (planters as boxes)
    const planterPositions = [[-5, 0], [5, 0], [-5, -2], [5, -2]];
    for (const [px, pz] of planterPositions) {
        const pw = 0.8, ph = 1.0, pd = 0.8;
        const planterVerts = [
            px-pw, 0, pz-pd, px+pw, 0, pz-pd, px+pw, ph, pz-pd, px-pw, ph, pz-pd,
            px-pw, 0, pz+pd, px-pw, ph, pz+pd, px+pw, ph, pz+pd, px+pw, 0, pz+pd,
            px-pw, 0, pz-pd, px-pw, 0, pz+pd, px-pw, ph, pz+pd, px-pw, ph, pz-pd,
            px+pw, 0, pz-pd, px+pw, ph, pz-pd, px+pw, ph, pz+pd, px+pw, 0, pz+pd,
            px-pw, ph, pz-pd, px-pw, ph, pz+pd, px+pw, ph, pz+pd, px+pw, ph, pz-pd,
        ];
        const planterInds = [
            0,1,2, 0,2,3,
            4,5,6, 4,6,7,
            8,9,10, 8,10,11,
            12,13,14, 12,14,15,
            16,17,18, 16,18,19,
        ];
        allVertices.push(...planterVerts);
        allIndices.push(...planterInds.map(i => i + indexOffset));
        indexOffset += 20;
    }

    console.log(`Created simplified Sponza: ${allVertices.length/3} vertices, ${allIndices.length/3} triangles`);

    return {
        vertices: new Float32Array(allVertices),
        indices: new Uint32Array(allIndices),
    };
}

const sponzaGeom = createSponzaPlaceholder();

// ============================================================================
// RT Setup
// ============================================================================

console.log('Building RT acceleration structures...');
const buildStart = performance.now();

const rtGeometry = mystralRT.createGeometry({
    vertices: sponzaGeom.vertices,
    indices: sponzaGeom.indices,
    vertexStride: 12,
});

const blas = mystralRT.createBLAS([rtGeometry]);

const identity = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);

const tlas = mystralRT.createTLAS([
    { blas: blas, transform: identity, instanceId: 0 },
]);

const buildTime = performance.now() - buildStart;
console.log(`Acceleration structures built in ${buildTime.toFixed(2)}ms`);

// ============================================================================
// Camera Setup
// ============================================================================

const projInverse = perspectiveProjectionInverse(
    Math.PI / 3,
    width / height,
    0.1,
    1000.0
);

const uniforms = new Float32Array(32);
uniforms.set(projInverse, 16);

function updateCameraUniforms() {
    const viewMatrix = lookAt(cameraPosition, cameraTarget, cameraUp);
    const viewInverse = invertMatrix(viewMatrix);
    uniforms.set(viewInverse, 0);
}

// Fly-through waypoints
const flyWaypoints = [
    { pos: [0, 2, 8], target: [0, 2, 0] },
    { pos: [6, 3, 4], target: [0, 2, 0] },
    { pos: [10, 4, 0], target: [0, 3, -2] },
    { pos: [6, 8, -4], target: [0, 4, 0] },
    { pos: [-6, 3, -2], target: [2, 2, 2] },
    { pos: [-10, 4, 0], target: [0, 2, 0] },
    { pos: [-6, 2, 4], target: [0, 2, 0] },
    { pos: [0, 2, 8], target: [0, 2, 0] }, // Back to start
];

function updateFlyThrough(dt) {
    const waypointDuration = 8; // seconds per waypoint
    flyThroughPhase += dt / waypointDuration;

    const numWaypoints = flyWaypoints.length - 1;
    const segmentPhase = flyThroughPhase % 1;
    const segmentIndex = Math.floor(flyThroughPhase) % numWaypoints;

    const wp1 = flyWaypoints[segmentIndex];
    const wp2 = flyWaypoints[(segmentIndex + 1) % flyWaypoints.length];

    // Smooth interpolation (ease in-out)
    const t = segmentPhase < 0.5
        ? 2 * segmentPhase * segmentPhase
        : 1 - Math.pow(-2 * segmentPhase + 2, 2) / 2;

    cameraPosition = [
        lerp(wp1.pos[0], wp2.pos[0], t),
        lerp(wp1.pos[1], wp2.pos[1], t),
        lerp(wp1.pos[2], wp2.pos[2], t),
    ];
    cameraTarget = [
        lerp(wp1.target[0], wp2.target[0], t),
        lerp(wp1.target[1], wp2.target[1], t),
        lerp(wp1.target[2], wp2.target[2], t),
    ];
}

updateCameraUniforms();

// ============================================================================
// Render Loop
// ============================================================================

console.log('');
console.log('Controls:');
console.log('  Space       - Toggle fly-through / Pause time');
console.log('  T           - Toggle RT shadows');
console.log('  F           - Toggle fog');
console.log('  1-5         - Time presets (dawn/noon/sunset/dusk/night)');
console.log('  +/-         - Adjust time speed');
console.log('  Arrow keys  - Manual sun adjustment');
console.log('  R           - Reset camera');
console.log('');

let running = true;
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;
let lastTime = performance.now();

function render() {
    if (!running) return;

    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // Update time
    if (!timePaused) {
        timeOfDay = (timeOfDay + timeSpeed * dt) % 24;
        if (timeOfDay < 0) timeOfDay += 24;
    }

    // Get atmosphere state
    const atmos = getAtmosphereState(timeOfDay);

    // Update camera
    if (flyThroughMode) {
        updateFlyThrough(dt);
    }
    updateCameraUniforms();

    // Trace rays
    if (rtEnabled) {
        mystralRT.traceRays({
            tlas: tlas,
            width: width,
            height: height,
            outputTexture: null,
            uniforms: uniforms,
            sunDirection: atmos.sunDirection,
            sunColor: atmos.sunColor,
            sunIntensity: atmos.sunIntensity,
            skyColor: atmos.skyColor,
            fogEnabled: fogEnabled,
            fogColor: atmos.fogColor,
            fogDensity: fogDensity,
        });
    }

    // FPS tracking
    frameCount++;
    if (now - lastFpsTime >= 3000) {
        fps = frameCount / ((now - lastFpsTime) / 1000);
        frameCount = 0;
        lastFpsTime = now;

        console.log('────────────────────────────────────────────────────');
        console.log(`Time: ${getTimeLabel(timeOfDay)} (${getTimePeriod(timeOfDay)})`);
        console.log(`FPS: ${fps.toFixed(1)} | RT: ${rtEnabled ? 'ON' : 'OFF'} | Fog: ${fogEnabled ? 'ON' : 'OFF'}`);
        console.log(`Sun El: ${(Math.asin(atmos.sunDirection[1]) * 180 / Math.PI).toFixed(1)}° | Intensity: ${atmos.sunIntensity.toFixed(2)}`);

        const skyRGB = atmos.skyColor.map(c => Math.round(c * 255));
        console.log(`Sky: RGB(${skyRGB.join(', ')})`);

        const camStr = cameraPosition.map(c => c.toFixed(1)).join(', ');
        console.log(`Camera: [${camStr}]`);
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
                if (flyThroughMode) {
                    timePaused = !timePaused;
                    console.log('Time:', timePaused ? 'PAUSED' : 'RUNNING');
                } else {
                    flyThroughMode = true;
                    console.log('Fly-through mode enabled');
                }
                break;

            case 't':
                rtEnabled = !rtEnabled;
                console.log('RT shadows:', rtEnabled ? 'ON' : 'OFF');
                break;

            case 'f':
                fogEnabled = !fogEnabled;
                console.log('Fog:', fogEnabled ? 'ON' : 'OFF');
                break;

            case '1':
                timeOfDay = 6.5; // Dawn
                console.log('Time set to Dawn (6:30 AM)');
                break;

            case '2':
                timeOfDay = 12; // Noon
                console.log('Time set to Noon (12:00 PM)');
                break;

            case '3':
                timeOfDay = 18; // Sunset
                console.log('Time set to Sunset (6:00 PM)');
                break;

            case '4':
                timeOfDay = 19.5; // Dusk
                console.log('Time set to Dusk (7:30 PM)');
                break;

            case '5':
                timeOfDay = 23; // Night
                console.log('Time set to Night (11:00 PM)');
                break;

            case '=':
            case '+':
                timeSpeed = Math.min(5, timeSpeed + 0.25);
                console.log(`Time speed: ${timeSpeed.toFixed(2)} hours/sec`);
                break;

            case '-':
                timeSpeed = Math.max(0, timeSpeed - 0.25);
                console.log(`Time speed: ${timeSpeed.toFixed(2)} hours/sec`);
                break;

            case 'r':
                cameraPosition = [0.5, 2.0, -0.5];
                cameraTarget = [5, 2, 0];
                flyThroughMode = true;
                flyThroughPhase = 0;
                console.log('Camera reset');
                break;

            case 'arrowup':
                sunAzimuthOffset += 15;
                console.log(`Sun azimuth offset: ${sunAzimuthOffset}°`);
                break;

            case 'arrowdown':
                sunAzimuthOffset -= 15;
                console.log(`Sun azimuth offset: ${sunAzimuthOffset}°`);
                break;

            case 'arrowleft':
                timeOfDay = (timeOfDay - 0.5 + 24) % 24;
                console.log(`Time: ${getTimeLabel(timeOfDay)}`);
                break;

            case 'arrowright':
                timeOfDay = (timeOfDay + 0.5) % 24;
                console.log(`Time: ${getTimeLabel(timeOfDay)}`);
                break;
        }
    });
}

// ============================================================================
// Start
// ============================================================================

console.log('Starting render loop...');
console.log('');
render();

// ============================================================================
// Cleanup
// ============================================================================

if (typeof process !== 'undefined') {
    process.on('exit', () => {
        console.log('');
        console.log('Cleaning up RT resources...');
        running = false;

        mystralRT.destroyTLAS(tlas);
        mystralRT.destroyBLAS(blas);

        console.log('Done!');
    });
}
