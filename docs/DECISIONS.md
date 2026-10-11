# Architectural Decisions

This document records significant architectural decisions made during the development of PhotoEditor Pro.

---

## Decision 1: Use React for UI Layer

**Date**: Project inception
**Status**: Accepted

### Context
Need to choose a UI framework for the image editor.

### Options Considered
1. **React** - Component-based, large ecosystem
2. **Vue** - Simpler API, smaller bundle
3. **Svelte** - Compiler-based, minimal runtime
4. **Vanilla JS** - No framework overhead

### Decision
Use **React 18** with TypeScript.

### Rationale
1. **Component Model**: Well-suited for complex UI with many panels
2. **Ecosystem**: Rich library support (drag-drop, state management)
3. **Team Familiarity**: Most developers know React
4. **TypeScript Support**: Excellent type inference
5. **Performance**: Concurrent features in React 18

### Consequences
- ✅ Large ecosystem of UI components
- ✅ Good TypeScript support
- ✅ Virtual DOM helps with complex UI updates
- ⚠️ Larger bundle size than alternatives
- ⚠️ Need to prevent unnecessary re-renders

---

## Decision 2: Use Canvas 2D for Initial Rendering

**Date**: Project inception
**Status**: Accepted

### Context
Need to choose rendering technology for image display and manipulation.

### Options Considered
1. **Canvas 2D** - Native browser API, well-supported
2. **WebGL** - GPU-accelerated, complex
3. **WebGPU** - Next-gen GPU API, limited support
4. **SVG** - Vector-based, not suitable for raster

### Decision
Use **Canvas 2D** initially, with architecture to support WebGL/WebGPU later.

### Rationale
1. **Simplicity**: Easier to implement and debug
2. **Compatibility**: Works in all browsers
3. **Sufficient Performance**: Adequate for typical photo sizes
4. **Learning Curve**: Lower barrier to entry
5. **Future-Proof**: Can migrate to WebGL later

### Consequences
- ✅ Simple to implement
- ✅ Wide browser support
- ✅ Easy to debug
- ⚠️ Limited to CPU rendering
- ⚠️ May struggle with very large images (>50MP)
- ⚠️ Will need migration path to WebGL

### Migration Path
```typescript
interface Renderer {
  render(document: Document, viewport: Viewport): void;
}

class Canvas2DRenderer implements Renderer { }
class WebGLRenderer implements Renderer { } // Future
```

---

## Decision 3: Use Zustand for State Management

**Date**: Phase 1 planning
**Status**: Accepted

### Context
Need state management solution to replace scattered useState calls.

### Options Considered
1. **Redux** - Mature, verbose, lots of boilerplate
2. **MobX** - Reactive, magic-like behavior
3. **Zustand** - Simple, minimal boilerplate
4. **Jotai** - Atomic state, good for fine-grained updates
5. **Context API** - Built-in, but performance issues

### Decision
Use **Zustand** for state management.

### Rationale
1. **Simplicity**: Minimal boilerplate, easy to learn
2. **Performance**: No provider wrapper, direct access
3. **TypeScript**: Excellent type inference
4. **Size**: Small bundle size (~1KB)
5. **Flexibility**: Can use middleware for persistence, devtools

### Consequences
- ✅ Simple API, easy to adopt
- ✅ Good performance
- ✅ Small bundle size
- ✅ TypeScript support
- ⚠️ Less mature than Redux
- ⚠️ Smaller community

### Implementation
```typescript
interface EditorState {
  document: EditorDocument | null;
  activeLayerId: string | null;
  activeTool: ToolId;
  
  // Actions
  setDocument: (doc: EditorDocument) => void;
  setActiveLayer: (id: string) => void;
  setActiveTool: (tool: ToolId) => void;
}

const useEditorStore = create<EditorState>((set) => ({
  document: null,
  activeLayerId: null,
  activeTool: 'move',
  
  setDocument: (doc) => set({ document: doc }),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
}));
```

---

## Decision 4: Implement Command Pattern for Undo/Redo

**Date**: Phase 1 planning
**Status**: Accepted

### Context
Need robust undo/redo system that is memory-efficient and extensible.

### Options Considered
1. **State Snapshots** - Store full state, simple but memory-heavy
2. **Command Pattern** - Store operations, memory-efficient
3. **CRDT** - Collaborative, overkill for single-user
4. **Event Sourcing** - Store events, complex

### Decision
Use **Command Pattern** with delta compression.

### Rationale
1. **Memory Efficiency**: Store operations, not full snapshots
2. **Extensibility**: Easy to add new commands
3. **Grouping**: Can group operations into transactions
4. **Serialization**: Commands can be saved/loaded
5. **Testability**: Commands are isolated and testable

