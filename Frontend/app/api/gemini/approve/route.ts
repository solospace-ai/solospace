import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const pyResponse = await fetch("http://127.0.0.1:8000/approve_tool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!pyResponse.ok) {
      const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
      return Response.json(errorData, { status: pyResponse.status });
    }

    const data = await pyResponse.json();
    return Response.json(data);
  } catch (err: any) {
    console.error("Proxy error for /approve — Python backend unreachable:", err.message);
    return Response.json({ detail: "Python backend is unavailable." }, { status: 503 });
  }
}
