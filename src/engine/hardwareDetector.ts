import { HardwareCapabilities, LensId, RangeCapability, SceneOptimizationPlan } from '../types/nova';

export interface Xiaomi17TLensSpec {
  id: LensId;
  zoomLabel: string;
  marketingName: string;
  expectedSensor: string;
  focalLengthMm: string;
  aperture: string;
  oisExpected: boolean;
  fovNote: string;
  apiExposureStatus: 'UNVERIFIED_WEB_RUNTIME' | 'CAMERA2_PHYSICAL_ID_TARGET';
}

export const XIAOMI_17T_REFERENCE_LENSES: Xiaomi17TLensSpec[] = [
  {
    id: 'ultrawide',
    zoomLabel: '0.6×',
    marketingName: 'Ultra-Wide',
    expectedSensor: '12 MP CMOS',
    focalLengthMm: '15 mm eq.',
    aperture: 'f/2.2',
    oisExpected: false,
    fovNote: '120° FOV',
    apiExposureStatus: 'CAMERA2_PHYSICAL_ID_TARGET',
  },
  {
    id: 'main',
    zoomLabel: '1×',
    marketingName: 'Main Wide',
    expectedSensor: '50 MP Light Fusion 800',
    focalLengthMm: '23 mm eq.',
    aperture: 'f/1.7',
    oisExpected: true,
    fovNote: 'Primary OIS',
    apiExposureStatus: 'CAMERA2_PHYSICAL_ID_TARGET',
  },
  {
    id: 'telephoto',
    zoomLabel: '5×',
    marketingName: 'Telephoto',
    expectedSensor: '50 MP Telephoto',
    focalLengthMm: '115 mm eq.',
    aperture: 'f/3.0',
    oisExpected: true,
    fovNote: '5× Optical',
    apiExposureStatus: 'CAMERA2_PHYSICAL_ID_TARGET',
  },
  {
    id: 'front',
    zoomLabel: 'Front',
    marketingName: 'Front Selfie',
    expectedSensor: '32 MP Front',
    focalLengthMm: '24 mm eq.',
    aperture: 'f/2.0',
    oisExpected: false,
    fovNote: 'Portrait Front',
    apiExposureStatus: 'CAMERA2_PHYSICAL_ID_TARGET',
  },
];

const UNSUPPORTED_RANGE: RangeCapability = { supported: false, min: 0, max: 0, step: 1 };

function toRange(raw?: { min?: number; max?: number; step?: number }): RangeCapability {
  if (!raw || typeof raw.min !== 'number' || typeof raw.max !== 'number') {
    return UNSUPPORTED_RANGE;
  }
  return {
    supported: raw.max > raw.min,
    min: raw.min,
    max: raw.max,
    step: typeof raw.step === 'number' && raw.step > 0 ? raw.step : (raw.max - raw.min) / 20,
  };
}

/**
 * Inspects actual browser MediaDevices & MediaStreamTrack.getCapabilities().
 * Never fakes or advertises unsupported hardware controls on live tracks.
 */