### Consequences
- ✅ Memory efficient
- ✅ Extensible
- ✅ Testable
- ✅ Can group operations
- ⚠️ More complex to implement
- ⚠️ Need to handle command dependencies

### Implementation
```typescript
interface Command {
  execute(): void;
  undo(): void;
  redo(): void;
}

class AddLayerCommand implements Command {
  constructor(
    private layerManager: LayerManager,
    private layer: Layer
  ) {}
  
  execute() {
    this.layerManager.addLayer(this.layer);
  }
  
  undo() {
    this.layerManager.removeLayer(this.layer.id);
  }
  
  redo() {
    this.execute();
  }
}
```

### Memory Optimization
For raster operations, use delta compression:
```typescript
class PaintStrokeCommand implements Command {
  private before: ImageRegion;
  private after: ImageRegion;
  
  execute() {
    this.before = captureRegion(this.layer, this.region);
    applyStroke(this.layer, this.stroke);
    this.after = captureRegion(this.layer, this.region);
  }
  
  undo() {
    restoreRegion(this.layer, this.before);
  }
}
```

---

## Decision 5: Modular Tool Architecture

**Date**: Phase 1 planning
**Status**: Accepted

### Context
Need extensible tool system that allows adding tools without modifying core code.

### Options Considered
1. **Switch-case in component** - Current approach, not extensible
2. **Strategy Pattern** - Good, but needs registry
3. **Plugin System** - Overkill for initial implementation
4. **Tool Registry** - Balanced approach

### Decision
Use **Tool Registry** with dependency injection.

### Rationale
1. **Extensibility**: Add tools without modifying core
2. **Isolation**: Each tool is independent module
3. **Testability**: Tools can be tested in isolation
4. **Configuration**: Tools can declare their options
5. **Lifecycle**: Clear activation/deactivation

### Consequences
- ✅ Easy to add new tools
- ✅ Tools are isolated
- ✅ Testable
- ✅ Configurable
- ⚠️ More complex than switch-case
- ⚠️ Need tool context abstraction

### Implementation
```typescript
interface EditorTool {
  readonly id: string;
  readonly name: string;
  
  activate(context: ToolContext): void;
  deactivate(context: ToolContext): void;
  
  onPointerDown(event: PointerEvent, context: ToolContext): void;
  onPointerMove(event: PointerEvent, context: ToolContext): void;
  onPointerUp(event: PointerEvent, context: ToolContext): void;
}

class ToolRegistry {
  private tools = new Map<string, EditorTool>();
  
  register(tool: EditorTool) {
    this.tools.set(tool.id, tool);
  }
  
  get(id: string): EditorTool | undefined {
    return this.tools.get(id);
  }
}

class ToolManager {
  private activeTool: EditorTool | null = null;
  
  setActiveTool(id: string, context: ToolContext) {
    if (this.activeTool) {
      this.activeTool.deactivate(context);
    }
    
    this.activeTool = registry.get(id) || null;
    
    if (this.activeTool) {
      this.activeTool.activate(context);
    }
  }
}
```

---

## Decision 6: Separate Document Model from UI

**Date**: Phase 1 planning
**Status**: Accepted

### Context
Need clear separation between document data and UI state.

### Options Considered
1. **Mixed state** - Current approach, hard to maintain
2. **Separate models** - Clear boundaries
3. **Event bus** - Loose coupling, hard to debug

### Decision
Use **separate document model** with explicit interfaces.

### Rationale
1. **Separation of Concerns**: Document logic separate from UI
2. **Testability**: Document can be tested without UI
3. **Serialization**: Document can be saved/loaded
4. **Multiple Views**: Can have multiple UIs for same document
5. **Undo/Redo**: Easier to implement on pure data

### Consequences
- ✅ Clear boundaries
- ✅ Testable
- ✅ Serializable
- ✅ Flexible
- ⚠️ More code to write
- ⚠️ Need synchronization logic

### Implementation
```typescript
// Document model (pure data)
class EditorDocument {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly layers: Layer[];
  
  addLayer(layer: Layer): EditorDocument {
    return new EditorDocument({
      ...this,
      layers: [...this.layers, layer]
    });
  }
}

// UI state (Zustand store)
interface UIState {
  zoom: number;
  panOffset: { x: number; y: number };
  activeTool: string;
  
  setZoom: (zoom: number) => void;
}

// Connection
function Editor() {
  const document = useEditorStore(s => s.document);
  const zoom = useUIStore(s => s.zoom);
  
  return <Canvas document={document} zoom={zoom} />;
}
```

---

## Decision 7: Use Vitest for Testing

**Date**: Phase 1 planning
**Status**: Accepted

### Context
Need testing framework for unit and integration tests.

### Options Considered
1. **Jest** - Mature, but slower
2. **Vitest** - Fast, Vite-native
3. **Mocha** - Flexible, but needs setup
4. **Ava** - Fast, but less popular

