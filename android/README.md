# NOVA CAM AI — Xiaomi 17T Android Project & Web Studio

## Overview
NOVA CAM AI is an AI-assisted computational photography and videography system built around **Hardware-Aware Camera2 Probing**, **Subtle AI Scene Optimization**, **Cinematic Colour Grading**, **Liquid Glass UI**, and **Live Pre-Shutter Composition Coaching**.

## Environment & Build Note
This repository contains two synchronized deliverables:
1. **Interactive Full-Stack Web Studio (`/src`, `/server.ts`)**: Runs live in Node.js + React + Express + `@google/genai` (`gemini-4-hydrogen`), featuring real `MediaDevices` / `MediaStreamTrack.getCapabilities()` probing, real-time pixel grading, throttled offline CV coaching, video recording via `MediaRecorder`, IndexedDB gallery with Before/After split comparison, and server-side Gemini Vision analysis.
2. **Modular Android Studio Kotlin / Jetpack Compose Project (`/android`)**: Structured across all 19 Gradle modules (`app`, `camera-core`, `camera-xiaomi`, `camera-controls`, `photo-processing`, `cinematic-engine`, `video-engine`, `video-hdr`, `ai-core`, `ai-offline`, `ai-cloud`, `composition-engine`, `gallery`, `liquid-glass-ui`, `theme-customizer`, `update-manager`, `settings`, `data`, `domain`).

> **Important Honesty Notice**: The AI Studio build container is a Linux Node.js web environment without the Android SDK, Gradle wrapper binaries, or a physical Xiaomi 17T attached. Therefore, **debug/release APKs have not been compiled in this container**, and **physical Xiaomi 17T Camera2 hardware characteristics are unverified on real hardware**.

## Building the Android Project Locally
1. Open `/android` (or extract `nova-cam-ai-android.zip` exported from the app) in **Android Studio Ladybug (2024.2+)** with **JDK 17** and **Android SDK API 35**.
2. Sync Gradle (`./gradlew :app:assembleDebug`).
3. Configure your backend proxy URL (`NOVA_BACKEND_BASE_URL` in `local.properties` / BuildConfig) so online Gemini Vision requests route through your HTTPS server rather than embedding any API keys in the APK.

## Release APK Signing Instructions
1. Generate an upload keystore outside version control:
   ```bash
   keytool -genkeypair -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias novacam
   ```
2. Configure `signingConfigs.release` via environment variables (`KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`) — never commit keystores or secrets.
3. Run `./gradlew :app:assembleRelease` or `./gradlew :app:bundleRelease`.
