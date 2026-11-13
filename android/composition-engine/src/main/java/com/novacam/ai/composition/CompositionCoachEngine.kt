package com.novacam.ai.composition

import com.novacam.ai.domain.LensRole
import com.novacam.ai.domain.SceneCategory
import kotlin.math.abs

data class LiveCoachAdvice(
    val scene: SceneCategory,
    val primaryInstruction: String,
    val secondaryTips: List<String>,
    val recommendedLens: LensRole,
    val horizonTiltDeg: Float
)

/**
 * Generates actionable pre-shutter composition guidance only when a meaningful improvement exists.
 */
class CompositionCoachEngine {
    fun evaluateFrame(
        scene: SceneCategory,
        horizonTiltDeg: Float,
        highlightClipPct: Float,
        subjectOffsetFromCenterX: Float,
        backgroundClutterScore: Float
    ): LiveCoachAdvice {
        val tips = mutableListOf<String>()

        if (abs(horizonTiltDeg) >= 1.8f) {
            val dir = if (horizonTiltDeg > 0f) "counter-clockwise" else "clockwise"
            tips += "Level horizon slightly $dir (${"%.1f".format(abs(horizonTiltDeg))}° tilt)."
        }

        if (highlightClipPct > 4.2f) {
            tips += "Highlights clipping (${"%.1f".format(highlightClipPct)}%) — reduce EV slightly."
        }

        val recommendedLens = when {
            scene == SceneCategory.PORTRAIT && backgroundClutterScore > 0.48f -> {
                tips += "Busy background — switch to 5× telephoto or step closer for separation."
                LensRole.TELEPHOTO
            }
            scene == SceneCategory.LANDSCAPE || scene == SceneCategory.ARCHITECTURE -> LensRole.ULTRA_WIDE
            else -> LensRole.MAIN
        }

        if (scene == SceneCategory.PORTRAIT && abs(subjectOffsetFromCenterX) < 0.05f && backgroundClutterScore > 0.35f) {
            tips += "Shift subject slightly toward left or right rule-of-thirds line."
        }

        val primary = tips.firstOrNull()
            ?: "${scene.name.lowercase().replaceFirstChar { it.uppercase() }} framing & exposure balanced."

        return LiveCoachAdvice(
            scene = scene,
            primaryInstruction = primary,
            secondaryTips = tips.drop(1),
            recommendedLens = recommendedLens,
            horizonTiltDeg = horizonTiltDeg
        )
    }
}
