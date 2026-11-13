package com.novacam.ai.ai

import com.novacam.ai.domain.CameraCapabilityReport
import com.novacam.ai.domain.LensRole
import com.novacam.ai.domain.SceneCategory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AiSceneOptimizerTest {

    private val fullCaps = CameraCapabilityReport(
        cameraId = "0",
        physicalId = "2",
        lensRole = LensRole.MAIN,
        focalLengthMm = 23f,
        aperture = 1.7f,
        isoRange = 50..6400,
        exposureNsRange = 100_000L..1_000_000_000L,
        evStepRange = -12..12,
        evStepFraction = 0.25f,
        minFocusDistanceDiopters = 10f,
        supportsManualFocus = true,
        supportsManualWb = true,
        supportsRawDng = true,
        supportsOis = true,
        supportedHdrProfiles = listOf("HDR10"),
        supportedPhotoSizes = listOf(4096 to 3072),
        supportedVideoFps = listOf(30, 60),
        hasFlashUnit = true
    )

    private val restrictedCaps = fullCaps.copy(
        isoRange = null,
        supportsManualWb = false,
        supportsManualFocus = false
    )

    @Test
    fun registersCommonScenesAndMapsSupportedParams() {
        val optimizer = AiSceneOptimizer()
        val registered = optimizer.getRegisteredScenes()
        assertTrue(registered.contains(SceneCategory.PORTRAIT))
        assertTrue(registered.contains(SceneCategory.LANDSCAPE))
        assertTrue(registered.contains(SceneCategory.NIGHT))
        assertTrue(registered.contains(SceneCategory.FOOD))

        val night = optimizer.resolveHardwareAdjustments(SceneCategory.NIGHT, 0.91f, fullCaps)
        assertNotNull(night.targetIso)
        assertNotNull(night.exposureEvDelta)
        assertNotNull(night.whiteBalanceKelvin)
        assertTrue(night.skippedUnsupported.isEmpty())
    }

    @Test
    fun skipsUnsupportedControlsGracefully() {
        val optimizer = AiSceneOptimizer()
        val food = optimizer.resolveHardwareAdjustments(SceneCategory.FOOD, 0.88f, restrictedCaps)
        assertNull(food.targetIso)
        assertNull(food.whiteBalanceKelvin)
        assertNull(food.focusDistanceDiopters)
        assertEquals(3, food.skippedUnsupported.size)
        assertNotNull(food.exposureEvDelta)
    }
}
