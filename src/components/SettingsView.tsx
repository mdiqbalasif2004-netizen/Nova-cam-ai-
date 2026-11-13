import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Download,
  FileCode2,
  Lock,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Shield,
  Smartphone,
  Sun,
  Trash2,
} from 'lucide-react';
import { HardwareCapabilities, PrivacyAndAiSettings, ThemeSettings } from '../types/nova';
import { ACCENT_PRESETS } from '../hooks/useNovaSettings';
import { XIAOMI_17T_REFERENCE_LENSES } from '../engine/hardwareDetector';
import { LiquidGlassPanel } from './LiquidGlass';

interface UpdateManifest {
  appId: string;
  installedVersion: string;
  latestVersion: string;
  channel: string;
  publishedAt: string;
  downloadSizeBytes: number;
  targetDeviceOptimizations: string[];
  releaseNotes: string[];
  verification: {
    sha256: string;
    signingCertSha256: string;
    requiresPackageInstallerConfirmation: boolean;
  };
  playStoreFlow: {
    supportedVia: string;
    mode: string;
  };
}

interface SettingsViewProps {
  theme: ThemeSettings;
  onUpdateTheme: (next: ThemeSettings) => void;
  onResetTheme: () => void;
  privacy: PrivacyAndAiSettings;
  onUpdatePrivacy: (next: PrivacyAndAiSettings) => void;
  onClearAnalysisHistory: () => Promise<void>;
  capabilities: HardwareCapabilities;
}

