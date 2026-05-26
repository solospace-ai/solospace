import { NextResponse } from "next/server";

export async function GET() {
  try {
    const pyResponse = await fetch("http://127.0.0.1:8000/providers", {
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
