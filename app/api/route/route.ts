export async function POST(request: Request) {
  const { waypoints, mode = "cycling" } = await request.json();
  if (!waypoints || waypoints.length < 2) return Response.json({ error: "need 2+ waypoints" }, { status: 400 });
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return Response.json({ error: "no token" }, { status: 500 });
  const coords = waypoints.map(([lng, lat]: [number, number]) => `${lng},${lat}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coords}?geometries=geojson&overview=full&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) return Response.json({ error: "mapbox error" }, { status: 502 });
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) return Response.json({ error: "no route" }, { status: 404 });
  return Response.json({
    geometry: route.geometry.coordinates,
    distanceKm: route.distance / 1000,
    durationMin: Math.round(route.duration / 60),
  });
}
