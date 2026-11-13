# Xiaomi 17T Feature Compatibility Report

**Verification Status:** `UNVERIFIED ON PHYSICAL XIAOMI 17T HARDWARE` (No physical Xiaomi 17T or Android SDK runtime available inside the web container).

## 1. Hardware Capability Probe Strategy
`HardwareCapabilityManager.kt` and `Xiaomi17TCameraProfile.kt` never hardcode camera specs. At runtime on Android, the app queries `CameraManager.getCameraCharacteristics(cameraId)`:

| Target Xiaomi 17T Sensor | Expected Spec | Public Android Camera2 API Check | Fallback if Restricted by OEM HAL |
| :--- | :--- | :--- | :--- |
| Main Wide | 50 MP Light Fusion 800, ~23mm, f/1.7, OIS | `PHYSICAL_CAMERA_ID`, `LENS_INFO_AVAILABLE_FOCAL_LENGTHS`, `LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION` | Falls back to logical rear camera `0` with focal length / zoom ratio control. |
| Telephoto | 50 MP, ~115mm, f/3.0, OIS, 5× optical | `LOGICAL_MULTI_CAMERA` physical sub-IDs or `CONTROL_ZOOM_RATIO_RANGE >= 5.0f` | Uses logical `setZoomRatio(5.0f)` if physical telephoto ID is hidden from 3rd-party Camera2 clients. |
| Ultra-Wide | 12 MP, ~15mm, 120° FOV | Physical sub-ID focal length `< 2.5mm` or `CONTROL_ZOOM_RATIO_RANGE.lower < 1.0f` | Uses logical `setZoomRatio(0.6f)` when supported by OEM HAL. |
| Front Selfie | 32 MP | `LENS_FACING_FRONT` `SENSOR_INFO_PIXEL_ARRAY_SIZE` | Uses highest exposed front `JPEG` stream size. |

## 2. Feature & API Limitations
- **Xiaomi Proprietary Processing (Leica/HyperOS ISP private tags)**: Not accessible via public CameraX/Camera2 APIs. NOVA CAM AI provides its own original `cinematic-engine` colour profiles rather than claiming access to vendor-private ISP modes.
- **RAW DNG Capture**: Enabled in UI only if `REQUEST_AVAILABLE_CAPABILITIES` contains `REQUEST_AVAILABLE_CAPABILITIES_RAW`.
- **10-bit HDR Video (HDR10 / HDR10+ / HLG)**: Enabled in `VideoRecorderManager` only when `DynamicRangeProfiles.getSupportedProfiles()` reports `HDR10`, `HDR10_PLUS`, or `HLG10`. Log recording is hidden unless an OEM/Camera2 profile explicitly exposes it.
- **AI Scene Optimization**: All scene-based EV, White Balance, ISO, and Focus adjustments pass through `HardwareCapabilityManager.constrainOptimization()` before reaching `Camera2Interop`. Unsupported controls are never mutated or displayed.
