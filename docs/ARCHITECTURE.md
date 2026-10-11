# Architecture Documentation

## Current State (Phase 0 Audit)

### Project Overview
- **Name**: PhotoEditor Pro
- **Type**: Browser-based raster image editor
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS 4
- **Build Status**: ✅ Passing

### Critical Architectural Issues

#### 1. Monolithic Structure
**Problem**: Entire application logic resides in a single file `src/App.tsx` (3,795 lines)

**Impact**:
- Impossible to maintain or extend
- No separation of concerns
- All business logic mixed with UI rendering
- No testability
- Violates single responsibility principle

**Evidence**:
```
src/App.tsx: 3,795 lines
  - Document model: inline
  - Layer system: inline
  - Rendering: inline
  - Tool system: inline
  - Selection system: inline
  - Image processing: inline
  - Command/history: inline
  - UI components: inline
```

#### 2. No State Management
**Problem**: Uses React `useState` for all application state

**Impact**:
- State scattered across component
- No centralized state management
- Difficult to implement undo/redo properly
- No persistence layer
- State not serializable

**Evidence**:
```typescript
const [layers, setLayers] = useState<Layer[]>([]);
const [activeLayerId, setActiveLayerId] = useState('');
const [history, setHistory] = useState<HistoryState[]>([]);
// ... 50+ useState calls
```

#### 3. No Command Pattern
**Problem**: No command system for operations

**Impact**:
- Undo/redo implemented ad-hoc
- No transaction support
- History stores full image snapshots (memory inefficient)
- No grouping of operations

**Evidence**:
```typescript
const pushHistory = (currentLayers: Layer[], currentActiveId: string) => {
  const state = saveHistoryState(currentLayers, currentActiveId);
  // Stores full ImageData for each layer
}
```

#### 4. No Tool Abstraction
**Problem**: All tools implemented as switch-case in event handlers

**Impact**:
- Cannot add tools without modifying core code
- No tool isolation
- No tool configuration
- Violates open/closed principle

**Evidence**:
```typescript
switch (tool) {
  case 'brush':
    // ... 20 lines
  case 'eraser':
    // ... 10 lines
  // ... 25+ cases
}
```

#### 5. No Selection System
**Problem**: Selection implemented as global variables

**Impact**:
- No selection abstraction
- Cannot combine selections
- No feather support
- Selection not independent from tools

**Evidence**:
```typescript
const [selection, setSelection] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
(window as any).__selectionMask = maskCanvas;
```

#### 6. No Rendering Engine
**Problem**: Rendering mixed with component logic

**Impact**:
- No viewport abstraction
- No render optimization
- No coordinate transformation system
- Cannot swap rendering backend

**Evidence**:
```typescript
const renderComposite = useCallback(() => {
  // Direct canvas manipulation in component
  const mainCanvas = mainCanvasRef.current;
  const ctx = mainCanvas.getContext('2d')!;
  // ... 100+ lines of rendering code
}, [layers, canvasWidth, canvasHeight, selection, transform]);
```

#### 7. No Image Processing Module
**Problem**: Image processing algorithms scattered in component

**Impact**:
- No reusable filters
- No worker support
- Cannot test algorithms independently
- No preview/final distinction

**Evidence**:
```typescript
const applyQuickFilter = (type: string) => {
  // Inline image processing
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  // ... pixel manipulation
}
```

#### 8. No Tests
**Problem**: Zero automated tests

**Impact**:
- No regression protection
- Cannot verify correctness
- Refactoring is risky
- No documentation through tests

**Evidence**:
```
No test files found
No test framework configured
```

### What Works (Preserve These)

#### ✅ Functional Features
1. **Layer System** (partial)
   - Create/delete/duplicate layers
   - Layer visibility toggle
   - Layer opacity
   - Blend modes (16 modes)
   - Layer masks (basic)
   - Layer locking

