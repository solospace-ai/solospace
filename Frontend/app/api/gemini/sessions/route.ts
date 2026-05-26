import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    const url = id ? `http://127.0.0.1:8000/sessions/${id}` : "http://127.0.0.1:8000/sessions";
    const pyResponse = await fetch(url, { method: "GET" });

    if (!pyResponse.ok) {
      const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
      return Response.json(errorData, { status: pyResponse.status });
    }

    const data = await pyResponse.json();
    return Response.json(data);
  } catch (err: any) {
    console.error("Proxy error for GET /sessions — Python backend unreachable:", err.message);
    return Response.json({ detail: "Python backend is unavailable." }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ detail: "Missing session id parameter" }, { status: 400 });
    }

    const pyResponse = await fetch(`http://127.0.0.1:8000/sessions/${id}`, { method: "DELETE" });

    if (!pyResponse.ok) {
      const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
      return Response.json(errorData, { status: pyResponse.status });
    }

    const data = await pyResponse.json();
    return Response.json(data);
  } catch (err: any) {
    console.error("Proxy error for DELETE /sessions — Python backend unreachable:", err.message);
    return Response.json({ detail: "Python backend is unavailable." }, { status: 503 });
  }
}
