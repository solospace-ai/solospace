import { useEffect, useRef, useState } from 'react';
import { useWorkflowStore } from '../workflowStore';

function getWebSocketUrl(sessionId: string): string {
  if (typeof window === 'undefined') return '';

  const { protocol, hostname, port, host } = window.location;
  const isHttps = protocol === 'https:';
  const wsProtocol = isHttps ? 'wss:' : 'ws:';

  // 1. If running locally on localhost or 127.0.0.1
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${wsProtocol}//127.0.0.1:8000/ws/${sessionId}`;
  }

  // 2. If the port is in the subdomain or hostname (typical in cloud IDEs like IDX, Gitpod, Codespaces)
  // e.g. 3000-xyz.preview.domain.com -> 8000-xyz.preview.domain.com
  if (hostname.includes('3000')) {
    const backendHostname = hostname.replace('3000', '8000');
    return `${wsProtocol}//${backendHostname}/ws/${sessionId}`;
  }

  // 3. If there is a port in the URL (e.g. localhost:3000 or custom-domain:3000)
  if (port && port !== '80' && port !== '443') {
    const backendHost = host.replace(port, '8000');
    return `${wsProtocol}//${backendHost}/ws/${sessionId}`;
  }

  // 4. Fallback default
  return `${wsProtocol}//${hostname}:8000/ws/${sessionId}`;
}

export function useWebSocket(sessionId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const delayRef = useRef(1000); // Start reconnect delay at 1s

  useEffect(() => {
    if (!sessionId) {
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const connect = () => {
      if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const wsUrl = getWebSocketUrl(sessionId);
      console.log(`Connecting to WebSocket for session: ${sessionId} at ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (socketRef.current !== socket) return;
        console.log(`WebSocket connected for session: ${sessionId}`);
        setIsConnected(true);
        delayRef.current = 1000; // Reset reconnection delay on successful connect
      };

      socket.onmessage = (event) => {
        if (socketRef.current !== socket) return;
        try {
          const message = JSON.parse(event.data);
          const { event: eventName, data } = message;

          if (eventName === 'state_sync') {
            console.log('Received state synchronization via WebSocket:', data);
            
            // Sync state to store, merging instead of replacing if needed
            useWorkflowStore.setState({
              nodes: data.nodes || [],
              edges: data.edges || [],
              chatMessages: data.chatMessages || [],
              agentTalkLogs: data.agentTalkLogs || [],
              executionState: data.executionState || 'setup',
              statusMessage: data.statusMessage || '',
              followUpSuggestions: data.followUpSuggestions || [],
            });
          } else if (eventName === 'tool_approval_sync') {
            console.log('Received tool approval sync via WebSocket:', data);
            const storeState = useWorkflowStore.getState();
            const updatedNodes = storeState.nodes.map((node) => {
              if (node.id === data.nodeId) {
                const logs = ((node.data as any).toolLogs || []).map((log: any) => {
                  if (log.id === data.logId) {
                    return {
                      ...log,
                      status: data.status === 'approved' ? 'SUCCESS' : 'BLOCKED',
                      detail: data.status === 'approved' ? `Approved: ${data.toolName}` : `Denied`,
                    };
                  }
                  return log;
                });
                return { ...node, data: { ...node.data, toolLogs: logs } };
              }
              return node;
            });
            useWorkflowStore.setState({ nodes: updatedNodes });
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      socket.onclose = (event) => {
        if (socketRef.current !== socket) return;
        setIsConnected(false);
        socketRef.current = null;
        if (sessionId) {
          console.log(`WebSocket closed: ${event.reason}. Retrying in ${delayRef.current}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (socketRef.current !== null) return;
            delayRef.current = Math.min(delayRef.current * 2, 30000); // Cap at 30s
            connect();
          }, delayRef.current);
        }
      };

      socket.onerror = (error) => {
        if (socketRef.current !== socket) return;
        console.error(`WebSocket connection error for ${socket.url}:`, error);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId]);

  const sendApprovalResponse = (nodeId: string, toolName: string, action: 'approve' | 'deny', logId: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'tool_approval_response',
        nodeId,
        toolName,
        action,
        logId,
      }));
    } else {
      console.warn('WebSocket is not open. Falling back to HTTP for tool approval.');
      fetch('/api/gemini/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          nodeId,
          toolName,
          action,
          logId,
        }),
      }).catch((e) => console.error('Failed to approve tool via fallback:', e));
    }
  };

  return { isConnected, sendApprovalResponse };
}
