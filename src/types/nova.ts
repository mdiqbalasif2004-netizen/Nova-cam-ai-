export type AppSection = 'photo' | 'video' | 'coach' | 'gallery' | 'settings';

export type SceneType =
  | 'portrait'
  | 'landscape'
  | 'night'
  | 'food'
  | 'sunset'
  | 'architecture'
  | 'street'
  | 'closeup';

export type LensId = 'ultrawide' | 'main' | 'telephoto' | 'front';

export type ColorProfileId =
  | 'cinematic'
  | 'natural_pro'
  | 'warm_cinema'
  | 'cool_cinema'
  | 'vintage_film'
  | 'moody'
  | 'golden_hour'
  | 'soft_portrait'
  | 'monochrome'
  | 'neutral';

export type VideoProfileId =
  | 'cinematic_natural'
  | 'warm_cinema'
  | 'cool_cinema'
  | 'film_inspired'
  | 'moody'
  | 'neutral';

export interface ColorAdjustments {
  intensity: number; // 0 to 100
  contrast: number; // -50 to +50
  saturation: number; // -50 to +50
  highlights: number; // -50 to +50
  shadows: number; // -50 to +50
  temperature: number; // -50 to +50
  tint: number; // -50 to +50
  sharpness: number; // 0 to 100
  fade: number; // 0 to 100
  vignette: number; // 0 to 100
}

export interface RangeCapability {
  supported: boolean;
  min: number;
  max: number;
  step: number;
}

export interface HardwareCapabilities {
  sourceType: 'live_camera' | 'sample_scene' | 'uploaded_media';
  deviceLabel: string;
  deviceId: string | null;
  availableVideoInputs: { deviceId: string; label: string }[];
  supportsIso: boolean;
  isoRange: RangeCapability;
  supportsExposureComp: boolean;
  evRange: RangeCapability;
  supportsFocusMode: boolean;
  focusModes: string[];
  supportsFocusDistance: boolean;
  focusDistanceRange: RangeCapability;
  supportsWhiteBalance: boolean;
  wbModes: string[];
  supportsColorTemp: boolean;
  wbKelvinRange: RangeCapability;
  supportsZoom: boolean;
  zoomRange: RangeCapability;
  supportsTorch: boolean;
  maxWidth: number;
  maxHeight: number;
  supportedFrameRates: number[];
  hdrProfile: 'SDR_ONLY_WEB' | 'HDR10' | 'HDR10_PLUS' | 'HLG';
  rawCaptureSupported: boolean;
  heifCaptureSupported: boolean;
  oisReported: boolean;
}

export interface ManualCameraSettings {
  mode: 'auto' | 'pro';
  activeLens: LensId;
  iso: number;
  shutterSpeed: string;
  ev: number;
  aeLocked: boolean;
  afLocked: boolean;
  focusMode: 'continuous' | 'single' | 'manual';
  focusDistance: number; // 0..1 normalized
  wbMode: 'auto' | 'manual';
  wbKelvin: number; // 2800..7500
  zoom: number;
  aspectRatio: '4:3' | '16:9' | '1:1';
  timerSeconds: 0 | 3 | 10;
  burstCount: 1 | 3 | 5;
  gridMode: 'thirds' | 'golden' | 'crosshair' | 'off';
  showHistogram: boolean;
  showLevel: boolean;
  format: 'JPEG' | 'PNG' | 'HEIF_ANDROID_ONLY' | 'RAW_DNG_ANDROID_ONLY';
  flashMode: 'off' | 'auto' | 'on';
  torch: boolean;
}

export interface VideoSettings {
  resolution: '4K' | '1080p';
  fps: 24 | 30 | 60;
  hdrMode: 'SDR' | 'HDR10_ANDROID' | 'HLG_ANDROID';
  stabilization: 'Standard' | 'Cinematic';
  micEnabled: boolean;
  selectedMicId: string | null;
  profile: VideoProfileId;
}

export interface SceneOptimizationPlan {
  scene: SceneType;
  confidence: number;
  appliedToHardware: boolean;
  adjustments: {
    exposureDeltaEv: number | null;
    whiteBalanceKelvin: number | null;
    isoTarget: number | null;
    focusMode: 'continuous' | 'macro' | 'infinity' | null;
  };
  skippedUnsupported: string[];
  rationale: string;
}

export interface OfflineAnalysisResult {
  timestamp: number;
  detectedScene: SceneType;
  confidence: number;
  meanLuminance: number; // 0..255
  highlightClipPct: number; // 0..100
  shadowCrushPct: number; // 0..100
  warmthBias: number; // -1..+1
  tiltDegrees: number;
  subjectCentroid: { x: number; y: number }; // normalized 0..1
  centerSharpness: number; // 0..100
  backgroundClutter: number; // 0..100
  histogram: number[]; // 64 bins normalized 0..1
  primaryAdvice: string | null;
  secondaryTips: string[];
  recommendedLens: LensId;
  optimization: SceneOptimizationPlan;
}

export interface OnlineCoachResult {
  source: string;
  detectedScene: string;
  confidence: number;
  primaryAdvice: string;
  secondaryTips: string[];
  framingDirection: string;
  recommendedLens: string;
  lightingAssessment?: string;
  backgroundAssessment?: string;
  optimization?: {
    exposureDeltaEv?: number;
    whiteBalanceKelvin?: number;
    isoSuggestion?: number;
    focusMode?: string;
    rationale?: string;
  };
}

export interface PhotoAnalysisResult {
  source: string;
  analyzedAt: string;
  overallFeedback: string;
  subjectiveIndicator: number;
  dimensions: {
    composition: string;
    subjectPositioning: string;
    lighting: string;
    exposure: string;
    sharpness: string;
    background: string;
    colourBalance: string;
    horizonAlignment: string;
    visualDistractions: string;
  };
  strengths: string[];
  improvements: string[];
  retakeSuggestions: string[];
}

export interface GalleryItem {
  id: string;
  mediaType: 'photo' | 'video';
  title: string;
  album: string;
  favorite: boolean;
  createdAt: string;
  originalDataUrl: string;
  gradedDataUrl: string;
  videoBlobUrl?: string;
  mimeType: string;
  width: number;
  height: number;
  exif: {
    cameraModel: string;
    lensLabel: string;
    focalLengthMm: string;
    aperture: string;
    iso: number;
    shutterSpeed: string;
    ev: number;
    wbKelvin: number;
    profileName: string;
    sceneDetected: SceneType;
    aiOptimized: boolean;
  };
  analysisHistory: PhotoAnalysisResult[];
}

export type AccentPresetId = 'violet' | 'ice_blue' | 'emerald' | 'amber' | 'rose' | 'white' | 'custom';

export interface ThemeSettings {
  darkMode: boolean;
  accentPreset: AccentPresetId;
  customAccentHex: string;
  glassBlurPx: number;
  glassOpacity: number;
}

export interface PrivacyAndAiSettings {
  autoCoachEnabled: boolean;
  autoSceneOptimizeEnabled: boolean;
  onlineAiConsent: boolean;
  offlineOnlyMode: boolean;
  saveAnalysisHistory: boolean;
}
