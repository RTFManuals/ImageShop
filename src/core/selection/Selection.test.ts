import { describe, it, expect } from 'vitest';
import { Selection } from './Selection';

describe('Selection', () => {
  it('should create empty selection', () => {
    const selection = new Selection(100, 100);
    expect(selection.isEmpty()).toBe(true);
    expect(selection.bounds.width).toBe(0);
    expect(selection.bounds.height).toBe(0);
  });

  it('should select single pixel', () => {
    const selection = new Selection(100, 100);
    selection.select(50, 50);
    
    expect(selection.isEmpty()).toBe(false);
    expect(selection.contains(50, 50)).toBe(true);
    expect(selection.contains(51, 50)).toBe(false);
  });

  it('should select rectangle', () => {
    const selection = new Selection(100, 100);
    selection.selectRect({ x: 10, y: 10, width: 20, height: 20 });
    
    expect(selection.contains(15, 15)).toBe(true);
    expect(selection.contains(5, 5)).toBe(false);
    expect(selection.bounds.x).toBe(10);
    expect(selection.bounds.y).toBe(10);
    expect(selection.bounds.width).toBe(20);
    expect(selection.bounds.height).toBe(20);
  });

  it('should select ellipse', () => {
    const selection = new Selection(100, 100);
    selection.selectEllipse({ x: 25, y: 25, width: 50, height: 50 });
    
    // Center should be selected
    expect(selection.contains(50, 50)).toBe(true);
    
    // Corners should not be selected (outside ellipse)
    expect(selection.contains(25, 25)).toBe(false);
  });

  it('should clear selection', () => {
    const selection = new Selection(100, 100);
    selection.selectRect({ x: 10, y: 10, width: 20, height: 20 });
    selection.clear();
    
    expect(selection.isEmpty()).toBe(true);
  });

  it('should invert selection', () => {
    const selection = new Selection(10, 10);
    selection.select(5, 5);
    selection.invert();
    
    expect(selection.contains(5, 5)).toBe(false);
    expect(selection.contains(0, 0)).toBe(true);
  });

  it('should union two selections', () => {
    const sel1 = new Selection(100, 100);
    sel1.selectRect({ x: 10, y: 10, width: 20, height: 20 });
    
    const sel2 = new Selection(100, 100);
    sel2.selectRect({ x: 25, y: 25, width: 20, height: 20 });
    
    const union = sel1.union(sel2);
    
    expect(union.contains(15, 15)).toBe(true);
    expect(union.contains(30, 30)).toBe(true);
    expect(union.contains(50, 50)).toBe(false);
  });

  it('should intersect two selections', () => {
    const sel1 = new Selection(100, 100);
    sel1.selectRect({ x: 10, y: 10, width: 20, height: 20 });
    
    const sel2 = new Selection(100, 100);
    sel2.selectRect({ x: 15, y: 15, width: 20, height: 20 });
    
    const intersection = sel1.intersect(sel2);
    
    expect(intersection.contains(17, 17)).toBe(true);
    expect(intersection.contains(12, 12)).toBe(false);
    expect(intersection.contains(30, 30)).toBe(false);
  });

  it('should subtract selection', () => {
    const sel1 = new Selection(100, 100);
    sel1.selectRect({ x: 10, y: 10, width: 20, height: 20 });
    
    const sel2 = new Selection(100, 100);
    sel2.selectRect({ x: 15, y: 15, width: 20, height: 20 });
    
    const difference = sel1.subtract(sel2);
    
    expect(difference.contains(12, 12)).toBe(true);
    expect(difference.contains(20, 20)).toBe(false);
  });

  it('should clone selection', () => {
    const selection = new Selection(100, 100);
    selection.selectRect({ x: 10, y: 10, width: 20, height: 20 });
    
    const clone = selection.clone();
    
    expect(clone.contains(15, 15)).toBe(true);
    expect(clone.bounds).toEqual(selection.bounds);
    
    // Modifying clone should not affect original
    clone.clear();
    expect(selection.isEmpty()).toBe(false);
    expect(clone.isEmpty()).toBe(true);
  });

  it('should handle out of bounds coordinates', () => {
    const selection = new Selection(100, 100);
    
    selection.select(-1, -1);
    expect(selection.isEmpty()).toBe(true);
    
    selection.select(100, 100);
    expect(selection.isEmpty()).toBe(true);
  });
});
