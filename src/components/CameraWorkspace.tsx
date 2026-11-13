import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Flashlight,
  Grid3X3,
  Image as ImageIcon,
  Lock,
  Mic,
  MicOff,
  RotateCcw,
  Sliders,
  Sparkles,
  Square,
  Timer,
  Upload,
  Video,
  Wand2,
} from 'lucide-react';
import {
  ColorAdjustments,
  ColorProfileId,
  GalleryItem,
  HardwareCapabilities,
  LensId,
  ManualCameraSettings,
  OfflineAnalysisResult,
  OnlineCoachResult,
  PrivacyAndAiSettings,
  VideoSettings,
} from '../types/nova';
import {
  applyColorGradingToCanvas,
  buildCssFilterPreview,
  getProfileById,
  PHOTO_COLOR_PROFILES,
  VIDEO_COLOR_PROFILES,
} from '../engine/colorProfiles';
import { probeRuntimeCameraCapabilities, XIAOMI_17T_REFERENCE_LENSES } from '../engine/hardwareDetector';
import { analyzeFrameOffline, capitalizeScene } from '../engine/offlineAiEngine';
import { SAMPLE_SCENES } from '../engine/sampleScenes';
import { LiquidGlassPanel, LiveHistogram } from './LiquidGlass';

interface CameraWorkspaceProps {
  mode: 'photo' | 'video';
  onModeChange: (mode: 'photo' | 'video') => void;
  onOpenGallery: () => void;
  latestGalleryItem?: GalleryItem;
  onCaptureSaved: (item: GalleryItem) => Promise<void>;
  privacy: PrivacyAndAiSettings;
  onUpdatePrivacy: (next: PrivacyAndAiSettings) => void;
  capabilities: HardwareCapabilities;
  onCapabilitiesChange: (caps: HardwareCapabilities) => void;
  offlineAnalysis: OfflineAnalysisResult | null;
  onOfflineAnalysisChange: (res: OfflineAnalysisResult | null) => void;
  onlineCoach: OnlineCoachResult | null;
  onOnlineCoachChange: (res: OnlineCoachResult | null) => void;
}

const SHUTTER_SPEEDS = ['1/4000s', '1/1000s', '1/500s', '1/250s', '1/125s', '1/60s', '1/30s', '1/15s'];

