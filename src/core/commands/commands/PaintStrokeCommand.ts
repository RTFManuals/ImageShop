import { BaseDocumentCommand } from '../DocumentCommand';
import { Document } from '../../document/Document';
import { RasterLayer } from '../../document/DocumentTypes';

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface StrokeData {
  points: StrokePoint[];
  color: string;
  size: number;
  opacity: number;
  hardness: number;
  mode: 'brush' | 'eraser';
}

/**
 * Command to paint a stroke on a raster layer.
 * This command is immutable and creates a new document with the stroke applied.
 * 
 * Note: This command does not implement undo() because the DocumentHistoryManager
 * stores full document snapshots. The undo operation is handled by restoring
 * the previous document state from the history stack.
 */
export class PaintStrokeCommand extends BaseDocumentCommand {
  private layerId: string;
  private strokeData: StrokeData;

  constructor(layerId: string, strokeData: StrokeData) {
    super(`Paint Stroke on ${layerId}`);
    this.layerId = layerId;
    this.strokeData = strokeData;
  }

  execute(document: Document): Document {
    const layer = document.getLayer(this.layerId);
    if (!layer || layer.type !== 'raster') {
      throw new Error(`Layer ${this.layerId} not found or not a raster layer`);
    }

    const rasterLayer = layer as RasterLayer;
    
    // Create new ImageData with stroke applied
    const newImageData = this.applyStroke(rasterLayer.imageData, this.strokeData);
    
    // Create new layer with updated imageData
    const newLayer: RasterLayer = {
      ...rasterLayer,
      imageData: newImageData,
    };

    // Return new document with updated layer
    return document.updateLayer(this.layerId, newLayer);
  }

  undo(document: Document): Document {
    // This method should not be called directly.
    // DocumentHistoryManager handles undo by restoring the previous document state.
    throw new Error(
      'PaintStrokeCommand.undo() should not be called directly. ' +
      'Use DocumentHistoryManager.undo() which restores the previous document state.'
    );
  }

  private applyStroke(imageData: ImageData, stroke: StrokeData): ImageData {
    // Create a copy of the image data to avoid mutating the original
    const newData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const ctx = this.createTemporaryContext(newData);
    
    if (stroke.mode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = stroke.opacity / 100;

    if (stroke.points.length === 0) {
      return newData;
    }

    // Draw the stroke
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      const point = stroke.points[i];
      ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();

    // Get the modified image data from the canvas
    const resultData = ctx.getImageData(0, 0, imageData.width, imageData.height);
    
    return resultData;
  }

  private createTemporaryContext(imageData: ImageData): CanvasRenderingContext2D {
    // Create a temporary canvas to draw on
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create 2D context');
    }
    
    // Put the image data on the canvas
    ctx.putImageData(imageData, 0, 0);
    
    return ctx;
  }
}
