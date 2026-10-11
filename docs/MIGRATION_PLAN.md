# TASK-ARCH-001 — Migration Plan

## Audit Summary

### Confirmed Problems

✅ **Problem 1**: App.tsx contains 3,795 lines with duplicate implementations
- Own layer system (Layer interface, createCanvas, cloneLayer)
- Own history system (saveHistoryState, restoreHistoryState, history state)
- Own tool implementations (all tools in switch-case)
- Own rendering logic (renderComposite function)
- Own selection system (selection state, mask handling)
- 50 useState calls for state management

✅ **Problem 2**: main.tsx mounts legacy App directly
- No integration with new architecture
- Direct import of App component

✅ **Problem 3**: New src/core/ architecture exists but not integrated
- Document model exists but not used by App
- Command system exists but not used by App
- Tool system exists but not used by App
- Selection system exists but not used by App
- Renderer exists but not used by App

✅ **Problem 4**: editorStore.ts not consumed by legacy editor
- Store exists with proper structure
- App.tsx uses its own useState instead
- Two independent state management systems

✅ **Problem 5**: Two independent document and history implementations
- Legacy: App.tsx with saveHistoryState/restoreHistoryState
- New: Document class + HistoryManager + Command pattern
- Both coexist without integration

✅ **Problem 6**: Command implementation lacks reliable state transition
- FilterCommand exists but not integrated
- PaintStrokeCommand exists but not integrated
- No bridge between commands and UI state

✅ **Problem 7**: Canvas2DRenderer creates temporary canvases
- renderRasterLayer creates new canvas per layer per frame
- No caching of raster surfaces
- Performance issue for large documents

✅ **Problem 8**: Tests don't demonstrate end-to-end integration
- Unit tests exist for individual modules
- No integration tests with real application
- No tests verifying architecture integration

---

## Functionality Inventory

### Editing Tools (in App.tsx)
1. Move Tool - moves layer position
2. Brush Tool - paints with configurable brush
3. Eraser Tool - erases pixels
4. Clone Stamp - clones from source point
5. Healing Brush - auto-heals defects
6. Spot Healing Brush - automatic healing
7. Blur Tool - local blur
8. Sharpen Tool - local sharpen
9. Smudge Tool - smudges pixels
10. Dodge Tool - lightens areas
11. Burn Tool - darkens areas
12. Eyedropper Tool - picks colors
13. Paint Bucket - flood fill
14. Gradient Tool - linear/radial gradients
15. Text Tool - adds text
16. Line Tool - draws lines
17. Rectangle Tool - draws rectangles
18. Ellipse Tool - draws ellipses
19. Crop Tool - crops canvas
20. Hand Tool - pans canvas
21. Zoom Tool - zooms canvas

### Selection Tools (in App.tsx)
1. Rectangular Marquee - rectangular selection
2. Elliptical Marquee - elliptical selection
3. Lasso Tool - free-form selection
4. Polygonal Lasso - polygon selection
5. Magic Wand - color-based selection
6. Quick Selection - brush-based selection
7. Mask Paint Tool - paints on masks

### Layer Operations (in App.tsx)
1. Add layer
2. Delete layer
3. Duplicate layer
4. Reorder layers (move up/down)
5. Change layer visibility
6. Change layer opacity
7. Change blend mode
8. Lock/unlock layer
9. Merge down
10. Flatten image
11. Add layer mask
12. Remove layer mask
13. Create clipping mask
14. Create layer group

### Selection Operations (in App.tsx)
1. Select all
2. Deselect all
3. Invert selection
4. Feather selection
5. Delete selection
6. Fill selection
7. Stroke selection
8. Copy selection
9. Paste selection

### History Operations (in App.tsx)
1. Undo
2. Redo
3. History panel navigation

### Color Adjustments (in App.tsx)
1. Brightness/Contrast
2. Exposure
3. Levels
4. Hue/Saturation
5. Color Balance
6. Temperature/Tint
7. Selective Color
8. Vibrance

### Filters (in App.tsx)
1. Gaussian Blur
2. Motion Blur
3. Radial Blur
4. Unsharp Mask
5. High Pass
6. Sharpen
7. Noise Reduction
8. Add Noise
9. Vignette
10. Invert
11. Grayscale
12. Sepia
13. Threshold
14. Posterize
15. Pixelate
16. Emboss

### Import/Export (in App.tsx)
1. Import PNG/JPEG/WebP
2. Export PNG/JPEG/WebP
3. Save project (JSON)
4. Load project (JSON)
5. Drag & Drop import

### UI Interactions (in App.tsx)
1. Menu bar (File, Edit, Image, Layer, Filter, View, Help)
2. Options bar (tool-specific settings)
3. Toolbar (tool selection)
4. Canvas viewport (zoom, pan)
5. Layers panel
6. History panel
7. Color panel
8. Navigator panel
9. Context menu
10. Dialogs (New, Resize, Text, Filters, etc.)

### Keyboard Shortcuts (in App.tsx)
- Tool shortcuts (B, E, G, I, T, V, M, W, etc.)
- Modifier shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+C, etc.)
- Brush size shortcuts ([, ])
- Color shortcuts (X, D)

---

## Core Module Equivalents

### Document Model
- ✅ Document class exists
- ✅ Layer types defined
- ✅ Immutable operations
- ✅ Serialization support
- ❌ Not integrated with App.tsx

### Command System
- ✅ Command interface exists
- ✅ HistoryManager exists
- ✅ AddLayerCommand exists
- ✅ RemoveLayerCommand exists
- ✅ ChangeOpacityCommand exists
- ✅ PaintStrokeCommand exists
- ✅ FilterCommand exists
- ❌ Not integrated with App.tsx

