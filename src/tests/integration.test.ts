import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from '../core/document';
import { HistoryManager } from '../core/commands';
import { AddLayerCommand } from '../core/commands/commands/AddLayerCommand';
import { RemoveLayerCommand } from '../core/commands/commands/RemoveLayerCommand';
import { ChangeOpacityCommand } from '../core/commands/commands/ChangeOpacityCommand';
import { RasterLayer } from '../core/document/DocumentTypes';

describe('Integration Tests', () => {
  let document: Document;
  let history: HistoryManager;

  beforeEach(() => {
    document = Document.create(800, 600, 'Test Document');
    history = new HistoryManager();
  });

  describe('Layer Operations', () => {
    it('should add layer and undo', () => {
      const layer: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 800,
        height: 600,
        imageData: new ImageData(800, 600),
      };

      const command = new AddLayerCommand(document, layer);
      history.execute(command);

      expect(document.layers.length).toBe(0);
      const resultDoc = command.getResult();
      expect(resultDoc?.layers.length).toBe(1);

      // Undo
      history.undo();
      expect(history.canRedo()).toBe(true);
    });

    it('should remove layer and undo', () => {
      const layer: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 800,
        height: 600,
        imageData: new ImageData(800, 600),
      };

      const docWithLayer = document.addLayer(layer);
      const command = new RemoveLayerCommand(docWithLayer, 'layer1');
      history.execute(command);

      const resultDoc = command.getResult();
      expect(resultDoc?.layers.length).toBe(0);

      // Undo
      history.undo();
      expect(history.canRedo()).toBe(true);
    });

    it('should change opacity and undo', () => {
      const layer: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 800,
        height: 600,
        imageData: new ImageData(800, 600),
      };

      const docWithLayer = document.addLayer(layer);
      const command = new ChangeOpacityCommand(docWithLayer, 'layer1', 50);
      history.execute(command);

      const resultDoc = command.getResult();
      expect(resultDoc?.getLayer('layer1')?.opacity).toBe(50);

      // Undo
      history.undo();
      expect(history.canRedo()).toBe(true);
    });
  });

  describe('History Management', () => {
    it('should maintain history stack', () => {
      const layer1: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 800,
        height: 600,
        imageData: new ImageData(800, 600),
      };

      const layer2: RasterLayer = {
        id: 'layer2',
        name: 'Layer 2',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 800,
        height: 600,
        imageData: new ImageData(800, 600),
      };

      const cmd1 = new AddLayerCommand(document, layer1);
      history.execute(cmd1);

      const doc1 = cmd1.getResult()!;
      const cmd2 = new AddLayerCommand(doc1, layer2);
      history.execute(cmd2);

      expect(history.getUndoCount()).toBe(2);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);

      // Undo one
      history.undo();
      expect(history.getUndoCount()).toBe(1);
      expect(history.canRedo()).toBe(true);

      // Undo another
      history.undo();
      expect(history.getUndoCount()).toBe(0);
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(true);

      // Redo
      history.redo();
      expect(history.getUndoCount()).toBe(1);
      expect(history.canRedo()).toBe(true);
    });

    it('should limit history size', () => {
      const smallHistory = new HistoryManager(3);

      for (let i = 0; i < 5; i++) {
        const layer: RasterLayer = {
          id: `layer${i}`,
          name: `Layer ${i}`,
          type: 'raster',
          visible: true,
          opacity: 100,
          blendMode: 'normal',
          locked: false,
          width: 800,
          height: 600,
          imageData: new ImageData(800, 600),
        };

        const cmd = new AddLayerCommand(document, layer);
        smallHistory.execute(cmd);
        document = cmd.getResult()!;
      }

      expect(smallHistory.getUndoCount()).toBe(3);
    });
  });

  describe('Document Serialization', () => {
    it('should serialize and deserialize document with layers', () => {
      const layer: RasterLayer = {
        id: 'layer1',
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        opacity: 75,
        blendMode: 'multiply',
        locked: false,
        width: 800,
        height: 600,
        imageData: new ImageData(800, 600),
      };

      const docWithLayer = document.addLayer(layer);
      const json = docWithLayer.toJSON();

      // Сериализуем в JSON строку
      const jsonString = JSON.stringify(json);

      // Десериализуем
      const parsed = JSON.parse(jsonString);
      const restored = Document.fromJSON(parsed);

      expect(restored.id).toBe(docWithLayer.id);
      expect(restored.name).toBe(docWithLayer.name);
      expect(restored.width).toBe(docWithLayer.width);
      expect(restored.height).toBe(docWithLayer.height);
      expect(restored.layers.length).toBe(1);
      expect(restored.layers[0].name).toBe('Layer 1');
      expect(restored.layers[0].opacity).toBe(75);
      expect(restored.layers[0].blendMode).toBe('multiply');
    });
  });
});
