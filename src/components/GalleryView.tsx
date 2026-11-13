import React, { useMemo, useState } from 'react';
import {
  Check,
  Download,
  Grid3X3,
  Heart,
  Info,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { GalleryItem, PhotoAnalysisResult, PrivacyAndAiSettings } from '../types/nova';
import { analyzeFrameOffline, capitalizeScene } from '../engine/offlineAiEngine';
import { probeRuntimeCameraCapabilities } from '../engine/hardwareDetector';
import { LiquidGlassPanel } from './LiquidGlass';

interface GalleryViewProps {
  items: GalleryItem[];
  onToggleFavorite: (id: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onAppendAnalysis: (id: string, analysis: PhotoAnalysisResult) => Promise<void>;
  privacy: PrivacyAndAiSettings;
}

export function GalleryView({
  items,
  onToggleFavorite,
  onDeleteItem,
  onAppendAnalysis,
  privacy,
}: GalleryViewProps) {
  const [filterTab, setFilterTab] = useState<'all' | 'photos' | 'videos' | 'favorites'>('all');
  const [albumFilter, setAlbumFilter] = useState<string>('All');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [compareSplit, setCompareSplit] = useState<number>(50);
  const [showCompareSlider, setShowCompareSlider] = useState<boolean>(true);
  const [showOverlayGrid, setShowOverlayGrid] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const albums = useMemo(() => {
    const set = new Set<string>(['All']);
    items.forEach((i) => set.add(i.album));
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterTab === 'photos' && item.mediaType !== 'photo') return false;
      if (filterTab === 'videos' && item.mediaType !== 'video') return false;
      if (filterTab === 'favorites' && !item.favorite) return false;
      if (albumFilter !== 'All' && item.album !== albumFilter) return false;
      return true;
    });
  }, [items, filterTab, albumFilter]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const runPhotoAnalysis = async (item: GalleryItem) => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      // Always compute local offline critique first
      const img = new Image();
      img.src = item.gradedDataUrl;
      await new Promise((r) => {
        img.onload = r;
        img.onerror = r;
      });
      const caps = await probeRuntimeCameraCapabilities(null, 'sample_scene');
      const offline = analyzeFrameOffline(img, caps);

      if (privacy.onlineAiConsent && !privacy.offlineOnlyMode) {
        const base64 = item.gradedDataUrl.split(',')[1];
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: item.mimeType || 'image/jpeg',
            consent: true,
            exif: item.exif,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Online AI analysis failed');
        if (privacy.saveAnalysisHistory) {
          await onAppendAnalysis(item.id, json);
        }
      } else if (offline) {
        // Offline structured analysis
        const offlineResult: PhotoAnalysisResult = {
          source: 'offline-pixel-engine',
          analyzedAt: new Date().toISOString(),
          overallFeedback: offline.primaryAdvice ?? 'Balanced exposure and framing.',
          subjectiveIndicator: Math.max(
            62,
            Math.min(
              92,
              Math.round(
                82 -
                  Math.abs(offline.tiltDegrees) * 2.2 -
                  offline.highlightClipPct * 1.4 -
                  offline.backgroundClutter * 0.12
              )
            )
          ),
          dimensions: {
            composition: `Subject visual weight at (${offline.subjectCentroid.x.toFixed(2)}, ${offline.subjectCentroid.y.toFixed(2)}).`,
            subjectPositioning:
              Math.abs(offline.subjectCentroid.x - 0.5) < 0.06
                ? 'Centered framing; consider rule-of-thirds offset for dynamic tension.'
                : 'Off-center weight aligns cleanly with rule-of-thirds balance.',
            lighting: `Mean frame luminance ${offline.meanLuminance}/255 with warmth bias ${offline.warmthBias >= 0 ? '+' : ''}${offline.warmthBias.toFixed(2)}.`,
            exposure: `${offline.highlightClipPct}% clipped highlights · ${offline.shadowCrushPct}% deep shadows.`,
            sharpness: `Center edge acuity measured at ${offline.centerSharpness}%.`,
            background: `Periphery edge clutter measured at ${offline.backgroundClutter}%.`,
            colourBalance: `Profile ${item.exif.profileName} rendered at ${item.exif.wbKelvin}K target.`,
            horizonAlignment: `Estimated horizon tilt ${offline.tiltDegrees >= 0 ? '+' : ''}${offline.tiltDegrees}°.`,
            visualDistractions:
              offline.backgroundClutter > 46
                ? 'Moderate peripheral edge clutter; telephoto or tighter step-in recommended.'
                : 'Clean perimeter without major distracting contrast spikes.',
          },
          strengths: [
            offline.highlightClipPct < 2.5
              ? 'Highlights remain well-controlled without severe clipping.'
              : 'Distinct subject-to-frame luminance separation.',
            offline.centerSharpness > 35
              ? 'Crisp central plane micro-contrast.'
              : 'Smooth tonal gradation across midtones.',
          ],
          improvements:
            offline.secondaryTips.length > 0
              ? offline.secondaryTips
              : [
                  Math.abs(offline.tiltDegrees) > 1.5
                    ? `Level horizon by ${Math.abs(offline.tiltDegrees).toFixed(1)}°.`
                    : 'Enable Online Vision AI in Settings for deeper semantic critique.',
                ],
          retakeSuggestions: [
            `Try ${item.exif.sceneDetected === 'portrait' ? '115mm telephoto compression' : 'subtle EV bracketing'} for an alternate frame.`,
          ],
        };
        if (privacy.saveAnalysisHistory) {
          await onAppendAnalysis(item.id, offlineResult);
        }
      }
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleShareOrDownload = async (item: GalleryItem, variant: 'graded' | 'original') => {
    const url = variant === 'graded' ? item.gradedDataUrl : item.originalDataUrl;
    const ext = item.mediaType === 'video' ? 'webm' : 'jpg';
    const filename = `${item.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${variant}.${ext}`;

    if (variant === 'graded' && navigator.share && item.mediaType === 'photo') {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: item.title, files: [file] });
          return;
        }
      } catch {
        // Fallback to direct download
      }
    }

    const a = document.createElement('a');
    a.href = item.mediaType === 'video' && item.videoBlobUrl ? item.videoBlobUrl : url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setShareToast(`Downloaded ${variant} file`);
    window.setTimeout(() => setShareToast(null), 2200);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 lg:pb-10 space-y-5">
      {/* Header & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-zinc-900 dark:text-white">
            Gallery & EXIF Studio
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
            {items.length} saved captures · Original sensor frames preserved non-destructively alongside colour-graded outputs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-black/25 border border-white/10">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'photos', label: 'Recent Photos' },
                { id: 'videos', label: 'Videos' },
                { id: 'favorites', label: 'Favorites' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  filterTab === tab.id
                    ? 'bg-[var(--nova-accent)] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={albumFilter}
            onChange={(e) => setAlbumFilter(e.target.value)}
            aria-label="Filter by album"
            className="min-h-[42px] px-3 rounded-xl bg-zinc-900/80 border border-white/10 text-xs text-zinc-200"
          >
            {albums.map((a) => (
              <option key={a} value={a}>
                Album: {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Media Grid */}
      {filteredItems.length === 0 ? (
        <LiquidGlassPanel className="p-10 text-center space-y-2">
          <p className="text-sm text-zinc-300">No captures match the current filter.</p>
          <p className="text-xs text-zinc-500">Switch back to All or capture a new frame from the Photo/Video studio.</p>
        </LiquidGlassPanel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItemId(item.id)}
              className="group cursor-pointer rounded-2xl overflow-hidden bg-zinc-900/80 border border-white/10 hover:border-[var(--nova-accent)] transition-colors flex flex-col"
            >
              <div className="relative aspect-[4/3] bg-black overflow-hidden">
                <img
                  src={item.gradedDataUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                />
                {item.mediaType === 'video' && (
                  <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded-lg bg-black/70 text-white text-[11px] font-mono flex items-center gap-1">
                    <Video className="w-3 h-3" />
                    <span>VIDEO</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item.id);
                  }}
                  aria-label="Toggle favorite"
                  className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/55 flex items-center justify-center text-white hover:bg-black/80"
                >
                  <Heart
                    className={`w-4 h-4 ${item.favorite ? 'fill-rose-500 text-rose-500' : 'text-white/80'}`}
                  />
                </button>
              </div>
              <div className="p-3.5 space-y-1">
                <h3 className="text-sm font-display font-medium text-white truncate">{item.title}</h3>
                <div className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono tabular-nums truncate">
                  <span>{item.exif.focalLengthMm}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.exif.aperture}</span>
                  <span aria-hidden="true">·</span>
                  <span>ISO {item.exif.iso}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox Inspector */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-6xl rounded-3xl bg-[#0d0e12] border border-white/12 overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 max-h-[92vh]">
            {/* Left: Image/Video & Before-After Split Comparison */}
            <div className="lg:col-span-7 bg-black relative flex flex-col justify-between p-4">
              <div className="flex items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-2">
                  {selectedItem.mediaType === 'photo' && (
                    <button
                      type="button"
                      onClick={() => setShowCompareSlider((v) => !v)}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 border ${
                        showCompareSlider
                          ? 'bg-[var(--nova-accent)] text-white border-transparent'
                          : 'bg-white/10 border-white/15 text-zinc-200'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Original vs Edited</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowOverlayGrid((v) => !v)}
                    className={`min-h-[36px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 border ${
                      showOverlayGrid
                        ? 'bg-white/20 border-white/25 text-white'
                        : 'bg-white/5 border-white/10 text-zinc-300'
                    }`}
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                    <span>Composition Grid</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedItemId(null)}
                  aria-label="Close inspector"
                  className="min-h-[40px] min-w-[40px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-zinc-950 select-none">
                {selectedItem.mediaType === 'video' && selectedItem.videoBlobUrl ? (
                  <video
                    src={selectedItem.videoBlobUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <>
                    {/* Base Graded Image */}
                    <img
                      src={selectedItem.gradedDataUrl}
                      alt={selectedItem.title}
                      className="w-full h-full object-contain"
                    />
                    {/* Split Original Overlay */}
                    {showCompareSlider && (
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}
                      >
                        <img
                          src={selectedItem.originalDataUrl}
                          alt={`${selectedItem.title} original`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    {showCompareSlider && (
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow"
                        style={{ left: `${compareSplit}%` }}
                      />
                    )}
                  </>
                )}

                {showOverlayGrid && (
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                    <div className="border-r border-b border-white/25" />
                    <div className="border-r border-b border-white/25" />
                    <div className="border-b border-white/25" />
                    <div className="border-r border-b border-white/25" />
                    <div className="border-r border-b border-white/25" />
                    <div className="border-b border-white/25" />
                    <div className="border-r border-white/25" />
                    <div className="border-r border-white/25" />
                    <div />
                  </div>
                )}
              </div>

              {selectedItem.mediaType === 'photo' && showCompareSlider && (
                <div className="pt-3 space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                    <span>Original Untouched</span>
                    <span>{selectedItem.exif.profileName} Graded</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={compareSplit}
                    onChange={(e) => setCompareSplit(Number(e.target.value))}
                    className="nova-range w-full"
                    aria-label="Original vs edited split slider"
                  />
                </div>
              )}
            </div>

            {/* Right: EXIF Metadata + AI Photo Analysis + Actions */}
            <div className="lg:col-span-5 p-5 overflow-y-auto space-y-5 border-t lg:border-t-0 lg:border-l border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-display font-semibold text-white">{selectedItem.title}</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {new Date(selectedItem.createdAt).toLocaleString()} · {selectedItem.width}×{selectedItem.height}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(selectedItem.id)}
                  aria-label="Favorite item"
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center"
                >
                  <Heart
                    className={`w-4 h-4 ${selectedItem.favorite ? 'fill-rose-500 text-rose-500' : 'text-zinc-300'}`}
                  />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleShareOrDownload(selectedItem, 'graded')}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[var(--nova-accent)] text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share / Export Graded</span>
                </button>
                {selectedItem.mediaType === 'photo' && (
                  <button
                    type="button"
                    onClick={() => handleShareOrDownload(selectedItem, 'original')}
                    className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save Original</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(selectedItem.id)}
                  className="min-h-[40px] px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              {shareToast && (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>{shareToast}</span>
                </div>
              )}

              {/* Delete Confirmation */}
              {confirmDeleteId === selectedItem.id && (
                <div className="rounded-xl p-3 bg-rose-500/15 border border-rose-500/30 space-y-2">
                  <p className="text-xs text-rose-200">Permanently delete this capture and its analysis history?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteItem(selectedItem.id);
                        setConfirmDeleteId(null);
                        setSelectedItemId(null);
                      }}
                      className="min-h-[34px] px-3 rounded-lg bg-rose-600 text-white text-xs font-medium"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="min-h-[34px] px-3 rounded-lg bg-white/10 text-zinc-200 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* EXIF Metadata Table */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                  <Info className="w-3.5 h-3.5 text-[var(--nova-accent)]" />
                  <span>EXIF & Lens Metadata</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs font-mono tabular-nums">
                  <span className="text-zinc-500">Camera</span>
                  <span className="text-zinc-200 truncate">{selectedItem.exif.cameraModel}</span>
                  <span className="text-zinc-500">Lens</span>
                  <span className="text-zinc-200 truncate">{selectedItem.exif.lensLabel}</span>
                  <span className="text-zinc-500">Exposure</span>
                  <span className="text-zinc-200">
                    {selectedItem.exif.shutterSpeed} · {selectedItem.exif.aperture} · ISO {selectedItem.exif.iso}
                  </span>
                  <span className="text-zinc-500">EV / WB</span>
                  <span className="text-zinc-200">
                    {selectedItem.exif.ev >= 0 ? `+${selectedItem.exif.ev}` : selectedItem.exif.ev} EV · {selectedItem.exif.wbKelvin}K
                  </span>
                  <span className="text-zinc-500">Colour</span>
                  <span className="text-zinc-200">{selectedItem.exif.profileName}</span>
                  <span className="text-zinc-500">Scene AI</span>
                  <span className="text-zinc-200">
                    {capitalizeScene(selectedItem.exif.sceneDetected)} ({selectedItem.exif.aiOptimized ? 'Subtle Opt.' : 'Manual'})
                  </span>
                </div>
              </div>

              {/* AI Photo Analysis */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--nova-accent)]" />
                    <span>Post-Capture AI Photo Analysis</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => runPhotoAnalysis(selectedItem)}
                    disabled={analyzing}
                    className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {analyzing
                      ? 'Evaluating...'
                      : privacy.onlineAiConsent && !privacy.offlineOnlyMode
                        ? 'Analyze (Gemini Vision)'
                        : 'Analyze (Offline Engine)'}
                  </button>
                </div>

                {analysisError && <p className="text-xs text-amber-300">{analysisError}</p>}

                {selectedItem.analysisHistory.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    No analysis recorded yet. Run offline pixel critique anytime or enable Online Vision AI in Settings.
                  </p>
                ) : (
                  selectedItem.analysisHistory.map((rep, idx) => (
                    <div key={idx} className="rounded-2xl bg-white/5 border border-white/10 p-3.5 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="font-mono">{rep.source}</span>
                        <span className="font-mono tabular-nums text-zinc-200">
                          Subjective Indicator: {rep.subjectiveIndicator}/100
                        </span>
                      </div>
                      <p className="text-zinc-100 leading-relaxed">{rep.overallFeedback}</p>

                      <div className="grid grid-cols-1 gap-1.5 text-[11px] text-zinc-300 border-t border-white/10 pt-2">
                        <div><strong>Composition:</strong> {rep.dimensions.composition}</div>
                        <div><strong>Lighting:</strong> {rep.dimensions.lighting}</div>
                        <div><strong>Exposure:</strong> {rep.dimensions.exposure}</div>
                        <div><strong>Sharpness:</strong> {rep.dimensions.sharpness}</div>
                        <div><strong>Background:</strong> {rep.dimensions.background}</div>
                        <div><strong>Horizon:</strong> {rep.dimensions.horizonAlignment}</div>
                      </div>

                      {rep.retakeSuggestions.length > 0 && (
                        <div className="border-t border-white/10 pt-2 text-[11px] text-zinc-300">
                          <strong>Retake Suggestions:</strong>
                          <ul className="mt-1 space-y-0.5">
                            {rep.retakeSuggestions.map((s, si) => (
                              <li key={si}>• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
