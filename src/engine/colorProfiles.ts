import { ColorAdjustments, ColorProfileId, VideoProfileId } from '../types/nova';

export interface ProfilePreset {
  id: ColorProfileId;
  name: string;
  subtitle: string;
  defaults: ColorAdjustments;
  lutTone: {
    contrastCurve: number;
    warmShift: number;
    tintShift: number;
    shadowBlue: number;
    highlightWarm: number;
    saturationMult: number;
    fadeFloor: number;
    monochrome: boolean;
  };
}

export const PHOTO_COLOR_PROFILES: ProfilePreset[] = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    subtitle: 'Deep contrast, controlled highlights, rich natural skin tones',
    defaults: {
      intensity: 85,
      contrast: 12,
      saturation: 4,
      highlights: -14,
      shadows: 6,
      temperature: 4,
      tint: -2,
      sharpness: 18,
      fade: 6,
      vignette: 22,
    },
    lutTone: {
      contrastCurve: 1.14,
      warmShift: 5,
      tintShift: -2,
      shadowBlue: 8,
      highlightWarm: 10,
      saturationMult: 1.03,
      fadeFloor: 7,
      monochrome: false,
    },
  },
  {
    id: 'natural_pro',
    name: 'Natural Professional',
    subtitle: 'Balanced editorial clarity with true-to-life dynamic range',
    defaults: {
      intensity: 80,
      contrast: 6,
      saturation: 2,
      highlights: -8,
      shadows: 10,
      temperature: 0,
      tint: 0,
      sharpness: 20,
      fade: 0,
      vignette: 8,
    },
    lutTone: {
      contrastCurve: 1.06,
      warmShift: 0,
      tintShift: 0,
      shadowBlue: 2,
      highlightWarm: 2,
      saturationMult: 1.02,
      fadeFloor: 0,
      monochrome: false,
    },
  },
  {
    id: 'warm_cinema',
    name: 'Warm Cinema',
    subtitle: 'Golden amber highlights with soft tungsten shadow warmth',
    defaults: {
      intensity: 85,
      contrast: 10,
      saturation: 6,
      highlights: -10,
      shadows: 4,
      temperature: 16,
      tint: 3,
      sharpness: 15,
      fade: 10,
      vignette: 20,
    },
    lutTone: {
      contrastCurve: 1.11,
      warmShift: 15,
      tintShift: 3,
      shadowBlue: -4,
      highlightWarm: 16,
      saturationMult: 1.05,
      fadeFloor: 9,
      monochrome: false,
    },
  },
  {
    id: 'cool_cinema',
    name: 'Cool Cinema',
    subtitle: 'Crisp slate shadows and restrained cerulean atmosphere',
    defaults: {
      intensity: 85,
      contrast: 14,
      saturation: -6,
      highlights: -12,
      shadows: 2,
      temperature: -16,
      tint: -4,
      sharpness: 20,
      fade: 8,
      vignette: 24,
    },
    lutTone: {
      contrastCurve: 1.15,
      warmShift: -14,
      tintShift: -3,
      shadowBlue: 14,
      highlightWarm: -6,
      saturationMult: 0.94,
      fadeFloor: 8,
      monochrome: false,
    },
  },
  {
    id: 'vintage_film',
    name: 'Vintage Film',
    subtitle: 'Lifted matte blacks, soft highlight roll-off, muted hues',
    defaults: {
      intensity: 85,
      contrast: 4,
      saturation: -10,
      highlights: -16,
      shadows: 12,
      temperature: 10,
      tint: 4,
      sharpness: 8,
      fade: 24,
      vignette: 28,
    },
    lutTone: {
      contrastCurve: 1.04,
      warmShift: 9,
      tintShift: 5,
      shadowBlue: 4,
      highlightWarm: 12,
      saturationMult: 0.88,
      fadeFloor: 20,
      monochrome: false,
    },
  },
  {
    id: 'moody',
    name: 'Moody',
    subtitle: 'Deep shadows, desaturated greens, dramatic tonal weight',
    defaults: {
      intensity: 90,
      contrast: 20,
      saturation: -14,
      highlights: -18,
      shadows: -10,
      temperature: -6,
      tint: -2,
      sharpness: 16,
      fade: 12,
      vignette: 36,
    },
    lutTone: {
      contrastCurve: 1.22,
      warmShift: -5,
      tintShift: -2,
      shadowBlue: 10,
      highlightWarm: 4,
      saturationMult: 0.84,
      fadeFloor: 10,
      monochrome: false,
    },
  },
  {
    id: 'golden_hour',
    name: 'Golden Hour',
    subtitle: 'Luminous sunset glow while protecting sky highlights',
    defaults: {
      intensity: 85,
      contrast: 8,
      saturation: 12,
      highlights: -16,
      shadows: 12,
      temperature: 20,
      tint: 5,
      sharpness: 14,
      fade: 4,
      vignette: 14,
    },
    lutTone: {
      contrastCurve: 1.09,
      warmShift: 18,
      tintShift: 4,
      shadowBlue: -2,
      highlightWarm: 18,
      saturationMult: 1.1,
      fadeFloor: 4,
      monochrome: false,
    },
  },
  {
    id: 'soft_portrait',
    name: 'Soft Portrait',
    subtitle: 'Gentle micro-contrast and luminous, accurate skin tones',
    defaults: {
      intensity: 80,
      contrast: 2,
      saturation: -2,
      highlights: -10,
      shadows: 14,
      temperature: 6,
      tint: 2,
      sharpness: 10,
      fade: 10,
      vignette: 16,
    },
    lutTone: {
      contrastCurve: 1.02,
      warmShift: 6,
      tintShift: 3,
      shadowBlue: 2,
      highlightWarm: 8,
      saturationMult: 0.97,
      fadeFloor: 8,
      monochrome: false,
    },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    subtitle: 'Silver-gelatin tonal separation with crisp midtone grit',
    defaults: {
      intensity: 100,
      contrast: 22,
      saturation: -50,
      highlights: -10,
      shadows: 4,
      temperature: 0,
      tint: 0,
      sharpness: 24,
      fade: 8,
      vignette: 26,
    },
    lutTone: {
      contrastCurve: 1.24,
      warmShift: 2,
      tintShift: 0,
      shadowBlue: 0,
      highlightWarm: 2,
      saturationMult: 0,
      fadeFloor: 8,
      monochrome: true,
    },
  },
  {
    id: 'neutral',
    name: 'Neutral',
    subtitle: 'Unaltered sensor rendering with zero colour grading',
    defaults: {
      intensity: 100,
      contrast: 0,
      saturation: 0,
      highlights: 0,
      shadows: 0,
      temperature: 0,
      tint: 0,
      sharpness: 0,
      fade: 0,
      vignette: 0,
    },
    lutTone: {
      contrastCurve: 1,
      warmShift: 0,
      tintShift: 0,
      shadowBlue: 0,
      highlightWarm: 0,
      saturationMult: 1,
      fadeFloor: 0,
      monochrome: false,
    },
  },
];

