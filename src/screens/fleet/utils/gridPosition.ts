export const TEL_AVIV_BOUNDS = {
  north: 32.1353,
  south: 32.0353,
  east: 34.8318,
  west: 34.7318,
};

export function gridPosition({ lat, lng }: { lat: number; lng: number }) {
  const { north, south, east, west } = TEL_AVIV_BOUNDS;
  const x = (lng - west) / (east - west);
  const y = (north - lat) / (north - south);

  return {
    x: Math.min(1, Math.max(0, x)) * 100,
    y: Math.min(1, Math.max(0, y)) * 100,
  };
}
