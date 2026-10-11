import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Document } from '../core/document';
import { HistoryManager } from '../core/commands';
import { ToolRegistry, ToolManager, ToolContext } from '../core/tools';
import { Selection } from '../core/selection';
import { ViewportImpl } from '../core/rendering';
import { MoveTool } from '../tools/move';
import { BrushTool } from '../tools/brush';
import { EraserTool } from '../tools/eraser';
import { EyedropperTool } from '../tools/eyedropper';
import { RectangularMarqueeTool } from '../tools/selection/RectangularMarqueeTool';
import { EllipticalMarqueeTool } from '../tools/selection/EllipticalMarqueeTool';
import { LassoTool } from '../tools/selection/LassoTool';
import { MagicWandTool } from '../tools/selection/MagicWandTool';
import { MaskPaintTool } from '../tools/mask';
import { SpotHealingBrushTool, CloneStampTool } from '../tools/retouch';

interface EditorContextValue {
  document: Document | null;
  setDocument: (doc: Document | null) => void;
  historyManager: HistoryManager;
  toolRegistry: ToolRegistry;
  toolManager: ToolManager;
  activeToolId: string;
  setActiveTool: (toolId: string) => void;
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  viewport: ViewportImpl;
  zoom: number;
  setZoom: (zoom: number) => void;
  undo: () => void;
  redo: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorContext must be used within EditorProvider');
  }
  return context;
}

interface EditorProviderProps {
  children: React.ReactNode;
}

export function EditorProvider({ children }: EditorProviderProps) {
  const [document, setDocument] = React.useState<Document | null>(null);
  const [activeToolId, setActiveToolId] = React.useState<string>('move');
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [zoom, setZoom] = React.useState<number>(1);

  const historyManagerRef = useRef(new HistoryManager(60));
  const toolRegistryRef = useRef(new ToolRegistry());
  const viewportRef = useRef(new ViewportImpl(800, 600));

  // Initialize tools
  useEffect(() => {
    const registry = toolRegistryRef.current;
    
    // Register all tools
    registry.register(new MoveTool());
    registry.register(new BrushTool());
    registry.register(new EraserTool());
    registry.register(new EyedropperTool());
    registry.register(new RectangularMarqueeTool());
    registry.register(new EllipticalMarqueeTool());
    registry.register(new LassoTool());
    registry.register(new MagicWandTool());
    registry.register(new MaskPaintTool());
    registry.register(new SpotHealingBrushTool());
    registry.register(new CloneStampTool());

    console.log('✅ Tools registered:', registry.getAll().map(t => t.id));
  }, []);

  // Create tool context
  const toolContext: ToolContext = {
    getDocument: () => document,
    setDocument: (doc) => setDocument(doc),
    getActiveLayer: () => {
      if (!document) return null;
      return document.getActiveLayer();
    },
    getSelection: () => selection,
    setSelection: (sel) => setSelection(sel),
    getViewport: () => viewportRef.current,
    executeCommand: (command) => {
      historyManagerRef.current.execute(command);
    },
    requestRender: () => {
      // Will be implemented by consumer
    },
  };

  const toolManagerRef = useRef(new ToolManager(toolRegistryRef.current, toolContext));

  // Sync active tool
  useEffect(() => {
    toolManagerRef.current.setActiveTool(activeToolId);
  }, [activeToolId]);

  const undo = () => {
    historyManagerRef.current.undo();
  };

  const redo = () => {
    historyManagerRef.current.redo();
  };

  const value: EditorContextValue = {
    document,
    setDocument,
    historyManager: historyManagerRef.current,
    toolRegistry: toolRegistryRef.current,
    toolManager: toolManagerRef.current,
    activeToolId,
    setActiveTool: setActiveToolId,
    selection,
    setSelection,
    viewport: viewportRef.current,
    zoom,
    setZoom,
    undo,
    redo,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}
