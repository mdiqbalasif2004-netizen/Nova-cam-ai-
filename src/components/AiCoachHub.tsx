import React, { useState } from 'react';
import { Compass, Eye, ShieldAlert, Sliders, Sparkles, Upload, Wand2 } from 'lucide-react';
import {
  HardwareCapabilities,
  OfflineAnalysisResult,
  OnlineCoachResult,
  PrivacyAndAiSettings,
  SceneType,
} from '../types/nova';
import { analyzeFrameOffline, capitalizeScene } from '../engine/offlineAiEngine';
import { LiquidGlassPanel } from './LiquidGlass';

interface AiCoachHubProps {
  offlineAnalysis: OfflineAnalysisResult | null;
  onlineCoach: OnlineCoachResult | null;
  capabilities: HardwareCapabilities;
  privacy: PrivacyAndAiSettings;
  onUpdatePrivacy: (next: PrivacyAndAiSettings) => void;
  onOpenCamera: () => void;
}

const SCENE_PROFILES: {
  scene: SceneType;
  exposure: string;
  wb: string;
  isoRule: string;
  focusRule: string;
  intent: string;
}[] = [
  {
    scene: 'portrait',
    exposure: '+0.0 to +0.2 EV',
    wb: '5350K skin-neutral',
    isoRule: 'Keep ISO ≤ 200 in daylight',
    focusRule: 'Continuous eye/subject AF',
    intent: 'Preserves natural skin luminosity and gentle shadow roll-off without flattening facial contrast.',
  },
  {
    scene: 'landscape',
    exposure: '-0.1 to -0.3 EV',
    wb: '5600K daylight',
    isoRule: 'Base ISO 100 priority',
    focusRule: 'Hyperfocal / infinity focus',
    intent: 'Protects bright cloud and sky gradients while keeping foliage greens organic and un-neon.',
  },
  {
    scene: 'night',
    exposure: '+0.3 EV subtle lift',
    wb: '4300K–4800K ambient',
    isoRule: 'Balanced ISO 640 cap',
    focusRule: 'Low-light contrast AF',
    intent: 'Lifts shadow readability gently while preserving dark sky depth and neon/streetlamp colour.',
  },
  {
    scene: 'food',
    exposure: '+0.2 EV clean lift',
    wb: '5150K warm-neutral',
    isoRule: 'ISO ≤ 250 for texture',
    focusRule: 'Macro / close plane AF',
    intent: 'Keeps plates crisp and appetizing without artificial oversaturation or clipped ceramic highlights.',
  },
  {
    scene: 'sunset',
    exposure: '-0.4 EV highlight lock',
    wb: '5900K golden preserve',
    isoRule: 'Base ISO 100',
    focusRule: 'Horizon / infinity focus',
    intent: 'Retains solar orb detail and warm atmospheric gradients without washing out dusk tones.',
  },
  {
    scene: 'architecture',
    exposure: '-0.1 EV micro-contrast',
    wb: '5400K neutral',
    isoRule: 'Base ISO 100',
    focusRule: 'Infinity plane focus',
    intent: 'Emphasizes geometric lines and concrete texture with neutral white balance.',
  },
];

