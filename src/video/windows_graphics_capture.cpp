/**
 * Windows.Graphics.Capture Video Recorder (Windows 10 1803+)
 *
 * Uses Windows.Graphics.Capture API for high-quality, low-overhead screen capture.
 * Captures the SDL window directly and encodes to H.264/MP4 using Media Foundation.
 *
 * Requirements:
 * - Windows 10 version 1803 (April 2018 Update) or later
 * - Graphics Capture capability
 *
 * NOTE: Currently stubbed out due to C++/WinRT namespace conflicts with Windows.h.
 * The GPU readback fallback will be used on Windows instead.
 * TODO: Fix namespace issues and re-enable native Windows capture.
 */

#include "mystral/video/video_recorder.h"

#ifdef _WIN32

#include <iostream>

namespace mystral {
namespace video {

// Currently disabled - Windows.Graphics.Capture has C++/WinRT namespace conflicts
// that need to be resolved. For now, use GPU readback fallback.
std::unique_ptr<VideoRecorder> createWindowsGraphicsCaptureRecorder() {
    // Return nullptr to fall back to GPU readback
    return nullptr;
}

bool isWindowsGraphicsCaptureAvailableCheck() {
    // Disabled for now - return false to use GPU readback fallback
    return false;
}

}  // namespace video
}  // namespace mystral

#else  // Not Windows

namespace mystral {
namespace video {

std::unique_ptr<VideoRecorder> createWindowsGraphicsCaptureRecorder() {
    return nullptr;
}

bool isWindowsGraphicsCaptureAvailableCheck() {
    return false;
}

}  // namespace video
}  // namespace mystral

#endif  // _WIN32
