package com.novacam.ai.videohdr

import com.novacam.ai.domain.CameraCapabilityReport

enum class HdrRecordingMode {
    SDR_8BIT, HDR10, HDR10_PLUS, HLG10
}

/**
 * Only exposes HDR10 / HDR10+ / HLG when CameraCharacteristics DynamicRangeProfiles genuinely reports support.
 */
object HdrProfileDetector {
    fun availableModes(report: CameraCapabilityReport): List<HdrRecordingMode> {
        val list = mutableListOf(HdrRecordingMode.SDR_8BIT)
        if (report.supportedHdrProfiles.contains("HLG10")) list += HdrRecordingMode.HLG10
        if (report.supportedHdrProfiles.contains("HDR10")) list += HdrRecordingMode.HDR10
        if (report.supportedHdrProfiles.contains("HDR10+")) list += HdrRecordingMode.HDR10_PLUS
        return list
    }
}
