// Test Promise behavior in MystralNative

console.log('=== Promise Test ===');

// Test 1: Await on non-Promise
async function testNonPromise() {
  console.log('Test 1: await on non-Promise');
  const result = await 42;
  console.log('  Result:', result);
  return result;
}

// Test 2: Await on object (like our requestAdapter returns)
async function testObjectAwait() {
  console.log('Test 2: await on object');
  const obj = { value: 'test' };
  const result = await obj;
  console.log('  Result:', result);
  return result;
}

// Test 3: Promise inside Promise constructor with async
async function testNestedPromise() {
  console.log('Test 3: Nested Promise with async');
  const p = new Promise(async (resolve, reject) => {
    console.log('  Inside Promise constructor');
    await 1;
    console.log('  After first await');
    await 2;
    console.log('  After second await');
    resolve('done');
  });
  const result = await p;
  console.log('  Result:', result);
  return result;
}

// Test 4: Similar to Three.js init pattern
async function testThreePattern() {
  console.log('Test 4: Three.js-like pattern');

  const adapter = await navigator.gpu.requestAdapter();
  console.log('  Got adapter:', !!adapter);

  const device = await adapter.requestDevice();
  console.log('  Got device:', !!device);

  device.lost.then((info) => {
    console.log('  Device lost:', info);
  });
  console.log('  Set up device.lost handler');

  return device;
}

// Run all tests
async function runTests() {
  try {
    await testNonPromise();
    await testObjectAwait();
    await testNestedPromise();
    await testThreePattern();
    console.log('=== All tests passed ===');
  } catch (e) {
    console.error('Test failed:', e.message);
    console.error('Stack:', e.stack);
  }
}

runTests().then(() => {
  console.log('=== Tests complete ===');
});