export function CameraWorkspace({
  mode,
  onModeChange,
  onOpenGallery,
  latestGalleryItem,
  onCaptureSaved,
  privacy,
  onUpdatePrivacy,
  capabilities,
  onCapabilitiesChange,
  offlineAnalysis,
  onOfflineAnalysisChange,
  onlineCoach,
  onOnlineCoachChange,
}: CameraWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampleImgRef = useRef<HTMLImageElement | null>(null);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [sourceMode, setSourceMode] = useState<'sample' | 'live' | 'upload'>('sample');
  const [selectedSampleIdx, setSelectedSampleIdx] = useState(0);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);

  const [selectedProfile, setSelectedProfile] = useState<ColorProfileId>('cinematic');
  const [colorAdj, setColorAdj] = useState<ColorAdjustments>(() => getProfileById('cinematic').defaults);

  const [manual, setManual] = useState<ManualCameraSettings>({
    mode: 'auto',
    activeLens: 'main',
    iso: 100,
    shutterSpeed: '1/250s',
    ev: 0,
    aeLocked: false,
    afLocked: false,
    focusMode: 'continuous',
    focusDistance: 0.5,
    wbMode: 'auto',
    wbKelvin: 5500,
    zoom: 1,
    aspectRatio: '4:3',
    timerSeconds: 0,
    burstCount: 1,
    gridMode: 'thirds',
    showHistogram: true,
    showLevel: true,
    format: 'JPEG',
    flashMode: 'auto',
    torch: false,
  });

  const [videoCfg, setVideoCfg] = useState<VideoSettings>({
    resolution: '1080p',
    fps: 30,
    hdrMode: 'SDR',
    stabilization: 'Cinematic',
    micEnabled: true,
    selectedMicId: null,
    profile: 'cinematic_natural',
  });

  const [activeDrawer, setActiveDrawer] = useState<'none' | 'color' | 'pro'>('none');
  const [focusReticle, setFocusReticle] = useState<{ x: number; y: number; locked: boolean } | null>(null);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [flashPulse, setFlashPulse] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [coachExpanded, setCoachExpanded] = useState(true);

  const activeSample = SAMPLE_SCENES[selectedSampleIdx];
  const activeLensSpec = XIAOMI_17T_REFERENCE_LENSES.find((l) => l.id === manual.activeLens) ?? XIAOMI_17T_REFERENCE_LENSES[1];

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startLiveCamera = useCallback(
    async (facing: 'environment' | 'user' = 'environment', deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Browser camera API is unavailable in this context. Using Reference Studio Viewfinder.');
        setSourceMode('sample');
        return;
      }
      setCameraStarting(true);
      setCameraError(null);
      stopStream();
      try {
        const videoConstraint: MediaTrackConstraints = deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: mode === 'video' && videoCfg.micEnabled,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setSourceMode('live');
        const caps = await probeRuntimeCameraCapabilities(stream, 'live_camera');
        onCapabilitiesChange(caps);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Camera permission denied or no physical camera found. Reference scenes remain active.';
        setCameraError(msg);
        setSourceMode('sample');
        const fallbackCaps = await probeRuntimeCameraCapabilities(null, 'sample_scene');
        onCapabilitiesChange(fallbackCaps);
      } finally {
        setCameraStarting(false);
      }
    },
    [mode, onCapabilitiesChange, stopStream, videoCfg.micEnabled]
  );

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // Probe capabilities when switching to sample or upload mode
  useEffect(() => {
    if (sourceMode !== 'live') {
      probeRuntimeCameraCapabilities(null, sourceMode === 'upload' ? 'uploaded_media' : 'sample_scene').then(
        onCapabilitiesChange
      );
    }
  }, [sourceMode, onCapabilitiesChange]);

  // Sync video profile selection to underlying color grading profile
  const effectiveColorProfile: ColorProfileId = useMemo(() => {
    if (mode === 'video') {
      const vp = VIDEO_COLOR_PROFILES.find((v) => v.id === videoCfg.profile);
      return vp ? vp.mappedPhotoProfile : 'cinematic';
    }
    return selectedProfile;
  }, [mode, videoCfg.profile, selectedProfile]);

  const handleSelectPhotoProfile = (id: ColorProfileId) => {
    setSelectedProfile(id);
    setColorAdj(getProfileById(id).defaults);
  };

  const handleSelectVideoProfile = (id: VideoSettings['profile']) => {
    setVideoCfg((prev) => ({ ...prev, profile: id }));
    const mapped = VIDEO_COLOR_PROFILES.find((v) => v.id === id)?.mappedPhotoProfile ?? 'cinematic';
    setColorAdj(getProfileById(mapped).defaults);
  };

  // Apply real MediaStreamTrack constraints when supported and modified
  const applyTrackConstraint = useCallback(
    async (patch: Partial<ManualCameraSettings>) => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || sourceMode !== 'live') return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const advanced: Record<string, any> = {};

      if (patch.ev !== undefined && capabilities.supportsExposureComp) {
        advanced.exposureCompensation = Math.max(
          capabilities.evRange.min,
          Math.min(capabilities.evRange.max, patch.ev)
        );
      }
      if (patch.iso !== undefined && capabilities.supportsIso) {
        advanced.iso = Math.max(capabilities.isoRange.min, Math.min(capabilities.isoRange.max, patch.iso));
      }
      if (patch.wbKelvin !== undefined && capabilities.supportsColorTemp && manual.wbMode === 'manual') {
        advanced.whiteBalanceMode = 'manual';
        advanced.colorTemperature = Math.max(
          capabilities.wbKelvinRange.min,
          Math.min(capabilities.wbKelvinRange.max, patch.wbKelvin)
        );
      }
      if (patch.zoom !== undefined && capabilities.supportsZoom) {
        advanced.zoom = Math.max(capabilities.zoomRange.min, Math.min(capabilities.zoomRange.max, patch.zoom));
      }
      if (patch.torch !== undefined && capabilities.supportsTorch) {
        advanced.torch = patch.torch;
      }

      if (Object.keys(advanced).length > 0) {
        try {
          await track.applyConstraints({ advanced: [advanced] } as MediaTrackConstraints);
        } catch {
          // Hardware constraint rejected silently without breaking preview
        }
      }
    },
    [capabilities, manual.wbMode, sourceMode]
  );

  // Throttled Offline AI Frame Analyzer & Subtle Scene Optimizer (~750ms)
  useEffect(() => {
    const runAnalysis = () => {
      const srcEl = sourceMode === 'live' ? videoRef.current : sampleImgRef.current;
      if (!srcEl) return;
      if (srcEl instanceof HTMLVideoElement && srcEl.readyState < 2) return;
      if (srcEl instanceof HTMLImageElement && !srcEl.complete) return;

      const res = analyzeFrameOffline(srcEl, capabilities);
      if (res) {
        onOfflineAnalysisChange(res);
      }
    };

    const timer = window.setInterval(runAnalysis, 750);
    const initial = window.setTimeout(runAnalysis, 180);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initial);
    };
  }, [sourceMode, selectedSampleIdx, uploadedImageUrl, capabilities, onOfflineAnalysisChange]);

  // Subtle Auto Scene Optimization: applies gentle, non-destructive EV / WB / ISO adjustments when Auto Mode & Auto Scene Optimize are active
  const activeOptimizedValues = useMemo(() => {
    if (manual.mode === 'pro' || !privacy.autoSceneOptimizeEnabled || !offlineAnalysis) {
      return {
        ev: manual.ev,
        wbKelvin: manual.wbKelvin,
        iso: manual.iso,
        applied: false,
      };
    }
    const opt = offlineAnalysis.optimization.adjustments;
    return {
      ev: opt.exposureDeltaEv !== null ? opt.exposureDeltaEv : manual.ev,
      wbKelvin: opt.whiteBalanceKelvin !== null ? opt.whiteBalanceKelvin : manual.wbKelvin,
      iso: opt.isoTarget !== null ? opt.isoTarget : manual.iso,
      applied: true,
    };
  }, [manual.ev, manual.iso, manual.mode, manual.wbKelvin, offlineAnalysis, privacy.autoSceneOptimizeEnabled]);

  // Sync subtle scene optimization to live track hardware when supported
  useEffect(() => {
    if (sourceMode === 'live' && activeOptimizedValues.applied && !manual.aeLocked) {
      applyTrackConstraint({
        ev: activeOptimizedValues.ev,
        iso: capabilities.supportsIso ? activeOptimizedValues.iso : undefined,
        wbKelvin: capabilities.supportsColorTemp ? activeOptimizedValues.wbKelvin : undefined,
      });
    }
  }, [activeOptimizedValues, applyTrackConstraint, capabilities.supportsColorTemp, capabilities.supportsIso, manual.aeLocked, sourceMode]);

  const handleLensSwitch = (lensId: LensId) => {
    const zoomTarget = lensId === 'ultrawide' ? 0.6 : lensId === 'telephoto' ? 2.4 : 1;
    setManual((prev) => ({ ...prev, activeLens: lensId, zoom: zoomTarget }));
    if (sourceMode === 'live') {
      if (lensId === 'front') {
        startLiveCamera('user');
      } else if (manual.activeLens === 'front') {
        startLiveCamera('environment');
      } else if (capabilities.supportsZoom) {
        applyTrackConstraint({ zoom: Math.max(capabilities.zoomRange.min, zoomTarget) });
      }
    }
  };

  // Capture helper: draws original untouched frame AND graded frame separately
  const executeSingleCapture = useCallback(async () => {
    const srcEl = sourceMode === 'live' ? videoRef.current : sampleImgRef.current;
    if (!srcEl) return;

    const w =
      srcEl instanceof HTMLVideoElement ? srcEl.videoWidth || 1280 : srcEl.naturalWidth || 1200;
    const h =
      srcEl instanceof HTMLVideoElement ? srcEl.videoHeight || 960 : srcEl.naturalHeight || 900;

    // Aspect ratio crop calculation
    let targetW = w;
    let targetH = h;
    if (manual.aspectRatio === '16:9') {
      targetH = Math.round((w * 9) / 16);
      if (targetH > h) {
        targetH = h;
        targetW = Math.round((h * 16) / 9);
      }
    } else if (manual.aspectRatio === '1:1') {
      const side = Math.min(w, h);
      targetW = side;
      targetH = side;
    }

    const sx = Math.floor((w - targetW) / 2);
    const sy = Math.floor((h - targetH) / 2);

    const origCanvas = document.createElement('canvas');
    origCanvas.width = targetW;
    origCanvas.height = targetH;
    const oCtx = origCanvas.getContext('2d');
    if (!oCtx) return;
    oCtx.drawImage(srcEl, sx, sy, targetW, targetH, 0, 0, targetW, targetH);

    const mime = manual.format === 'PNG' ? 'image/png' : 'image/jpeg';
    const originalDataUrl = origCanvas.toDataURL(mime, 0.94);

    // Non-destructive graded canvas
    const gradedCanvas = document.createElement('canvas');
    gradedCanvas.width = targetW;
    gradedCanvas.height = targetH;
    const gCtx = gradedCanvas.getContext('2d');
    if (!gCtx) return;
    gCtx.drawImage(origCanvas, 0, 0);

    applyColorGradingToCanvas(
      gCtx,
      targetW,
      targetH,
      effectiveColorProfile,
      colorAdj,
      activeOptimizedValues.ev,
      activeOptimizedValues.wbKelvin
    );

    const gradedDataUrl = gradedCanvas.toDataURL(mime, 0.94);
    const profileObj = getProfileById(effectiveColorProfile);

    const item: GalleryItem = {
      id: `nova-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mediaType: 'photo',
      title: `${capitalizeScene(offlineAnalysis?.detectedScene ?? 'street')} · ${profileObj.name}`,
      album: activeOptimizedValues.applied ? 'AI Optimized' : 'Camera Captures',
      favorite: false,
      createdAt: new Date().toISOString(),
      originalDataUrl,
      gradedDataUrl,
      mimeType: mime,
      width: targetW,
      height: targetH,
      exif: {
        cameraModel:
          sourceMode === 'live'
            ? capabilities.deviceLabel
            : 'NOVA Studio Reference (Xiaomi 17T Target)',
        lensLabel: `${activeLensSpec.marketingName} (${activeLensSpec.focalLengthMm})`,
        focalLengthMm: activeLensSpec.focalLengthMm,
        aperture: activeLensSpec.aperture,
        iso: activeOptimizedValues.iso,
        shutterSpeed: manual.shutterSpeed,
        ev: Number(activeOptimizedValues.ev.toFixed(1)),
        wbKelvin: activeOptimizedValues.wbKelvin,
        profileName: profileObj.name,
        sceneDetected: offlineAnalysis?.detectedScene ?? 'street',
        aiOptimized: activeOptimizedValues.applied,
      },
      analysisHistory: [],
    };

    await onCaptureSaved(item);
  }, [
    activeLensSpec,
    activeOptimizedValues,
    capabilities.deviceLabel,
    colorAdj,
    effectiveColorProfile,
    manual.aspectRatio,
    manual.format,
    manual.shutterSpeed,
    offlineAnalysis?.detectedScene,
    onCaptureSaved,
    sourceMode,
  ]);

  const triggerShutter = async () => {
    if (mode === 'video') {
      if (isRecording) {
        stopVideoRecording();
      } else {
        startVideoRecording();
      }
      return;
    }

    if (manual.timerSeconds > 0) {
      let remaining = manual.timerSeconds;
      setCountdownLeft(remaining);
      await new Promise<void>((resolve) => {
        const iv = window.setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            window.clearInterval(iv);
            setCountdownLeft(null);
            resolve();
          } else {
            setCountdownLeft(remaining);
          }
        }, 1000);
      });
    }

    const totalFrames = manual.burstCount;
    for (let i = 0; i < totalFrames; i++) {
      setFlashPulse(true);
      await executeSingleCapture();
      window.setTimeout(() => setFlashPulse(false), 120);
      if (i < totalFrames - 1) {
        await new Promise((r) => setTimeout(r, 180));
      }
    }

    setCaptureNotice(
      totalFrames > 1
        ? `Saved ${totalFrames} burst captures (Original + ${getProfileById(effectiveColorProfile).name})`
        : `Captured Original + ${getProfileById(effectiveColorProfile).name} to Gallery`
    );
    window.setTimeout(() => setCaptureNotice(null), 2600);
  };

  // Real Video Recording using graded canvas stream + optional mic audio
  const startVideoRecording = () => {
    const srcEl = sourceMode === 'live' ? videoRef.current : sampleImgRef.current;
    if (!srcEl) return;

    const canvas = recordCanvasRef.current ?? document.createElement('canvas');
    recordCanvasRef.current = canvas;
    canvas.width = videoCfg.resolution === '4K' && capabilities.maxWidth >= 3840 ? 3840 : 1280;
    canvas.height = videoCfg.resolution === '4K' && capabilities.maxWidth >= 3840 ? 2160 : 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const renderLoop = () => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
      ctx.filter = buildCssFilterPreview(
        effectiveColorProfile,
        colorAdj,
        activeOptimizedValues.ev,
        activeOptimizedValues.wbKelvin
      );
      ctx.drawImage(srcEl, 0, 0, canvas.width, canvas.height);
      rafId = requestAnimationFrame(renderLoop);
    };

    const canvasStream = canvas.captureStream(videoCfg.fps);
    if (videoCfg.micEnabled && streamRef.current) {
      streamRef.current.getAudioTracks().forEach((at) => canvasStream.addTrack(at));
    }

    recordedChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(canvasStream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      cancelAnimationFrame(rafId);
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      const videoUrl = URL.createObjectURL(blob);

      // Capture poster frame for gallery thumbnail
      ctx.filter = buildCssFilterPreview(
        effectiveColorProfile,
        colorAdj,
        activeOptimizedValues.ev,
        activeOptimizedValues.wbKelvin
      );
      ctx.drawImage(srcEl, 0, 0, canvas.width, canvas.height);
      const posterUrl = canvas.toDataURL('image/jpeg', 0.88);

      const item: GalleryItem = {
        id: `nova-vid-${Date.now()}`,
        mediaType: 'video',
        title: `${videoCfg.resolution} ${videoCfg.fps}fps · ${
          VIDEO_COLOR_PROFILES.find((v) => v.id === videoCfg.profile)?.name ?? 'Cinematic Natural'
        }`,
        album: 'Videos',
        favorite: false,
        createdAt: new Date().toISOString(),
        originalDataUrl: posterUrl,
        gradedDataUrl: posterUrl,
        videoBlobUrl: videoUrl,
        mimeType,
        width: canvas.width,
        height: canvas.height,
        exif: {
          cameraModel: sourceMode === 'live' ? capabilities.deviceLabel : 'NOVA Studio Recorder',
          lensLabel: `${activeLensSpec.marketingName} (${activeLensSpec.focalLengthMm})`,
          focalLengthMm: activeLensSpec.focalLengthMm,
          aperture: activeLensSpec.aperture,
          iso: activeOptimizedValues.iso,
          shutterSpeed: `1/${videoCfg.fps * 2}s`,
          ev: Number(activeOptimizedValues.ev.toFixed(1)),
          wbKelvin: activeOptimizedValues.wbKelvin,
          profileName: VIDEO_COLOR_PROFILES.find((v) => v.id === videoCfg.profile)?.name ?? 'Cinematic Natural',
          sceneDetected: offlineAnalysis?.detectedScene ?? 'street',
          aiOptimized: activeOptimizedValues.applied,
        },
        analysisHistory: [],
      };
      await onCaptureSaved(item);
      setCaptureNotice('Saved graded video clip to Gallery');
      window.setTimeout(() => setCaptureNotice(null), 2600);
    };

    recorder.start(250);
    setIsRecording(true);
    setRecordingSeconds(0);
    rafId = requestAnimationFrame(renderLoop);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  useEffect(() => {
    if (!isRecording) return;
    const iv = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(iv);
  }, [isRecording]);

  // Ask Online Gemini Vision AI Coach (only when user explicitly consented)
  const requestOnlineCoach = async () => {
    if (!privacy.onlineAiConsent || privacy.offlineOnlyMode) {
      setOnlineError('Enable Online Vision AI & grant consent in Settings to use cloud coaching.');
      return;
    }
    const srcEl = sourceMode === 'live' ? videoRef.current : sampleImgRef.current;
    if (!srcEl) return;

    setOnlineLoading(true);
    setOnlineError(null);
    try {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 480;
      const ctx = c.getContext('2d');
      ctx?.drawImage(srcEl, 0, 0, 640, 480);
      const dataUrl = c.toDataURL('image/jpeg', 0.82);
      const base64 = dataUrl.split(',')[1];

      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: 'image/jpeg',
          consent: privacy.onlineAiConsent,
          capabilities: {
            supportsIso: capabilities.supportsIso,
            isoRange: capabilities.isoRange,
            supportsExposureComp: capabilities.supportsExposureComp,
            evRange: capabilities.evRange,
            supportsColorTemp: capabilities.supportsColorTemp,
            wbKelvinRange: capabilities.wbKelvinRange,
            supportsFocusMode: capabilities.supportsFocusMode,
          },
          offlineSummary: offlineAnalysis
            ? {
                detectedScene: offlineAnalysis.detectedScene,
                tiltDegrees: offlineAnalysis.tiltDegrees,
                highlightClipPct: offlineAnalysis.highlightClipPct,
              }
            : {},
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Online coach failed');
      }
      onOnlineCoachChange(json);
    } catch (err: unknown) {
      setOnlineError(err instanceof Error ? err.message : 'Unable to reach Gemini Vision Coach.');
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleUploadFrame = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        stopStream();
        setUploadedImageUrl(reader.result);
        setSourceMode('upload');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleViewfinderTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    setFocusReticle({ x: xPct, y: yPct, locked: manual.afLocked });
  };

  const previewFilterCss = useMemo(
    () =>
      buildCssFilterPreview(
        effectiveColorProfile,
        colorAdj,
        activeOptimizedValues.ev,
        activeOptimizedValues.wbKelvin
      ),
    [effectiveColorProfile, colorAdj, activeOptimizedValues.ev, activeOptimizedValues.wbKelvin]
  );

  // Visual optical zoom simulation for non-hardware zoom lenses in studio preview
  const previewScale = useMemo(() => {
    if (manual.activeLens === 'ultrawide') return 1;
    if (manual.activeLens === 'telephoto') return 1.38;
    return Math.max(1, Math.min(2.5, manual.zoom));
  }, [manual.activeLens, manual.zoom]);

  const aspectContainerClass =
    manual.aspectRatio === '16:9'
      ? 'aspect-video'
      : manual.aspectRatio === '1:1'
        ? 'aspect-square max-h-[68vh]'
        : 'aspect-[4/3]';

  return (
    <div className="relative flex flex-col gap-4 w-full max-w-7xl mx-auto px-3 sm:px-6 pb-24 lg:pb-8">
      {/* Top Floating Control Bar */}
      <LiquidGlassPanel className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Auto / Pro Mode Switch */}
          <div className="flex items-center p-1 rounded-xl bg-black/30 dark:bg-black/40 border border-white/10">
            <button
              type="button"
              onClick={() => setManual((p) => ({ ...p, mode: 'auto' }))}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                manual.mode === 'auto'
                  ? 'bg-[var(--nova-accent)] text-white shadow-sm'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Auto AI
            </button>
            <button
              type="button"
              onClick={() => {
                setManual((p) => ({ ...p, mode: 'pro' }));
                setActiveDrawer('pro');
              }}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                manual.mode === 'pro'
                  ? 'bg-[var(--nova-accent)] text-white shadow-sm'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Pro Manual
            </button>
          </div>

          {/* Source Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-black/25 border border-white/10">
            <button
              type="button"
              onClick={() => startLiveCamera('environment')}
              disabled={cameraStarting}
              className={`min-h-[36px] px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                sourceMode === 'live'
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{cameraStarting ? 'Starting...' : 'Live Camera'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopStream();
                setSourceMode('sample');
              }}
              className={`min-h-[36px] px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                sourceMode === 'sample'
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Studio Scenes</span>
            </button>
            <label className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 text-zinc-400 hover:text-white cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
              <input type="file" accept="image/*" onChange={handleUploadFrame} className="hidden" />
            </label>
          </div>
        </div>

        {/* Right Quick Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {mode === 'photo' ? (
            <>
              <button
                type="button"
                onClick={() =>
                  setManual((p) => ({
                    ...p,
                    timerSeconds: p.timerSeconds === 0 ? 3 : p.timerSeconds === 3 ? 10 : 0,
                  }))
                }
                aria-label="Cycle shutter timer"
                className="min-h-[40px] px-2.5 rounded-xl hover:bg-white/10 text-xs font-mono tabular-nums flex items-center gap-1 text-zinc-200 whitespace-nowrap"
              >
                <Timer className="w-3.5 h-3.5 text-[var(--nova-accent)]" />
                <span>{manual.timerSeconds === 0 ? 'Off' : `${manual.timerSeconds}s`}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setManual((p) => ({
                    ...p,
                    burstCount: p.burstCount === 1 ? 3 : p.burstCount === 3 ? 5 : 1,
                  }))
                }
                aria-label="Cycle burst capture count"
                className="min-h-[40px] px-2.5 rounded-xl hover:bg-white/10 text-xs font-mono tabular-nums text-zinc-200 whitespace-nowrap"
              >
                {manual.burstCount === 1 ? 'Single' : `Burst ×${manual.burstCount}`}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  setVideoCfg((v) => ({
                    ...v,
                    resolution: v.resolution === '1080p' && capabilities.maxWidth >= 3840 ? '4K' : '1080p',
                  }))
                }
                className="min-h-[40px] px-2.5 rounded-xl hover:bg-white/10 text-xs font-mono tabular-nums text-zinc-200 whitespace-nowrap"
              >
                {videoCfg.resolution}
              </button>
              <button
                type="button"
                onClick={() => {
                  const rates = capabilities.supportedFrameRates;
                  const idx = rates.indexOf(videoCfg.fps);
                  const next = (rates[(idx + 1) % rates.length] ?? 30) as 24 | 30 | 60;
                  setVideoCfg((v) => ({ ...v, fps: next }));
                }}
                className="min-h-[40px] px-2.5 rounded-xl hover:bg-white/10 text-xs font-mono tabular-nums text-zinc-200 whitespace-nowrap"
              >
                {videoCfg.fps} fps
              </button>
              <button
                type="button"
                onClick={() => setVideoCfg((v) => ({ ...v, micEnabled: !v.micEnabled }))}
                aria-label="Toggle microphone"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-200"
              >
                {videoCfg.micEnabled ? <Mic className="w-4 h-4 text-[var(--nova-accent)]" /> : <MicOff className="w-4 h-4 text-rose-400" />}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() =>
              setManual((p) => ({
                ...p,
                gridMode:
                  p.gridMode === 'thirds'
                    ? 'golden'
                    : p.gridMode === 'golden'
                      ? 'crosshair'
                      : p.gridMode === 'crosshair'
                        ? 'off'
                        : 'thirds',
              }))
            }
            aria-label="Cycle composition grid"
            className={`min-h-[40px] min-w-[40px] px-2.5 rounded-xl hover:bg-white/10 text-xs flex items-center gap-1 whitespace-nowrap ${
              manual.gridMode !== 'off' ? 'text-[var(--nova-accent)]' : 'text-zinc-400'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            <span className="hidden sm:inline capitalize">{manual.gridMode}</span>
          </button>

          <button
            type="button"
            onClick={() => setManual((p) => ({ ...p, showHistogram: !p.showHistogram }))}
            className={`min-h-[40px] px-2.5 rounded-xl hover:bg-white/10 text-xs whitespace-nowrap ${
              manual.showHistogram ? 'text-[var(--nova-accent)]' : 'text-zinc-400'
            }`}
          >
            Histogram
          </button>

          {capabilities.supportsTorch && (
            <button
              type="button"
              onClick={() => {
                const nextTorch = !manual.torch;
                setManual((p) => ({ ...p, torch: nextTorch }));
                applyTrackConstraint({ torch: nextTorch });
              }}
              aria-label="Toggle hardware torch"
              className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/10 ${
                manual.torch ? 'text-amber-400' : 'text-zinc-300'
              }`}
            >
              <Flashlight className="w-4 h-4" />
            </button>
          )}
        </div>
      </LiquidGlassPanel>

      {/* Main Split: Viewfinder (left/center) + AI Coach & Controls Sidebar on wide viewports */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Sample Scene Switcher when in Studio Scene mode */}
          {sourceMode === 'sample' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {SAMPLE_SCENES.map((scene, idx) => (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => setSelectedSampleIdx(idx)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                    selectedSampleIdx === idx
                      ? 'bg-[var(--nova-accent)] text-white border-transparent'
                      : 'bg-zinc-900/70 dark:bg-zinc-900/70 text-zinc-300 border-white/10 hover:border-white/25'
                  }`}
                >
                  {scene.title}
                </button>
              ))}
            </div>
          )}

          {cameraError && (
            <div className="rounded-xl px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 flex items-center justify-between gap-2">
              <span>{cameraError}</span>
              <button
                type="button"
                onClick={() => setCameraError(null)}
                className="text-amber-300 underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Unobstructed Viewfinder Canvas */}
          <div
            onClick={handleViewfinderTap}
            className={`relative w-full ${aspectContainerClass} mx-auto rounded-3xl overflow-hidden bg-black border border-white/12 shadow-2xl cursor-crosshair select-none`}
          >
            {/* Video or Image Preview (Zero backdrop-blur over viewfinder!) */}
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                filter: previewFilterCss,
                transform: `scale(${previewScale})`,
              }}
              className={`w-full h-full object-cover transition-transform duration-200 ${
                sourceMode === 'live' ? 'block' : 'hidden'
              }`}
            />

            {sourceMode !== 'live' && (
              <img
                ref={sampleImgRef}
                src={sourceMode === 'upload' && uploadedImageUrl ? uploadedImageUrl : activeSample.src}
                alt={sourceMode === 'upload' ? 'Imported photograph preview' : activeSample.title}
                referrerPolicy="no-referrer"
                style={{
                  filter: previewFilterCss,
                  transform: `scale(${previewScale})`,
                }}
                className="w-full h-full object-cover transition-transform duration-200"
              />
            )}

            {/* Vignette live preview overlay */}
            {colorAdj.vignette > 0 && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(circle, transparent 48%, rgba(0,0,0,${(colorAdj.vignette / 100) * 0.62}) 100%)`,
                }}
              />
            )}

            {/* Composition Grids */}
            {manual.gridMode === 'thirds' && (
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-white/20" />
                <div className="border-r border-white/20" />
                <div />
              </div>
            )}
            {manual.gridMode === 'golden' && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-0 bottom-0 left-[38.2%] w-px bg-white/22" />
                <div className="absolute top-0 bottom-0 right-[38.2%] w-px bg-white/22" />
                <div className="absolute left-0 right-0 top-[38.2%] h-px bg-white/22" />
                <div className="absolute left-0 right-0 bottom-[38.2%] h-px bg-white/22" />
              </div>
            )}
            {manual.gridMode === 'crosshair' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-px bg-white/45" />
                <div className="h-8 w-px bg-white/45 -ml-4" />
              </div>
            )}

            {/* Horizon Level Indicator */}
            {manual.showLevel && offlineAnalysis && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="w-24 h-0.5 rounded-full transition-transform duration-200"
                  style={{
                    transform: `rotate(${-offlineAnalysis.tiltDegrees}deg)`,
                    backgroundColor:
                      Math.abs(offlineAnalysis.tiltDegrees) < 1.5 ? '#10b981' : 'rgba(255,255,255,0.65)',
                  }}
                />
              </div>
            )}

            {/* Tap-to-Focus Reticle */}
            {focusReticle && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border-2 transition-all duration-150 flex items-center justify-center"
                style={{
                  left: `${focusReticle.x}%`,
                  top: `${focusReticle.y}%`,
                  borderColor: 'var(--nova-accent)',
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--nova-accent)]" />
              </div>
            )}

            {/* Top Viewfinder HUD Overlay: Readout + Histogram */}
            <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
              <div className="liquid-glass-subtle rounded-xl px-3 py-1.5 text-xs text-zinc-100 flex items-center gap-2">
                <span className="font-medium">{getProfileById(effectiveColorProfile).name}</span>
                <span aria-hidden="true" className="text-zinc-500">
                  ·
                </span>
                <span className="font-mono tabular-nums text-zinc-300">
                  ISO {activeOptimizedValues.iso}
                </span>
                <span aria-hidden="true" className="text-zinc-500">
                  ·
                </span>
                <span className="font-mono tabular-nums text-zinc-300">
                  {activeOptimizedValues.ev >= 0 ? `+${activeOptimizedValues.ev.toFixed(1)}` : activeOptimizedValues.ev.toFixed(1)} EV
                </span>
                {activeOptimizedValues.applied && (
                  <>
                    <span aria-hidden="true" className="text-zinc-500">
                      ·
                    </span>
                    <span className="text-[var(--nova-accent)] font-medium">
                      AI {capitalizeScene(offlineAnalysis?.detectedScene ?? 'street')}
                    </span>
                  </>
                )}
              </div>

              {manual.showHistogram && offlineAnalysis && (
                <LiveHistogram
                  bins={offlineAnalysis.histogram}
                  highlightClipPct={offlineAnalysis.highlightClipPct}
                  shadowCrushPct={offlineAnalysis.shadowCrushPct}
                />
              )}
            </div>

            {/* Video Recording Timer */}
            {isRecording && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-rose-600/90 text-white px-3 py-1 rounded-full text-xs font-mono tabular-nums flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>
                  REC {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                  {String(recordingSeconds % 60).padStart(2, '0')}
                </span>
              </div>
            )}

            {/* Countdown Timer Overlay */}
            {countdownLeft !== null && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-7xl font-display font-bold text-white tabular-nums">
                  {countdownLeft}
                </span>
              </div>
            )}

            {/* Shutter Flash */}
            {flashPulse && <div className="pointer-events-none absolute inset-0 bg-white/75" />}

            {/* Capture Saved Notification */}
            {captureNotice && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 liquid-glass rounded-xl px-4 py-2 text-xs text-white flex items-center gap-2 whitespace-nowrap">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{captureNotice}</span>
              </div>
            )}
          </div>

          {/* Lens Selector & Shutter Dock */}
          <LiquidGlassPanel className="p-3 sm:p-4 flex flex-col gap-3">
            {/* Lens Selector */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                {XIAOMI_17T_REFERENCE_LENSES.map((lens) => {
                  const active = manual.activeLens === lens.id;
                  return (
                    <button
                      key={lens.id}
                      type="button"
                      onClick={() => handleLensSwitch(lens.id)}
                      className={`min-h-[40px] px-3 rounded-xl text-xs font-mono tabular-nums transition-all whitespace-nowrap ${
                        active
                          ? 'bg-[var(--nova-accent)] text-white font-semibold shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                      }`}
                    >
                      {lens.zoomLabel} · {lens.focalLengthMm.replace(' eq.', '')}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onModeChange('photo')}
                  className={`min-h-[40px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    mode === 'photo'
                      ? 'bg-white/15 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange('video')}
                  className={`min-h-[40px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    mode === 'video'
                      ? 'bg-white/15 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Video</span>
                </button>
              </div>
            </div>

            {/* Shutter Row */}
            <div className="flex items-center justify-between gap-4 pt-1">
              {/* Gallery Thumbnail Shortcut */}
              <button
                type="button"
                onClick={onOpenGallery}
                aria-label="Open captured gallery"
                className="w-12 h-12 rounded-xl overflow-hidden border border-white/20 bg-zinc-900 flex items-center justify-center hover:border-[var(--nova-accent)] transition-colors shrink-0"
              >
                {latestGalleryItem ? (
                  <img
                    src={latestGalleryItem.gradedDataUrl}
                    alt={latestGalleryItem.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-5 h-5 text-zinc-400" />
                )}
              </button>

              {/* Primary Shutter / Record Button */}
              <button
                type="button"
                onClick={triggerShutter}
                aria-label={mode === 'video' ? (isRecording ? 'Stop recording' : 'Start recording') : 'Capture photo'}
                className="relative w-16 h-16 rounded-full p-1 transition-transform active:scale-95 flex items-center justify-center shrink-0"
                style={{
                  border: '3px solid var(--nova-accent)',
                }}
              >
                {mode === 'video' ? (
                  isRecording ? (
                    <Square className="w-6 h-6 text-rose-500 fill-rose-500" />
                  ) : (
                    <span className="w-11 h-11 rounded-full bg-rose-500 block" />
                  )
                ) : (
                  <span className="w-12 h-12 rounded-full bg-white block shadow-inner" />
                )}
              </button>

              {/* Drawers Toggles */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveDrawer((d) => (d === 'color' ? 'none' : 'color'))}
                  className={`min-h-[44px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                    activeDrawer === 'color'
                      ? 'bg-[var(--nova-accent)] text-white border-transparent'
                      : 'bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <Aperture className="w-4 h-4" />
                  <span className="hidden sm:inline">Colour</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawer((d) => (d === 'pro' ? 'none' : 'pro'))}
                  className={`min-h-[44px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                    activeDrawer === 'pro'
                      ? 'bg-[var(--nova-accent)] text-white border-transparent'
                      : 'bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span className="hidden sm:inline">Manual</span>
                </button>
              </div>
            </div>

            {/* Expandable Colour Grading Drawer */}
            {activeDrawer === 'color' && (
              <div className="pt-3 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">
                    {mode === 'video' ? 'Video Colour Profiles' : 'Cinematic Colour Profiles'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setColorAdj(getProfileById(effectiveColorProfile).defaults)}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset sliders</span>
                  </button>
                </div>

                {mode === 'photo' ? (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {PHOTO_COLOR_PROFILES.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPhotoProfile(p.id)}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 border transition-colors ${
                          selectedProfile === p.id
                            ? 'bg-[var(--nova-accent)] text-white border-transparent'
                            : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {VIDEO_COLOR_PROFILES.map((vp) => (
                      <button
                        key={vp.id}
                        type="button"
                        onClick={() => handleSelectVideoProfile(vp.id)}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 border transition-colors ${
                          videoCfg.profile === vp.id
                            ? 'bg-[var(--nova-accent)] text-white border-transparent'
                            : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        {vp.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {(
                    [
                      { key: 'intensity', label: 'Intensity', min: 0, max: 100 },
                      { key: 'contrast', label: 'Contrast', min: -50, max: 50 },
                      { key: 'saturation', label: 'Saturation', min: -50, max: 50 },
                      { key: 'highlights', label: 'Highlights', min: -50, max: 50 },
                      { key: 'shadows', label: 'Shadows', min: -50, max: 50 },
                      { key: 'temperature', label: 'Temperature', min: -50, max: 50 },
                      { key: 'tint', label: 'Tint', min: -50, max: 50 },
                      { key: 'sharpness', label: 'Sharpness', min: 0, max: 100 },
                      { key: 'fade', label: 'Fade', min: 0, max: 100 },
                      { key: 'vignette', label: 'Vignette', min: 0, max: 100 },
                    ] as const
                  ).map((slider) => (
                    <label key={slider.key} className="flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between text-zinc-300">
                        <span>{slider.label}</span>
                        <span className="font-mono tabular-nums text-zinc-400">
                          {colorAdj[slider.key]}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        value={colorAdj[slider.key]}
                        onChange={(e) =>
                          setColorAdj((prev) => ({
                            ...prev,
                            [slider.key]: Number(e.target.value),
                          }))
                        }
                        className="nova-range w-full"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Expandable Pro Manual Controls Drawer (Strictly Hardware-Aware) */}
            {activeDrawer === 'pro' && (
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-medium text-zinc-300">
                    Manual Controls · {capabilities.deviceLabel}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setManual((p) => ({ ...p, aeLocked: !p.aeLocked }))}
                      className={`min-h-[34px] px-2.5 rounded-lg text-xs flex items-center gap-1 border ${
                        manual.aeLocked
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-white/5 border-white/10 text-zinc-300'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      <span>AE Lock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setManual((p) => ({ ...p, afLocked: !p.afLocked }))}
                      className={`min-h-[34px] px-2.5 rounded-lg text-xs flex items-center gap-1 border ${
                        manual.afLocked
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-white/5 border-white/10 text-zinc-300'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      <span>AF Lock</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Exposure Compensation */}
                  {capabilities.supportsExposureComp && (
                    <label className="flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between text-zinc-300">
                        <span>Exposure (EV)</span>
                        <span className="font-mono tabular-nums">
                          {manual.ev >= 0 ? `+${manual.ev.toFixed(1)}` : manual.ev.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={capabilities.evRange.min}
                        max={capabilities.evRange.max}
                        step={capabilities.evRange.step}
                        value={manual.ev}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setManual((p) => ({ ...p, mode: 'pro', ev: val }));
                          applyTrackConstraint({ ev: val });
                        }}
                        className="nova-range w-full"
                      />
                    </label>
                  )}

                  {/* White Balance Kelvin */}
                  {capabilities.supportsColorTemp && (
                    <label className="flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between text-zinc-300">
                        <span>White Balance</span>
                        <span className="font-mono tabular-nums">{manual.wbKelvin}K</span>
                      </div>
                      <input
                        type="range"
                        min={capabilities.wbKelvinRange.min}
                        max={capabilities.wbKelvinRange.max}
                        step={100}
                        value={manual.wbKelvin}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setManual((p) => ({ ...p, mode: 'pro', wbMode: 'manual', wbKelvin: val }));
                          applyTrackConstraint({ wbKelvin: val });
                        }}
                        className="nova-range w-full"
                      />
                    </label>
                  )}

                  {/* ISO — only rendered when live track supports ISO */}
                  {capabilities.supportsIso ? (
                    <label className="flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between text-zinc-300">
                        <span>ISO</span>
                        <span className="font-mono tabular-nums">{manual.iso}</span>
                      </div>
                      <input
                        type="range"
                        min={capabilities.isoRange.min}
                        max={capabilities.isoRange.max}
                        step={capabilities.isoRange.step}
                        value={manual.iso}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setManual((p) => ({ ...p, mode: 'pro', iso: val }));
                          applyTrackConstraint({ iso: val });
                        }}
                        className="nova-range w-full"
                      />
                    </label>
                  ) : (
                    <div className="rounded-xl p-2.5 bg-white/5 border border-white/10 text-[11px] text-zinc-400">
                      Hardware ISO & Shutter Speed controls require native Camera2 on Android; hidden on unsupported web streams.
                    </div>
                  )}

                  {/* Aspect Ratio */}
                  <div className="flex flex-col gap-1.5 text-xs">
                    <span className="text-zinc-300">Aspect Ratio</span>
                    <div className="flex gap-1.5">
                      {(['4:3', '16:9', '1:1'] as const).map((ar) => (
                        <button
                          key={ar}
                          type="button"
                          onClick={() => setManual((p) => ({ ...p, aspectRatio: ar }))}
                          className={`flex-1 min-h-[34px] rounded-lg font-mono text-xs border ${
                            manual.aspectRatio === ar
                              ? 'bg-[var(--nova-accent)] text-white border-transparent'
                              : 'bg-white/5 border-white/10 text-zinc-300'
                          }`}
                        >
                          {ar}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Output Format */}
                  <div className="flex flex-col gap-1.5 text-xs">
                    <span className="text-zinc-300">Capture Format</span>
                    <div className="flex gap-1.5">
                      {(['JPEG', 'PNG'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setManual((p) => ({ ...p, format: fmt }))}
                          className={`flex-1 min-h-[34px] rounded-lg font-mono text-xs border ${
                            manual.format === fmt
                              ? 'bg-[var(--nova-accent)] text-white border-transparent'
                              : 'bg-white/5 border-white/10 text-zinc-300'
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference Shutter Tag for Studio EXIF */}
                  <div className="flex flex-col gap-1.5 text-xs">
                    <span className="text-zinc-300">Shutter Target</span>
                    <select
                      value={manual.shutterSpeed}
                      onChange={(e) => setManual((p) => ({ ...p, shutterSpeed: e.target.value }))}
                      className="min-h-[34px] rounded-lg bg-zinc-900 border border-white/10 px-2.5 text-xs font-mono text-zinc-200"
                    >
                      {SHUTTER_SPEEDS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </LiquidGlassPanel>
        </div>

        {/* Right Column: Live AI Camera Coach & Subtle Scene Optimization Card */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <LiquidGlassPanel className="p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--nova-accent)]" />
                <h2 className="text-sm font-display font-semibold text-white">
                  Live AI Camera Coach
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCoachExpanded((v) => !v)}
                aria-label="Toggle coach details"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400"
              >
                {coachExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {offlineAnalysis ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    Scene:{' '}
                    <strong className="text-zinc-100 font-medium">
                      {capitalizeScene(offlineAnalysis.detectedScene)}
                    </strong>
                  </span>
                  <span className="font-mono tabular-nums">
                    {Math.round(offlineAnalysis.confidence * 100)}% conf
                  </span>
                </div>

                <p className="text-sm text-zinc-100 leading-relaxed">
                  {offlineAnalysis.primaryAdvice}
                </p>

                {coachExpanded && (
                  <>
                    {offlineAnalysis.secondaryTips.length > 0 && (
                      <ul className="space-y-1.5 text-xs text-zinc-300 border-t border-white/10 pt-2.5">
                        {offlineAnalysis.secondaryTips.map((tip, idx) => (
                          <li key={idx} className="leading-snug">
                            • {tip}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Recommended Lens Quick Switch */}
                    {offlineAnalysis.recommendedLens !== manual.activeLens && (
                      <button
                        type="button"
                        onClick={() => handleLensSwitch(offlineAnalysis.recommendedLens)}
                        className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white flex items-center justify-between transition-colors"
                      >
                        <span>
                          Recommended lens:{' '}
                          {
                            XIAOMI_17T_REFERENCE_LENSES.find((l) => l.id === offlineAnalysis.recommendedLens)
                              ?.marketingName
                          }
                        </span>
                        <span className="text-[var(--nova-accent)] font-mono">Switch</span>
                      </button>
                    )}

                    {/* Subtle AI Scene Optimization Panel */}
                    <div className="pt-3 border-t border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                          <Wand2 className="w-3.5 h-3.5 text-[var(--nova-accent)]" />
                          <span>Subtle Scene Optimization</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdatePrivacy({
                              ...privacy,
                              autoSceneOptimizeEnabled: !privacy.autoSceneOptimizeEnabled,
                            })
                          }
                          className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium transition-colors ${
                            privacy.autoSceneOptimizeEnabled
                              ? 'bg-[var(--nova-accent)] text-white'
                              : 'bg-white/10 text-zinc-300'
                          }`}
                        >
                          {privacy.autoSceneOptimizeEnabled ? 'Active' : 'Paused'}
                        </button>
                      </div>

                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {offlineAnalysis.optimization.rationale}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                        <div className="rounded-xl bg-black/30 px-2.5 py-2 border border-white/5">
                          <div className="text-[10px] text-zinc-500">Exposure Trim</div>
                          <div className="text-zinc-200">
                            {offlineAnalysis.optimization.adjustments.exposureDeltaEv !== null
                              ? `${offlineAnalysis.optimization.adjustments.exposureDeltaEv >= 0 ? '+' : ''}${offlineAnalysis.optimization.adjustments.exposureDeltaEv.toFixed(1)} EV`
                              : 'Unsupported'}
                          </div>
                        </div>
                        <div className="rounded-xl bg-black/30 px-2.5 py-2 border border-white/5">
                          <div className="text-[10px] text-zinc-500">White Balance</div>
                          <div className="text-zinc-200">
                            {offlineAnalysis.optimization.adjustments.whiteBalanceKelvin !== null
                              ? `${offlineAnalysis.optimization.adjustments.whiteBalanceKelvin}K`
                              : 'Unsupported'}
                          </div>
                        </div>
                        <div className="rounded-xl bg-black/30 px-2.5 py-2 border border-white/5">
                          <div className="text-[10px] text-zinc-500">ISO Target</div>
                          <div className="text-zinc-200">
                            {offlineAnalysis.optimization.adjustments.isoTarget !== null
                              ? offlineAnalysis.optimization.adjustments.isoTarget
                              : 'Auto (Track Fixed)'}
                          </div>
                        </div>
                        <div className="rounded-xl bg-black/30 px-2.5 py-2 border border-white/5">
                          <div className="text-[10px] text-zinc-500">Horizon Tilt</div>
                          <div className="text-zinc-200">
                            {offlineAnalysis.tiltDegrees >= 0 ? `+${offlineAnalysis.tiltDegrees}` : offlineAnalysis.tiltDegrees}°
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Optional Online Gemini Vision Coach */}
                    <div className="pt-3 border-t border-white/10 space-y-2">
                      <button
                        type="button"
                        onClick={requestOnlineCoach}
                        disabled={onlineLoading}
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[var(--nova-accent)]" />
                        <span>
                          {onlineLoading
                            ? 'Analyzing live frame with Gemini Vision...'
                            : privacy.onlineAiConsent && !privacy.offlineOnlyMode
                              ? 'Deep Coach via Online Vision AI'
                              : 'Online Vision AI (Consent Required)'}
                        </span>
                      </button>

                      {onlineError && (
                        <p className="text-[11px] text-amber-300 leading-snug">{onlineError}</p>
                      )}

                      {onlineCoach && (
                        <div className="rounded-xl bg-black/35 border border-white/10 p-3 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-zinc-400">
                            <span>Cloud Vision Coach</span>
                            <span className="font-mono text-[10px]">{onlineCoach.detectedScene}</span>
                          </div>
                          <p className="text-zinc-100 leading-relaxed">{onlineCoach.primaryAdvice}</p>
                          {onlineCoach.secondaryTips?.slice(0, 2).map((t, i) => (
                            <p key={i} className="text-zinc-400">
                              • {t}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">Sampling viewfinder telemetry...</p>
            )}
          </LiquidGlassPanel>
        </div>
      </div>
    </div>
  );
}
