package com.novacam.ai.ai.offline

import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.novacam.ai.domain.SceneCategory
import java.util.concurrent.atomic.AtomicLong

/**
 * Battery-conscious throttled offline analyzer.
 * Runs ML Kit face/image labeling + Y-plane luminance statistics at most once every 750ms
 * on reduced-resolution analysis frames, completely decoupled from full-resolution capture.
 */
class OfflineVisionAnalyzer(
    private val onResult: (scene: SceneCategory, confidence: Float, meanLuma: Float, highlightClipPct: Float) -> Unit
) : ImageAnalysis.Analyzer {

    private val lastAnalyzedMs = AtomicLong(0L)
    private val labeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
    private val faceDetector = FaceDetection.getClient()

    @OptIn(ExperimentalGetImage::class)
    override fun analyze(imageProxy: ImageProxy) {
        val now = System.currentTimeMillis()
        if (now - lastAnalyzedMs.get() < 750L) {
            imageProxy.close()
            return
        }
        lastAnalyzedMs.set(now)

        val yPlane = imageProxy.planes[0].buffer
        var lumaSum = 0L
        var clipped = 0
        val count = yPlane.remaining()
        while (yPlane.hasRemaining()) {
            val v = yPlane.get().toInt() and 0xFF
            lumaSum += v
            if (v > 246) clipped++
        }
        val meanLuma = if (count > 0) lumaSum.toFloat() / count else 120f
        val clipPct = if (count > 0) (clipped.toFloat() / count) * 100f else 0f

        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        val input = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        faceDetector.process(input)
            .addOnSuccessListener { faces ->
                if (faces.isNotEmpty()) {
                    onResult(SceneCategory.PORTRAIT, 0.90f, meanLuma, clipPct)
                    imageProxy.close()
                } else {
                    labeler.process(input)
                        .addOnSuccessListener { labels ->
                            val top = labels.firstOrNull()?.text?.lowercase() ?: ""
                            val scene = when {
                                meanLuma < 65f -> SceneCategory.NIGHT
                                top.contains("food") || top.contains("dish") || top.contains("coffee") -> SceneCategory.FOOD
                                top.contains("sunset") || top.contains("dusk") -> SceneCategory.SUNSET
                                top.contains("building") || top.contains("architecture") -> SceneCategory.ARCHITECTURE
                                top.contains("mountain") || top.contains("sky") || top.contains("nature") -> SceneCategory.LANDSCAPE
                                else -> SceneCategory.STREET
                            }
                            onResult(scene, labels.firstOrNull()?.confidence ?: 0.72f, meanLuma, clipPct)
                        }
                        .addOnCompleteListener { imageProxy.close() }
                }
            }
            .addOnFailureListener { imageProxy.close() }
    }
}