2. **Tools** (27 tools)
   - Move, Select (rect/ellipse), Lasso, Polygonal Lasso
   - Magic Wand, Quick Selection
   - Crop, Eyedropper
   - Brush, Eraser, Clone Stamp, Healing Brush
   - Blur, Sharpen, Smudge, Dodge, Burn
   - Fill, Gradient, Text
   - Line, Rectangle, Ellipse
   - Hand, Zoom

3. **Selection System** (partial)
   - Rectangular selection
   - Elliptical selection
   - Lasso selection
   - Magic Wand selection
   - Selection contour display
   - Marching ants animation

4. **Image Processing**
   - Brightness/Contrast
   - Hue/Saturation
   - Exposure
   - Color Balance
   - Levels
   - Invert, Grayscale, Sepia
   - Blur, Sharpen
   - Noise, Pixelate, Emboss, Vignette
   - Motion Blur, Radial Blur
   - High Pass, Unsharp Mask

5. **File Operations**
   - Import PNG/JPEG/WebP
   - Export PNG/JPEG/WebP
   - Drag & Drop import
   - Project save/load (JSON)

6. **UI Features**
   - Dark theme
   - Rulers with dynamic scaling
   - Navigator panel
   - History panel
   - Color swatches
   - Keyboard shortcuts
   - Context menu
   - Tool options bar

7. **Advanced Features**
   - Undo/Redo (60 steps)
   - Copy/Paste with selection mask
   - Free Transform
   - Crop with preview
   - Before/After preview
   - Layer groups
   - Clipping masks

### Architecture Violations

1. **Business logic in UI components**
   - Image processing in App.tsx
   - Selection logic in event handlers
   - History management in component

2. **Global mutable state**
   ```typescript
   (window as any).__selectionMask = maskCanvas;
   (window as any).__clipboard = { canvas, x, y };
   ```

3. **Tight coupling**
   - Tools directly manipulate canvas
   - Selection directly modifies layers
   - No interfaces between modules

4. **No dependency injection**
   - Hard-coded canvas contexts
   - Direct DOM manipulation
   - No abstraction boundaries

### Technology Stack Assessment

#### Current Stack
- ✅ React 18 - Good choice for UI
- ✅ TypeScript - Good for type safety
- ✅ Vite - Fast build tool
- ✅ Tailwind CSS - Efficient styling
- ❌ No state management (need Zustand)
- ❌ No test framework (need Vitest)
- ❌ No Web Workers (needed for performance)
- ❌ No IndexedDB (needed for persistence)

#### Missing Dependencies
```json
{
  "zustand": "^4.x",           // State management
  "vitest": "^1.x",            // Unit testing
  "@testing-library/react": "^14.x", // Component testing
  "playwright": "^1.x",        // E2E testing
  "comlink": "^4.x"            // Web Worker communication
}
```

### Risk Assessment

#### High Risk
1. **Monolithic architecture** - Cannot add features without breaking existing ones
2. **No tests** - Any change can introduce regressions
3. **Memory leaks** - Full image snapshots in history
4. **Performance** - No optimization for large images

#### Medium Risk
1. **No persistence** - Projects lost on refresh
2. **No error handling** - Silent failures
3. **No validation** - Corrupt files can crash app

#### Low Risk
1. **UI/UX** - Generally good
2. **Feature coverage** - Most Photoshop features present
3. **Build system** - Working correctly

### Conclusion

The current prototype demonstrates good feature coverage and UI/UX, but has critical architectural problems that prevent long-term maintenance and extension.

**Recommendation**: Proceed with Phase 1 refactoring to establish proper architecture while preserving existing functionality.

**Priority**:
1. Extract core modules (Document, Layer, Renderer)
2. Implement Command pattern
3. Add state management (Zustand)
4. Create Tool abstraction
5. Add test infrastructure
6. Gradually migrate logic to modules

**Estimated Effort**: 2-3 weeks for Phase 1 completion
