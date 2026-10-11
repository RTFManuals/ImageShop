import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from '../core/document';
import { HistoryManager } from '../core/commands';
import { ToolRegistry, ToolManager, ToolContext } from '../core/tools';
import { Selection } from '../core/selection';
import { RasterLayer } from '../core/document/DocumentTypes';

describe('EditorContext Integration', () => {
  let document: Document;
  let historyManager: HistoryManager;
  let toolRegistry: ToolRegistry;
  let toolManager: ToolManager;
  let currentSelection: Selection | null;
  let renderCallCount: number;

  beforeEach(() => {
    // Create initial document
    document = Document.create(100, 100, 'Test');
    
    // Add a layer
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

    historyManager = new HistoryManager(60);
    toolRegistry = new ToolRegistry();
    currentSelection = null;
    renderCallCount = 0;

    // Create tool context with refs to simulate EditorContext behavior
    const documentRef = { current: document };
    const selectionRef = { current: currentSelection };

    const toolContext: ToolContext = {
      getDocument: () => documentRef.current,
      setDocument: (doc) => {
        documentRef.current = doc;
        document = doc;
      },
      getActiveLayer: () => {
        const doc = documentRef.current;
        if (!doc) return null;
        return doc.getActiveLayer();
      },
      getSelection: () => selectionRef.current,
      setSelection: (sel) => {
        selectionRef.current = sel;
        currentSelection = sel;
      },
      getViewport: () => ({ zoom: 1, panX: 0, panY: 0, width: 100, height: 100 }),
      executeCommand: (command) => {
        historyManager.execute(command);
        renderCallCount++;
      },
      requestRender: () => {
        renderCallCount++;
      },
    };

    toolManager = new ToolManager(toolRegistry, toolContext);
  });

  describe('ToolContext state access', () => {
    it('should receive updated document state', () => {
      const activeLayer = toolManager['context'].getActiveLayer();
      expect(activeLayer).toBeDefined();
      expect(activeLayer?.id).toBe('layer1');

      // Update document
      const updatedDoc = document.setActiveLayer(null);
      toolManager['context'].setDocument(updatedDoc);

      // Should receive updated state
      const newActiveLayer = toolManager['context'].getActiveLayer();
      expect(newActiveLayer).toBeUndefined();
    });

    it('should receive updated selection state', () => {
      expect(toolManager['context'].getSelection()).toBeNull();

      // Update selection
      const selection = new Selection(100, 100);
      selection.selectRect({ x: 10, y: 10, width: 20, height: 20 });
      toolManager['context'].setSelection(selection);

      // Should receive updated state
      const currentSel = toolManager['context'].getSelection();
      expect(currentSel).not.toBeNull();
      expect(currentSel?.contains(15, 15)).toBe(true);
    });

    it('should trigger render on command execution', () => {
      expect(renderCallCount).toBe(0);

      // Execute a command (simulated)
      const mockCommand = {
        id: 'test',
        name: 'Test Command',
        timestamp: Date.now(),
        execute: () => {},
        undo: () => {},
        redo: () => {},
      };

      toolManager['context'].executeCommand(mockCommand);
      expect(renderCallCount).toBe(1);
    });

    it('should trigger render on requestRender', () => {
      expect(renderCallCount).toBe(0);

      toolManager['context'].requestRender();
      expect(renderCallCount).toBe(1);

      toolManager['context'].requestRender();
      expect(renderCallCount).toBe(2);
    });
  });

  describe('Command execution and undo/redo', () => {
    it('should update document through command execution', () => {
      const initialDoc = toolManager['context'].getDocument();
      expect(initialDoc?.layers.length).toBe(1);

      // Simulate command that adds a layer
      const newLayer: RasterLayer = {
        id: 'layer2',
        name: 'Layer 2',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const updatedDoc = initialDoc!.addLayer(newLayer);
      toolManager['context'].setDocument(updatedDoc);

      // Verify document updated
      const currentDoc = toolManager['context'].getDocument();
      expect(currentDoc?.layers.length).toBe(2);
    });

    it('should restore previous document on undo', () => {
      const initialDoc = toolManager['context'].getDocument();
      expect(initialDoc?.layers.length).toBe(1);

      // Simulate command execution
      const newLayer: RasterLayer = {
        id: 'layer2',
        name: 'Layer 2',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const updatedDoc = initialDoc!.addLayer(newLayer);
      
      // Create a simple command for testing
      const mockCommand = {
        id: 'test',
        name: 'Test Command',
        timestamp: Date.now(),
        execute: () => {
          toolManager['context'].setDocument(updatedDoc);
        },
        undo: () => {
          toolManager['context'].setDocument(initialDoc!);
        },
        redo: () => {
          toolManager['context'].setDocument(updatedDoc);
        },
      };

      historyManager.execute(mockCommand);
      
      // Verify document updated
      let currentDoc = toolManager['context'].getDocument();
      expect(currentDoc?.layers.length).toBe(2);

      // Undo
      historyManager.undo();
      currentDoc = toolManager['context'].getDocument();
      expect(currentDoc?.layers.length).toBe(1);
    });

    it('should restore new document on redo', () => {
      const initialDoc = toolManager['context'].getDocument();
      
      const newLayer: RasterLayer = {
        id: 'layer2',
        name: 'Layer 2',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      const updatedDoc = initialDoc!.addLayer(newLayer);
      
      const mockCommand = {
        id: 'test',
        name: 'Test Command',
        timestamp: Date.now(),
        execute: () => {
          toolManager['context'].setDocument(updatedDoc);
        },
        undo: () => {
          toolManager['context'].setDocument(initialDoc!);
        },
        redo: () => {
          toolManager['context'].setDocument(updatedDoc);
        },
      };

      historyManager.execute(mockCommand);
      historyManager.undo();
      
      // Verify document restored to initial state
      let currentDoc = toolManager['context'].getDocument();
      expect(currentDoc?.layers.length).toBe(1);

      // Redo
      historyManager.redo();
      currentDoc = toolManager['context'].getDocument();
      expect(currentDoc?.layers.length).toBe(2);
    });
  });

  describe('Active layer preservation', () => {
    it('should preserve valid active layer after layer removal', () => {
      // Add two layers
      const layer2: RasterLayer = {
        id: 'layer2',
        name: 'Layer 2',
        type: 'raster',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        locked: false,
        width: 100,
        height: 100,
        imageData: new ImageData(100, 100),
      };

      let doc = toolManager['context'].getDocument()!;
      doc = doc.addLayer(layer2);
      doc = doc.setActiveLayer('layer2');
      toolManager['context'].setDocument(doc);

      // Remove active layer
      doc = doc.removeLayer('layer2');
      toolManager['context'].setDocument(doc);

      // Active layer should be valid
      const currentDoc = toolManager['context'].getDocument();
      expect(currentDoc?.activeLayerId).toBe('layer1');
      expect(currentDoc?.getActiveLayer()).toBeDefined();
    });

    it('should set active layer to null when all layers removed', () => {
      let doc = toolManager['context'].getDocument()!;
      doc = doc.removeLayer('layer1');
      toolManager['context'].setDocument(doc);

      const currentDoc = toolManager['context'].getDocument();
      expect(currentDoc?.activeLayerId).toBeNull();
      expect(currentDoc?.getActiveLayer()).toBeUndefined();
    });
  });

  describe('History and rendering coordination', () => {
    it('should coordinate command execution with rendering', () => {
      expect(renderCallCount).toBe(0);
      expect(historyManager.getUndoCount()).toBe(0);

      // Execute multiple commands
      for (let i = 0; i < 3; i++) {
        const mockCommand = {
          id: `test-${i}`,
          name: `Test Command ${i}`,
          timestamp: Date.now(),
          execute: () => {},
          undo: () => {},
          redo: () => {},
        };
        historyManager.execute(mockCommand);
        renderCallCount++;
      }

      expect(historyManager.getUndoCount()).toBe(3);
      expect(renderCallCount).toBe(3);

      // Undo should not trigger additional render (handled by command)
      historyManager.undo();
      expect(historyManager.getUndoCount()).toBe(2);
      expect(historyManager.getRedoCount()).toBe(1);
    });
  });
});
