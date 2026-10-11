import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from '../core/document';
import { DocumentHistoryManager, AddLayerCommand, RemoveLayerCommand, ChangeOpacityCommand, MoveLayerCommand } from '../core/commands';
import { RasterLayer } from '../core/document/DocumentTypes';

describe('Unified Document Command Pipeline', () => {
  let document: Document;
  let historyManager: DocumentHistoryManager;

  const createTestLayer = (id: string, name: string): RasterLayer => ({
    id,
    name,
    type: 'raster',
    visible: true,
    opacity: 100,
    blendMode: 'normal',
    locked: false,
    width: 100,
    height: 100,
    imageData: new ImageData(100, 100),
  });

  beforeEach(() => {
    document = Document.create(100, 100, 'Test Document');
    historyManager = new DocumentHistoryManager(60);
  });

  describe('Add Layer → Undo → Redo', () => {
    it('should add layer, undo it, then redo it', () => {
      const layer = createTestLayer('layer1', 'Layer 1');
      const command = new AddLayerCommand(layer);

      // Execute
      const docAfterAdd = historyManager.execute(command, document);
      expect(docAfterAdd.layers.length).toBe(1);
      expect(docAfterAdd.getLayer('layer1')).toBeDefined();

      // Undo
      const docAfterUndo = historyManager.undo(docAfterAdd);
      expect(docAfterUndo).not.toBeNull();
      expect(docAfterUndo!.layers.length).toBe(0);
      expect(docAfterUndo!.getLayer('layer1')).toBeUndefined();

      // Redo
      const docAfterRedo = historyManager.redo(docAfterUndo!);
      expect(docAfterRedo).not.toBeNull();
      expect(docAfterRedo!.layers.length).toBe(1);
      expect(docAfterRedo!.getLayer('layer1')).toBeDefined();
    });
  });

  describe('Delete Layer → Undo → Redo', () => {
    it('should delete layer, undo it, then redo it', () => {
      const layer = createTestLayer('layer1', 'Layer 1');
      document = document.addLayer(layer);

      const command = new RemoveLayerCommand('layer1');

      // Execute
      const docAfterRemove = historyManager.execute(command, document);
      expect(docAfterRemove.layers.length).toBe(0);

      // Undo
      const docAfterUndo = historyManager.undo(docAfterRemove);
      expect(docAfterUndo).not.toBeNull();
      expect(docAfterUndo!.layers.length).toBe(1);
      expect(docAfterUndo!.getLayer('layer1')).toBeDefined();

      // Redo
      const docAfterRedo = historyManager.redo(docAfterUndo!);
      expect(docAfterRedo).not.toBeNull();
      expect(docAfterRedo!.layers.length).toBe(0);
    });
  });

  describe('Move Layer → Undo → Redo', () => {
    it('should move layer, undo it, then redo it', () => {
      const layer = createTestLayer('layer1', 'Layer 1');
      document = document.addLayer(layer);

      const command = new MoveLayerCommand('layer1', { x: 50, y: 50 });

      // Execute
      const docAfterMove = historyManager.execute(command, document);
      const movedLayer = docAfterMove.getLayer('layer1');
      expect(movedLayer?.transform?.x).toBe(50);
      expect(movedLayer?.transform?.y).toBe(50);

      // Undo
      const docAfterUndo = historyManager.undo(docAfterMove);
      expect(docAfterUndo).not.toBeNull();
      const undoneLayer = docAfterUndo!.getLayer('layer1');
      expect(undoneLayer?.transform?.x).toBe(0);
      expect(undoneLayer?.transform?.y).toBe(0);

      // Redo
      const docAfterRedo = historyManager.redo(docAfterUndo!);
      expect(docAfterRedo).not.toBeNull();
      const redoneLayer = docAfterRedo!.getLayer('layer1');
      expect(redoneLayer?.transform?.x).toBe(50);
      expect(redoneLayer?.transform?.y).toBe(50);
    });
  });

  describe('Change Opacity → Undo → Redo', () => {
    it('should change opacity, undo it, then redo it', () => {
      const layer = createTestLayer('layer1', 'Layer 1');
      document = document.addLayer(layer);

      const command = new ChangeOpacityCommand('layer1', 50);

      // Execute
      const docAfterChange = historyManager.execute(command, document);
      const changedLayer = docAfterChange.getLayer('layer1');
      expect(changedLayer?.opacity).toBe(50);

      // Undo
      const docAfterUndo = historyManager.undo(docAfterChange);
      expect(docAfterUndo).not.toBeNull();
      const undoneLayer = docAfterUndo!.getLayer('layer1');
      expect(undoneLayer?.opacity).toBe(100);

      // Redo
      const docAfterRedo = historyManager.redo(docAfterUndo!);
      expect(docAfterRedo).not.toBeNull();
      const redoneLayer = docAfterRedo!.getLayer('layer1');
      expect(redoneLayer?.opacity).toBe(50);
    });
  });

  describe('Sequential Commands → Multiple Undo/Redo', () => {
    it('should execute three commands, undo three times, then redo three times', () => {
      const layer1 = createTestLayer('layer1', 'Layer 1');
      const layer2 = createTestLayer('layer2', 'Layer 2');
      const layer3 = createTestLayer('layer3', 'Layer 3');

      // Execute three commands
      const cmd1 = new AddLayerCommand(layer1);
      const doc1 = historyManager.execute(cmd1, document);
      expect(doc1.layers.length).toBe(1);

      const cmd2 = new AddLayerCommand(layer2);
      const doc2 = historyManager.execute(cmd2, doc1);
      expect(doc2.layers.length).toBe(2);

      const cmd3 = new AddLayerCommand(layer3);
      const doc3 = historyManager.execute(cmd3, doc2);
      expect(doc3.layers.length).toBe(3);

      // Undo three times
      const undo1 = historyManager.undo(doc3);
      expect(undo1!.layers.length).toBe(2);

      const undo2 = historyManager.undo(undo1!);
      expect(undo2!.layers.length).toBe(1);

      const undo3 = historyManager.undo(undo2!);
      expect(undo3!.layers.length).toBe(0);

      // Redo three times
      const redo1 = historyManager.redo(undo3!);
      expect(redo1!.layers.length).toBe(1);

      const redo2 = historyManager.redo(redo1!);
      expect(redo2!.layers.length).toBe(2);

      const redo3 = historyManager.redo(redo2!);
      expect(redo3!.layers.length).toBe(3);
    });
  });

  describe('Undo → New Command → Redo Unavailable', () => {
    it('should invalidate redo stack after new command', () => {
      const layer1 = createTestLayer('layer1', 'Layer 1');
      const layer2 = createTestLayer('layer2', 'Layer 2');

      // Execute first command
      const cmd1 = new AddLayerCommand(layer1);
      const doc1 = historyManager.execute(cmd1, document);
      expect(historyManager.canRedo()).toBe(false);

      // Undo
      const docAfterUndo = historyManager.undo(doc1);
      expect(historyManager.canRedo()).toBe(true);

      // Execute new command (should invalidate redo)
      const cmd2 = new AddLayerCommand(layer2);
      const doc2 = historyManager.execute(cmd2, docAfterUndo!);
      expect(historyManager.canRedo()).toBe(false);
      expect(doc2.layers.length).toBe(1);
      expect(doc2.getLayer('layer2')).toBeDefined();
      expect(doc2.getLayer('layer1')).toBeUndefined();
    });
  });

  describe('Failed Command Leaves State Unchanged', () => {
    it('should not modify document or history when command fails', () => {
      const layer = createTestLayer('layer1', 'Layer 1');
      document = document.addLayer(layer);

      // Try to remove non-existent layer
      const command = new RemoveLayerCommand('nonexistent');
      
      const initialLayerCount = document.layers.length;
      const initialHistorySize = historyManager.getUndoCount();

      expect(() => {
        historyManager.execute(command, document);
      }).toThrow();

      // Document should be unchanged
      expect(document.layers.length).toBe(initialLayerCount);
      
      // History should be unchanged
      expect(historyManager.getUndoCount()).toBe(initialHistorySize);
    });
  });

  describe('UI Receives Updated Document', () => {
    it('should provide updated document after command execution', () => {
      const layer = createTestLayer('layer1', 'Layer 1');
      const command = new AddLayerCommand(layer);

      // Simulate UI receiving document updates
      let currentDocument = document;
      
      const newDocument = historyManager.execute(command, currentDocument);
      currentDocument = newDocument;

      // UI should see the updated document
      expect(currentDocument.layers.length).toBe(1);
      expect(currentDocument.getLayer('layer1')).toBeDefined();

      // After undo
      const undoneDocument = historyManager.undo(currentDocument);
      currentDocument = undoneDocument!;

      expect(currentDocument.layers.length).toBe(0);

      // After redo
      const redoneDocument = historyManager.redo(currentDocument);
      currentDocument = redoneDocument!;

      expect(currentDocument.layers.length).toBe(1);
    });
  });

  describe('Render Notification', () => {
    it('should indicate successful document transition', () => {
      const layer = createTestLayer('layer1', 'Layer 1');
      const command = new AddLayerCommand(layer);

      // Execute should return new document (indicates success)
      const newDocument = historyManager.execute(command, document);
      expect(newDocument).not.toBe(document);
      expect(newDocument.layers.length).toBe(1);

      // Undo should return previous document
      const previousDocument = historyManager.undo(newDocument);
      expect(previousDocument).not.toBeNull();
      expect(previousDocument).toBe(document);

      // Redo should return new document again
      const redoneDocument = historyManager.redo(previousDocument!);
      expect(redoneDocument).toBe(newDocument);
    });
  });

  describe('History Manager State', () => {
    it('should track undo/redo counts correctly', () => {
      expect(historyManager.getUndoCount()).toBe(0);
      expect(historyManager.getRedoCount()).toBe(0);

      const layer1 = createTestLayer('layer1', 'Layer 1');
      const cmd1 = new AddLayerCommand(layer1);
      const doc1 = historyManager.execute(cmd1, document);

      expect(historyManager.getUndoCount()).toBe(1);
      expect(historyManager.getRedoCount()).toBe(0);

      const docAfterUndo = historyManager.undo(doc1);
      expect(historyManager.getUndoCount()).toBe(0);
      expect(historyManager.getRedoCount()).toBe(1);

      const docAfterRedo = historyManager.redo(docAfterUndo!);
      expect(historyManager.getUndoCount()).toBe(1);
      expect(historyManager.getRedoCount()).toBe(0);
    });

    it('should provide history descriptions', () => {
      const layer1 = createTestLayer('layer1', 'Layer 1');
      const layer2 = createTestLayer('layer2', 'Layer 2');

      historyManager.execute(new AddLayerCommand(layer1), document);
      historyManager.execute(new AddLayerCommand(layer2), document);

      const undoHistory = historyManager.getUndoHistory();
      expect(undoHistory.length).toBe(2);
      expect(undoHistory[0]).toContain('Layer 1');
      expect(undoHistory[1]).toContain('Layer 2');
    });
  });

  describe('Document Metadata Preservation', () => {
    it('should preserve document metadata through commands', () => {
      const layer = createTestLayer('layer1', 'Layer 1');
      const command = new AddLayerCommand(layer);

      const newDocument = historyManager.execute(command, document);

      // Metadata should be preserved
      expect(newDocument.id).toBe(document.id);
      expect(newDocument.name).toBe(document.name);
      expect(newDocument.width).toBe(document.width);
      expect(newDocument.height).toBe(document.height);
    });

    it('should preserve active layer state appropriately', () => {
      const layer1 = createTestLayer('layer1', 'Layer 1');
      const layer2 = createTestLayer('layer2', 'Layer 2');

      // Add first layer (becomes active)
      const doc1 = historyManager.execute(new AddLayerCommand(layer1), document);
      expect(doc1.activeLayerId).toBe('layer1');

      // Set active to layer1 explicitly
      const doc1WithActive = doc1.setActiveLayer('layer1');

      // Add second layer
      const doc2 = historyManager.execute(new AddLayerCommand(layer2), doc1WithActive);
      
      // Active layer should still be valid
      expect(doc2.activeLayerId).toBe('layer1');
      expect(doc2.getLayer('layer1')).toBeDefined();
    });
  });
});
