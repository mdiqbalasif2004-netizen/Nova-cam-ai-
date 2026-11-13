import portraitImg from '../assets/images/scene_portrait_golden_1794583474541.jpg';
import sunsetImg from '../assets/images/scene_landscape_sunset_1794583474793.jpg';
import streetImg from '../assets/images/scene_street_moody_1794583475015.jpg';
import archImg from '../assets/images/scene_architecture_clean_1794583475529.jpg';
import { SceneType } from '../types/nova';

export interface SampleScene {
  id: string;
  title: string;
  sceneHint: SceneType;
  lensLabel: string;
  src: string;
}

export const SAMPLE_SCENES: SampleScene[] = [
  {
    id: 'sample-portrait',
    title: 'Cafe Window Portrait',
    sceneHint: 'portrait',
    lensLabel: '23mm f/1.7',
    src: portraitImg,
  },
  {
    id: 'sample-sunset',
    title: 'Coastal Cliffs Sunset',
    sceneHint: 'sunset',
    lensLabel: '15mm f/2.2',
    src: sunsetImg,
  },
  {
    id: 'sample-street',
    title: 'Rainy Twilight Alley',
    sceneHint: 'night',
    lensLabel: '23mm f/1.7',
    src: streetImg,
  },
  {
    id: 'sample-arch',
    title: 'Concrete Museum Lines',
    sceneHint: 'architecture',
    lensLabel: '115mm f/3.0',
    src: archImg,
  },
];
