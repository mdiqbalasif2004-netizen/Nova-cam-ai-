package com.novacam.ai.ai

import com.novacam.ai.domain.CameraCapabilityReport
import com.novacam.ai.domain.SceneCategory
import com.novacam.ai.domain.SceneOptimizationAdjustment
import kotlin.math.roundToInt

/**
 * Target camera parameter profile for a registered scene type.
 * Adjustments are intentionally subtle to preserve natural scene aesthetics.
 */
data class SceneParameterProfile(
    val scene: SceneCategory,
    val baseExposureEvDelta: Float,
    val highlightProtectedEvDelta: Float? = null,
    val lowLightLiftEvDelta: Float? = null,
    val whiteBalanceKelvin: Int,
    val targetIso: Int,
    val focusMode: String,
    val preferredFocusDistanceDiopters: Float? = null,
    val rationale: String
)

/**
 * Hardware-validated parameter mapping ready for Camera2Interop / CameraX binding.
 */
data class HardwareMappedParameters(
    val scene: SceneCategory,
    val confidence: Float,
    val targetIso: Int?,
    val exposureEvDelta: Float?,
    val exposureCompSteps: Int?,
    val whiteBalanceKelvin: Int?,
    val focusMode: String?,
    val focusDistanceDiopters: Float?,
    val skippedUnsupported: List<String>,
    val rationale: String
)

/**
 * Central scene-to-parameter registry and hardware-gated optimizer in the `ai-core` module.
 * Registers common scene types (Portrait, Landscape, Night, Food, plus Sunset, Architecture,
 * Street, Close-up) and maps detected scenes to hardware-supported Camera2 adjustments
 * (ISO, exposure compensation, white balance, and focus).
 */
class AiSceneOptimizer {

    private val sceneRegistry: MutableMap<SceneCategory, SceneParameterProfile> = linkedMapOf()

    init {
        registerDefaultScenes()
    }

    private fun registerDefaultScenes() {
        registerScene(
            SceneParameterProfile(
                scene = SceneCategory.PORTRAIT,
                baseExposureEvDelta = 0.0f,
                lowLightLiftEvDelta = 0.2f,
                whiteBalanceKelvin = 5350,
                targetIso = 160,
                focusMode = "CONTINUOUS_SUBJECT",
                rationale = "Preserves natural skin luminosity at 5350K with subtle shadow lift in dim interiors."
            )
        )
        registerScene(
            SceneParameterProfile(
                scene = SceneCategory.LANDSCAPE,
                baseExposureEvDelta = -0.1f,
                highlightProtectedEvDelta = -0.3f,
                whiteBalanceKelvin = 5600,
                targetIso = 100,
                focusMode = "HYPERFOCAL_INFINITY",
                preferredFocusDistanceDiopters = 0.05f,
                rationale = "Protects bright sky gradients (-0.1 to -0.3 EV) while maximizing base-ISO detail."
            )
        )
        registerScene(
            SceneParameterProfile(
                scene = SceneCategory.NIGHT,
                baseExposureEvDelta = 0.3f,
                whiteBalanceKelvin = 4500,
                targetIso = 640,
                focusMode = "LOW_LIGHT_CONTRAST_AF",
                rationale = "Controlled +0.3 EV lift and ISO 640 cap preserve night atmosphere without blowing out lights."
            )
        )
        registerScene(
            SceneParameterProfile(
                scene = SceneCategory.FOOD,
                baseExposureEvDelta = 0.2f,
                whiteBalanceKelvin = 5150,
                targetIso = 200,
                focusMode = "MACRO_PRIORITY",
                preferredFocusDistanceDiopters = 3.2f,
                rationale = "Gentle +0.2 EV lift and appetizing 5150K tone with close-plane focus priority."
            )
        )
        registerScene(
            SceneParameterProfile(
                scene = SceneCategory.SUNSET,
                baseExposureEvDelta = -0.4f,
                whiteBalanceKelvin = 5900,
                targetIso = 100,
                focusMode = "HYPERFOCAL_INFINITY",
                preferredFocusDistanceDiopters = 0.05f,
                rationale = "Retains solar highlight headroom (-0.4 EV) and warm 5900K dusk coloration."
            )
        )
        registerScene(
            SceneCategory.ARCHITECTURE,
            SceneParameterProfile(
                scene = SceneCategory.ARCHITECTURE,
                baseExposureEvDelta = -0.1f,
                whiteBalanceKelvin = 5400,
                targetIso = 100,
                focusMode = "HYPERFOCAL_INFINITY",
                preferredFocusDistanceDiopters = 0.05f,
                rationale = "Neutral 5400K balance and clean micro-contrast exposure for structural geometry."
            )
        )
        registerScene(
            SceneParameterProfile(
                scene = SceneCategory.STREET,
                baseExposureEvDelta = -0.2f,
                whiteBalanceKelvin = 5200,
                targetIso = 250,
                focusMode = "CONTINUOUS_SUBJECT",
                rationale = "Fast continuous AF tracking with -0.2 EV highlight safety for candid street contrast."
            )
        )
        registerScene(
            SceneParameterProfile(
                scene = SceneCategory.CLOSE_UP,
                baseExposureEvDelta = 0.1f,
                whiteBalanceKelvin = 5300,
                targetIso = 200,
                focusMode = "MACRO_PRIORITY",
                preferredFocusDistanceDiopters = 4.0f,
                rationale = "Close-plane focus priority with neutral texture exposure to avoid specular clipping."
            )
        )
    }