export async function probeRuntimeCameraCapabilities(
  stream: MediaStream | null,
  sourceType: 'live_camera' | 'sample_scene' | 'uploaded_media'
): Promise<HardwareCapabilities> {
  let videoInputs: { deviceId: string; label: string }[] = [];
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      videoInputs = all
        .filter((d) => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera Input ${idx + 1}`,
        }));
    } catch {
      videoInputs = [];
    }
  }

  if (!stream || sourceType !== 'live_camera') {
    // Non-live reference studio preview mode: explicitly report software non-destructive grading controls only
    return {
      sourceType,
      deviceLabel:
        sourceType === 'sample_scene'
          ? 'Reference Scene Viewfinder (Software Grading Only)'
          : 'Imported Image Viewfinder (Software Grading Only)',
      deviceId: null,
      availableVideoInputs: videoInputs,
      supportsIso: false,
      isoRange: UNSUPPORTED_RANGE,
      supportsExposureComp: true, // non-destructive software EV trim supported in studio preview
      evRange: { supported: true, min: -2, max: 2, step: 0.1 },
      supportsFocusMode: false,
      focusModes: [],
      supportsFocusDistance: false,
      focusDistanceRange: UNSUPPORTED_RANGE,
      supportsWhiteBalance: true, // non-destructive software Kelvin preview
      wbModes: ['auto', 'manual'],
      supportsColorTemp: true,
      wbKelvinRange: { supported: true, min: 3200, max: 7000, step: 100 },
      supportsZoom: true,
      zoomRange: { supported: true, min: 1, max: 5, step: 0.1 },
      supportsTorch: false,
      maxWidth: 1600,
      maxHeight: 1200,
      supportedFrameRates: [24, 30],
      hdrProfile: 'SDR_ONLY_WEB',
      rawCaptureSupported: false,
      heifCaptureSupported: false,
      oisReported: false,
    };
  }

  const videoTrack = stream.getVideoTracks()[0];
  const settings = videoTrack?.getSettings?.() ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caps: Record<string, any> = typeof videoTrack?.getCapabilities === 'function' ? videoTrack.getCapabilities() : {};

  const isoRange = toRange(caps.iso);
  const evRange = toRange(caps.exposureCompensation);
  const focusDistanceRange = toRange(caps.focusDistance);
  const wbKelvinRange = toRange(caps.colorTemperature);
  const zoomRange = toRange(caps.zoom);
  const focusModes: string[] = Array.isArray(caps.focusMode) ? caps.focusMode : [];
  const wbModes: string[] = Array.isArray(caps.whiteBalanceMode) ? caps.whiteBalanceMode : [];

  const maxW = typeof caps.width?.max === 'number' ? caps.width.max : settings.width || 1920;
  const maxH = typeof caps.height?.max === 'number' ? caps.height.max : settings.height || 1080;
  const maxFps = typeof caps.frameRate?.max === 'number' ? caps.frameRate.max : 30;
  const frameRates = [24, 30, 60].filter((f) => f <= maxFps + 1);

  return {
    sourceType: 'live_camera',
    deviceLabel: videoTrack?.label || 'Active WebRTC Camera',
    deviceId: settings.deviceId ?? null,
    availableVideoInputs: videoInputs,
    supportsIso: isoRange.supported,
    isoRange,
    supportsExposureComp: evRange.supported,
    evRange,
    supportsFocusMode: focusModes.length > 0,
    focusModes,
    supportsFocusDistance: focusDistanceRange.supported,
    focusDistanceRange,
    supportsWhiteBalance: wbModes.length > 0,
    wbModes,
    supportsColorTemp: wbKelvinRange.supported,
    wbKelvinRange,
    supportsZoom: zoomRange.supported,
    zoomRange,
    supportsTorch: caps.torch === true,
    maxWidth: maxW,
    maxHeight: maxH,
    supportedFrameRates: frameRates.length > 0 ? frameRates : [30],
    hdrProfile: 'SDR_ONLY_WEB',
    rawCaptureSupported: false, // Browsers do not expose Camera2 RAW_SENSOR DNG
    heifCaptureSupported: false,
    oisReported: false, // Web MediaTrackCapabilities does not expose OIS hardware flag
  };
}

/**
 * Integrates AI Scene Optimization strictly with probed hardware capabilities.
 * Any parameter not supported by the active camera track is omitted and recorded in skippedUnsupported.
 */
export function constrainOptimizationToHardware(
  plan: SceneOptimizationPlan,
  caps: HardwareCapabilities
): SceneOptimizationPlan {
  const skipped: string[] = [];
  const adjusted = { ...plan.adjustments };

  if (adjusted.exposureDeltaEv !== null) {
    if (!caps.supportsExposureComp) {
      skipped.push('Exposure Compensation (not exposed by active camera track)');
      adjusted.exposureDeltaEv = null;
    } else {
      adjusted.exposureDeltaEv = Math.max(
        caps.evRange.min,
        Math.min(caps.evRange.max, Number(adjusted.exposureDeltaEv.toFixed(2)))
      );
    }
  }

  if (adjusted.whiteBalanceKelvin !== null) {
    if (!caps.supportsColorTemp) {
      skipped.push('Manual Kelvin White Balance (not exposed by active camera track)');
      adjusted.whiteBalanceKelvin = null;
    } else {
      adjusted.whiteBalanceKelvin = Math.round(
        Math.max(caps.wbKelvinRange.min, Math.min(caps.wbKelvinRange.max, adjusted.whiteBalanceKelvin))
      );
    }
  }

  if (adjusted.isoTarget !== null) {
    if (!caps.supportsIso) {
      skipped.push('ISO Control (not exposed by active camera track)');
      adjusted.isoTarget = null;
    } else {
      adjusted.isoTarget = Math.round(
        Math.max(caps.isoRange.min, Math.min(caps.isoRange.max, adjusted.isoTarget))
      );
    }
  }

  if (adjusted.focusMode !== null && !caps.supportsFocusMode && caps.sourceType === 'live_camera') {
    skipped.push('Focus Mode (hardware AF mode lock not exposed)');
    adjusted.focusMode = null;
  }

  return {
    ...plan,
    adjustments: adjusted,
    skippedUnsupported: skipped,
  };
}
