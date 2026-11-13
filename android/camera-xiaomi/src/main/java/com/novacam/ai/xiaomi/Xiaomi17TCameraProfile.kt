package com.novacam.ai.xiaomi

import com.novacam.ai.domain.CameraCapabilityReport
import com.novacam.ai.domain.LensRole

/**
 * Resolves Xiaomi 17T physical/logical lenses strictly from probed Camera2 CameraCapabilityReport entries.
 * Falls back to logical camera zoom ratios if physical sub-IDs are hidden from third-party apps.
 */
object Xiaomi17TCameraProfile {

    data class ResolvedLensSet(
        val ultraWide: CameraCapabilityReport?,
        val mainWide: CameraCapabilityReport?,
        val telephoto: CameraCapabilityReport?,
        val front: CameraCapabilityReport?
    )

    fun resolveFromProbe(probed: List<CameraCapabilityReport>): ResolvedLensSet {
        return ResolvedLensSet(
            ultraWide = probed.firstOrNull { it.lensRole == LensRole.ULTRA_WIDE },
            mainWide = probed.firstOrNull { it.lensRole == LensRole.MAIN },
            telephoto = probed.firstOrNull { it.lensRole == LensRole.TELEPHOTO },
            front = probed.firstOrNull { it.lensRole == LensRole.FRONT }
        )
    }
}