### Tool System
- ✅ Tool interface exists
- ✅ ToolRegistry exists
- ✅ ToolManager exists
- ✅ MoveTool exists
- ✅ BrushTool exists
- ✅ EraserTool exists
- ✅ EyedropperTool exists
- ✅ RectangularMarqueeTool exists
- ✅ EllipticalMarqueeTool exists
- ✅ LassoTool exists
- ✅ MagicWandTool exists
- ✅ MaskPaintTool exists
- ✅ SpotHealingBrushTool exists
- ✅ CloneStampTool exists
- ❌ Not integrated with App.tsx

### Selection System
- ✅ Selection class exists
- ✅ Boolean operations (union, intersect, subtract)
- ✅ Feather support
- ❌ Not integrated with App.tsx

### Renderer
- ✅ Renderer interface exists
- ✅ Canvas2DRenderer exists
- ✅ Viewport exists
- ❌ Not integrated with App.tsx
- ❌ Creates temporary canvases (performance issue)

### State Management
- ✅ editorStore exists (Zustand)
- ❌ Not used by App.tsx

### Image Processing
- ✅ GaussianBlurFilter exists
- ✅ SharpenFilter exists
- ✅ NoiseReductionFilter exists
- ❌ Not integrated with commands

### Layer Effects
- ✅ LayerEffectsRenderer exists
- ✅ DropShadow, Stroke, OuterGlow
- ❌ Not integrated with UI

---

## Migration Strategy

### Phase 1: Foundation Bridge (Current Task)
**Goal**: Create bridge between legacy App and new architecture
**Scope**: Minimal safe changes to establish connection
**Risk**: Low

**Increment 1.1**: Create EditorContext adapter
- Create adapter that bridges App.tsx state to Document model
- Sync layer operations between legacy and new systems
- Verify document state consistency

**Increment 1.2**: Integrate HistoryManager
- Replace legacy history with HistoryManager
- Wrap existing operations in commands
- Verify undo/redo works correctly

**Increment 1.3**: Integrate ToolManager
- Register existing tools in ToolRegistry
- Route tool events through ToolManager
- Verify tools work correctly

**Increment 1.4**: Integrate Renderer
- Replace renderComposite with Canvas2DRenderer
- Fix temporary canvas allocation (caching)
- Verify rendering is correct

**Increment 1.5**: Integrate Selection
- Replace legacy selection with Selection class
- Verify selection operations work

### Phase 2: Command Migration
**Goal**: Wrap all operations in commands
**Scope**: Create commands for all editing operations
**Risk**: Medium

### Phase 3: UI Component Extraction
**Goal**: Split App.tsx into focused components
**Scope**: Extract UI components without changing functionality
**Risk**: Low

### Phase 4: Legacy Code Removal
**Goal**: Remove duplicate implementations
**Scope**: Remove legacy code after verification
**Risk**: Medium

---

## First Increment Plan: EditorContext Adapter

### Objective
Create a bridge that allows App.tsx to use the new Document model while maintaining backward compatibility.

### Implementation Steps

1. **Create EditorContext**
   - React context for editor state
   - Provides access to Document, HistoryManager, ToolManager
   - Syncs with legacy App state

2. **Create Document Adapter**
   - Converts between legacy Layer format and new Layer format
   - Syncs layer operations bidirectionally
   - Maintains document consistency

3. **Create Integration Tests**
   - Test document state synchronization
   - Test layer operations through adapter
   - Verify no data loss

### Files to Create
- `src/adapters/EditorContext.tsx`
- `src/adapters/DocumentAdapter.ts`
- `src/tests/architecture/EditorContext.test.tsx`

### Files to Modify
- `src/main.tsx` - wrap App with EditorProvider
- `src/App.tsx` - consume EditorContext (minimal changes)

### Regression Tests
1. Document state syncs correctly
2. Layer operations work through adapter
3. No functionality broken
4. Build passes
5. All existing tests pass

### Success Criteria
- App.tsx can access Document model through context
- Layer operations sync between legacy and new systems
- No functionality broken
- Integration tests pass

---

## Risk Assessment

### Low Risk
- Creating adapter layer (additive, no breaking changes)
- Adding integration tests (no production code changes)
- Documentation updates

### Medium Risk
- Replacing history system (could break undo/redo)
- Replacing tool system (could break tool behavior)
- Replacing renderer (could break visual output)

### High Risk
- Removing legacy code before verification
- Changing data structures
- Modifying core algorithms

### Mitigation
- Incremental migration with verification at each step
- Comprehensive testing before proceeding
- Keep legacy code as fallback until verified
- Rollback plan for each increment

---

## Execution Plan

### Current Task: Increment 1.1 — EditorContext Adapter

**Estimated Duration**: 2-3 hours

**Steps**:
1. Create EditorContext with Document, HistoryManager, ToolManager
2. Create DocumentAdapter for bidirectional sync
3. Wrap App with EditorProvider in main.tsx
4. Add minimal integration in App.tsx
5. Create integration tests
6. Verify all existing tests pass
7. Verify build passes
8. Document changes

**Deliverables**:
- EditorContext implementation
- DocumentAdapter implementation
- Integration tests
- Updated documentation
- Migration report

**Stop Condition**: Complete Increment 1.1 and report for review before proceeding to Increment 1.2.

---

## Verification Commands

```bash
# Type checking
npm run typecheck

# Unit tests
npx vitest run

# Integration tests
npx vitest run src/tests/architecture

# Build
npm run build
```

---

## Notes

- This is a conservative migration strategy
- Each increment is independently verifiable
- Legacy code remains functional until replaced
- No breaking changes to user-facing functionality
- Clear rollback path at each step
