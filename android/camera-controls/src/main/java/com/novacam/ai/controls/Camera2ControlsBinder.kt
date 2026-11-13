package com.novacam.ai.controls

import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.params.RggbChannelVector
import androidx.annotation.OptIn
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.ExtendableBuilder
import com.novacam.ai.domain.CameraCapabilityReport

data class ManualCaptureParams(
    val iso: Int? = null,
    val exposureTimeNs: Long? = null,
    val evSteps: Int? = null,
    val focusDistanceDiopters: Float? = null,
    val whiteBalanceKelvin: Int? = null,
    val aeLocked: Boolean = false
)

object Camera2ControlsBinder {

    @OptIn(ExperimentalCamera2Interop::class)
    fun <T> applySupportedParams(
        builder: ExtendableBuilder<T>,
        params: ManualCaptureParams,
        caps: CameraCapabilityReport
    ) {
        val ext = Camera2Interop.Extender(builder)

        if (params.aeLocked) {
            ext.setCaptureRequestOption(CaptureRequest.CONTROL_AE_LOCK, true)
        }

        if (params.evSteps != null && caps.evStepRange != null) {
            val clamped = params.evSteps.coerceIn(caps.evStepRange.first, caps.evStepRange.last)
            ext.setCaptureRequestOption(CaptureRequest.CONTROL_AE_EXPOSURE_COMPENSATION, clamped)
        }

        if (params.iso != null && caps.isoRange != null) {
            val clampedIso = params.iso.coerceIn(caps.isoRange.first, caps.isoRange.last)
            ext.setCaptureRequestOption(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_OFF)
            ext.setCaptureRequestOption(CaptureRequest.SENSOR_SENSITIVITY, clampedIso)
            if (params.exposureTimeNs != null && caps.exposureNsRange != null) {
                val clampedExp = params.exposureTimeNs.coerceIn(caps.exposureNsRange.first, caps.exposureNsRange.last)
                ext.setCaptureRequestOption(CaptureRequest.SENSOR_EXPOSURE_TIME, clampedExp)
            }
        }

        if (params.focusDistanceDiopters != null && caps.supportsManualFocus) {
            val maxD = caps.minFocusDistanceDiopters ?: 10f
            ext.setCaptureRequestOption(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_OFF)
            ext.setCaptureRequestOption(CaptureRequest.LENS_FOCUS_DISTANCE, params.focusDistanceDiopters.coerceIn(0f, maxD))
        }

        if (params.whiteBalanceKelvin != null && caps.supportsManualWb) {
            ext.setCaptureRequestOption(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_OFF)
            ext.setCaptureRequestOption(
                CaptureRequest.COLOR_CORRECTION_MODE,
                CaptureRequest.COLOR_CORRECTION_MODE_TRANSFORM_MATRIX
            )
            ext.setCaptureRequestOption(
                CaptureRequest.COLOR_CORRECTION_GAINS,
                kelvinToRggbGains(params.whiteBalanceKelvin)
            )
        }
    }

    private fun kelvinToRggbGains(kelvin: Int): RggbChannelVector {
        val t = (kelvin.coerceIn(2800, 7500) - 5500f) / 2000f
        val red = (1.65f + t * 0.42f).coerceIn(1.0f, 2.6f)
        val blue = (1.65f - t * 0.42f).coerceIn(1.0f, 2.6f)
        return RggbChannelVector(red, 1.0f, 1.0f, blue)
    }
}
