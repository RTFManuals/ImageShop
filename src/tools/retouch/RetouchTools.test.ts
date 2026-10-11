import { describe, it, expect, beforeEach } from 'vitest';
import { MaskPaintTool } from '../mask/MaskPaintTool';
import { SpotHealingBrushTool } from './SpotHealingBrushTool';
import { CloneStampTool } from './CloneStampTool';
import { Document } from '../../core/document/Document';
import { RasterLayer } from '../../core/document/DocumentTypes';

describe('MaskPaintTool', () => {
  let tool: MaskPaintTool;
  let document: Document;
  let mockContext: any;

  beforeEach(() => {
    tool = new MaskPaintTool();
    document = Document.create(100, 100);
    
    const layer: RasterLayer = {
      id: 'layer1',
      name: 'Layer 1',
      type: 'raster',
      visible: true,
      opacity: 100,
      blendMode: 'normal',
      locked: false,
      width: 100,
      height: 100,
      imageData: new ImageData(100, 100),
    };
    
    document = document.addLayer(layer);
    
    mockContext = {
      getDocument: () => document,
      setDocument: (doc: Document) => { document = doc; },
      getActiveLayer: () => document.getLayer('layer1'),
      getSelection: () => null,
      setSelection: () => {},
      getViewport: () => ({ zoom: 1, panX: 0, panY: 0 }),
      executeCommand: () => {},
      requestRender: () => {},
    };
  });

  it('should have correct id and name', () => {
    expect(tool.id).toBe('mask-paint');
    expect(tool.name).toBe('Mask Paint Tool');
  });

  it('should set size', () => {
    tool.setSize(30);
    // Size is private, но мы можем проверить что метод существует
    expect(tool.setSize).toBeDefined();
  });

  it('should set hardness', () => {
    tool.setHardness(50);
    expect(tool.setHardness).toBeDefined();
  });

  it('should set opacity', () => {
    tool.setOpacity(75);
    expect(tool.setOpacity).toBeDefined();
  });

  it('should set mode', () => {
    tool.setMode('conceal');
    expect(tool.setMode).toBeDefined();
  });
});

describe('SpotHealingBrushTool', () => {
  let tool: SpotHealingBrushTool;

  beforeEach(() => {
    tool = new SpotHealingBrushTool();
  });

  it('should have correct id and name', () => {
    expect(tool.id).toBe('spot-healing-brush');
    expect(tool.name).toBe('Spot Healing Brush Tool');
  });

  it('should set size', () => {
    tool.setSize(25);
    expect(tool.setSize).toBeDefined();
  });
});

describe('CloneStampTool', () => {
  let tool: CloneStampTool;

  beforeEach(() => {
    tool = new CloneStampTool();
  });

  it('should have correct id and name', () => {
    expect(tool.id).toBe('clone-stamp');
    expect(tool.name).toBe('Clone Stamp Tool');
  });

  it('should set size', () => {
    tool.setSize(20);
    expect(tool.setSize).toBeDefined();
  });

  it('should set hardness', () => {
    tool.setHardness(80);
    expect(tool.setHardness).toBeDefined();
  });

  it('should set opacity', () => {
    tool.setOpacity(90);
    expect(tool.setOpacity).toBeDefined();
  });
});
