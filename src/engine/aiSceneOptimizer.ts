import { HardwareCapabilities, SceneOptimizationPlan, SceneType } from '../types/nova';
import { constrainOptimizationToHardware } from './hardwareDetector';

export interface SceneParameterProfile {
  scene: SceneType;
  baseExposureEvDelta: number;
  highlightProtectedEvDelta?: number;
  lowLightLiftEvDelta?: number;
  whiteBalanceKelvin: number;
  targetIso: number;
  focusMode: 'continuous' | 'macro' | 'infinity';
  rationale: string;
}

/**
 * Mirrors the Android `ai-core` AiSceneOptimizer registry in TypeScript for the Web Studio.
 * Registers common scenes (portrait, landscape, night, food, sunset, architecture, street, closeup)
 * and maps detected scenes to hardware-supported camera parameter adjustments.
 */
export class AiSceneOptimizer {
  private readonly registry = new Map<SceneType, SceneParameterProfile>();

  constructor() {
    this.registerDefaultScenes();
  }

  private registerDefaultScenes(): void {
    this.registerScene({
      scene: 'portrait',
      baseExposureEvDelta: 0.0,
      lowLightLiftEvDelta: 0.2,
      whiteBalanceKelvin: 5350,
      targetIso: 160,
      focusMode: 'continuous',
      rationale: 'Skin-accurate 5350K balance with gentle shadow lift so faces remain natural without over-smoothing.',
    });
    this.registerScene({
      scene: 'landscape',
      baseExposureEvDelta: -0.1,
      highlightProtectedEvDelta: -0.3,
      whiteBalanceKelvin: 5600,
      targetIso: 100,
      focusMode: 'infinity',
      rationale: 'Subtle -0.1 to -0.3 EV sky protection, clean 5600K daylight balance, and low-ISO detail preservation.',
    });
    this.registerScene({
      scene: 'night',
      baseExposureEvDelta: 0.3,
      whiteBalanceKelvin: 4500,
      targetIso: 640,
      focusMode: 'continuous',
      rationale: 'Controlled +0.3 EV lift and moderate ISO 640 cap preserve ambient night mood without blowing out lights.',
    });
    this.registerScene({
      scene: 'food',
      baseExposureEvDelta: 0.2,
      whiteBalanceKelvin: 5150,
      targetIso: 200,
      focusMode: 'macro',
      rationale: 'Subtle +0.2 EV brightness and appetizing warm-neutral 5150K tone with close-plane focus priority.',
    });
    this.registerScene({
      scene: 'sunset',
      baseExposureEvDelta: -0.4,
      whiteBalanceKelvin: 5900,
      targetIso: 100,
      focusMode: 'infinity',
      rationale: 'Protects solar highlight gradient (-0.4 EV) while preserving golden sky warmth at 5900K.',
    });
    this.registerScene({
      scene: 'architecture',
      baseExposureEvDelta: -0.1,
      whiteBalanceKelvin: 5400,
      targetIso: 100,
      focusMode: 'infinity',
      rationale: 'Crisp micro-contrast exposure (-0.1 EV) and neutral 5400K balance for clean concrete and glass lines.',
    });
    this.registerScene({
      scene: 'closeup',
      baseExposureEvDelta: 0.1,
      whiteBalanceKelvin: 5300,
      targetIso: 200,
      focusMode: 'macro',
      rationale: 'Macro focus priority with balanced neutral exposure to avoid specular clipping on textures.',
    });
    this.registerScene({
      scene: 'street',
      baseExposureEvDelta: -0.2,
      whiteBalanceKelvin: 5200,
      targetIso: 250,
      focusMode: 'continuous',
      rationale: 'Fast continuous tracking with -0.2 EV highlight safety for candid street contrast.',
    });
  }

  registerScene(profile: SceneParameterProfile): void {
    this.registry.set(profile.scene, profile);
  }

  getRegisteredScenes(): SceneType[] {
    return Array.from(this.registry.keys());
  }

  getProfile(scene: SceneType): SceneParameterProfile | undefined {
    return this.registry.get(scene);
  }

  resolveHardwareAdjustments(
    scene: SceneType,
    confidence: number,
    capabilities: HardwareCapabilities,
    metrics: { meanLuminance: number; highlightClipPct: number; warmthBias: number }
  ): SceneOptimizationPlan {
    const profile = this.registry.get(scene) ?? this.registry.get('street')!;

    let exposureDeltaEv = profile.baseExposureEvDelta;
    if (profile.highlightProtectedEvDelta !== undefined && metrics.highlightClipPct > 2.5) {
      exposureDeltaEv = profile.highlightProtectedEvDelta;
    } else if (profile.lowLightLiftEvDelta !== undefined && metrics.meanLuminance < 95) {
      exposureDeltaEv = profile.lowLightLiftEvDelta;
    }

    const whiteBalanceKelvin =
      scene === 'night' && metrics.warmthBias > 0.1 ? 4300 : profile.whiteBalanceKelvin;

    const rawPlan: SceneOptimizationPlan = {
      scene,
      confidence,
      appliedToHardware: false,
      adjustments: {
        exposureDeltaEv,
        whiteBalanceKelvin,
        isoTarget: profile.targetIso,
        focusMode: profile.focusMode,
      },
      skippedUnsupported: [],
      rationale: profile.rationale,
    };

    return constrainOptimizationToHardware(rawPlan, capabilities);
  }
}

export const defaultAiSceneOptimizer = new AiSceneOptimizer();
