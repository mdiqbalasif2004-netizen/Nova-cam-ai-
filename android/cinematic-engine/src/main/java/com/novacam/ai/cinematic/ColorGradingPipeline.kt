package com.novacam.ai.cinematic

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint

enum class CinematicProfile(val displayName: String, val contrast: Float, val saturation: Float, val warmth: Float) {
    CINEMATIC("Cinematic", 1.14f, 1.03f, 5f),
    NATURAL_PRO("Natural Professional", 1.06f, 1.02f, 0f),
    WARM_CINEMA("Warm Cinema", 1.11f, 1.05f, 14f),
    COOL_CINEMA("Cool Cinema", 1.15f, 0.94f, -14f),
    VINTAGE_FILM("Vintage Film", 1.04f, 0.88f, 9f),
    MOODY("Moody", 1.22f, 0.84f, -5f),
    GOLDEN_HOUR("Golden Hour", 1.09f, 1.10f, 18f),
    SOFT_PORTRAIT("Soft Portrait", 1.02f, 0.97f, 6f),
    MONOCHROME("Monochrome", 1.24f, 0.0f, 0f),
    NEUTRAL("Neutral", 1.0f, 1.0f, 0f)
}

data class GradeAdjustments(
    val intensity: Float = 0.85f,
    val contrastDelta: Float = 0f,
    val saturationDelta: Float = 0f,
    val highlights: Float = 0f,
    val shadows: Float = 0f,
    val temperature: Float = 0f,
    val tint: Float = 0f,
    val sharpness: Float = 0.18f,
    val fade: Float = 0.06f,
    val vignette: Float = 0.22f
)

/**
 * Non-destructive cinematic grading pipeline. Always produces a new graded Bitmap
 * while preserving the untouched original sensor file.
 */
object ColorGradingPipeline {
    fun renderNonDestructive(source: Bitmap, profile: CinematicProfile, adj: GradeAdjustments): Bitmap {
        val out = Bitmap.createBitmap(source.width, source.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val matrix = ColorMatrix()

        val sat = (1f + (profile.saturation - 1f) * adj.intensity + adj.saturationDelta).coerceAtLeast(0f)
        matrix.setSaturation(sat)

        val c = (1f + (profile.contrast - 1f) * adj.intensity + adj.contrastDelta).coerceIn(0.6f, 1.6f)
        val translate = (1f - c) * 128f + (adj.fade * 22f)
        val warm = profile.warmth * adj.intensity + adj.temperature

        val contrastWarmMatrix = ColorMatrix(
            floatArrayOf(
                c, 0f, 0f, 0f, translate + warm,
                0f, c, 0f, 0f, translate + adj.tint * 0.5f,
                0f, 0f, c, 0f, translate - warm * 0.85f,
                0f, 0f, 0f, 1f, 0f
            )
        )
        matrix.postConcat(contrastWarmMatrix)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            colorFilter = ColorMatrixColorFilter(matrix)
        }
        canvas.drawBitmap(source, 0f, 0f, paint)
        return out
    }
}
