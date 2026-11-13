import { describe, expect, it } from 'vitest';
import { gridPosition, TEL_AVIV_BOUNDS } from './gridPosition';

describe('fixed Tel Aviv grid', () => {
  it('projects the center to the middle of the grid', () => {
    const center = gridPosition({ lat: 32.0853, lng: 34.7818 });
    expect(center.x).toBeCloseTo(50);
    expect(center.y).toBeCloseTo(50);
  });

  it('uses north-up and east-right corners', () => {
    const { north, south, east, west } = TEL_AVIV_BOUNDS;
    expect(gridPosition({ lat: north, lng: west })).toEqual({ x: 0, y: 0 });
    expect(gridPosition({ lat: south, lng: east })).toEqual({ x: 100, y: 100 });
  });

  it('clamps an outlier without changing the source fix or other markers', () => {
    const stationary = { lat: 32.08, lng: 34.79 };
    const before = gridPosition(stationary);
    const outlier = { lat: 32.15, lng: 34.85 };

    expect(gridPosition(outlier)).toEqual({ x: 100, y: 0 });
    expect(outlier).toEqual({ lat: 32.15, lng: 34.85 });
    expect(gridPosition(stationary)).toEqual(before);
  });
});