    fun registerScene(profile: SceneParameterProfile) {
        sceneRegistry[profile.scene] = profile
    }

    private fun registerScene(category: SceneCategory, profile: SceneParameterProfile) {
        sceneRegistry[category] = profile
    }

    fun getRegisteredScenes(): Set<SceneCategory> = sceneRegistry.keys.toSet()

    fun getProfile(scene: SceneCategory): SceneParameterProfile? = sceneRegistry[scene]

    /**
     * Maps a detected scene to hardware-supported Camera2 parameters using [capabilities].
     */
    fun resolveHardwareAdjustments(
        scene: SceneCategory,
        confidence: Float,
        capabilities: CameraCapabilityReport,
        meanLuma: Float = 128f,
        highlightClipPct: Float = 0f
    ): HardwareMappedParameters {
        val profile = sceneRegistry[scene] ?: sceneRegistry.getValue(SceneCategory.STREET)
        val skipped = mutableListOf<String>()

        val desiredEv = when {
            profile.highlightProtectedEvDelta != null && highlightClipPct > 2.5f -> profile.highlightProtectedEvDelta
            profile.lowLightLiftEvDelta != null && meanLuma < 95f -> profile.lowLightLiftEvDelta
            else -> profile.baseExposureEvDelta
        }

        // 1. Exposure Compensation gated by CONTROL_AE_COMPENSATION_RANGE
        var mappedEvDelta: Float? = null
        var mappedEvSteps: Int? = null
        if (capabilities.evStepRange != null && capabilities.evStepFraction > 0f) {
            val rawSteps = (desiredEv / capabilities.evStepFraction).roundToInt()
            val clampedSteps = rawSteps.coerceIn(capabilities.evStepRange.first, capabilities.evStepRange.last)
            mappedEvSteps = clampedSteps
            mappedEvDelta = clampedSteps * capabilities.evStepFraction
        } else {
            skipped += "Exposure Compensation (CONTROL_AE_COMPENSATION_RANGE unavailable)"
        }

        // 2. ISO gated by SENSOR_INFO_SENSITIVITY_RANGE (MANUAL_SENSOR)
        val mappedIso: Int? = if (capabilities.isoRange != null) {
            profile.targetIso.coerceIn(capabilities.isoRange.first, capabilities.isoRange.last)
        } else {
            skipped += "ISO Control (MANUAL_SENSOR capability unavailable)"
            null
        }

        // 3. White Balance Kelvin gated by CONTROL_AWB_MODE_OFF
        val mappedWb: Int? = if (capabilities.supportsManualWb) {
            profile.whiteBalanceKelvin
        } else {
            skipped += "White Balance Kelvin (CONTROL_AWB_MODE_OFF unsupported)"
            null
        }

        // 4. Focus Distance gated by LENS_INFO_MINIMUM_FOCUS_DISTANCE
        val mappedFocusDistance: Float? = if (
            profile.preferredFocusDistanceDiopters != null && capabilities.supportsManualFocus
        ) {
            val maxDiopters = capabilities.minFocusDistanceDiopters ?: 10f
            profile.preferredFocusDistanceDiopters.coerceIn(0f, maxDiopters)
        } else {
            if (profile.preferredFocusDistanceDiopters != null && !capabilities.supportsManualFocus) {
                skipped += "Manual Focus Distance (fixed-focus or unsupported lens)"
            }
            null
        }

        return HardwareMappedParameters(
            scene = scene,
            confidence = confidence,
            targetIso = mappedIso,
            exposureEvDelta = mappedEvDelta,
            exposureCompSteps = mappedEvSteps,
            whiteBalanceKelvin = mappedWb,
            focusMode = profile.focusMode,
            focusDistanceDiopters = mappedFocusDistance,
            skippedUnsupported = skipped,
            rationale = profile.rationale
        )
    }

    /**
     * Produces a complete scene-to-parameter lookup table filtered for the active camera hardware.
     */
    fun mapAllRegisteredScenes(capabilities: CameraCapabilityReport): Map<SceneCategory, HardwareMappedParameters> {
        return sceneRegistry.keys.associateWith { scene ->
            resolveHardwareAdjustments(
                scene = scene,
                confidence = 1.0f,
                capabilities = capabilities
            )
        }
    }

    fun toOptimizationAdjustment(mapped: HardwareMappedParameters): SceneOptimizationAdjustment {
        return SceneOptimizationAdjustment(
            scene = mapped.scene,
            confidence = mapped.confidence,
            exposureEvDelta = mapped.exposureEvDelta,
            whiteBalanceKelvin = mapped.whiteBalanceKelvin,
            targetIso = mapped.targetIso,
            focusMode = mapped.focusMode,
            skippedUnsupported = mapped.skippedUnsupported,
            rationale = mapped.rationale
        )
    }
}
