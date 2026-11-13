package com.novacam.ai.domain

enum class SceneCategory {
    PORTRAIT, LANDSCAPE, NIGHT, FOOD, SUNSET, ARCHITECTURE, STREET, CLOSE_UP
}

enum class LensRole {
    ULTRA_WIDE, MAIN, TELEPHOTO, FRONT
}

data class CameraCapabilityReport(
    val cameraId: String,
    val physicalId: String?,
    val lensRole: LensRole,
    val focalLengthMm: Float,
    val aperture: Float,
    val isoRange: IntRange?,
    val exposureNsRange: LongRange?,
    val evStepRange: IntRange?,
    val evStepFraction: Float,
    val minFocusDistanceDiopters: Float?,
    val supportsManualFocus: Boolean,
    val supportsManualWb: Boolean,
    val supportsRawDng: Boolean,
    val supportsOis: Boolean,
    val supportedHdrProfiles: List<String>,
    val supportedPhotoSizes: List<Pair<Int, Int>>,
    val supportedVideoFps: List<Int>,
    val hasFlashUnit: Boolean
)

data class SceneOptimizationAdjustment(
    val scene: SceneCategory,
    val confidence: Float,
    val exposureEvDelta: Float?,
    val whiteBalanceKelvin: Int?,
    val targetIso: Int?,
    val focusMode: String?,
    val skippedUnsupported: List<String>,
    val rationale: String
)

data class ThemeConfig(
    val darkMode: Boolean = true,
    val accentHex: Long = 0xFF8B5CF6,
    val glassBlurDp: Float = 18f,
    val glassOpacity: Float = 0.62f
)
