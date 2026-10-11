import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { Document } from '../core/document';
import { DocumentCommand } from '../core/commands';
import { ToolRegistry, ToolManager, ToolContext, ToolContextProvider } from '../core/tools';
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
import { useEditorStore } from '../state/editorStore';

interface EditorContextValue {
  document: Document | null;
  setDocument: (doc: Document | null) => void;
  toolRegistry: ToolRegistry;
  toolManager: ToolManager;
  activeToolId: string;
  setActiveTool: (toolId: string) => void;
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  viewport: ViewportImpl;
  zoom: number;
  setZoom: (zoom: number) => void;
  executeCommand: (command: DocumentCommand) => void;
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
  // Use Zustand store as the single source of truth
  const store = useEditorStore();
  
  const toolRegistryRef = useRef(new ToolRegistry());
  const viewportRef = useRef(new ViewportImpl(800, 600));
  
  // Synchronous refs for tool context
  const documentRef = useRef(store.document);
  const selectionRef = useRef(store.selection);
  
  // Update refs synchronously during render
  documentRef.current = store.document;
  selectionRef.current = store.selection;

  // Render trigger for forcing updates
  const [renderTrigger, setRenderTrigger] = React.useState(0);

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
      setDocument: (doc) => store.setDocument(doc),
      getActiveLayer: () => {
        const doc = documentRef.current;
        if (!doc) return null;
        return doc.getActiveLayer() ?? null;
      },
      getSelection: () => selectionRef.current,
      setSelection: (sel) => store.setSelection(sel),
      getViewport: () => viewportRef.current,
      executeCommand: (command: DocumentCommand) => {
        store.executeCommand(command);
        setRenderTrigger(prev => prev + 1);
      },
      requestRender: () => {
        setRenderTrigger(prev => prev + 1);
      },
    };
  }, [store]);

  // Create ToolManager once with the context provider
  const toolManagerRef = useRef<ToolManager | null>(null);
  if (!toolManagerRef.current) {
    toolManagerRef.current = new ToolManager(toolRegistryRef.current, getToolContext);
  }
  
  // Update context provider on every render to ensure fresh state access
  toolManagerRef.current.updateContextProvider(getToolContext);

  // Sync active tool
  useEffect(() => {
    toolManagerRef.current?.setActiveTool(store.activeToolId);
  }, [store.activeToolId]);

  const value: EditorContextValue = {
    document: store.document,
    setDocument: store.setDocument,
    toolRegistry: toolRegistryRef.current,
    toolManager: toolManagerRef.current!,
    activeToolId: store.activeToolId,
    setActiveTool: store.setActiveTool,
    selection: store.selection,
    setSelection: store.setSelection,
    viewport: viewportRef.current,
    zoom: store.zoom,
    setZoom: store.setZoom,
    executeCommand: store.executeCommand,
    undo: store.undo,
    redo: store.redo,
    renderTrigger,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}
