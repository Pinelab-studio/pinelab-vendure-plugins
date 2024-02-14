import { GeoLocation } from '../strategies/order-address-to-geolocation-strategy';

export function getDistanceBetweenPointsInKMs(
  pointA: GeoLocation,
  pointB: GeoLocation
): number {
  const EARTH_RADIUS = 6371; // Radius of the earth in km
  const dLat = deg2rad(pointA.latitude - pointB.latitude);
  const dLon = deg2rad(pointA.longitude - pointB.longitude);
  const a =
    Math.pow(Math.sin(dLat / 2), 2) +
    Math.cos(deg2rad(pointB.latitude)) *
      Math.cos(deg2rad(pointB.longitude)) *
      Math.pow(Math.sin(dLon / 2), 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = EARTH_RADIUS * c; // Distance in km

  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}
