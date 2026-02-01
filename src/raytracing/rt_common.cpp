/**
 * MystralNative Ray Tracing Stub Implementation
 *
 * Provides a stub backend that returns isSupported() = false.
 * Platform-specific implementations (DXR, Vulkan RT, Metal RT) will
 * be added in future tasks.
 */

#include "rt_common.h"
#include <iostream>

namespace mystral {
namespace rt {

// ============================================================================
// Stub Backend Implementation
// ============================================================================

/**
 * Stub RT backend for when no hardware RT is available.
 * All methods return error or no-op, isSupported() returns false.
 */
class StubRTBackend : public IRTBackend {
public:
    StubRTBackend() {
        // Silent construction - logging happens in isSupported() check
    }

    ~StubRTBackend() override = default;

    // ========================================================================
    // Capability Queries
    // ========================================================================

    bool isSupported() override {
        return false;
    }

    RTBackendType getBackendType() override {
        return RTBackendType::None;
    }

    const char* getBackend() override {
        return "none";
    }

    // ========================================================================
    // Geometry Management
    // ========================================================================

    RTGeometryHandle createGeometry(const RTGeometryDesc& desc) override {
        std::cerr << "[MystralRT] createGeometry: Hardware ray tracing not available" << std::endl;
        return RTGeometryHandle{};
    }

    void destroyGeometry(RTGeometryHandle geometry) override {
        // No-op for stub
    }

    // ========================================================================
    // Acceleration Structure Management
    // ========================================================================

    RTBLASHandle createBLAS(RTGeometryHandle* geometries, size_t count) override {
        std::cerr << "[MystralRT] createBLAS: Hardware ray tracing not available" << std::endl;
        return RTBLASHandle{};
    }

    void destroyBLAS(RTBLASHandle blas) override {
        // No-op for stub
    }

    RTTLASHandle createTLAS(const RTTLASInstance* instances, size_t count) override {
        std::cerr << "[MystralRT] createTLAS: Hardware ray tracing not available" << std::endl;
        return RTTLASHandle{};
    }

    void updateTLAS(RTTLASHandle tlas, const RTTLASInstance* instances, size_t count) override {
        std::cerr << "[MystralRT] updateTLAS: Hardware ray tracing not available" << std::endl;
    }

    void destroyTLAS(RTTLASHandle tlas) override {
        // No-op for stub
    }

    // ========================================================================
    // Ray Tracing Execution
    // ========================================================================

    void traceRays(const TraceRaysOptions& options) override {
        std::cerr << "[MystralRT] traceRays: Hardware ray tracing not available" << std::endl;
    }
};

// ============================================================================
// Factory Implementation
// ============================================================================

std::unique_ptr<IRTBackend> createRTBackend() {
    // TODO: In Wave 3-4, detect platform and return appropriate backend:
    // - Windows with DXR-capable GPU: DXRRTBackend
    // - Vulkan with VK_KHR_ray_tracing_pipeline: VulkanRTBackend
    // - Apple Silicon with Metal 3: MetalRTBackend
    //
    // For now, return stub backend
    return std::make_unique<StubRTBackend>();
}

}  // namespace rt
}  // namespace mystral
