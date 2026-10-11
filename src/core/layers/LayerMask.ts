import { Selection } from '../selection/Selection';

export class Mask {
  private mask: Selection;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.mask = new Selection(width, height);
  }

  // Получить маску как Selection
  getSelection(): Selection {
    return this.mask.clone();
  }

  // Установить маску из Selection
  setSelection(selection: Selection): void {
    this.mask = selection.clone();
  }

  // Рисовать на маске
  paint(x: number, y: number, radius: number, value: number): void {
    // value: 255 = показать, 0 = скрыть
    const r = Math.floor(radius);
    
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = x + dx;
        const py = y + dy;
        
        if (px < 0 || px >= this.width || py < 0 || py >= this.height) {
          continue;
        }
        
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= radius) {
          if (value > 128) {
            this.mask.select(px, py);
          } else {
            this.mask.deselect(px, py);
          }
        }
      }
    }
  }

  // Применить маску к ImageData
  applyToImageData(imageData: ImageData): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const maskData = this.mask.getMask();

    for (let i = 0; i < result.data.length; i += 4) {
      const pixelIndex = i / 4;
      const maskValue = maskData[pixelIndex];
      
      // Применяем маску к alpha каналу
      result.data[i + 3] = (result.data[i + 3] * maskValue) / 255;
    }

    return result;
  }

  // Инвертировать маску
  invert(): void {
    this.mask.invert();
  }

  // Очистить маску (всё видно)
  clear(): void {
    this.mask.clear();
  }

  // Заполнить маску (всё скрыто)
  fill(): void {
    this.mask.selectRect({ x: 0, y: 0, width: this.width, height: this.height });
  }

  // Feather (размытие краёв)
  feather(radius: number): void {
    this.mask = this.mask.feather(radius);
  }

  // Clone
  clone(): Mask {
    const cloned = new Mask(this.width, this.height);
    cloned.mask = this.mask.clone();
    return cloned;
  }

  // Serialization
  toImageData(): ImageData {
    const imageData = new ImageData(this.width, this.height);
    const maskData = this.mask.getMask();
    
    for (let i = 0; i < maskData.length; i++) {
      imageData.data[i * 4] = maskData[i];     // R
      imageData.data[i * 4 + 1] = maskData[i]; // G
      imageData.data[i * 4 + 2] = maskData[i]; // B
      imageData.data[i * 4 + 3] = 255;         // A
    }
    
    return imageData;
  }

  static fromImageData(imageData: ImageData): Mask {
    const mask = new Mask(imageData.width, imageData.height);
    const selection = new Selection(imageData.width, imageData.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const x = (i / 4) % imageData.width;
      const y = Math.floor((i / 4) / imageData.width);
      
      if (imageData.data[i] > 128) {
        selection.select(x, y);
      }
    }
    
    mask.setSelection(selection);
    return mask;
  }
}
