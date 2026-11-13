package com.novacam.ai.ai

import com.novacam.ai.domain.CameraCapabilityReport
import com.novacam.ai.domain.SceneCategory
import com.novacam.ai.domain.SceneOptimizationAdjustment

/**
 * Coordinates live scene telemetry with [AiSceneOptimizer] to produce
 * hardware-constrained camera parameter adjustments.
 */
class SceneOptimizationEngine(
    private val optimizer: AiSceneOptimizer = AiSceneOptimizer()
) {

    fun buildSubtleOptimization(
        scene: SceneCategory,
        confidence: Float,
        meanLuma: Float,
        highlightClipPct: Float,
        caps: CameraCapabilityReport
    ): SceneOptimizationAdjustment {
        val mapped = optimizer.resolveHardwareAdjustments(
            scene = scene,
            confidence = confidence,
            capabilities = caps,
            meanLuma = meanLuma,
            highlightClipPct = highlightClipPct
        )
        return optimizer.toOptimizationAdjustment(mapped)
    }
}
