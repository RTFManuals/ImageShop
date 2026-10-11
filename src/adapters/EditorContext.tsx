import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
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
  renderTrigger: number;
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
  const [document, setDocumentState] = React.useState<Document | null>(null);
  const [activeToolId, setActiveToolId] = React.useState<string>('move');
  const [selection, setSelectionState] = React.useState<Selection | null>(null);
  const [zoom, setZoom] = React.useState<number>(1);
  const [renderTrigger, setRenderTrigger] = React.useState(0);

  const historyManagerRef = useRef(new HistoryManager(60));
  const toolRegistryRef = useRef(new ToolRegistry());
  const viewportRef = useRef(new ViewportImpl(800, 600));
  
  // Synchronous refs - updated immediately, not via useEffect
  const documentRef = useRef(document);
  const selectionRef = useRef(selection);
  
  // Update refs synchronously during render (before useEffect)
  documentRef.current = document;
  selectionRef.current = selection;

  // Wrapper functions that update both state and refs synchronously
  const setDocument = useCallback((doc: Document | null) => {
    documentRef.current = doc;
    setDocumentState(doc);
  }, []);

  const setSelection = useCallback((sel: Selection | null) => {
    selectionRef.current = sel;
    setSelectionState(sel);
  }, []);

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

  // Create tool context provider - returns fresh context on every call
  const getToolContext = useCallback((): ToolContext => {
    return {
      getDocument: () => documentRef.current,
      setDocument: (doc) => setDocument(doc),
      getActiveLayer: () => {
        const doc = documentRef.current;
        if (!doc) return null;
        return doc.getActiveLayer() ?? null;
      },
      getSelection: () => selectionRef.current,
      setSelection: (sel) => setSelection(sel),
      getViewport: () => viewportRef.current,
      executeCommand: (command) => {
        historyManagerRef.current.execute(command);
        // Trigger re-render after command execution
        setRenderTrigger(prev => prev + 1);
      },
      requestRender: () => {
        // Trigger re-render for visual updates
        setRenderTrigger(prev => prev + 1);
      },
    };
  }, [setDocument, setSelection]);

  // Create ToolManager once with the context provider
  const toolManagerRef = useRef<ToolManager | null>(null);
  if (!toolManagerRef.current) {
    toolManagerRef.current = new ToolManager(toolRegistryRef.current, getToolContext);
  }
  
  // Update context provider on every render to ensure fresh state access
  toolManagerRef.current.updateContextProvider(getToolContext);

  // Sync active tool
  useEffect(() => {
    toolManagerRef.current?.setActiveTool(activeToolId);
  }, [activeToolId]);

  const undo = useCallback(() => {
    const command = historyManagerRef.current.undo();
    if (command) {
      setRenderTrigger(prev => prev + 1);
    }
  }, []);

  const redo = useCallback(() => {
    const command = historyManagerRef.current.redo();
    if (command) {
      setRenderTrigger(prev => prev + 1);
    }
  }, []);

  const value: EditorContextValue = {
    document,
    setDocument,
    historyManager: historyManagerRef.current,
    toolRegistry: toolRegistryRef.current,
    toolManager: toolManagerRef.current!,
    activeToolId,
    setActiveTool: setActiveToolId,
    selection,
    setSelection,
    viewport: viewportRef.current,
    zoom,
    setZoom,
    undo,
    redo,
    renderTrigger,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}
