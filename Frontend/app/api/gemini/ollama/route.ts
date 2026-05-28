import { NextResponse } from "next/server";

export async function GET() {
  try {
    const pyResponse = await fetch("http://127.0.0.1:8000/ollama/models", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!pyResponse.ok) {
      return NextResponse.json(
        { error: `Backend error: ${pyResponse.status}`, models: [], ollama_available: false },
        { status: pyResponse.status }
      );
    }

    const data = await pyResponse.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Proxy error — Python backend unreachable for Ollama:", err.message);
    return NextResponse.json(
      { error: "Python backend is unavailable", models: [], ollama_available: false },
      { status: 503 }
    );
  }
}
