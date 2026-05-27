import { useEffect, useRef, useState } from 'react';
import { useWorkflowStore } from '../workflowStore';

export function useWebSocket(sessionId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const delayRef = useRef(1000); // Start reconnect delay at 1s

  useEffect(() => {
    if (!sessionId) {
      if (socketRef.current) {
        socketRef.current.close();
      }
      return;
    }

    const connect = () => {
      if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      console.log(`Connecting to WebSocket for session: ${sessionId}`);
      const socket = new WebSocket(`ws://127.0.0.1:8000/ws/${sessionId}`);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log(`WebSocket connected for session: ${sessionId}`);
        setIsConnected(true);
        delayRef.current = 1000; // Reset reconnection delay on successful connect
      };

      socket.onmessage = (event) => {
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
        setIsConnected(false);
        socketRef.current = null;
        if (sessionId) {
          console.log(`WebSocket closed: ${event.reason}. Retrying in ${delayRef.current}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            delayRef.current = Math.min(delayRef.current * 2, 30000); // Cap at 30s
            connect();
          }, delayRef.current);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        socket.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
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