export const VIDEO_COLOR_PROFILES: { id: VideoProfileId; name: string; mappedPhotoProfile: ColorProfileId; subtitle: string }[] = [
  { id: 'cinematic_natural', name: 'Cinematic Natural', mappedPhotoProfile: 'cinematic', subtitle: 'Default balanced cinematic dynamic range' },
  { id: 'warm_cinema', name: 'Warm Cinema', mappedPhotoProfile: 'warm_cinema', subtitle: 'Rich amber highlights for dusk and interiors' },
  { id: 'cool_cinema', name: 'Cool Cinema', mappedPhotoProfile: 'cool_cinema', subtitle: 'Restrained cool shadows for urban motion' },
  { id: 'film_inspired', name: 'Film Inspired', mappedPhotoProfile: 'vintage_film', subtitle: 'Soft highlight roll-off and organic shadow floor' },
  { id: 'moody', name: 'Moody', mappedPhotoProfile: 'moody', subtitle: 'Deep dramatic contrast and muted chroma' },
  { id: 'neutral', name: 'Neutral', mappedPhotoProfile: 'neutral', subtitle: 'Clean Rec.709 / HDR pass-through without grading' },
];

export function getProfileById(id: ColorProfileId): ProfilePreset {
  return PHOTO_COLOR_PROFILES.find((p) => p.id === id) ?? PHOTO_COLOR_PROFILES[0];
}