### Decision
Use **Vitest** for testing.

### Rationale
1. **Speed**: Much faster than Jest
2. **Vite Integration**: Native support, no config needed
3. **TypeScript**: Excellent support out of box
4. **Compatibility**: Jest-compatible API
5. **Modern**: Uses native ES modules

### Consequences
- ✅ Very fast test execution
- ✅ Zero config with Vite
- ✅ Great TypeScript support
- ✅ Watch mode works well
- ⚠️ Less mature than Jest
- ⚠️ Smaller ecosystem

### Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
});
```

---

## Decision 8: Immutable Document Model

**Date**: Phase 1 planning
**Status**: Accepted

### Context
Need to decide if document model should be mutable or immutable.

### Options Considered
1. **Mutable** - Simpler, but hard to track changes
2. **Immutable** - Easier undo/redo, but more memory
3. **Structural Sharing** - Best of both worlds

### Decision
Use **immutable document model** with structural sharing.

### Rationale
1. **Undo/Redo**: Easy to implement with immutable state
2. **Change Detection**: Simple comparison
3. **Predictability**: No unexpected mutations
4. **Time Travel**: Can jump to any state
5. **Functional**: Easier to reason about

### Consequences
- ✅ Easy undo/redo
- ✅ Predictable
- ✅ Easy to test
- ✅ Time travel debugging
- ⚠️ More memory usage (mitigated by structural sharing)
- ⚠️ Need to learn immutable patterns

### Implementation
```typescript
class EditorDocument {
  constructor(
    public readonly id: string,
    public readonly layers: readonly Layer[]
  ) {}
  
  // Returns new instance, doesn't mutate
  addLayer(layer: Layer): EditorDocument {
    return new EditorDocument(
      this.id,
      [...this.layers, layer]
    );
  }
  
  // Structural sharing - layers array is new, but layer objects are same
  updateLayer(layerId: string, updates: Partial<Layer>): EditorDocument {
    return new EditorDocument(
      this.id,
      this.layers.map(layer => 
        layer.id === layerId 
          ? { ...layer, ...updates }
          : layer
      )
    );
  }
}
```

---

## Decision 9: Use Web Workers for Heavy Processing

**Date**: Phase 1 planning
**Status**: Accepted (for future implementation)

### Context
Need to handle heavy image processing without blocking UI.

### Options Considered
1. **Main thread** - Simple, but blocks UI
2. **Web Workers** - Non-blocking, but complex
3. **WASM** - Fast, but complex
4. **requestIdleCallback** - Non-blocking, but limited

### Decision
Use **Web Workers** for heavy image processing.

### Rationale
1. **Non-blocking**: UI remains responsive
2. **Parallel**: Can use multiple cores
3. **Standard**: Well-supported browser API
4. **Comlink**: Easy communication library

### Consequences
- ✅ Non-blocking UI
- ✅ Better performance
- ✅ Can process large images
- ⚠️ More complex code
- ⚠️ Need to handle serialization
- ⚠️ Debugging is harder

### Implementation Plan
```typescript
// imageProcessing.worker.ts
import { expose } from 'comlink';

const api = {
  applyBlur(imageData: ImageData, radius: number): ImageData {
    // Heavy processing here
    return blurredImageData;
  }
};

expose(api);

// Main thread
import { wrap } from 'comlink';
import worker from './imageProcessing.worker?worker';

const workerApi = wrap<ImageProcessingAPI>(new worker());

