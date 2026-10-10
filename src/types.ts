export type Tool =
  | 'move'
  | 'select'
  | 'brush'
  | 'eraser'
  | 'fill'
  | 'eyedropper'
  | 'text'
  | 'gradient'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'crop'
  | 'zoom'
  | 'blur-tool'
  | 'sharpen-tool'
  | 'clone';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  canvas: HTMLCanvasElement;
  blendMode: string;
  locked: boolean;
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
  }[];
  activeLayerId: string;
}

export interface TextLayerData {
  text: string;
  x: number;
  y: number;
  font: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface FilterOptions {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sharpen: number;
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
