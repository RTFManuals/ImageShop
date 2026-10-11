// Core Document Types

export interface DocumentMetadata {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  colorSpace: 'sRGB' | 'AdobeRGB' | 'DisplayP3';
  dpi: number;
}

export interface EditorDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: Layer[];
  activeLayerId: string | null;
  metadata: DocumentMetadata;
  schemaVersion: string;
}

export interface Layer {
  id: string;
  name: string;
  type: 'raster' | 'group' | 'adjustment';
  visible: boolean;
  opacity: number; // 0-100
  blendMode: BlendMode;
  locked: boolean;
  transform?: LayerTransform;
  mask?: LayerMask;
}

export interface RasterLayer extends Layer {
  type: 'raster';
  width: number;
  height: number;
  imageData: ImageData;
}

export interface LayerGroup extends Layer {
  type: 'group';
  children: Layer[];
  expanded: boolean;
}

export interface LayerTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
}

export interface LayerMask {
  enabled: boolean;
  linked: boolean;
  imageData: ImageData;
}

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export const BLEND_MODES: BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];