export function AiCoachHub({
  offlineAnalysis,
  onlineCoach,
  capabilities,
  privacy,
  onUpdatePrivacy,
  onOpenCamera,
}: AiCoachHubProps) {
  const [customPreview, setCustomPreview] = useState<string | null>(null);
  const [customOffline, setCustomOffline] = useState<OfflineAnalysisResult | null>(null);
  const [customOnline, setCustomOnline] = useState<OnlineCoachResult | null>(null);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeOffline = customOffline ?? offlineAnalysis;

  const handleAnalyzeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const dataUrl = reader.result;
      setCustomPreview(dataUrl);
      setCustomOnline(null);
      setErrorMsg(null);
      const img = new Image();
      img.onload = () => {
        const res = analyzeFrameOffline(img, capabilities);
        setCustomOffline(res);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const runOnlineOnUploaded = async () => {
    if (!customPreview) return;
    if (!privacy.onlineAiConsent || privacy.offlineOnlyMode) {
      setErrorMsg('Grant explicit Online Vision AI consent below before uploading frames.');
      return;
    }
    setLoadingOnline(true);
    setErrorMsg(null);
    try {
      const base64 = customPreview.split(',')[1];
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
          offlineSummary: activeOffline
            ? {
                detectedScene: activeOffline.detectedScene,
                tiltDegrees: activeOffline.tiltDegrees,
                highlightClipPct: activeOffline.highlightClipPct,
              }
            : {},
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Online analysis failed');
      setCustomOnline(json);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete online coaching.');
    } finally {
      setLoadingOnline(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 lg:pb-10 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-zinc-900 dark:text-white">
            Intelligent AI Camera Coach
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
            Offline-first real-time composition analysis and subtle, hardware-aware scene optimization before you press the shutter.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="min-h-[42px] px-4 py-2 rounded-xl bg-white/10 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-900 dark:text-white hover:bg-white/15 cursor-pointer flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-[var(--nova-accent)]" />
            <span>Test Frame</span>
            <input type="file" accept="image/*" onChange={handleAnalyzeUpload} className="hidden" />
          </label>
          <button
            type="button"
            onClick={onOpenCamera}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--nova-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Return to Viewfinder
          </button>
        </div>
      </div>

      {/* Live Telemetry & Subject Placement Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <LiquidGlassPanel className="lg:col-span-7 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[var(--nova-accent)]" />
              <h2 className="text-base font-display font-semibold text-white">
                Active Scene Telemetry
              </h2>
            </div>
            {activeOffline && (
              <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                {capitalizeScene(activeOffline.detectedScene)} · {Math.round(activeOffline.confidence * 100)}% confidence
              </span>
            )}
          </div>

          {customPreview && (
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-black/20 border border-white/10">
              <img src={customPreview} alt="Test frame" className="w-28 h-20 object-cover rounded-xl" />
              <div className="flex-1 space-y-2">
                <p className="text-xs text-zinc-300">Analyzing imported test frame instead of live viewfinder.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runOnlineOnUploaded}
                    disabled={loadingOnline}
                    className="min-h-[36px] px-3 rounded-lg bg-[var(--nova-accent)] text-white text-xs font-medium"
                  >
                    {loadingOnline ? 'Analyzing...' : 'Run Online Gemini Coach'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPreview(null);
                      setCustomOffline(null);
                      setCustomOnline(null);
                    }}
                    className="min-h-[36px] px-3 rounded-lg bg-white/10 text-zinc-300 text-xs"
                  >
                    Clear Test Frame
                  </button>
                </div>
                {errorMsg && <p className="text-xs text-amber-400">{errorMsg}</p>}
              </div>
            </div>
          )}

          {activeOffline ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Rule of Thirds Subject Centroid Map */}
              <div className="rounded-2xl bg-black/30 border border-white/10 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Visual Weight & Subject Placement</span>
                  <span className="font-mono tabular-nums">
                    ({activeOffline.subjectCentroid.x.toFixed(2)}, {activeOffline.subjectCentroid.y.toFixed(2)})
                  </span>
                </div>
                <div className="relative aspect-[4/3] w-full rounded-xl bg-zinc-950 border border-white/10 overflow-hidden">
                  {/* Thirds lines */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                    <div className="border-r border-b border-white/10" />
                    <div className="border-r border-b border-white/10" />
                    <div className="border-b border-white/10" />
                    <div className="border-r border-b border-white/10" />
                    <div className="border-r border-b border-white/10" />
                    <div className="border-b border-white/10" />
                    <div className="border-r border-white/10" />
                    <div className="border-r border-white/10" />
                    <div />
                  </div>
                  {/* Detected Visual Weight Dot */}
                  <div
                    className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg transition-all duration-300"
                    style={{
                      left: `${activeOffline.subjectCentroid.x * 100}%`,
                      top: `${activeOffline.subjectCentroid.y * 100}%`,
                      backgroundColor: 'var(--nova-accent)',
                    }}
                  />
                </div>
              </div>

              {/* Lighting, Sharpness, Clutter, Tilt Metrics */}
              <div className="space-y-3 text-xs">
                <div className="rounded-xl bg-black/25 border border-white/10 p-3 space-y-2">
                  <div className="flex justify-between text-zinc-300">
                    <span>Mean Luminance</span>
                    <span className="font-mono tabular-nums">{activeOffline.meanLuminance} / 255</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--nova-accent)]"
                      style={{ width: `${(activeOffline.meanLuminance / 255) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-black/25 border border-white/10 p-3 space-y-2">
                  <div className="flex justify-between text-zinc-300">
                    <span>Center Sharpness</span>
                    <span className="font-mono tabular-nums">{activeOffline.centerSharpness}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${activeOffline.centerSharpness}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-black/25 border border-white/10 p-3 space-y-2">
                  <div className="flex justify-between text-zinc-300">
                    <span>Background Edge Clutter</span>
                    <span className="font-mono tabular-nums">{activeOffline.backgroundClutter}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${activeOffline.backgroundClutter}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-black/25 border border-white/10 p-3 flex items-center justify-between text-zinc-300">
                  <span>Estimated Horizon Tilt</span>
                  <span className="font-mono tabular-nums font-medium">
                    {activeOffline.tiltDegrees >= 0 ? `+${activeOffline.tiltDegrees}` : activeOffline.tiltDegrees}°
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Open the Photo or Video viewfinder to stream live scene telemetry.</p>
          )}

          {(customOnline || onlineCoach) && (
            <div className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--nova-accent)]" />
                  Online Vision AI Evaluation
                </span>
                <span className="font-mono">{(customOnline ?? onlineCoach)?.source}</span>
              </div>
              <p className="text-sm text-zinc-100">{(customOnline ?? onlineCoach)?.primaryAdvice}</p>
              {(customOnline ?? onlineCoach)?.lightingAssessment && (
                <p className="text-xs text-zinc-400">
                  Lighting: {(customOnline ?? onlineCoach)?.lightingAssessment}
                </p>
              )}
              {(customOnline ?? onlineCoach)?.backgroundAssessment && (
                <p className="text-xs text-zinc-400">
                  Background: {(customOnline ?? onlineCoach)?.backgroundAssessment}
                </p>
              )}
            </div>
          )}
        </LiquidGlassPanel>

        {/* Right Column: Hardware-Gated Scene Optimization Rules & Consent */}
        <LiquidGlassPanel className="lg:col-span-5 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-[var(--nova-accent)]" />
              <h2 className="text-base font-display font-semibold text-white">
                Scene Optimization Engine
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdatePrivacy({
                  ...privacy,
                  autoSceneOptimizeEnabled: !privacy.autoSceneOptimizeEnabled,
                })
              }
              className={`min-h-[34px] px-3 rounded-lg text-xs font-medium ${
                privacy.autoSceneOptimizeEnabled
                  ? 'bg-[var(--nova-accent)] text-white'
                  : 'bg-white/10 text-zinc-300'
              }`}
            >
              {privacy.autoSceneOptimizeEnabled ? 'Auto-Optimize On' : 'Auto-Optimize Off'}
            </button>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Adjustments are intentionally subtle and constrained by your active hardware capability profile so images stay natural rather than artificially processed.
          </p>

          {/* Hardware Gate Summary */}
          <div className="rounded-xl bg-black/25 border border-white/10 p-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-zinc-200">
              <Sliders className="w-3.5 h-3.5 text-[var(--nova-accent)]" />
              <span>Hardware-Gated Parameters ({capabilities.sourceType === 'live_camera' ? 'Live Track' : 'Studio Mode'})</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1 font-mono text-[11px]">
              <span className={capabilities.supportsExposureComp ? 'text-emerald-400' : 'text-zinc-500'}>
                EV Trim: {capabilities.supportsExposureComp ? 'Supported' : 'Blocked'}
              </span>
              <span className={capabilities.supportsColorTemp ? 'text-emerald-400' : 'text-zinc-500'}>
                WB Kelvin: {capabilities.supportsColorTemp ? 'Supported' : 'Blocked'}
              </span>
              <span className={capabilities.supportsIso ? 'text-emerald-400' : 'text-zinc-500'}>
                Manual ISO: {capabilities.supportsIso ? 'Supported' : 'Blocked'}
              </span>
              <span className={capabilities.supportsFocusMode ? 'text-emerald-400' : 'text-zinc-500'}>
                AF Priority: {capabilities.supportsFocusMode ? 'Supported' : 'Studio N/A'}
              </span>
            </div>
          </div>

          {activeOffline && activeOffline.optimization.skippedUnsupported.length > 0 && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-200 space-y-1">
              <div className="font-medium flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Skipped Unsupported Controls</span>
              </div>
              {activeOffline.optimization.skippedUnsupported.map((s, idx) => (
                <div key={idx}>• {s}</div>
              ))}
            </div>
          )}

          {/* Privacy Consent Switch */}
          <div className="rounded-xl bg-black/25 border border-white/10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[var(--nova-accent)]" />
                <span>Online Gemini Vision Consent</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdatePrivacy({
                    ...privacy,
                    onlineAiConsent: !privacy.onlineAiConsent,
                    offlineOnlyMode: privacy.onlineAiConsent ? true : false,
                  })
                }
                className={`min-h-[32px] px-2.5 rounded-lg text-xs font-medium ${
                  privacy.onlineAiConsent && !privacy.offlineOnlyMode
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/10 text-zinc-300'
                }`}
              >
                {privacy.onlineAiConsent && !privacy.offlineOnlyMode ? 'Consented' : 'Offline Only'}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              Frames are never uploaded unless you explicitly grant consent and trigger Online Vision AI.
            </p>
          </div>
        </LiquidGlassPanel>
      </div>

      {/* Scene Optimization Tuning Matrix */}
      <LiquidGlassPanel className="p-5 space-y-4">
        <h2 className="text-base font-display font-semibold text-zinc-900 dark:text-white">
          Scene Optimization Profiles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {SCENE_PROFILES.map((sp) => (
            <div
              key={sp.scene}
              className={`rounded-2xl p-4 border transition-colors ${
                activeOffline?.detectedScene === sp.scene
                  ? 'border-[var(--nova-accent)] bg-[var(--nova-accent)]/10'
                  : 'border-white/10 bg-black/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-sm font-display font-semibold text-white">
                  {capitalizeScene(sp.scene)}
                </h3>
                {activeOffline?.detectedScene === sp.scene && (
                  <span className="text-[11px] font-mono text-[var(--nova-accent)]">Detected</span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{sp.intent}</p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono tabular-nums text-zinc-300">
                <div>EV: {sp.exposure}</div>
                <div>WB: {sp.wb}</div>
                <div>ISO: {sp.isoRule}</div>
                <div>AF: {sp.focusRule}</div>
              </div>
            </div>
          ))}
        </div>
      </LiquidGlassPanel>
    </div>
  );
}
