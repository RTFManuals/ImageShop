# Implementation Plan

## Phase 0 — Repository Audit ✅ COMPLETE

**Status**: Complete
**Duration**: Current session

### Deliverables
- [x] Architecture audit document
- [x] Feature matrix with status
- [x] Implementation plan
- [x] Architectural decisions document

### Findings Summary
- **Current State**: Monolithic prototype with 3,795 lines in single file
- **Feature Coverage**: 65% (64/98 features)
- **Architecture Score**: Poor - no separation of concerns
- **Test Coverage**: 0% - no tests exist
- **Critical Issues**: 
  - All logic in App.tsx
  - No state management
  - No command pattern
  - No tool abstraction
  - No test infrastructure

### Decision
Proceed with Phase 1 refactoring. The prototype has good feature coverage but critical architectural problems that prevent long-term maintenance.

---

## Phase 1 — Core Foundation

**Goal**: Establish maintainable architecture while preserving existing functionality
**Duration**: 2-3 weeks
**Priority**: CRITICAL

### Objectives

1. **Extract Core Modules**
   - Document model
   - Layer system
   - Rendering engine
   - Viewport management

2. **Implement Command Pattern**
   - Command interface
   - Command manager
   - History manager
   - Memory-efficient undo

3. **Add State Management**
   - Install Zustand
   - Create editor store
   - Migrate from useState
   - Centralize state

4. **Create Tool Abstraction**
   - Tool interface
   - Tool registry
   - Tool manager
   - Migrate existing tools

5. **Add Test Infrastructure**
   - Install Vitest
   - Configure test environment
   - Write initial tests
   - Set up CI

### Acceptance Criteria

✅ User can import an image
✅ User can create layers
✅ User can move a layer
✅ User can change opacity
✅ User can undo changes
✅ User can export rendered result
✅ All existing features still work
✅ Code coverage > 60%
✅ No TypeScript errors
✅ Build passes

### Implementation Steps

#### Step 1.1: Project Setup (1 day)
```bash
npm install zustand vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Files to Create**:
- `src/core/document/Document.ts`
- `src/core/document/DocumentTypes.ts`
- `src/core/layers/Layer.ts`
- `src/core/layers/LayerTypes.ts`
- `src/core/layers/LayerManager.ts`
- `src/state/editorStore.ts`
- `vitest.config.ts`

**Tasks**:
1. Install dependencies
2. Create directory structure
3. Define core interfaces
4. Set up Vitest configuration
5. Create basic test

**Risk**: Low - additive changes only

---

#### Step 1.2: Document Model (2 days)

**Files to Create**:
- `src/core/document/Document.ts` - Document class
- `src/core/document/DocumentManager.ts` - Document lifecycle
- `src/core/document/DocumentTypes.ts` - Type definitions

**Tasks**:
1. Define Document interface
2. Implement Document class
3. Add serialization support
4. Write unit tests
5. Integrate with existing code

**Key Design Decisions**:
- Document is immutable
- Changes create new document instances
- Document contains layer tree
- Document is serializable to JSON

**Tests**:
```typescript
describe('Document', () => {
  it('should create document with dimensions', () => {})
  it('should add layer to document', () => {})
  it('should remove layer from document', () => {})
  it('should serialize to JSON', () => {})
  it('should deserialize from JSON', () => {})
})
```

**Risk**: Medium - core data structure

---

#### Step 1.3: Layer System (2 days)

**Files to Create**:
- `src/core/layers/Layer.ts` - Base layer
- `src/core/layers/RasterLayer.ts` - Raster layer
- `src/core/layers/LayerGroup.ts` - Layer group
- `src/core/layers/LayerManager.ts` - Layer operations

**Tasks**:
1. Define Layer interface
2. Implement RasterLayer
3. Implement LayerGroup
4. Implement LayerManager
5. Add blend mode support
6. Write unit tests
7. Migrate existing layer logic

**Key Design Decisions**:
- Layer is immutable
- Pixel data stored separately from metadata
- Layer has unique ID
- Layer supports masks
- Layer supports blend modes

**Tests**:
```typescript
describe('LayerManager', () => {
  it('should add layer', () => {})
  it('should remove layer', () => {})
  it('should reorder layers', () => {})
  it('should change layer opacity', () => {})
  it('should change layer visibility', () => {})
  it('should apply blend mode', () => {})
})
```

**Risk**: Medium - core functionality

---

#### Step 1.4: Rendering Engine (2 days)

**Files to Create**:
- `src/core/rendering/Renderer.ts` - Renderer interface
- `src/core/rendering/Canvas2DRenderer.ts` - Canvas implementation
- `src/core/rendering/Viewport.ts` - Viewport management
- `src/core/rendering/RenderScheduler.ts` - Render scheduling

**Tasks**:
1. Define Renderer interface
2. Implement Canvas2DRenderer
3. Implement Viewport (zoom, pan)
4. Implement RenderScheduler
5. Add coordinate transformation
6. Write unit tests
7. Migrate existing rendering

**Key Design Decisions**:
- Renderer is replaceable
- Viewport handles zoom/pan
- RenderScheduler prevents unnecessary redraws
- Coordinate system separates document/screen space

**Tests**:
```typescript
describe('Viewport', () => {
  it('should zoom in', () => {})
  it('should zoom out', () => {})
  it('should pan', () => {})
  it('should transform coordinates', () => {})
})

