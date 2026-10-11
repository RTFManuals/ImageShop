import { Layer } from '../document/DocumentTypes';

export interface AdjustmentSettings {
  [key: string]: any;
}

export abstract class Adjustment {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly settings: AdjustmentSettings;

  abstract apply(imageData: ImageData): ImageData;
  abstract updateSettings(newSettings: Partial<AdjustmentSettings>): void;
  abstract clone(): Adjustment;
}

// Brightness/Contrast Adjustment
export class BrightnessContrastAdjustment extends Adjustment {
  readonly id = 'brightness-contrast';
  readonly name = 'Brightness/Contrast';
  settings: { brightness: number; contrast: number };

  constructor(brightness: number = 0, contrast: number = 0) {
    super();
    this.settings = { brightness, contrast };
  }

  apply(imageData: ImageData): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const brightness = this.settings.brightness;
    const contrast = this.settings.contrast;
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < result.data.length; i += 4) {
      // Apply brightness
      result.data[i] = Math.max(0, Math.min(255, result.data[i] + brightness));
      result.data[i + 1] = Math.max(0, Math.min(255, result.data[i + 1] + brightness));
      result.data[i + 2] = Math.max(0, Math.min(255, result.data[i + 2] + brightness));

      // Apply contrast
      result.data[i] = Math.max(0, Math.min(255, contrastFactor * (result.data[i] - 128) + 128));
      result.data[i + 1] = Math.max(0, Math.min(255, contrastFactor * (result.data[i + 1] - 128) + 128));
      result.data[i + 2] = Math.max(0, Math.min(255, contrastFactor * (result.data[i + 2] - 128) + 128));
    }

    return result;
  }

  updateSettings(newSettings: Partial<{ brightness: number; contrast: number }>): void {
    if (newSettings.brightness !== undefined) this.settings.brightness = newSettings.brightness;
    if (newSettings.contrast !== undefined) this.settings.contrast = newSettings.contrast;
  }

  clone(): BrightnessContrastAdjustment {
    return new BrightnessContrastAdjustment(this.settings.brightness, this.settings.contrast);
  }
}

// Hue/Saturation Adjustment
export class HueSaturationAdjustment extends Adjustment {
  readonly id = 'hue-saturation';
  readonly name = 'Hue/Saturation';
  settings: { hue: number; saturation: number; lightness: number };

  constructor(hue: number = 0, saturation: number = 0, lightness: number = 0) {
    super();
    this.settings = { hue, saturation, lightness };
  }

  apply(imageData: ImageData): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const hueShift = this.settings.hue / 360;
    const satFactor = 1 + this.settings.saturation / 100;
    const lightShift = this.settings.lightness;

    for (let i = 0; i < result.data.length; i += 4) {
      const r = result.data[i] / 255;
      const g = result.data[i + 1] / 255;
      const b = result.data[i + 2] / 255;

      // Convert to HSL
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }

      // Apply adjustments
      h = (h + hueShift) % 1;
      if (h < 0) h += 1;
      s = Math.max(0, Math.min(1, s * satFactor));
      l = Math.max(0, Math.min(1, l + lightShift / 100));

      // Convert back to RGB
      const [nr, ng, nb] = this.hslToRgb(h, s, l);
      result.data[i] = Math.round(nr * 255);
      result.data[i + 1] = Math.round(ng * 255);
      result.data[i + 2] = Math.round(nb * 255);
    }

    return result;
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    if (s === 0) {
      return [l, l, l];
    }

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return [
      hue2rgb(p, q, h + 1/3),
      hue2rgb(p, q, h),
      hue2rgb(p, q, h - 1/3)
    ];
  }

  updateSettings(newSettings: Partial<{ hue: number; saturation: number; lightness: number }>): void {
    if (newSettings.hue !== undefined) this.settings.hue = newSettings.hue;
    if (newSettings.saturation !== undefined) this.settings.saturation = newSettings.saturation;
    if (newSettings.lightness !== undefined) this.settings.lightness = newSettings.lightness;
  }

  clone(): HueSaturationAdjustment {
    return new HueSaturationAdjustment(this.settings.hue, this.settings.saturation, this.settings.lightness);
  }
}

// Levels Adjustment
export class LevelsAdjustment extends Adjustment {
  readonly id = 'levels';
  readonly name = 'Levels';
  settings: { 
    inputBlack: number; 
    inputWhite: number; 
    gamma: number;
    outputBlack: number;
    outputWhite: number;
  };

  constructor(
    inputBlack: number = 0,
    inputWhite: number = 255,
    gamma: number = 1,
    outputBlack: number = 0,
    outputWhite: number = 255
  ) {
    super();
    this.settings = { inputBlack, inputWhite, gamma, outputBlack, outputWhite };
  }

  apply(imageData: ImageData): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const { inputBlack, inputWhite, gamma, outputBlack, outputWhite } = this.settings;
    const inputRange = inputWhite - inputBlack;
    const outputRange = outputWhite - outputBlack;

    for (let i = 0; i < result.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let value = result.data[i + c];

        // Input levels
        value = (value - inputBlack) / inputRange;
        value = Math.max(0, Math.min(1, value));

        // Gamma correction
        value = Math.pow(value, 1 / gamma);

        // Output levels
        value = value * outputRange + outputBlack;
        value = Math.max(0, Math.min(255, value));

        result.data[i + c] = Math.round(value);
      }
    }

    return result;
  }

  updateSettings(newSettings: Partial<typeof this.settings>): void {
    Object.assign(this.settings, newSettings);
  }

  clone(): LevelsAdjustment {
    return new LevelsAdjustment(
      this.settings.inputBlack,
      this.settings.inputWhite,
      this.settings.gamma,
      this.settings.outputBlack,
      this.settings.outputWhite
    );
  }
}
