import { describe, it, expect, beforeEach } from 'vitest';
import { RectangularMarqueeTool } from './RectangularMarqueeTool';
import { EllipticalMarqueeTool } from './EllipticalMarqueeTool';
import { LassoTool } from './LassoTool';
import { MagicWandTool } from './MagicWandTool';
import { Selection } from '../../core/selection/Selection';
import { Document } from '../../core/document/Document';
import { RasterLayer } from '../../core/document/DocumentTypes';

describe('Selection Modifiers', () => {
  let document: Document;
  let mockContext: any;

  beforeEach(() => {
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
      setSelection: (selection: Selection | null) => {
        mockContext._selection = selection;
      },
      _selection: null as Selection | null,
      getViewport: () => ({ zoom: 1, panX: 0, panY: 0 }),
      executeCommand: () => {},
      requestRender: () => {},
    };
  });

  describe('RectangularMarqueeTool', () => {
    it('should add to selection with Shift key', () => {
      const tool = new RectangularMarqueeTool();
      
      // Создаём первое выделение
      tool.onPointerDown({ type: 'down', x: 10, y: 10, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      tool.onPointerMove({ type: 'move', x: 30, y: 30, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      tool.onPointerUp({ type: 'up', x: 30, y: 30, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      
      const firstSelection = mockContext._selection;
      expect(firstSelection).not.toBeNull();
      
      // Добавляем второе выделение с Shift
      mockContext.getSelection = () => firstSelection;
      
      tool.onPointerDown({ type: 'down', x: 50, y: 50, pressure: 1, button: 0, altKey: false, shiftKey: true, ctrlKey: false }, mockContext);
      tool.onPointerMove({ type: 'move', x: 70, y: 70, pressure: 1, button: 0, altKey: false, shiftKey: true, ctrlKey: false }, mockContext);
      tool.onPointerUp({ type: 'up', x: 70, y: 70, pressure: 1, button: 0, altKey: false, shiftKey: true, ctrlKey: false }, mockContext);
      
      const combinedSelection = mockContext._selection;
      expect(combinedSelection).not.toBeNull();
      
      // Проверяем, что обе области выделены
      expect(combinedSelection!.contains(20, 20)).toBe(true); // Первая область
      expect(combinedSelection!.contains(60, 60)).toBe(true); // Вторая область
    });

    it('should subtract from selection with Alt key', () => {
      const tool = new RectangularMarqueeTool();
      
      // Создаём большое выделение
      tool.onPointerDown({ type: 'down', x: 10, y: 10, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      tool.onPointerMove({ type: 'move', x: 80, y: 80, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      tool.onPointerUp({ type: 'up', x: 80, y: 80, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      
      const firstSelection = mockContext._selection;
      expect(firstSelection!.contains(50, 50)).toBe(true);
      
      // Вычитаем область с Alt
      mockContext.getSelection = () => firstSelection;
      
      tool.onPointerDown({ type: 'down', x: 40, y: 40, pressure: 1, button: 0, altKey: true, shiftKey: false, ctrlKey: false }, mockContext);
      tool.onPointerMove({ type: 'move', x: 60, y: 60, pressure: 1, button: 0, altKey: true, shiftKey: false, ctrlKey: false }, mockContext);
      tool.onPointerUp({ type: 'up', x: 60, y: 60, pressure: 1, button: 0, altKey: true, shiftKey: false, ctrlKey: false }, mockContext);
      
      const subtractedSelection = mockContext._selection;
      expect(subtractedSelection).not.toBeNull();
      
      // Проверяем, что вычитаемая область не выделена
      expect(subtractedSelection!.contains(50, 50)).toBe(false);
      // Но остальная часть первого выделения осталась
      expect(subtractedSelection!.contains(20, 20)).toBe(true);
    });

    it('should intersect selections with Shift+Alt', () => {
      const tool = new RectangularMarqueeTool();
      
      // Создаём первое выделение
      tool.onPointerDown({ type: 'down', x: 10, y: 10, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      tool.onPointerMove({ type: 'move', x: 50, y: 50, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      tool.onPointerUp({ type: 'up', x: 50, y: 50, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      
      const firstSelection = mockContext._selection;
      
      // Пересекаем с другим выделением
      mockContext.getSelection = () => firstSelection;
      
      tool.onPointerDown({ type: 'down', x: 30, y: 30, pressure: 1, button: 0, altKey: true, shiftKey: true, ctrlKey: false }, mockContext);
      tool.onPointerMove({ type: 'move', x: 70, y: 70, pressure: 1, button: 0, altKey: true, shiftKey: true, ctrlKey: false }, mockContext);
      tool.onPointerUp({ type: 'up', x: 70, y: 70, pressure: 1, button: 0, altKey: true, shiftKey: true, ctrlKey: false }, mockContext);
      
      const intersectedSelection = mockContext._selection;
      expect(intersectedSelection).not.toBeNull();
      
      // Проверяем, что выделена только пересечённая область
      expect(intersectedSelection!.contains(40, 40)).toBe(true); // В пересечении
      expect(intersectedSelection!.contains(15, 15)).toBe(false); // Только в первом
      expect(intersectedSelection!.contains(60, 60)).toBe(false); // Только во втором
    });
  });

  describe('EllipticalMarqueeTool', () => {
    it('should support selection modifiers', () => {
      const tool = new EllipticalMarqueeTool();
      
      // Создаём первое выделение
      tool.onPointerDown({ type: 'down', x: 10, y: 10, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      tool.onPointerMove({ type: 'move', x: 40, y: 40, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      tool.onPointerUp({ type: 'up', x: 40, y: 40, pressure: 1, button: 0, altKey: false, shiftKey: false, ctrlKey: false }, mockContext);
      
      const firstSelection = mockContext._selection;
      expect(firstSelection).not.toBeNull();
      
      // Добавляем второе выделение с Shift
      mockContext.getSelection = () => firstSelection;
      
      tool.onPointerDown({ type: 'down', x: 60, y: 60, pressure: 1, button: 0, altKey: false, shiftKey: true, ctrlKey: false }, mockContext);
      tool.onPointerMove({ type: 'move', x: 90, y: 90, pressure: 1, button: 0, altKey: false, shiftKey: true, ctrlKey: false }, mockContext);
      tool.onPointerUp({ type: 'up', x: 90, y: 90, pressure: 1, button: 0, altKey: false, shiftKey: true, ctrlKey: false }, mockContext);
      
      const combinedSelection = mockContext._selection;
      expect(combinedSelection).not.toBeNull();
    });
  });
});