describe('Canvas2DRenderer', () => {
  it('should render document', () => {})
  it('should render layers in order', () => {})
  it('should apply blend modes', () => {})
  it('should render checkerboard background', () => {})
})
```

**Risk**: Medium - performance critical

---

#### Step 1.5: Command System (2 days)

**Files to Create**:
- `src/core/commands/Command.ts` - Command interface
- `src/core/commands/CommandManager.ts` - Command execution
- `src/core/commands/HistoryManager.ts` - Undo/redo
- `src/core/commands/commands/` - Concrete commands

**Tasks**:
1. Define Command interface
2. Implement CommandManager
3. Implement HistoryManager
4. Create basic commands:
   - AddLayerCommand
   - RemoveLayerCommand
   - ChangeOpacityCommand
   - MoveLayerCommand
5. Write unit tests
6. Integrate with existing undo/redo

**Key Design Decisions**:
- Command has execute() and undo()
- Commands are immutable
- History stores commands, not snapshots
- Memory-efficient undo using delta compression

**Tests**:
```typescript
describe('CommandManager', () => {
  it('should execute command', () => {})
  it('should undo command', () => {})
  it('should redo command', () => {})
  it('should limit history size', () => {})
})

describe('AddLayerCommand', () => {
  it('should add layer on execute', () => {})
  it('should remove layer on undo', () => {})
})
```

**Risk**: High - affects all operations

---

#### Step 1.6: Tool Abstraction (2 days)

**Files to Create**:
- `src/core/tools/Tool.ts` - Tool interface
- `src/core/tools/ToolRegistry.ts` - Tool registration
- `src/core/tools/ToolManager.ts` - Tool dispatch
- `src/core/tools/ToolContext.ts` - Tool context
- `src/tools/move/MoveTool.ts` - Move tool
- `src/tools/brush/BrushTool.ts` - Brush tool

**Tasks**:
1. Define Tool interface
2. Implement ToolRegistry
3. Implement ToolManager
4. Migrate Move tool
5. Migrate Brush tool
6. Write unit tests
7. Gradually migrate other tools

**Key Design Decisions**:
- Tool is isolated module
- Tool receives context, not global state
- Tool uses commands for changes
- Tool can be added without modifying core

**Tests**:
```typescript
describe('MoveTool', () => {
  it('should move layer on drag', () => {})
  it('should create undoable command', () => {})
})

