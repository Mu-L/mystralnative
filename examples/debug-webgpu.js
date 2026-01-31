// Debug script to test WebGPU API availability and behavior

console.log('=== WebGPU API Debug Test ===');

// Check navigator.gpu
console.log('1. navigator.gpu exists:', !!navigator.gpu);
console.log('   navigator.gpu type:', typeof navigator.gpu);

if (navigator.gpu) {
    console.log('   navigator.gpu keys:', Object.keys(navigator.gpu).join(', '));
    console.log('   requestAdapter type:', typeof navigator.gpu.requestAdapter);
    console.log('   getPreferredCanvasFormat type:', typeof navigator.gpu.getPreferredCanvasFormat);
}

// Test getPreferredCanvasFormat
if (navigator.gpu && navigator.gpu.getPreferredCanvasFormat) {
    const format = navigator.gpu.getPreferredCanvasFormat();
    console.log('2. getPreferredCanvasFormat():', format);
}

// Test requestAdapter
async function testWebGPU() {
    console.log('\n3. Testing requestAdapter...');

    try {
        const adapterResult = navigator.gpu.requestAdapter();
        console.log('   requestAdapter() returned:', typeof adapterResult);
        console.log('   Is Promise?:', adapterResult instanceof Promise);
        console.log('   Has then?:', typeof adapterResult?.then);

        const adapter = await adapterResult;
        console.log('   After await, adapter:', typeof adapter);

        if (adapter) {
            console.log('   adapter keys:', Object.keys(adapter).join(', '));
            console.log('   adapter.features:', adapter.features);
            console.log('   adapter.limits:', adapter.limits ? 'present' : 'missing');
            console.log('   adapter.requestDevice type:', typeof adapter.requestDevice);

            // Test requestDevice
            console.log('\n4. Testing requestDevice...');
            const deviceResult = adapter.requestDevice();
            console.log('   requestDevice() returned:', typeof deviceResult);
            console.log('   Is Promise?:', deviceResult instanceof Promise);
            console.log('   Has then?:', typeof deviceResult?.then);

            const device = await deviceResult;
            console.log('   After await, device:', typeof device);

            if (device) {
                console.log('   device keys:', Object.keys(device).join(', '));
                console.log('   device.queue:', device.queue ? 'present' : 'missing');
                console.log('   device.createShaderModule type:', typeof device.createShaderModule);
                console.log('   device.createBuffer type:', typeof device.createBuffer);
                console.log('   device.createRenderPipeline type:', typeof device.createRenderPipeline);

                // Test device.lost
                console.log('\n5. Testing device.lost...');
                console.log('   device.lost:', device.lost);
                console.log('   device.lost type:', typeof device.lost);
                console.log('   device.lost instanceof Promise:', device.lost instanceof Promise);
            } else {
                console.log('   ERROR: device is null/undefined');
            }
        } else {
            console.log('   ERROR: adapter is null/undefined');
        }
    } catch (e) {
        console.error('   ERROR during WebGPU test:', e.message);
        console.error('   Stack:', e.stack);
    }

    // Test canvas context
    console.log('\n6. Testing canvas.getContext("webgpu")...');
    try {
        const ctx = canvas.getContext('webgpu');
        console.log('   context:', typeof ctx);
        if (ctx) {
            console.log('   context keys:', Object.keys(ctx).join(', '));
        }
    } catch (e) {
        console.error('   ERROR:', e.message);
    }

    console.log('\n=== Debug Test Complete ===');
}

testWebGPU();
