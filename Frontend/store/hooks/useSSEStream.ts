/**
 * Unified SSE stream parser hook for Solospace orchestration.
 * Replaces the ~150-line copy-pasted SSE parsing in triggerSteerOrchestration
 * and triggerCustomExecution with a single DRY implementation.
 */

export interface SSEHandlers {
  onText: (token: string) => void;
  onThinking: (thought: string) => void;
  onStatus: (msg: string) => void;
  onMetadata: (meta: Record<string, any>) => void;
  onToolApproval: (approval: Record<string, any>) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

/**
 * Parse an SSE stream from a fetch Response and dispatch events to handlers.
 * Handles buffering, multi-line data fields, and malformed JSON gracefully.
 */
export async function parseSSEStream(
  response: Response,
  handlers: SSEHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream body.");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE blocks are separated by double newlines
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (!part.trim()) continue;

        const lines = part.split("\n");
        let eventType = "text";
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataLines.push(line.slice(6));
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5));
          }
        }

        const rawData = dataLines.join("\n");
        if (!rawData.trim()) continue;

        let parsed: any = null;
        try {
          parsed = JSON.parse(rawData);
        } catch {
          // Malformed JSON — skip silently
          continue;
        }

        switch (eventType) {
          case "text":
            handlers.onText(typeof parsed === "string" ? parsed : String(parsed));
            break;

          case "thinking":
            handlers.onThinking(typeof parsed === "string" ? parsed : String(parsed));
            break;

          case "status":
            handlers.onStatus(typeof parsed === "string" ? parsed : "");
            break;

          case "metadata":
            if (parsed && typeof parsed === "object") {
              handlers.onMetadata(parsed);
            }
            break;

          case "tool_approval":
            if (parsed && typeof parsed === "object") {
              handlers.onToolApproval(parsed);
            }
            break;

          case "done":
            handlers.onDone();
            break;

          default:
            // Unknown event — ignore
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Merge backend nodes/edges into existing canvas nodes/edges.
 * Preserves user customizations, only updates runtime fields (status, toolLogs).
 */
export function mergeCanvasState(
  preExistingNodes: any[],
  preExistingEdges: any[],
  backendNodes: any[],
  backendEdges: any[],
): { nodes: any[]; edges: any[] } {
  if (preExistingNodes.length === 0) {
    return { nodes: backendNodes, edges: backendEdges };
  }

  const mergedNodes = [...preExistingNodes];
  for (const backendNode of backendNodes) {
    const existingIdx = mergedNodes.findIndex((n) => n.id === backendNode.id);
    if (existingIdx >= 0) {
      // Node already exists → preserve user customizations, update runtime fields
      mergedNodes[existingIdx] = {
        ...mergedNodes[existingIdx],
        data: {
          ...mergedNodes[existingIdx].data,
          status: backendNode.data?.status,
          toolLogs: backendNode.data?.toolLogs ?? mergedNodes[existingIdx].data.toolLogs,
        },
      };
    } else {
      // Genuinely new agent → append
      mergedNodes.push(backendNode);
    }
  }

  const mergedEdges = [...preExistingEdges];
  const mergedEdgeIds = new Set(mergedEdges.map((e) => e.id));
  for (const backendEdge of backendEdges) {
    if (!mergedEdgeIds.has(backendEdge.id)) {
      mergedEdges.push(backendEdge);
    }
  }

  return { nodes: mergedNodes, edges: mergedEdges };
}
