// Rendering Engine - Core Interfaces

import { EditorDocument } from '../document/DocumentTypes';

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
  width: number;
  height: number;

  // Coordinate transformations
  screenToDocument(screenX: number, screenY: number): { x: number; y: number };
  documentToScreen(docX: number, docY: number): { x: number; y: number };

  // Viewport operations
  setZoom(zoom: number): void;
  pan(dx: number, dy: number): void;
  reset(): void;
}

export interface Renderer {
  initialize(canvas: HTMLCanvasElement): void;
  render(document: EditorDocument, viewport: Viewport): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export class ViewportImpl implements Viewport {
  zoom: number = 1;
  panX: number = 0;
  panY: number = 0;
  width: number = 0;
  height: number = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  screenToDocument(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.panX) / this.zoom,
      y: (screenY - this.panY) / this.zoom,
    };
  }

  documentToScreen(docX: number, docY: number): { x: number; y: number } {
    return {
      x: docX * this.zoom + this.panX,
      y: docY * this.zoom + this.panY,
    };
  }

  setZoom(zoom: number): void {
    this.zoom = Math.max(0.01, Math.min(32, zoom));
  }

  pan(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
  }

  reset(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}
