// Selection System

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Selection {
  private mask: Uint8Array;
  private _bounds: Rect;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.mask = new Uint8Array(width * height);
    this._bounds = { x: 0, y: 0, width: 0, height: 0 };
  }

  get bounds(): Rect {
    return { ...this._bounds };
  }

  isEmpty(): boolean {
    return this._bounds.width === 0 || this._bounds.height === 0;
  }

  contains(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    return this.mask[y * this.width + x] > 0;
  }

  select(x: number, y: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return;
    }
    this.mask[y * this.width + x] = 255;
    this.updateBounds();
  }

  deselect(x: number, y: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return;
    }
    this.mask[y * this.width + x] = 0;
    this.updateBounds();
  }

  selectRect(rect: Rect): void {
    const x1 = Math.max(0, Math.floor(rect.x));
    const y1 = Math.max(0, Math.floor(rect.y));
    const x2 = Math.min(this.width, Math.ceil(rect.x + rect.width));
    const y2 = Math.min(this.height, Math.ceil(rect.y + rect.height));

    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        this.mask[y * this.width + x] = 255;
      }
    }
    this.updateBounds();
  }

  selectEllipse(rect: Rect): void {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const rx = rect.width / 2;
    const ry = rect.height / 2;

    const x1 = Math.max(0, Math.floor(rect.x));
    const y1 = Math.max(0, Math.floor(rect.y));
    const x2 = Math.min(this.width, Math.ceil(rect.x + rect.width));
    const y2 = Math.min(this.height, Math.ceil(rect.y + rect.height));

    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          this.mask[y * this.width + x] = 255;
        }
      }
    }
    this.updateBounds();
  }

  clear(): void {
    this.mask.fill(0);
    this._bounds = { x: 0, y: 0, width: 0, height: 0 };
  }

  invert(): void {
    for (let i = 0; i < this.mask.length; i++) {
      this.mask[i] = this.mask[i] > 0 ? 0 : 255;
    }
    this.updateBounds();
  }

  union(other: Selection): Selection {
    const result = new Selection(this.width, this.height);
    for (let i = 0; i < this.mask.length; i++) {
      result.mask[i] = this.mask[i] > 0 || other.mask[i] > 0 ? 255 : 0;
    }
    result.updateBounds();
    return result;
  }

  intersect(other: Selection): Selection {
    const result = new Selection(this.width, this.height);
    for (let i = 0; i < this.mask.length; i++) {
      result.mask[i] = this.mask[i] > 0 && other.mask[i] > 0 ? 255 : 0;
    }
    result.updateBounds();
    return result;
  }

  subtract(other: Selection): Selection {
    const result = new Selection(this.width, this.height);
    for (let i = 0; i < this.mask.length; i++) {
      result.mask[i] = this.mask[i] > 0 && other.mask[i] === 0 ? 255 : 0;
    }
    result.updateBounds();
    return result;
  }

  feather(radius: number): Selection {
    // Simple box blur for feathering
    const result = new Selection(this.width, this.height);
    const size = radius * 2 + 1;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let sum = 0;
        let count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
              sum += this.mask[ny * this.width + nx];
              count++;
            }
          }
        }

        result.mask[y * this.width + x] = Math.round(sum / count);
      }
    }

    result.updateBounds();
    return result;
  }

  getMask(): Uint8Array {
    return new Uint8Array(this.mask);
  }

  private updateBounds(): void {
    let minX = this.width;
    let minY = this.height;
    let maxX = 0;
    let maxY = 0;
    let found = false;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.mask[y * this.width + x] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          found = true;
        }
      }
    }

    if (found) {
      this._bounds = {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      };
    } else {
      this._bounds = { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  clone(): Selection {
    const result = new Selection(this.width, this.height);
    result.mask.set(this.mask);
    result._bounds = { ...this._bounds };
    return result;
  }
}
