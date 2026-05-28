import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pyResponse = await fetch(`http://127.0.0.1:8000/sessions/${id}`, { method: "GET" });

    if (!pyResponse.ok) {
      const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
      return Response.json(errorData, { status: pyResponse.status });
    }

    const data = await pyResponse.json();
    return Response.json(data);
  } catch (err: any) {
    const { id } = await params;
    console.error(`Proxy error for GET /sessions/${id} — Python backend unreachable:`, err.message);
    return Response.json({ detail: "Python backend is unavailable." }, { status: 503 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pyResponse = await fetch(`http://127.0.0.1:8000/sessions/${id}`, { method: "DELETE" });

    if (!pyResponse.ok) {
      const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
      return Response.json(errorData, { status: pyResponse.status });
    }

    const data = await pyResponse.json();
    return Response.json(data);
  } catch (err: any) {
    const { id } = await params;
    console.error(`Proxy error for DELETE /sessions/${id} — Python backend unreachable:`, err.message);
    return Response.json({ detail: "Python backend is unavailable." }, { status: 503 });
  }
}
