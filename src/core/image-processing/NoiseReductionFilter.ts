export class NoiseReductionFilter {
  static apply(imageData: ImageData, strength: number = 1): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const dst = new Uint8ClampedArray(src.length);

    // Медианный фильтр для уменьшения шума
    const radius = Math.ceil(strength);
    const windowSize = radius * 2 + 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rValues: number[] = [];
        const gValues: number[] = [];
        const bValues: number[] = [];

        // Собираем значения в окне
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const nx = Math.min(Math.max(x + kx, 0), width - 1);
            const ny = Math.min(Math.max(y + ky, 0), height - 1);
            const idx = (ny * width + nx) * 4;

            rValues.push(src[idx]);
            gValues.push(src[idx + 1]);
            bValues.push(src[idx + 2]);
          }
        }

        // Сортируем и берём медиану
        rValues.sort((a, b) => a - b);
        gValues.sort((a, b) => a - b);
        bValues.sort((a, b) => a - b);

        const medianIdx = Math.floor(rValues.length / 2);
        const idx = (y * width + x) * 4;

        // Смешиваем медиану с оригиналом на основе strength
        const blend = Math.min(strength / 2, 1);
        dst[idx] = Math.round(src[idx] * (1 - blend) + rValues[medianIdx] * blend);
        dst[idx + 1] = Math.round(src[idx + 1] * (1 - blend) + gValues[medianIdx] * blend);
        dst[idx + 2] = Math.round(src[idx + 2] * (1 - blend) + bValues[medianIdx] * blend);
        dst[idx + 3] = src[idx + 3]; // Alpha не меняем
      }
    }

    return new ImageData(dst, width, height);
  }
}
