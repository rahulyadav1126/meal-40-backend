import { describe, expect, it } from 'vitest';
import { haversineDistanceKm } from '../../libs/common/src/utils/location.util.js';

describe('haversineDistanceKm', () => {
  it('returns zero for identical coordinates', () => expect(haversineDistanceKm({ latitude: 28.6139, longitude: 77.209 }, { latitude: 28.6139, longitude: 77.209 })).toBe(0));
  it('calculates a realistic distance', () => expect(haversineDistanceKm({ latitude: 28.6139, longitude: 77.209 }, { latitude: 28.5355, longitude: 77.391 })).toBeGreaterThan(19));
});
