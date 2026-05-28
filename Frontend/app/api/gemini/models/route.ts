import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, api_key, base_url } = body;
    
    const params = new URLSearchParams();
    if (api_key) params.append("api_key", api_key);
    if (base_url) params.append("base_url", base_url);
    
    const queryString = params.toString();
    const url = `http://127.0.0.1:8000/${provider}/models` + (queryString ? `?${queryString}` : "");

    const pyResponse = await fetch(url, {
      method: "GET",
    });

    if (!pyResponse.ok) {
      return NextResponse.json(
        { error: `Backend error: ${pyResponse.status}` },
        { status: pyResponse.status }
      );
    }

    const data = await pyResponse.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Proxy error — Python backend unreachable:", err.message);
    return NextResponse.json(
      { error: "Python backend is unavailable" },
      { status: 503 }
    );
  }
}
