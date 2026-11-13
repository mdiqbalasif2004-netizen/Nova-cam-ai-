package com.novacam.ai.cameracore

import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.hardware.camera2.params.DynamicRangeProfiles
import android.os.Build
import com.novacam.ai.domain.CameraCapabilityReport
import com.novacam.ai.domain.LensRole

/**
 * Inspects real device camera capabilities via Android Camera2 CameraCharacteristics.
 * Never fabricates or enables unsupported controls.
 */
class HardwareCapabilityManager(context: Context) {

    private val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager

    fun probeAllCameras(): List<CameraCapabilityReport> {
        val reports = mutableListOf<CameraCapabilityReport>()
        val ids = runCatching { cameraManager.cameraIdList }.getOrDefault(emptyArray())
        for (id in ids) {
            val chars = runCatching { cameraManager.getCameraCharacteristics(id) }.getOrNull() ?: continue
            val facing = chars.get(CameraCharacteristics.LENS_FACING)
            val physicalIds = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                chars.physicalCameraIds
            } else {
                emptySet()
            }

            if (physicalIds.isNotEmpty() && facing == CameraCharacteristics.LENS_FACING_BACK) {
                var addedPhysical = false
                for (physId in physicalIds) {
                    val physChars = runCatching { cameraManager.getCameraCharacteristics(physId) }.getOrNull()
                    if (physChars != null) {
                        reports += buildReport(id, physId, physChars, isFront = false)
                        addedPhysical = true
                    }
                }
                if (!addedPhysical) {
                    reports += buildReport(id, null, chars, isFront = false)
                }
            } else {
                reports += buildReport(id, null, chars, isFront = facing == CameraCharacteristics.LENS_FACING_FRONT)
            }
        }
        return reports
    }

    private fun buildReport(
        logicalId: String,
        physicalId: String?,
        chars: CameraCharacteristics,
        isFront: Boolean
    ): CameraCapabilityReport {
        val focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
        val primaryFocal = focalLengths?.firstOrNull() ?: 4.7f
        val apertures = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES)
        val primaryAperture = apertures?.firstOrNull() ?: 1.8f

        val role = when {
            isFront -> LensRole.FRONT
            primaryFocal < 3.0f -> LensRole.ULTRA_WIDE
            primaryFocal > 12.0f -> LensRole.TELEPHOTO
            else -> LensRole.MAIN
        }

        val caps = chars.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES) ?: IntArray(0)
        val hasManualSensor = caps.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR)
        val hasRaw = caps.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_RAW)

        val isoRange = if (hasManualSensor) {
            chars.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE)?.let { it.lower..it.upper }
        } else null

        val exposureRange = if (hasManualSensor) {
            chars.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE)?.let { it.lower..it.upper }
        } else null

        val evCompRange = chars.get(CameraCharacteristics.CONTROL_AE_COMPENSATION_RANGE)?.let { it.lower..it.upper }
        val evStep = chars.get(CameraCharacteristics.CONTROL_AE_COMPENSATION_STEP)?.toFloat() ?: 0.33f

        val minFocus = chars.get(CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE)
        val oisModes = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION) ?: IntArray(0)
        val supportsOis = oisModes.contains(CameraCharacteristics.LENS_OPTICAL_STABILIZATION_MODE_ON)

        val hdrProfiles = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val drp = chars.get(CameraCharacteristics.REQUEST_AVAILABLE_DYNAMIC_RANGE_PROFILES)
            val supported = drp?.supportedProfiles ?: emptySet()
            if (supported.contains(DynamicRangeProfiles.HDR10)) hdrProfiles += "HDR10"
            if (supported.contains(DynamicRangeProfiles.HDR10_PLUS)) hdrProfiles += "HDR10+"
            if (supported.contains(DynamicRangeProfiles.HLG10)) hdrProfiles += "HLG10"
        }

        val streamMap = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        val photoSizes = streamMap?.getOutputSizes(ImageFormat.JPEG)
            ?.map { it.width to it.height }
            ?.sortedByDescending { it.first * it.second }
            ?: emptyList()

        val fpsRanges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
            ?.map { it.upper }
            ?.distinct()
            ?.sorted()
            ?: listOf(30)

        val awbModes = chars.get(CameraCharacteristics.CONTROL_AWB_AVAILABLE_MODES) ?: IntArray(0)
        val hasFlash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true

        return CameraCapabilityReport(
            cameraId = logicalId,
            physicalId = physicalId,
            lensRole = role,
            focalLengthMm = primaryFocal,
            aperture = primaryAperture,
            isoRange = isoRange,
            exposureNsRange = exposureRange,
            evStepRange = evCompRange,
            evStepFraction = evStep,
            minFocusDistanceDiopters = minFocus,
            supportsManualFocus = (minFocus ?: 0f) > 0f,
            supportsManualWb = awbModes.contains(CameraCharacteristics.CONTROL_AWB_MODE_OFF),
            supportsRawDng = hasRaw,
            supportsOis = supportsOis,
            supportedHdrProfiles = hdrProfiles,
            supportedPhotoSizes = photoSizes,
            supportedVideoFps = fpsRanges,
            hasFlashUnit = hasFlash
        )
    }
}
