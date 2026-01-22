# Contributing to MystralNative

Thank you for your interest in contributing to MystralNative!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Run `node scripts/download-deps.mjs` to download dependencies
4. Run `cmake -B build && cmake --build build` to build

## Submitting Changes

1. Create a new branch for your feature/fix
2. Make your changes
3. Run the tests: `./build/mystral run examples/triangle.js --no-sdl --frames 1`
4. Submit a pull request

## Code Style

- Use consistent formatting
- Add comments for complex logic
- Keep functions focused and small
