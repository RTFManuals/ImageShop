export class GaussianBlurFilter {
  static apply(imageData: ImageData, radius: number): ImageData {
    if (radius <= 0) return imageData;

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const dst = new Uint8ClampedArray(src.length);

    // Создаём ядро Гаусса
    const kernelSize = Math.ceil(radius) * 2 + 1;
    const kernel = new Float32Array(kernelSize);
    const sigma = radius / 3;
    let sum = 0;

    for (let i = 0; i < kernelSize; i++) {
      const x = i - Math.floor(kernelSize / 2);
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      sum += kernel[i];
    }

    // Нормализуем ядро
    for (let i = 0; i < kernelSize; i++) {
      kernel[i] /= sum;
    }

    // Горизонтальное размытие
    const temp = new Uint8ClampedArray(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        
        for (let k = 0; k < kernelSize; k++) {
          const kx = Math.min(Math.max(x + k - Math.floor(kernelSize / 2), 0), width - 1);
          const idx = (y * width + kx) * 4;
          const weight = kernel[k];
          
          r += src[idx] * weight;
          g += src[idx + 1] * weight;
          b += src[idx + 2] * weight;
          a += src[idx + 3] * weight;
        }
        
        const idx = (y * width + x) * 4;
        temp[idx] = r;
        temp[idx + 1] = g;
        temp[idx + 2] = b;
        temp[idx + 3] = a;
      }
    }

    // Вертикальное размытие
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        
        for (let k = 0; k < kernelSize; k++) {
          const ky = Math.min(Math.max(y + k - Math.floor(kernelSize / 2), 0), height - 1);
          const idx = (ky * width + x) * 4;
          const weight = kernel[k];
          
          r += temp[idx] * weight;
          g += temp[idx + 1] * weight;
          b += temp[idx + 2] * weight;
          a += temp[idx + 3] * weight;
        }
        
        const idx = (y * width + x) * 4;
        dst[idx] = r;
        dst[idx + 1] = g;
        dst[idx + 2] = b;
        dst[idx + 3] = a;
      }
    }

    return new ImageData(dst, width, height);
  }
}
