import {
  HardwareCapabilities,
  LensId,
  OfflineAnalysisResult,
  SceneType,
} from '../types/nova';
import { defaultAiSceneOptimizer } from './aiSceneOptimizer';

const ANALYSIS_W = 160;
const ANALYSIS_H = 120;

let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

function getAnalysisCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
    sharedCanvas.width = ANALYSIS_W;
    sharedCanvas.height = ANALYSIS_H;
    sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
  }
  return sharedCtx;
}

/**
 * Runs deterministic, fast offline pixel & gradient analysis on a downscaled 160x120 frame.
 * Keeps full-resolution capture completely decoupled from reduced-resolution AI analysis.
 */
export function analyzeFrameOffline(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  capabilities: HardwareCapabilities
): OfflineAnalysisResult | null {
  const ctx = getAnalysisCtx();
  if (!ctx) return null;

  try {
    ctx.drawImage(source, 0, 0, ANALYSIS_W, ANALYSIS_H);
  } catch {
    return null;
  }

  const img = ctx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H);
  const d = img.data;
  const totalPixels = ANALYSIS_W * ANALYSIS_H;

  const lumaGrid = new Float32Array(totalPixels);
  const bins = new Array<number>(64).fill(0);

  let sumLuma = 0;
  let clippedHigh = 0;
  let crushedLow = 0;
  let warmScoreSum = 0;
  let skinLikePixels = 0;
  let skyLikeTopPixels = 0;
  let warmFoodCenterPixels = 0;
  let greenFoliagePixels = 0;

  let weightSum = 0;
  let weightX = 0;
  let weightY = 0;

  for (let y = 0; y < ANALYSIS_H; y++) {
    for (let x = 0; x < ANALYSIS_W; x++) {
      const idx = y * ANALYSIS_W + x;
      const p = idx * 4;
      const r = d[p];
      const g = d[p + 1];
      const b = d[p + 2];

      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lumaGrid[idx] = luma;
      sumLuma += luma;

      const bin = Math.min(63, Math.floor((luma / 256) * 64));
      bins[bin]++;

      if (r > 246 && g > 246 && b > 246) clippedHigh++;
      if (luma < 14) crushedLow++;

      warmScoreSum += (r - b) / 255;

      // Skin-tone heuristic in center 60% region
      const inCenterX = x > ANALYSIS_W * 0.2 && x < ANALYSIS_W * 0.8;
      const inCenterY = y > ANALYSIS_H * 0.12 && y < ANALYSIS_H * 0.85;
      if (
        inCenterX &&
        inCenterY &&
        r > 95 &&
        g > 40 &&
        b > 20 &&
        r > g &&
        r > b &&
        Math.abs(r - g) > 15 &&
        r - b > 18
      ) {
        skinLikePixels++;
      }

      // Upper third blue/golden sky detection
      if (y < ANALYSIS_H * 0.38) {
        if ((b > r + 14 && b > 95) || (r > 165 && g > 95 && b < 110)) {
          skyLikeTopPixels++;
        }
      }

      // Rich warm saturated tones in lower/center plate zone (food heuristic)
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
      if (y > ANALYSIS_H * 0.25 && inCenterX && sat > 0.34 && r > b + 25) {
        warmFoodCenterPixels++;
      }

      if (g > r + 10 && g > b + 12 && sat > 0.2) {
        greenFoliagePixels++;
      }

      // Visual weight for centroid (contrast from mid-luma + saturation)
      const sal = Math.abs(luma - 115) / 128 + sat * 0.9;
      weightSum += sal;
      weightX += (x / ANALYSIS_W) * sal;
      weightY += (y / ANALYSIS_H) * sal;
    }
  }

  const maxBin = Math.max(...bins, 1);
  const histogram = bins.map((v) => v / maxBin);

  const meanLuminance = sumLuma / totalPixels;
  const highlightClipPct = (clippedHigh / totalPixels) * 100;
  const shadowCrushPct = (crushedLow / totalPixels) * 100;
  const warmthBias = warmScoreSum / totalPixels;

  // Sobel gradient analysis for tilt angle, center sharpness, and background clutter
  let centerLapSum = 0;
  let centerCount = 0;
  let peripheryEdgeSum = 0;
  let peripheryCount = 0;
  let horizAngleSin = 0;
  let horizAngleCos = 0;
  let verticalLineCount = 0;
  let strongEdgeCount = 0;

  for (let y = 1; y < ANALYSIS_H - 1; y++) {
    for (let x = 1; x < ANALYSIS_W - 1; x++) {
      const c = y * ANALYSIS_W + x;
      const gx =
        -lumaGrid[c - ANALYSIS_W - 1] +
        lumaGrid[c - ANALYSIS_W + 1] -
        2 * lumaGrid[c - 1] +
        2 * lumaGrid[c + 1] -
        lumaGrid[c + ANALYSIS_W - 1] +
        lumaGrid[c + ANALYSIS_W + 1];
      const gy =
        -lumaGrid[c - ANALYSIS_W - 1] -
        2 * lumaGrid[c - ANALYSIS_W] -
        lumaGrid[c - ANALYSIS_W + 1] +
        lumaGrid[c + ANALYSIS_W - 1] +
        2 * lumaGrid[c + ANALYSIS_W] +
        lumaGrid[c + ANALYSIS_W + 1];

      const mag = Math.sqrt(gx * gx + gy * gy);
      const isCenter = x > ANALYSIS_W * 0.25 && x < ANALYSIS_W * 0.75 && y > ANALYSIS_H * 0.25 && y < ANALYSIS_H * 0.75;
      if (isCenter) {
        centerLapSum += mag;
        centerCount++;
      } else {
        peripheryEdgeSum += mag;
        peripheryCount++;
      }

      if (mag > 42) {
        strongEdgeCount++;
        // Horizontal-ish edges near middle band estimate horizon tilt
        if (y > ANALYSIS_H * 0.2 && y < ANALYSIS_H * 0.75 && Math.abs(gy) > Math.abs(gx) * 1.8) {
          const theta = Math.atan2(gx, gy);
          horizAngleSin += Math.sin(theta * 2) * mag;
          horizAngleCos += Math.cos(theta * 2) * mag;
        }
        // Strong vertical edges for architecture
        if (Math.abs(gx) > Math.abs(gy) * 2.4) {
          verticalLineCount++;
        }
      }
    }
  }

  const rawTiltRad = 0.5 * Math.atan2(horizAngleSin, horizAngleCos);
  const tiltDegrees = Number(((rawTiltRad * 180) / Math.PI).toFixed(1));
  const centerSharpness = Math.min(100, Math.round((centerLapSum / Math.max(1, centerCount)) * 1.3));
  const backgroundClutter = Math.min(100, Math.round((peripheryEdgeSum / Math.max(1, peripheryCount)) * 1.4));

  const subjectCentroid =
    weightSum > 0
      ? { x: Number((weightX / weightSum).toFixed(2)), y: Number((weightY / weightSum).toFixed(2)) }
      : { x: 0.5, y: 0.5 };

  // Scene Classification
  const skinRatio = skinLikePixels / (totalPixels * 0.44);
  const skyRatio = skyLikeTopPixels / (totalPixels * 0.38);
  const foodRatio = warmFoodCenterPixels / (totalPixels * 0.45);
  const foliageRatio = greenFoliagePixels / totalPixels;
  const verticalRatio = verticalLineCount / Math.max(1, strongEdgeCount);

  let detectedScene: SceneType = 'street';
  let confidence = 0.72;

  if (meanLuminance < 68) {
    detectedScene = 'night';
    confidence = Math.min(0.95, 0.76 + (68 - meanLuminance) / 140);
  } else if (skinRatio > 0.11) {
    detectedScene = 'portrait';
    confidence = Math.min(0.94, 0.7 + skinRatio * 1.1);
  } else if (skyRatio > 0.22 && warmthBias > 0.14 && highlightClipPct > 1.2) {
    detectedScene = 'sunset';
    confidence = 0.86;
  } else if (foodRatio > 0.2 && centerSharpness > 32 && skyRatio < 0.08) {
    detectedScene = 'food';
    confidence = 0.84;
  } else if (verticalRatio > 0.42 && skyRatio > 0.1) {
    detectedScene = 'architecture';
    confidence = 0.83;
  } else if (skyRatio > 0.22 || foliageRatio > 0.18) {
    detectedScene = 'landscape';
    confidence = 0.85;
  } else if (centerSharpness > 58 && backgroundClutter < 28) {
    detectedScene = 'closeup';
    confidence = 0.78;
  } else {
    detectedScene = 'street';
    confidence = 0.74;
  }

  // Generate subtle Scene Optimization Plan via AiSceneOptimizer (respecting natural look & hardware support)
  const optimization = defaultAiSceneOptimizer.resolveHardwareAdjustments(
    detectedScene,
    confidence,
    capabilities,
    {
      meanLuminance,
      highlightClipPct,
      warmthBias,
    }
  );

  // Live AI Camera Coach: only show meaningful, actionable improvements
  const tips: string[] = [];
  let recommendedLens: LensId = 'main';

  if (Math.abs(tiltDegrees) >= 1.8 && Math.abs(tiltDegrees) <= 18) {
    const dir = tiltDegrees > 0 ? 'counter-clockwise' : 'clockwise';
    tips.push(`Horizon tilted ${Math.abs(tiltDegrees).toFixed(1)}° — level camera slightly ${dir}.`);
  }

  if (highlightClipPct > 4.2) {
    tips.push(`Bright highlights clipping (${highlightClipPct.toFixed(1)}%) — lower exposure slightly to preserve sky/highlight detail.`);
  } else if (meanLuminance < 52 && shadowCrushPct > 35) {
    tips.push('Low ambient light — brace device steady and keep 1× f/1.7 main lens active.');
  }

  if (detectedScene === 'portrait') {
    recommendedLens = backgroundClutter > 46 ? 'telephoto' : 'main';
    if (Math.abs(subjectCentroid.x - 0.5) < 0.05 && backgroundClutter > 36) {
      tips.push('Move subject toward left or right third to balance framing and reduce background distraction.');
    }
    if (backgroundClutter > 48) {
      tips.push('Busy background detected — step closer or switch to 5× telephoto for cleaner separation.');
    }
  } else if (detectedScene === 'landscape' || detectedScene === 'sunset') {
    recommendedLens = 'ultrawide';
    if (subjectCentroid.y > 0.46 && subjectCentroid.y < 0.56) {
      tips.push('Place horizon along upper or lower third rather than splitting the frame evenly.');
    }
  } else if (detectedScene === 'architecture') {
    recommendedLens = 'ultrawide';
    if (Math.abs(tiltDegrees) > 1.2) {
      tips.push('Align vertical building edges parallel to the frame grid to avoid perspective lean.');
    }
  } else if (detectedScene === 'food' || detectedScene === 'closeup') {
    recommendedLens = 'main';
    if (centerSharpness < 24) {
      tips.push('Tap subject to lock focus and pull back slightly if closer than minimum focus distance.');
    }
  }

  const primaryAdvice =
    tips.length > 0
      ? tips[0]
      : `${capitalizeScene(detectedScene)} scene balanced — framing and exposure look clean.`;

  return {
    timestamp: Date.now(),
    detectedScene,
    confidence: Number(confidence.toFixed(2)),
    meanLuminance: Math.round(meanLuminance),
    highlightClipPct: Number(highlightClipPct.toFixed(1)),
    shadowCrushPct: Number(shadowCrushPct.toFixed(1)),
    warmthBias: Number(warmthBias.toFixed(2)),
    tiltDegrees,
    subjectCentroid,
    centerSharpness,
    backgroundClutter,
    histogram,
    primaryAdvice,
    secondaryTips: tips.slice(1, 3),
    recommendedLens,
    optimization,
  };
}

export function capitalizeScene(scene: SceneType): string {
  if (scene === 'closeup') return 'Close-Up';
  return scene.charAt(0).toUpperCase() + scene.slice(1);
}