export function SettingsView({
  theme,
  onUpdateTheme,
  onResetTheme,
  privacy,
  onUpdatePrivacy,
  onClearAnalysisHistory,
  capabilities,
}: SettingsViewProps) {
  const [tab, setTab] = useState<'hardware' | 'ai' | 'theme' | 'updates' | 'android'>('hardware');
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [androidFiles, setAndroidFiles] = useState<string[]>([]);
  const [selectedAndroidFile, setSelectedAndroidFile] = useState<string>('README.md');
  const [androidFileContent, setAndroidFileContent] = useState<string>('');
  const [historyCleared, setHistoryCleared] = useState(false);

  const fetchUpdateManifest = async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch('/api/updates/manifest');
      const json = await res.json();
      setManifest(json);
    } finally {
      setCheckingUpdate(false);
    }
  };

  useEffect(() => {
    if (tab === 'updates' && !manifest) {
      fetchUpdateManifest();
    }
    if (tab === 'android' && androidFiles.length === 0) {
      fetch('/api/android-files')
        .then((r) => r.json())
        .then((data) => {
          const files: string[] = data.files || [];
          setAndroidFiles(files);
          if (files.length > 0) {
            const first = files.includes('COMPATIBILITY_REPORT.md') ? 'COMPATIBILITY_REPORT.md' : files[0];
            setSelectedAndroidFile(first);
          }
        })
        .catch(() => undefined);
    }
  }, [tab, manifest, androidFiles.length]);

  useEffect(() => {
    if (tab !== 'android' || !selectedAndroidFile) return;
    fetch(`/api/android-file?path=${encodeURIComponent(selectedAndroidFile)}`)
      .then((r) => r.json())
      .then((data) => setAndroidFileContent(data.content || ''))
      .catch(() => setAndroidFileContent('Unable to read file.'));
  }, [tab, selectedAndroidFile]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 lg:pb-10 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-zinc-900 dark:text-white">
            Settings & Engineering Console
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
            Hardware capability detection, privacy controls, Liquid Glass colour engine, updates, and Xiaomi 17T Android Studio project
          </p>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'hardware', label: 'Hardware Detection', icon: Cpu },
            { id: 'ai', label: 'AI & Privacy', icon: Shield },
            { id: 'theme', label: 'UI Colour Engine', icon: Palette },
            { id: 'updates', label: 'App Updates', icon: RefreshCw },
            { id: 'android', label: 'Android Project & Xiaomi 17T Report', icon: FileCode2 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                tab === item.id
                  ? 'bg-[var(--nova-accent)] text-white'
                  : 'bg-slate-200/80 dark:bg-white/5 text-slate-700 dark:text-zinc-300 hover:bg-slate-300/70 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Hardware Detection */}
      {tab === 'hardware' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <LiquidGlassPanel className="lg:col-span-6 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-display font-semibold text-white">
                Active Runtime Probed Capabilities
              </h2>
              <span className="text-xs font-mono text-[var(--nova-accent)]">{capabilities.sourceType}</span>
            </div>
            <p className="text-xs text-zinc-400">
              Probed directly via <code className="font-mono">navigator.mediaDevices</code> and{' '}
              <code className="font-mono">MediaStreamTrack.getCapabilities()</code>. Unsupported controls are hidden from the viewfinder.
            </p>
            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono tabular-nums">
              <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                <div className="text-zinc-500 text-[10px]">Active Device</div>
                <div className="text-zinc-100 truncate mt-0.5">{capabilities.deviceLabel}</div>
              </div>
              <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                <div className="text-zinc-500 text-[10px]">Max Resolution</div>
                <div className="text-zinc-100 mt-0.5">
                  {capabilities.maxWidth}×{capabilities.maxHeight}
                </div>
              </div>
              <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                <div className="text-zinc-500 text-[10px]">Exposure Comp</div>
                <div className="text-zinc-100 mt-0.5">
                  {capabilities.supportsExposureComp
                    ? `${capabilities.evRange.min} to +${capabilities.evRange.max} EV`
                    : 'Not exposed'}
                </div>
              </div>
              <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                <div className="text-zinc-500 text-[10px]">Manual ISO</div>
                <div className="text-zinc-100 mt-0.5">
                  {capabilities.supportsIso
                    ? `${capabilities.isoRange.min}–${capabilities.isoRange.max}`
                    : 'Camera2 Android only'}
                </div>
              </div>
              <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                <div className="text-zinc-500 text-[10px]">Video HDR Pipeline</div>
                <div className="text-zinc-100 mt-0.5">{capabilities.hdrProfile}</div>
              </div>
              <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                <div className="text-zinc-500 text-[10px]">RAW DNG / HEIF</div>
                <div className="text-zinc-100 mt-0.5">
                  {capabilities.rawCaptureSupported ? 'Supported' : 'Camera2 Android only'}
                </div>
              </div>
            </div>
          </LiquidGlassPanel>

          <LiquidGlassPanel className="lg:col-span-6 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[var(--nova-accent)]" />
                <h2 className="text-base font-display font-semibold text-white">
                  Xiaomi 17T Target Camera2 Matrix
                </h2>
              </div>
              <span className="text-[11px] font-mono text-amber-300">Unverified on physical device</span>
            </div>
            <p className="text-xs text-zinc-400">
              Expected Xiaomi 17T lens specs targeted by <code className="font-mono">camera-xiaomi</code> module. Physical Camera2 IDs and RAW/HDR10+ exposure require runtime inspection on an actual Xiaomi 17T.
            </p>
            <div className="space-y-2">
              {XIAOMI_17T_REFERENCE_LENSES.map((lens) => (
                <div
                  key={lens.id}
                  className="rounded-xl bg-black/30 border border-white/10 p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-medium text-white">
                      {lens.zoomLabel} · {lens.marketingName} ({lens.expectedSensor})
                    </div>
                    <div className="text-zinc-400 font-mono text-[11px] mt-0.5">
                      {lens.focalLengthMm} · {lens.aperture} · {lens.oisExpected ? 'OIS Target' : 'Fixed'} · {lens.fovNote}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-400 shrink-0">Camera2 Probe</span>
                </div>
              ))}
            </div>
          </LiquidGlassPanel>
        </div>
      )}

      {/* TAB 2: AI & Privacy */}
      {tab === 'ai' && (
        <LiquidGlassPanel className="p-5 space-y-5 max-w-3xl">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[var(--nova-accent)]" />
            <h2 className="text-base font-display font-semibold text-white">Privacy-First AI Controls</h2>
          </div>

          <div className="space-y-3">
            {(
              [
                {
                  key: 'autoCoachEnabled',
                  title: 'Live AI Camera Coach',
                  desc: 'Displays pre-shutter composition, horizon, and highlight guidance when meaningful improvements exist.',
                },
                {
                  key: 'autoSceneOptimizeEnabled',
                  title: 'Subtle AI Scene Optimization',
                  desc: 'Automatically applies gentle exposure, white balance, ISO, and focus adjustments constrained to supported hardware.',
                },
                {
                  key: 'offlineOnlyMode',
                  title: 'Strict Offline-Only Mode',
                  desc: 'Keeps all computer vision analysis local on-device. Disables all cloud image transmissions.',
                },
                {
                  key: 'onlineAiConsent',
                  title: 'Explicit Online Gemini Vision Consent',
                  desc: 'Allows sending downscaled frames over HTTPS to our backend Gemini 4 Hydrogen endpoint when requested.',
                },
                {
                  key: 'saveAnalysisHistory',
                  title: 'Save AI Photo Analysis History',
                  desc: 'Stores post-capture AI evaluations locally alongside photo metadata.',
                },
              ] as const
            ).map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-black/25 border border-white/10"
              >
                <div>
                  <div className="text-sm font-medium text-white">{row.title}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{row.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !privacy[row.key];
                    const nextState = { ...privacy, [row.key]: nextVal };
                    if (row.key === 'onlineAiConsent' && nextVal) {
                      nextState.offlineOnlyMode = false;
                    }
                    if (row.key === 'offlineOnlyMode' && nextVal) {
                      nextState.onlineAiConsent = false;
                    }
                    onUpdatePrivacy(nextState);
                  }}
                  className={`min-h-[36px] px-3.5 rounded-xl text-xs font-medium shrink-0 transition-colors ${
                    privacy[row.key]
                      ? 'bg-[var(--nova-accent)] text-white'
                      : 'bg-white/10 text-zinc-300'
                  }`}
                >
                  {privacy[row.key] ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-400">
              {historyCleared ? 'All saved AI analysis history removed.' : 'Remove all locally stored AI photo critique records.'}
            </span>
            <button
              type="button"
              onClick={async () => {
                await onClearAnalysisHistory();
                setHistoryCleared(true);
                window.setTimeout(() => setHistoryCleared(false), 2500);
              }}
              className="min-h-[40px] px-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear AI History</span>
            </button>
          </div>
        </LiquidGlassPanel>
      )}

      {/* TAB 3: Custom UI Colour Engine */}
      {tab === 'theme' && (
        <LiquidGlassPanel className="p-5 space-y-5 max-w-3xl">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-display font-semibold text-white">
              Custom UI Colour Engine & Liquid Glass
            </h2>
            <button
              type="button"
              onClick={onResetTheme}
              className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-zinc-200 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>

          {/* Dark / Light Mode */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/25 border border-white/10">
            <div>
              <div className="text-sm font-medium text-white">Appearance Mode</div>
              <div className="text-xs text-zinc-400">Deep OLED black default or crisp studio daylight mode</div>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateTheme({ ...theme, darkMode: true })}
                className={`min-h-[38px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
                  theme.darkMode ? 'bg-[var(--nova-accent)] text-white' : 'bg-white/10 text-zinc-300'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateTheme({ ...theme, darkMode: false })}
                className={`min-h-[38px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
                  !theme.darkMode ? 'bg-[var(--nova-accent)] text-white' : 'bg-white/10 text-zinc-300'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
            </div>
          </div>

          {/* Accent Presets + Custom Picker */}
          <div className="space-y-2.5">
            <div className="text-xs font-medium text-zinc-300">Accent Colour</div>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onUpdateTheme({ ...theme, accentPreset: preset.id })}
                  className={`min-h-[42px] px-3.5 rounded-xl text-xs font-medium flex items-center gap-2 border transition-colors ${
                    theme.accentPreset === preset.id
                      ? 'border-white bg-white/15 text-white'
                      : 'border-white/10 bg-black/25 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/30"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span>{preset.label}</span>
                </button>
              ))}

              <label className="min-h-[42px] px-3.5 rounded-xl text-xs font-medium flex items-center gap-2 border border-white/10 bg-black/25 text-zinc-300 cursor-pointer">
                <input
                  type="color"
                  value={theme.customAccentHex}
                  onChange={(e) =>
                    onUpdateTheme({
                      ...theme,
                      accentPreset: 'custom',
                      customAccentHex: e.target.value,
                    })
                  }
                  className="w-5 h-5 rounded bg-transparent border-0 cursor-pointer"
                />
                <span>Custom Hex</span>
              </label>
            </div>
          </div>

          {/* Liquid Glass Blur & Opacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <label className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between text-zinc-300">
                <span>Glass Backdrop Blur</span>
                <span className="font-mono tabular-nums">{theme.glassBlurPx}px</span>
              </div>
              <input
                type="range"
                min={4}
                max={28}
                value={theme.glassBlurPx}
                onChange={(e) => onUpdateTheme({ ...theme, glassBlurPx: Number(e.target.value) })}
                className="nova-range w-full"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between text-zinc-300">
                <span>Glass Surface Opacity</span>
                <span className="font-mono tabular-nums">{Math.round(theme.glassOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={35}
                max={90}
                value={Math.round(theme.glassOpacity * 100)}
                onChange={(e) => onUpdateTheme({ ...theme, glassOpacity: Number(e.target.value) / 100 })}
                className="nova-range w-full"
              />
            </label>
          </div>
        </LiquidGlassPanel>
      )}

      {/* TAB 4: Automatic Update Manifest */}
      {tab === 'updates' && (
        <LiquidGlassPanel className="p-5 space-y-4 max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-display font-semibold text-white">
                Automatic App Update Architecture
              </h2>
              <p className="text-xs text-zinc-400">
                Supports Google Play In-App Updates and SHA-256 + signing-certificate-pinned direct APK updates.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchUpdateManifest}
              disabled={checkingUpdate}
              className="min-h-[40px] px-3.5 rounded-xl bg-[var(--nova-accent)] text-white text-xs font-medium flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>Check Manifest</span>
            </button>
          </div>

          {manifest && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono tabular-nums">
                <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                  <div className="text-zinc-500 text-[10px]">Installed</div>
                  <div className="text-zinc-100 mt-0.5">v{manifest.installedVersion}</div>
                </div>
                <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                  <div className="text-zinc-500 text-[10px]">Latest Available</div>
                  <div className="text-[var(--nova-accent)] font-semibold mt-0.5">v{manifest.latestVersion}</div>
                </div>
                <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                  <div className="text-zinc-500 text-[10px]">Package Size</div>
                  <div className="text-zinc-100 mt-0.5">
                    {(manifest.downloadSizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-black/30 p-3.5 border border-white/10 space-y-1.5">
                <div className="font-medium text-zinc-200">Release Notes</div>
                {manifest.releaseNotes.map((n, i) => (
                  <div key={i} className="text-zinc-300">
                    • {n}
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-black/30 p-3.5 border border-white/10 space-y-1.5 font-mono text-[11px] text-zinc-400">
                <div className="flex items-center gap-1.5 text-emerald-400 font-sans text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Integrity & Signing Certificate Pinning</span>
                </div>
                <div className="truncate">APK SHA-256: {manifest.verification.sha256}</div>
                <div className="truncate">Signer Pin: {manifest.verification.signingCertSha256}</div>
                <div>Play Billing/Update SDK: {manifest.playStoreFlow.supportedVia}</div>
              </div>
            </div>
          )}
        </LiquidGlassPanel>
      )}

      {/* TAB 5: Android Studio Project Explorer & Download */}
      {tab === 'android' && (
        <div className="space-y-4">
          <LiquidGlassPanel className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-display font-semibold text-white">
                Android Studio Kotlin & Jetpack Compose Source Tree
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Modular Gradle project targeting Xiaomi 17T (CameraX + Camera2 Interop + Media3 + Room + DataStore + WorkManager). Note: This web sandbox lacks an Android SDK/Gradle binary, so APK compilation must run in Android Studio locally.
              </p>
            </div>
            <a
              href="/api/android-project.zip"
              download="nova-cam-ai-android.zip"
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--nova-accent)] text-white text-xs font-medium flex items-center gap-2 shrink-0 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Download Android Project (.zip)</span>
            </a>
          </LiquidGlassPanel>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <LiquidGlassPanel className="lg:col-span-4 p-3 max-h-[540px] overflow-y-auto space-y-1">
              {androidFiles.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedAndroidFile(f)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono truncate transition-colors ${
                    selectedAndroidFile === f
                      ? 'bg-[var(--nova-accent)] text-white'
                      : 'text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {f}
                </button>
              ))}
            </LiquidGlassPanel>

            <LiquidGlassPanel className="lg:col-span-8 p-4 max-h-[540px] overflow-auto">
              <div className="text-xs font-mono text-zinc-400 pb-2 mb-3 border-b border-white/10">
                android/{selectedAndroidFile}
              </div>
              <pre className="text-xs font-mono text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                {androidFileContent || 'Select a file to inspect source code.'}
              </pre>
            </LiquidGlassPanel>
          </div>
        </div>
      )}
    </div>
  );
}
