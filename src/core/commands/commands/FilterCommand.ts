import { BaseCommand } from '../Command';
import { Document } from '../../document/Document';
import { RasterLayer } from '../../document/DocumentTypes';

export type FilterFunction = (imageData: ImageData) => ImageData;

export class FilterCommand extends BaseCommand {
  private document: Document;
  private layerId: string;
  private filterFn: FilterFunction;
  private filterName: string;
  private beforeImageData: ImageData | null = null;
  private afterImageData: ImageData | null = null;
  private resultDocument: Document | null = null;

  constructor(document: Document, layerId: string, filterFn: FilterFunction, filterName: string = 'Filter') {
    super(filterName);
    this.document = document;
    this.layerId = layerId;
    this.filterFn = filterFn;
    this.filterName = filterName;
  }

  execute(): void {
    const layer = this.document.getLayer(this.layerId);
    if (!layer || layer.type !== 'raster') {
      return;
    }

    const rasterLayer = layer as RasterLayer;
    
    // Сохраняем состояние до
    this.beforeImageData = new ImageData(
      new Uint8ClampedArray(rasterLayer.imageData.data),
      rasterLayer.imageData.width,
      rasterLayer.imageData.height
    );

    // Применяем фильтр
    this.afterImageData = this.filterFn(rasterLayer.imageData);

    // Обновляем слой
    const updatedLayer: RasterLayer = {
      ...rasterLayer,
      imageData: this.afterImageData,
    };

    this.resultDocument = this.document.updateLayer(this.layerId, updatedLayer);
  }

  undo(): void {
    if (!this.beforeImageData || !this.resultDocument) {
      return;
    }

    const layer = this.resultDocument.getLayer(this.layerId);
    if (!layer || layer.type !== 'raster') {
      return;
    }

    const rasterLayer = layer as RasterLayer;
    const restoredLayer: RasterLayer = {
      ...rasterLayer,
      imageData: this.beforeImageData,
    };

    this.resultDocument = this.resultDocument.updateLayer(this.layerId, restoredLayer);
  }

  getResult(): Document | null {
    return this.resultDocument;
  }

  getBeforeImageData(): ImageData | null {
    return this.beforeImageData;
  }

  getAfterImageData(): ImageData | null {
    return this.afterImageData;
  }

  getFilterName(): string {
    return this.filterName;
  }
}
