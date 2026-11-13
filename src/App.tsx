import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Compass, Image as ImageIcon, Settings, Video } from 'lucide-react';
import {
  AppSection,
  GalleryItem,
  HardwareCapabilities,
  OfflineAnalysisResult,
  OnlineCoachResult,
  PhotoAnalysisResult,
} from './types/nova';
import { useNovaSettings } from './hooks/useNovaSettings';
import { probeRuntimeCameraCapabilities } from './engine/hardwareDetector';
import {
  appendAnalysisToItem,
  clearAllAnalysisHistory,
  deleteGalleryItem,
  ensureInitialGallerySeeded,
  saveGalleryItem,
} from './engine/galleryStorage';
import { CameraWorkspace } from './components/CameraWorkspace';
import { AiCoachHub } from './components/AiCoachHub';
import { GalleryView } from './components/GalleryView';
import { SettingsView } from './components/SettingsView';

export default function App() {
  const { theme, setTheme, resetTheme, privacy, setPrivacy } = useNovaSettings();
  const [section, setSection] = useState<AppSection>('photo');
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [capabilities, setCapabilities] = useState<HardwareCapabilities | null>(null);
  const [offlineAnalysis, setOfflineAnalysis] = useState<OfflineAnalysisResult | null>(null);
  const [onlineCoach, setOnlineCoach] = useState<OnlineCoachResult | null>(null);

  useEffect(() => {
    ensureInitialGallerySeeded().then(setGalleryItems);
    probeRuntimeCameraCapabilities(null, 'sample_scene').then(setCapabilities);
  }, []);

  const handleCaptureSaved = useCallback(async (item: GalleryItem) => {
    await saveGalleryItem(item);
    setGalleryItems((prev) => [item, ...prev]);
  }, []);

  const handleToggleFavorite = useCallback(
    async (id: string) => {
      const target = galleryItems.find((i) => i.id === id);
      if (!target) return;
      const updated = { ...target, favorite: !target.favorite };
      await saveGalleryItem(updated);
      setGalleryItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    },
    [galleryItems]
  );

  const handleDeleteItem = useCallback(async (id: string) => {
    await deleteGalleryItem(id);
    setGalleryItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleAppendAnalysis = useCallback(async (id: string, analysis: PhotoAnalysisResult) => {
    await appendAnalysisToItem(id, analysis);
    setGalleryItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, analysisHistory: [analysis, ...i.analysisHistory] } : i
      )
    );
  }, []);

  const handleClearAnalysisHistory = useCallback(async () => {
    await clearAllAnalysisHistory();
    setGalleryItems((prev) => prev.map((i) => ({ ...i, analysisHistory: [] })));
  }, []);

  const navItems: { id: AppSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'photo', label: 'Photo', icon: Camera },
    { id: 'video', label: 'Video', icon: Video },
    { id: 'coach', label: 'AI Coach', icon: Compass },
    { id: 'gallery', label: 'Gallery', icon: ImageIcon },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#f4f5f8] dark:bg-[#050507] text-slate-900 dark:text-zinc-100 transition-colors duration-200 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#090a0d]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setSection('photo')}
            className="text-base sm:text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            NOVA CAM AI
          </button>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  section === item.id
                    ? 'border-[var(--nova-accent)] text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <a
              href="/api/android-project.zip"
              download="nova-cam-ai-android.zip"
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[var(--nova-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 flex items-center"
            >
              Export Android
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-4">
        {(section === 'photo' || section === 'video') && capabilities && (
          <CameraWorkspace
            mode={section}
            onModeChange={(m) => setSection(m)}
            onOpenGallery={() => setSection('gallery')}
            latestGalleryItem={galleryItems[0]}
            onCaptureSaved={handleCaptureSaved}
            privacy={privacy}
            onUpdatePrivacy={setPrivacy}
            capabilities={capabilities}
            onCapabilitiesChange={setCapabilities}
            offlineAnalysis={offlineAnalysis}
            onOfflineAnalysisChange={setOfflineAnalysis}
            onlineCoach={onlineCoach}
            onOnlineCoachChange={setOnlineCoach}
          />
        )}

        {section === 'coach' && capabilities && (
          <AiCoachHub
            offlineAnalysis={offlineAnalysis}
            onlineCoach={onlineCoach}
            capabilities={capabilities}
            privacy={privacy}
            onUpdatePrivacy={setPrivacy}
            onOpenCamera={() => setSection('photo')}
          />
        )}

        {section === 'gallery' && (
          <GalleryView
            items={galleryItems}
            onToggleFavorite={handleToggleFavorite}
            onDeleteItem={handleDeleteItem}
            onAppendAnalysis={handleAppendAnalysis}
            privacy={privacy}
          />
        )}

        {section === 'settings' && capabilities && (
          <SettingsView
            theme={theme}
            onUpdateTheme={setTheme}
            onResetTheme={resetTheme}
            privacy={privacy}
            onUpdatePrivacy={setPrivacy}
            onClearAnalysisHistory={handleClearAnalysisHistory}
            capabilities={capabilities}
          />
        )}
      </main>

      {/* Mobile Bottom Thumb Navigation (<= 15% mobile viewport height) */}
      <nav
        aria-label="Primary sections"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#090a0d]/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/10"
      >
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active
                    ? 'text-[var(--nova-accent)]'
                    : 'text-slate-600 dark:text-zinc-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
