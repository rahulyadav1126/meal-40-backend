import { haversineDistanceKm, type Coordinates } from '@app/common';
export interface GeocodedAddress extends Coordinates {
  formattedAddress: string;
}
export interface MapsProvider {
  geocode(address: string): Promise<GeocodedAddress>;
  reverseGeocode(coordinates: Coordinates): Promise<GeocodedAddress>;
  calculateDistance(from: Coordinates, to: Coordinates): Promise<number>;
}
export class HaversineMapsProvider implements Pick<
  MapsProvider,
  'calculateDistance'
> {
  async calculateDistance(from: Coordinates, to: Coordinates): Promise<number> {
    return haversineDistanceKm(from, to);
  }
}