async function applyBlur(imageData: ImageData, radius: number) {
  const result = await workerApi.applyBlur(imageData, radius);
  // Update canvas with result
}
```

### Phased Approach
- Phase 1-3: Main thread processing (simpler)
- Phase 4+: Move to Web Workers (performance)

---

## Decision 10: Project File Format

**Date**: Phase 1 planning
**Status**: Accepted

### Context
Need format for saving/loading projects.

### Options Considered
1. **PSD** - Industry standard, but complex
2. **Custom JSON** - Simple, but limited
3. **Custom Binary** - Efficient, but complex
4. **XCF (GIMP)** - Open format, but complex

### Decision
Use **custom JSON format** with versioning.

### Rationale
1. **Simplicity**: Easy to implement and debug
2. **Extensibility**: Easy to add features
3. **Human-readable**: Can inspect files
4. **Versioning**: Can migrate old files
5. **No Dependencies**: No external libraries needed

### Consequences
- ✅ Simple to implement
- ✅ Easy to debug
- ✅ Extensible
- ✅ Versioned
- ⚠️ Larger file sizes than binary
- ⚠️ Not compatible with Photoshop
- ⚠️ Need migration strategy

### Format Specification
```json
{
  "version": "1.0",
  "document": {
    "id": "uuid",
    "name": "Untitled",
    "width": 1920,
    "height": 1080,
    "layers": [
      {
        "id": "uuid",
        "name": "Layer 1",
        "type": "raster",
        "visible": true,
        "opacity": 100,
        "blendMode": "normal",
        "imageData": "data:image/png;base64,..."
      }
    ]
  },
  "metadata": {
    "created": "2024-01-01T00:00:00Z",
    "modified": "2024-01-01T00:00:00Z"
  }
}
```

### Migration Strategy
```typescript
function migrateProject(data: any, fromVersion: string): any {
  if (fromVersion === '1.0') {
    // Migrate to 1.1
    data.document.layers = data.document.layers.map(layer => ({
      ...layer,
      locked: false // Added in 1.1
    }));
    return migrateProject(data, '1.1');
  }
  return data;
}
```

---

## Decision 11: Coordinate System

**Date**: Phase 1 planning
**Status**: Accepted

### Context
Need clear coordinate system for document and screen space.

### Options Considered
1. **Single coordinate system** - Simple, but confusing
2. **Separate systems** - Clear, but needs transformation
3. **CSS pixels** - Familiar, but not precise

### Decision
Use **separate coordinate systems** with explicit transformation.

### Rationale
1. **Clarity**: Clear distinction between document and screen
2. **Precision**: Document coordinates are exact
3. **Flexibility**: Can zoom/pan without affecting document
4. **Correctness**: Avoids rounding errors

### Consequences
- ✅ Clear separation
- ✅ Precise coordinates
- ✅ Flexible viewport
- ⚠️ Need transformation logic
- ⚠️ More code to write

### Implementation
```typescript
class Viewport {
  zoom: number;
  panOffset: { x: number; y: number };
  
  // Document to screen
  documentToScreen(point: Point): Point {
    return {
      x: point.x * this.zoom + this.panOffset.x,
      y: point.y * this.zoom + this.panOffset.y
    };
  }
  
  // Screen to document
  screenToDocument(point: Point): Point {
    return {
      x: (point.x - this.panOffset.x) / this.zoom,
      y: (point.y - this.panOffset.y) / this.zoom
    };
  }
}

// Usage
const documentPoint = viewport.screenToDocument(mouseEvent);
const layer = document.getLayerAtPoint(documentPoint);
```

---

## Decision 12: Selection Representation

**Date**: Phase 1 planning
**Status**: Accepted

### Context
Need to represent selections in a way that supports various operations.

### Options Considered
1. **Bounding box only** - Simple, but limited
2. **Mask (bitmap)** - Flexible, but memory-heavy
3. **Path (vector)** - Efficient, but complex
4. **Hybrid** - Best of both worlds

### Decision
Use **mask-based selection** with bounding box cache.

### Rationale
1. **Flexibility**: Supports any shape
2. **Operations**: Easy to combine selections
3. **Feathering**: Natural support
4. **Performance**: Bounding box for quick checks

### Consequences
- ✅ Supports any shape
- ✅ Easy to combine
- ✅ Natural feathering
- ⚠️ Memory usage for large selections
- ⚠️ Need to optimize for performance

### Implementation
```typescript
class Selection {
  private mask: Uint8Array; // 0 or 255
  private boundingBox: Rect;
  
  constructor(width: number, height: number) {
    this.mask = new Uint8Array(width * height);
    this.boundingBox = { x: 0, y: 0, width: 0, height: 0 };
  }
  
  // Combine selections
  union(other: Selection): Selection {
    const result = new Selection(this.width, this.height);
    for (let i = 0; i < this.mask.length; i++) {
      result.mask[i] = this.mask[i] | other.mask[i];
    }
    result.updateBoundingBox();
    return result;
  }
  
  // Feather edges
  feather(radius: number): Selection {
    // Apply Gaussian blur to mask
    const blurred = gaussianBlur(this.mask, radius);
    const result = new Selection(this.width, this.height);
    result.mask = blurred;
    return result;
  }
}
```

---

## Summary

These decisions establish a solid foundation for the PhotoEditor Pro application:

1. **React + TypeScript** - Modern, type-safe UI
2. **Canvas 2D** - Simple, compatible rendering
3. **Zustand** - Simple, efficient state management
4. **Command Pattern** - Memory-efficient undo/redo
5. **Tool Registry** - Extensible tool system
6. **Separate Models** - Clear separation of concerns
7. **Vitest** - Fast, modern testing
8. **Immutable Documents** - Predictable, testable
9. **Web Workers** - Non-blocking processing (future)
10. **JSON Format** - Simple, extensible persistence
11. **Coordinate Systems** - Clear, precise transformations
12. **Mask Selections** - Flexible, powerful selections

All decisions prioritize:
- **Maintainability** over cleverness
- **Simplicity** over features
- **Testability** over speed of development
- **Extensibility** over initial completeness
