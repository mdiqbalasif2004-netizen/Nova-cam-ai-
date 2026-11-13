import { useEffect, useState } from 'react';
import { AccentPresetId, PrivacyAndAiSettings, ThemeSettings } from '../types/nova';

export const ACCENT_PRESETS: { id: AccentPresetId; label: string; hex: string }[] = [
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'ice_blue', label: 'Ice Blue', hex: '#38bdf8' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'white', label: 'White', hex: '#f8fafc' },
];

export const DEFAULT_THEME: ThemeSettings = {
  darkMode: true,
  accentPreset: 'violet',
  customAccentHex: '#8b5cf6',
  glassBlurPx: 18,
  glassOpacity: 0.62,
};

export const DEFAULT_PRIVACY: PrivacyAndAiSettings = {
  autoCoachEnabled: true,
  autoSceneOptimizeEnabled: true,
  onlineAiConsent: false,
  offlineOnlyMode: true,
  saveAnalysisHistory: true,
};

const THEME_KEY = 'nova_cam_theme_v1';
const PRIVACY_KEY = 'nova_cam_privacy_v1';

function hexToRgbTuple(hex: string): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r}, ${g}, ${b}`;
}

export function resolveAccentHex(theme: ThemeSettings): string {
  if (theme.accentPreset === 'custom') {
    return theme.customAccentHex;
  }
  const found = ACCENT_PRESETS.find((p) => p.id === theme.accentPreset);
  return found ? found.hex : '#8b5cf6';
}

export function useNovaSettings() {
  const [theme, setTheme] = useState<ThemeSettings>(() => {
    try {
      const raw = localStorage.getItem(THEME_KEY);
      return raw ? { ...DEFAULT_THEME, ...JSON.parse(raw) } : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });

  const [privacy, setPrivacy] = useState<PrivacyAndAiSettings>(() => {
    try {
      const raw = localStorage.getItem(PRIVACY_KEY);
      return raw ? { ...DEFAULT_PRIVACY, ...JSON.parse(raw) } : DEFAULT_PRIVACY;
    } catch {
      return DEFAULT_PRIVACY;
    }
  });

  useEffect(() => {
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    const root = document.documentElement;
    root.classList.toggle('dark', theme.darkMode);

    let accent = resolveAccentHex(theme);
    if (!theme.darkMode && theme.accentPreset === 'white') {
      accent = '#18181b';
    }
    root.style.setProperty('--nova-accent', accent);
    root.style.setProperty('--nova-accent-rgb', hexToRgbTuple(accent));
    root.style.setProperty('--nova-glass-blur', `${theme.glassBlurPx}px`);
    root.style.setProperty('--nova-glass-opacity', `${theme.glassOpacity}`);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(PRIVACY_KEY, JSON.stringify(privacy));
  }, [privacy]);

  const resetTheme = () => setTheme(DEFAULT_THEME);

  return {
    theme,
    setTheme,
    resetTheme,
    privacy,
    setPrivacy,
    activeAccentHex: !theme.darkMode && theme.accentPreset === 'white' ? '#18181b' : resolveAccentHex(theme),
  };
}
