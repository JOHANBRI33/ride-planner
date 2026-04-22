export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat") ?? "44.8378";
  const lon = searchParams.get("lon") ?? "-0.5792";

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return Response.json({ error: "no key" }, { status: 500 });

  const base = "https://api.openweathermap.org/data/2.5";
  const params = `lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=fr`;

  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${base}/weather?${params}`, { next: { revalidate: 1800 } }),
    fetch(`${base}/forecast?${params}&cnt=40`, { next: { revalidate: 1800 } }),
  ]);

  if (!currentRes.ok || !forecastRes.ok) {
    return Response.json({ error: "upstream error" }, { status: 502 });
  }

  const current = await currentRes.json();
  const forecast = await forecastRes.json();

  return Response.json({ current, forecast });
}