describe('BrushTool', () => {
  it('should paint on layer', () => {})
  it('should respect selection', () => {})
  it('should create undoable command', () => {})
})
```

**Risk**: High - affects all tools

---

#### Step 1.7: State Management (1 day)

**Files to Create**:
- `src/state/editorStore.ts` - Main store
- `src/state/uiStore.ts` - UI state
- `src/state/documentStore.ts` - Document state

**Tasks**:
1. Install Zustand
2. Create editor store
3. Migrate state from useState
4. Add persistence middleware
5. Write unit tests

**Key Design Decisions**:
- Separate UI state from document state
- Use Zustand for simplicity
- Add persistence for auto-save
- State is serializable

**Tests**:
```typescript
describe('editorStore', () => {
  it('should update active tool', () => {})
  it('should update active layer', () => {})
  it('should persist to localStorage', () => {})
})
```

**Risk**: Medium - affects all components

---

#### Step 1.8: Integration & Testing (2 days)

**Tasks**:
1. Integrate all modules
2. Fix integration issues
3. Write integration tests
4. Performance testing
5. Bug fixes
6. Documentation

**Integration Tests**:
```typescript
describe('Editor Integration', () => {
  it('should import image and create layer', () => {})
  it('should move layer and undo', () => {})
  it('should paint stroke and undo', () => {})
  it('should apply adjustment', () => {})
  it('should save and load project', () => {})
  it('should export image', () => {})
})
```

**Risk**: Medium - integration issues expected

---

### Phase 1 Deliverables

1. **Code**
   - Modular architecture
   - Core modules extracted
   - Command pattern implemented
   - Tool abstraction created
   - State management added

2. **Tests**
   - Unit tests for all core modules
   - Integration tests for workflows
   - > 60% code coverage

3. **Documentation**
   - API documentation
   - Architecture guide
   - Contribution guide

4. **Performance**
   - Baseline metrics
   - No regressions
   - Memory efficient undo

---

## Phase 2 — Editing Tools

**Goal**: Complete tool implementation with proper architecture
**Duration**: 2 weeks
**Priority**: HIGH

### Objectives

1. Migrate all tools to new architecture
2. Implement missing selection tools
3. Add advanced transform tools
4. Improve brush engine

### Tools to Implement

- [ ] Polygonal Lasso (migrate)
- [ ] Magic Wand (migrate)
- [ ] Quick Selection (migrate)
- [ ] Free Transform (enhance)
- [ ] Crop (migrate)
- [ ] Brush (enhance)
- [ ] Eraser (migrate)
- [ ] Eyedropper (migrate)

### Acceptance Criteria

✅ All tools use command pattern
✅ All tools respect selection
✅ All tools support undo/redo
✅ Brush engine supports pressure
✅ Transform supports all operations
✅ Tools are isolated modules

---

## Phase 3 — Masks & Adjustments

**Goal**: Non-destructive editing capabilities
**Duration**: 2 weeks
**Priority**: HIGH

### Objectives

1. Implement layer masks
2. Implement adjustment layers
3. Add curves adjustment
4. Add more adjustments

### Features to Implement

- [ ] Layer masks (paint on mask)
- [ ] Clipping masks (enhance)
- [ ] Adjustment layers
- [ ] Curves adjustment
- [ ] Levels (enhance)
- [ ] Hue/Saturation (enhance)
- [ ] Color Balance (enhance)

### Acceptance Criteria

✅ Masks are non-destructive
✅ Adjustments are non-destructive
✅ Can paint on layer masks
✅ Can stack adjustment layers
✅ All adjustments reversible

---

## Phase 4 — Retouching & Filters

**Goal**: Professional retouching tools
**Duration**: 2 weeks
**Priority**: MEDIUM

### Objectives

1. Implement advanced retouching
2. Add more filters
3. Improve performance with workers

### Features to Implement

- [ ] Background Eraser
- [ ] Spot Healing Brush
- [ ] Noise Reduction
- [ ] Lens Correction
- [ ] Gaussian Blur (enhance)
- [ ] Sharpen (enhance)
- [ ] Web Worker for processing

### Acceptance Criteria

✅ Retouching tools work correctly
✅ Filters respect selection
✅ Large images process smoothly
✅ No UI blocking during processing

---

## Phase 5 — Advanced Compositing

**Goal**: Advanced layer effects and transforms
**Duration**: 2 weeks
**Priority**: MEDIUM

### Objectives

1. Implement layer styles
2. Add advanced transforms
3. Implement smart objects
4. Add guides and snapping

### Features to Implement

- [ ] Layer styles (shadow, stroke, glow)
- [ ] Perspective transform
- [ ] Warp transform
- [ ] Liquify
- [ ] Smart objects
- [ ] Guides and snapping
- [ ] Advanced selection refinement

### Acceptance Criteria

✅ Layer styles are editable
✅ Transforms are non-destructive
✅ Smart objects preserve quality
✅ Guides snap correctly

---

## Phase 6 — AI Features (Future)

**Goal**: Optional AI integrations
**Duration**: TBD
**Priority**: LOW

### Objectives

1. Design AI provider interface
2. Implement background removal
3. Implement object removal
4. Implement generative fill

### Features to Implement

- [ ] AI provider interface
- [ ] Background removal
- [ ] Object removal
- [ ] Generative fill
- [ ] Generative expand
- [ ] AI upscale
- [ ] AI enhance
- [ ] Subject selection

### Acceptance Criteria

✅ AI features are optional
✅ Provider is replaceable
✅ Results are editable
✅ No dependency on specific AI service

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 0 - Audit | 1 day | ✅ Complete |
| Phase 1 - Foundation | 2-3 weeks | 🔄 Next |
| Phase 2 - Tools | 2 weeks | ⏳ Pending |
| Phase 3 - Masks | 2 weeks | ⏳ Pending |
| Phase 4 - Retouching | 2 weeks | ⏳ Pending |
| Phase 5 - Advanced | 2 weeks | ⏳ Pending |
| Phase 6 - AI | TBD | ⏳ Pending |

**Total Estimated Duration**: 10-12 weeks

---

## Risk Mitigation

### High Risk Items

1. **Command System Implementation**
   - Risk: Breaking existing undo/redo
   - Mitigation: Parallel implementation, gradual migration

2. **Tool Migration**
   - Risk: Breaking tool functionality
   - Mitigation: Migrate one tool at a time, test thoroughly

3. **State Management Migration**
   - Risk: Breaking component state
   - Mitigation: Migrate incrementally, keep fallbacks

### Mitigation Strategies

1. **Feature Flags**
   - Enable new architecture gradually
   - Keep old code as fallback

2. **Parallel Implementation**
   - New modules alongside old code
   - Switch when ready

3. **Extensive Testing**
   - Test every migration step
   - Integration tests before merge

4. **Incremental Refactoring**
   - Small, reviewable changes
   - No big-bang rewrites

---

## Success Metrics

### Phase 1 Success Criteria

1. **Code Quality**
   - [ ] No TypeScript errors
   - [ ] No ESLint errors
   - [ ] Code coverage > 60%
   - [ ] No circular dependencies

2. **Functionality**
   - [ ] All existing features work
   - [ ] No regressions
   - [ ] Performance maintained

3. **Architecture**
   - [ ] Clear module boundaries
   - [ ] No business logic in UI
   - [ ] Testable components
   - [ ] Extensible design

4. **Documentation**
   - [ ] API docs complete
   - [ ] Architecture guide
   - [ ] Contribution guide
   - [ ] Code examples

---

## Next Steps

**Immediate Actions**:

1. ✅ Complete Phase 0 documentation
2. 🔄 Start Phase 1.1 (Project Setup)
3. ⏳ Install dependencies
4. ⏳ Create directory structure
5. ⏳ Define core interfaces

**This Week**:
- Complete Phase 1.1 and 1.2
- Establish document model
- Add test infrastructure

**This Month**:
- Complete Phase 1
- Establish solid foundation
- Prepare for Phase 2

---

## Conclusion

This implementation plan provides a clear path from the current monolithic prototype to a professional, maintainable image editor. The phased approach minimizes risk while delivering value at each stage.

**Key Principles**:
1. Preserve existing functionality
2. Incremental refactoring
3. Test-driven development
4. Clear architecture boundaries
5. Continuous delivery

**Expected Outcome**:
A professional, extensible image editor with solid architecture, comprehensive tests, and clear path for future development.