export function buildCssFilterPreview(
  profileId: ColorProfileId,
  adj: ColorAdjustments,
  evPreviewOffset = 0,
  wbPreviewKelvin = 5500
): string {
  const profile = getProfileById(profileId);
  const strength = adj.intensity / 100;
  const contrastPct = 100 + (adj.contrast * 0.7 + (profile.lutTone.contrastCurve - 1) * 45 * strength);
  const satPct = profile.lutTone.monochrome
    ? 0
    : Math.max(0, 100 + adj.saturation * 1.1 + (profile.lutTone.saturationMult - 1) * 100 * strength);
  const evBrightness = 100 + evPreviewOffset * 14 + (adj.shadows - adj.highlights * 0.35) * 0.15;
  const sepiaPct = profile.lutTone.monochrome
    ? 0
    : Math.max(0, Math.min(30, (adj.temperature * 0.25 + (wbPreviewKelvin - 5500) * 0.004 + profile.lutTone.warmShift * 0.4 * strength)));

  return `contrast(${contrastPct.toFixed(1)}%) saturate(${satPct.toFixed(1)}%) brightness(${evBrightness.toFixed(1)}%) sepia(${sepiaPct.toFixed(1)}%)`;
}

/**
 * Non-destructive pixel-level color grading applied to a target 2D canvas.
 * Source image/video frame stays completely untouched.
 */
export function applyColorGradingToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  profileId: ColorProfileId,
  adj: ColorAdjustments,
  evOffset = 0,
  wbKelvin = 5500
): void {
  const profile = getProfileById(profileId);
  const strength = Math.max(0, Math.min(1, adj.intensity / 100));
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const contrastFactor = 1 + (adj.contrast / 100) * 0.65 + (profile.lutTone.contrastCurve - 1) * strength;
  const satFactor = profile.lutTone.monochrome
    ? 0
    : Math.max(0, (1 + adj.saturation / 100) * (1 + (profile.lutTone.saturationMult - 1) * strength));

  const tempDelta = adj.temperature * 0.85 + profile.lutTone.warmShift * strength + (wbKelvin - 5500) * 0.015;
  const tintDelta = adj.tint * 0.7 + profile.lutTone.tintShift * strength;
  const fadeLift = (adj.fade * 0.35 + profile.lutTone.fadeFloor * strength);
  const evGain = Math.pow(2, evOffset * 0.45);
  const highlightScale = adj.highlights / 100;
  const shadowScale = adj.shadows / 100;
  const shadowBlue = profile.lutTone.shadowBlue * strength;
  const highlightWarm = profile.lutTone.highlightWarm * strength;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * evGain;
    let g = data[i + 1] * evGain;
    let b = data[i + 2] * evGain;

    // Luminance in [0..1]
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // Shadows & Highlights recovery
    if (lum < 0.45 && shadowScale !== 0) {
      const w = (0.45 - lum) / 0.45;
      const lift = w * shadowScale * 48;
      r += lift;
      g += lift;
      b += lift;
    }
    if (lum > 0.55 && highlightScale !== 0) {
      const w = (lum - 0.55) / 0.45;
      const shift = w * highlightScale * 54;
      r += shift;
      g += shift;
      b += shift;
    }

    // Split-tone cinematic shadow/highlight tint
    if (lum < 0.38) {
      const sw = (0.38 - lum) / 0.38;
      b += shadowBlue * sw;
      r -= shadowBlue * 0.35 * sw;
    } else if (lum > 0.62) {
      const hw = (lum - 0.62) / 0.38;
      r += highlightWarm * hw;
      g += highlightWarm * 0.55 * hw;
      b -= highlightWarm * 0.45 * hw;
    }

    // Temperature & Tint
    r += tempDelta;
    b -= tempDelta * 0.9;
    g += tintDelta * 0.7;

    // Contrast around mid-grey (128)
    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;

    // Saturation / Monochrome
    const lumaAfter = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lumaAfter + (r - lumaAfter) * satFactor;
    g = lumaAfter + (g - lumaAfter) * satFactor;
    b = lumaAfter + (b - lumaAfter) * satFactor;

    // Matte Fade lift
    if (fadeLift > 0) {
      r = r * (1 - fadeLift / 255) + fadeLift;
      g = g * (1 - fadeLift / 255) + fadeLift;
      b = b * (1 - fadeLift / 255) + fadeLift;
    }

    data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }

  ctx.putImageData(imgData, 0, 0);

  // Subtle Vignette overlay
  if (adj.vignette > 0) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.sqrt(cx * cx + cy * cy);
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.42, cx, cy, radius);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${(adj.vignette / 100) * 0.58})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
}
