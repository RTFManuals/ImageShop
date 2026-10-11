export type Tool =
  | 'move'
  | 'select'
  | 'ellipse-select'
  | 'lasso'
  | 'polygonal-lasso'
  | 'quick-selection'
  | 'magic-wand'
  | 'crop'
  | 'eyedropper'
  | 'brush'
  | 'eraser'
  | 'gradient'
  | 'blur-tool'
  | 'sharpen-tool'
  | 'dodge'
  | 'burn'
  | 'smudge'
  | 'clone'
  | 'healing-brush'
  | 'fill'
  | 'text'
  | 'pen'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'zoom'
  | 'hand';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  canvas: HTMLCanvasElement;
  blendMode: string;
  locked: boolean;
  mask?: HTMLCanvasElement;
  thumbnail?: string;
  clippingMask?: boolean;
  groupId?: string;
}

export interface LayerGroup {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  layerIds: string[];
  expanded: boolean;
}

export interface HistoryState {
  layers: {
    id: string;
    name: string;
    visible: boolean;
    opacity: number;
    imageData: ImageData;
    blendMode: string;
    locked: boolean;
    maskData?: ImageData | null;
  }[];
  activeLayerId: string;
}

export interface FilterOptions {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sharpen: number;
}

export interface TransformState {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  layerId: string;
  snapshot?: ImageData;
}

export const BLEND_MODES = [
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

export const FONTS = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana',
  'Impact',
  'Comic Sans MS',
  'Trebuchet MS',
  'Palatino',
  'Garamond',
  'Lucida Console',
];
