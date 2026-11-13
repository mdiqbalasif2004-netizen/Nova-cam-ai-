# NOVA CAM AI — Feature Status Matrix

## Completed (Web Full-Stack Studio — Verified in Browser Runtime)
- **Live Camera + Studio Scene Viewfinder**: Real `getUserMedia()` camera feed + 4 photorealistic reference scenes + custom image import.
- **Hardware Capability Detection**: Real `navigator.mediaDevices.enumerateDevices()` and `MediaStreamTrack.getCapabilities()` probing; unsupported controls are hidden.
- **AI-Powered Scene Optimization**: Offline pixel/gradient engine detects `portrait`, `landscape`, `night`, `food`, `sunset`, `architecture`, `street`, and `closeup`, and applies subtle EV, WB, ISO, and Focus adjustments filtered by hardware capabilities.
- **Intelligent Live AI Camera Coach**: Throttled (750ms) downscaled `160x120` frame analyzer providing horizon tilt, highlight clipping, subject centroid placement, background clutter, and lens recommendations + optional server-side `gemini-4-hydrogen` coaching behind explicit consent.
- **Cinematic Colour Engine**: 10 Photo profiles (`Cinematic` default) + 6 Video profiles + 10 non-destructive sliders + Original vs. Edited preservation.
- **Professional Video Mode**: Real `MediaRecorder` capture with graded canvas + mic audio toggle, resolution/FPS gating.
- **Built-in Gallery**: IndexedDB persistence, Before/After split slider, EXIF metadata, Offline & Gemini Vision AI photo critique, Share/Export, Delete confirmation.
- **Liquid Glass UI & Custom Colour Engine**: 6 accent presets + custom hex + Dark/Light mode + adjustable glass blur/opacity persisted in `localStorage`.
- **Update Manifest & Privacy**: `/api/updates/manifest` endpoint with SHA-256 & signing cert verification metadata; strict offline-first consent gate.

## Implemented in Source / Requires Local Android Studio Compilation
- **Modular Kotlin & Jetpack Compose Project (`/android`)**: All 19 Gradle modules, Camera2 capability probe, Xiaomi 17T physical lens resolver, SceneOptimizationEngine, Liquid Glass Compose surfaces, DataStore theme engine, Room/MediaStore gallery, and Play/APK update verifier.

## Unverified / Not Executable in Web-Only Container
- **Debug/Release APK Compilation**: No Android SDK or Gradle daemon present in this Node.js web environment.
- **Physical Xiaomi 17T Hardware Verification**: Camera2 physical lens IDs, 10-bit HDR10+ encoder output, RAW DNG sensor capture, and OIS telemetry require testing on a physical Xiaomi 17T.
