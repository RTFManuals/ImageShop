export class SharpenFilter {
  static apply(imageData: ImageData, amount: number = 1): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const dst = new Uint8ClampedArray(src.length);

    // Ядро резкости (Unsharp Mask)
    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];

    // Применяем ядро
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let r = 0, g = 0, b = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            const weight = kernel[kernelIdx];

            r += src[idx] * weight;
            g += src[idx + 1] * weight;
            b += src[idx + 2] * weight;
          }
        }

        const idx = (y * width + x) * 4;
        
        // Смешиваем с оригиналом на основе amount
        dst[idx] = Math.round(src[idx] + (r - src[idx]) * amount);
        dst[idx + 1] = Math.round(src[idx + 1] + (g - src[idx + 1]) * amount);
        dst[idx + 2] = Math.round(src[idx + 2] + (b - src[idx + 2]) * amount);
        dst[idx + 3] = src[idx + 3]; // Alpha не меняем
      }
    }

    // Копируем границы без изменений
    for (let x = 0; x < width; x++) {
      // Верхняя граница
      let idx = x * 4;
      dst[idx] = src[idx];
      dst[idx + 1] = src[idx + 1];
      dst[idx + 2] = src[idx + 2];
      dst[idx + 3] = src[idx + 3];

      // Нижняя граница
      idx = ((height - 1) * width + x) * 4;
      dst[idx] = src[idx];
      dst[idx + 1] = src[idx + 1];
      dst[idx + 2] = src[idx + 2];
      dst[idx + 3] = src[idx + 3];
    }

    for (let y = 0; y < height; y++) {
      // Левая граница
      let idx = (y * width) * 4;
      dst[idx] = src[idx];
      dst[idx + 1] = src[idx + 1];
      dst[idx + 2] = src[idx + 2];
      dst[idx + 3] = src[idx + 3];

      // Правая граница
      idx = (y * width + (width - 1)) * 4;
      dst[idx] = src[idx];
      dst[idx + 1] = src[idx + 1];
      dst[idx + 2] = src[idx + 2];
      dst[idx + 3] = src[idx + 3];
    }

    return new ImageData(dst, width, height);
  }
}
