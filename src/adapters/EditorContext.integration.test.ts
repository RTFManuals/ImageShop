import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from '../core/document';
import { HistoryManager } from '../core/commands';
import { ToolRegistry, ToolManager, ToolContext, ToolContextProvider } from '../core/tools';
import { Selection } from '../core/selection';
import { ViewportImpl } from '../core/rendering';
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

    // Create state holders (simulating refs in EditorContext)
    const state = {
      document: document,
      selection: currentSelection,
    };

    // Create tool context provider - returns fresh context on every call
    const contextProvider: ToolContextProvider = () => {
      const context: ToolContext = {
        getDocument: () => state.document,
        setDocument: (doc) => {
          state.document = doc;
          document = doc;
        },
        getActiveLayer: () => {
          const doc = state.document;
          if (!doc) return null;
          return doc.getActiveLayer() ?? null;
        },
        getSelection: () => state.selection,
        setSelection: (sel) => {
          state.selection = sel;
          currentSelection = sel;
        },
        getViewport: () => new ViewportImpl(100, 100),
        executeCommand: (command) => {
          historyManager.execute(command);
          renderCallCount++;
        },
        requestRender: () => {
          renderCallCount++;
        },
      };
      return context;
    };

    toolManager = new ToolManager(toolRegistry, contextProvider);
  });

  describe('ToolContext state access', () => {
    it('should receive updated document state', () => {
      const context = (toolManager as any).getContext();
      const activeLayer = context.getActiveLayer();
      expect(activeLayer).toBeDefined();
      expect(activeLayer?.id).toBe('layer1');

      // Update document
      const updatedDoc = document.setActiveLayer(null);
      context.setDocument(updatedDoc);

      // Should receive updated state through new context call
      const newContext = (toolManager as any).getContext();
      const newActiveLayer = newContext.getActiveLayer();
      expect(newActiveLayer).toBeUndefined();
    });

    it('should receive updated selection state', () => {
      const context = (toolManager as any).getContext();
      expect(context.getSelection()).toBeNull();

      // Update selection
      const selection = new Selection(100, 100);
      selection.selectRect({ x: 10, y: 10, width: 20, height: 20 });
      context.setSelection(selection);

      // Should receive updated state through new context call
      const newContext = (toolManager as any).getContext();
      const currentSel = newContext.getSelection();
      expect(currentSel).not.toBeNull();
      expect(currentSel?.contains(15, 15)).toBe(true);
    });

    it('should trigger render on command execution', () => {
      const context = (toolManager as any).getContext();
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

      context.executeCommand(mockCommand);
      expect(renderCallCount).toBe(1);
    });

    it('should trigger render on requestRender', () => {
      const context = (toolManager as any).getContext();
      expect(renderCallCount).toBe(0);

      context.requestRender();
      expect(renderCallCount).toBe(1);

      context.requestRender();
      expect(renderCallCount).toBe(2);
    });
  });

  describe('Command execution and undo/redo', () => {
    it('should update document through command execution', () => {
      const context = (toolManager as any).getContext();
      const initialDoc = context.getDocument();
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
      context.setDocument(updatedDoc);

      // Verify document updated
      const newContext = (toolManager as any).getContext();
      const currentDoc = newContext.getDocument();
      expect(currentDoc?.layers.length).toBe(2);
    });

    it('should restore previous document on undo', () => {
      const context = (toolManager as any).getContext();
      const initialDoc = context.getDocument();
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
          context.setDocument(updatedDoc);
        },
        undo: () => {
          context.setDocument(initialDoc!);
        },
        redo: () => {
          context.setDocument(updatedDoc);
        },
      };

      historyManager.execute(mockCommand);
      
      // Verify document updated
      let currentContext = (toolManager as any).getContext();
      let currentDoc = currentContext.getDocument();
      expect(currentDoc?.layers.length).toBe(2);

      // Undo
      historyManager.undo();
      currentContext = (toolManager as any).getContext();
      currentDoc = currentContext.getDocument();
      expect(currentDoc?.layers.length).toBe(1);
    });

    it('should restore new document on redo', () => {
      const context = (toolManager as any).getContext();
      const initialDoc = context.getDocument();
      
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
          context.setDocument(updatedDoc);
        },
        undo: () => {
          context.setDocument(initialDoc!);
        },
        redo: () => {
          context.setDocument(updatedDoc);
        },
      };

      historyManager.execute(mockCommand);
      historyManager.undo();
      
      // Verify document restored to initial state
      let currentContext = (toolManager as any).getContext();
      let currentDoc = currentContext.getDocument();
      expect(currentDoc?.layers.length).toBe(1);

      // Redo
      historyManager.redo();
      currentContext = (toolManager as any).getContext();
      currentDoc = currentContext.getDocument();
      expect(currentDoc?.layers.length).toBe(2);
    });
  });

  describe('Active layer preservation', () => {
    it('should preserve valid active layer after layer removal', () => {
      const context = (toolManager as any).getContext();
      
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

      let doc = context.getDocument();
      doc = doc.addLayer(layer2);
      doc = doc.setActiveLayer('layer2');
      context.setDocument(doc);

      // Remove active layer
      doc = doc.removeLayer('layer2');
      context.setDocument(doc);

      // Active layer should be valid
      const currentContext = (toolManager as any).getContext();
      const currentDoc = currentContext.getDocument();
      expect(currentDoc?.activeLayerId).toBe('layer1');
      expect(currentDoc?.getActiveLayer()).toBeDefined();
    });

    it('should set active layer to null when all layers removed', () => {
      const context = (toolManager as any).getContext();
      let doc = context.getDocument();
      doc = doc.removeLayer('layer1');
      context.setDocument(doc);

      const currentContext = (toolManager as any).getContext();
      const currentDoc = currentContext.getDocument();
      expect(currentDoc?.activeLayerId).toBeNull();
      expect(currentDoc?.getActiveLayer()).toBeUndefined();
    });
  });

  describe('History and rendering coordination', () => {
    it('should coordinate command execution with rendering', () => {
      const context = (toolManager as any).getContext();
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
        context.executeCommand(mockCommand);
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
