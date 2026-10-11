import { describe, it, expect, beforeEach } from 'vitest';
import { RectangularMarqueeTool } from './RectangularMarqueeTool';
import { EllipticalMarqueeTool } from './EllipticalMarqueeTool';
import { LassoTool } from './LassoTool';
import { MagicWandTool } from './MagicWandTool';
import { Selection } from '../../core/selection/Selection';
import { Document } from '../../core/document/Document';
import { RasterLayer } from '../../core/document/DocumentTypes';

describe('RectangularMarqueeTool', () => {
  let tool: RectangularMarqueeTool;
  let document: Document;
  let mockContext: any;

  beforeEach(() => {
    tool = new RectangularMarqueeTool();
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
      setSelection: (selection: Selection | null) => {},
      getViewport: () => ({ zoom: 1, panX: 0, panY: 0 }),
      executeCommand: () => {},
      requestRender: () => {},
    };
  });

  it('should have correct id and name', () => {
    expect(tool.id).toBe('rectangular-marquee');
    expect(tool.name).toBe('Rectangular Marquee Tool');
  });

  it('should create rectangular selection', () => {
    tool.onPointerDown({ type: 'down', x: 10, y: 10, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
    tool.onPointerMove({ type: 'move', x: 50, y: 50, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
    tool.onPointerUp({ type: 'up', x: 50, y: 50, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
    
    const selection = mockContext.getSelection();
    expect(selection).not.toBeNull();
  });
});

describe('EllipticalMarqueeTool', () => {
  let tool: EllipticalMarqueeTool;

  beforeEach(() => {
    tool = new EllipticalMarqueeTool();
  });

  it('should have correct id and name', () => {
    expect(tool.id).toBe('elliptical-marquee');
    expect(tool.name).toBe('Elliptical Marquee Tool');
  });
});

describe('LassoTool', () => {
  let tool: LassoTool;

  beforeEach(() => {
    tool = new LassoTool();
  });

  it('should have correct id and name', () => {
    expect(tool.id).toBe('lasso');
    expect(tool.name).toBe('Lasso Tool');
  });
});

describe('MagicWandTool', () => {
  let tool: MagicWandTool;

  beforeEach(() => {
    tool = new MagicWandTool();
  });

  it('should have correct id and name', () => {
    expect(tool.id).toBe('magic-wand');
    expect(tool.name).toBe('Magic Wand Tool');
  });

  it('should set and get tolerance', () => {
    tool.setTolerance(50);
    expect(tool.getTolerance()).toBe(50);
  });

  it('should clamp tolerance to valid range', () => {
    tool.setTolerance(300);
    expect(tool.getTolerance()).toBe(255);
    
    tool.setTolerance(-10);
    expect(tool.getTolerance()).toBe(0);
  });
});
