import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const pyResponse = await fetch("http://127.0.0.1:8000/echohouse/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!pyResponse.ok) {
      const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
      
      const errStream = new ReadableStream({
        start(controller) {
          const errMsg = `**Backend Error (${pyResponse.status})**\n\n${errorData.detail || "The EchoHouse simulation returned an error."}`;
          const metaMsg = JSON.stringify({
            complexity: "simple",
            capabilities: [],
            nodes: [],
            edges: [],
            agent_talk: []
          });
          controller.enqueue(new TextEncoder().encode(`event: metadata\ndata: ${metaMsg}\n\n`));
          controller.enqueue(new TextEncoder().encode(`event: text\ndata: ${JSON.stringify(errMsg)}\n\n`));
          controller.enqueue(new TextEncoder().encode(`event: done\ndata: {}\n\n`));
          controller.close();
        }
      });
      
      return new Response(errStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
        },
      });
    }

    // Proxy the Python backend's readable stream directly
    return new Response(pyResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });

  } catch (err: any) {
    console.error("Proxy error — Python backend unreachable for EchoHouse simulate:", err.message);
    
    const errStream = new ReadableStream({
      start(controller) {
        const errMsg = "**Python backend is unavailable.**\n\nPlease ensure the backend server is running.";
        const metaMsg = JSON.stringify({
          complexity: "simple",
          capabilities: [],
          nodes: [],
          edges: [],
          agent_talk: []
        });
        controller.enqueue(new TextEncoder().encode(`event: metadata\ndata: ${metaMsg}\n\n`));
        controller.enqueue(new TextEncoder().encode(`event: text\ndata: ${JSON.stringify(errMsg)}\n\n`));
        controller.enqueue(new TextEncoder().encode(`event: done\ndata: {}\n\n`));
        controller.close();
      }
    });
    
    return new Response(errStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  }
}
