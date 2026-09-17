const EARTH_RADIUS_KM = 6371;
const DEGREES_TO_RADIANS = Math.PI / 180;
export interface Coordinates {
  latitude: number;
  longitude: number;
}
export function haversineDistanceKm(
  from: Coordinates,
  to: Coordinates,
): number {
  const latitudeDelta = (to.latitude - from.latitude) * DEGREES_TO_RADIANS;
  const longitudeDelta = (to.longitude - from.longitude) * DEGREES_TO_RADIANS;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(from.latitude * DEGREES_TO_RADIANS) *
      Math.cos(to.latitude * DEGREES_TO_RADIANS) *
      Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
