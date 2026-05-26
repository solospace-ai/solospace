import { create } from 'zustand';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection
} from '@xyflow/react';

export interface ToolLog {
  id: string;
  timestamp: string;
  tool: string;
  action: string;
  status: 'SUCCESS' | 'PENDING' | 'BLOCKED' | 'ERROR';
  detail: string;
}

export interface CanvasNodeData {
  name: string;
  tag: string;
  status: 'IDLE' | 'ACTIVE' | 'SCANNING WEB' | 'AUDITING' | 'QUEUED' | 'WAITING' | 'PROCESSING' | 'STANDBY' | 'DISABLED' | 'ERROR';
  metricLabel: string;
  metricVal: string;
  icon: string;
  objective: string;
  personality: string;
  systemPrompt: string;
  rules: string[];
  tools: string[];
  temp: number;
  logic: number;
  empathy: number;
  context: string;
  enabled: boolean;
  priority: number;
  toolPermissions?: Record<string, 'ALLOWED' | 'ASK' | 'DENIED'>;
  toolLogs?: ToolLog[];
  [key: string]: any;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  thinkingSummary?: string;
  timestamp: string;
}

export interface AgentTalkLog {
  id: string;
  senderId: string;
  senderName: string;
  senderIcon: string;
  text: string;
  timestamp: string;
}

export interface PendingApproval {
  sessionId?: string;
  nodeId: string;
  toolName: string;
  action: string;
  detail: string;
  logId: string;
}

export interface ChatSession {
  id: string;
  title: string;
  prompt: string;
  mode: 'auto' | 'custom';
  nodes: Node[];
  edges: Edge[];
  chatMessages: ChatMessage[];
  agentTalkLogs: AgentTalkLog[];
  executionState: 'setup' | 'running' | 'paused';
  statusMessage: string;
  followUpSuggestions?: string[];
}

export interface WorkflowState {
  sessions: Record<string, ChatSession>;
  activeSessionId: string | null;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  executionState: 'setup' | 'running' | 'paused';
  isOrchestrating: boolean;
  isThinking: boolean;
  statusMessage: string;
  chatMessages: ChatMessage[];
  agentTalkLogs: AgentTalkLog[];
  pendingApproval: PendingApproval | null;
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  provider: string;
  model: string;
  apiKeys: Record<string, string>;
  availableProviders: Record<string, any>;
  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
  setProviderApiKey: (provider: string, key: string) => void;
  fetchAvailableProviders: () => Promise<void>;
  fallbackProvider: string;
  setFallbackProvider: (provider: string) => void;
  providerBaseUrls: Record<string, string>;
  setProviderBaseUrl: (provider: string, url: string) => void;
  providerModels: Record<string, any[]>;
  fetchProviderModels: (providerId: string) => Promise<void>;
  followUpSuggestions: string[];
  liveThoughts: string;
  abortController: AbortController | null;
  cancelOrchestration: () => void;

  // Actions
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setSelectedNodeId: (id: string | null) => void;
  updateNodeField: (nodeId: string, updates: Partial<CanvasNodeData>) => void;
  addNode: (node: Node) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  addRule: (nodeId: string, rule: string) => void;
  deleteRule: (nodeId: string, ruleIndex: number) => void;
  simulateToolExecution?: never;
  setExecutionState: (state: 'setup' | 'running' | 'paused') => void;
  setIsOrchestrating: (val: boolean) => void;
  setIsThinking: (val: boolean) => void;
  setStatusMessage: (msg: string) => void;
  setChatMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  setAgentTalkLogs: (logs: AgentTalkLog[] | ((prev: AgentTalkLog[]) => AgentTalkLog[])) => void;
  setPendingApproval: (val: PendingApproval | null) => void;

  // Session Actions
  createSession: (prompt: string, mode: 'auto' | 'custom') => string;
  switchSession: (sessionId: string) => void;
  saveCurrentSession: () => void;
  fetchSessions: () => Promise<void>;
  loadSessionFromDb: (sessionId: string) => Promise<void>;
  deleteSessionFromDb: (sessionId: string) => Promise<void>;

  triggerSteerOrchestration: (promptText: string, execute?: boolean) => void;
  triggerCustomExecution: () => Promise<void>;
}

let saveTimeout: any = null;
const debounceSave = (currentSessionId: string, get: any, set: any) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    // Re-verify the session is still active before saving to prevent stale writes
    const activeId = get().activeSessionId;
    if (activeId !== currentSessionId) return;

    set((state: any) => {
      // Only save if the session still exists
      if (!state.sessions[currentSessionId]) return state;

      const currentSession = {
        id: currentSessionId,
        title: state.sessions[currentSessionId]?.title || "Chat",
        prompt: state.sessions[currentSessionId]?.prompt || "",
        mode: state.sessions[currentSessionId]?.mode || "auto",
        nodes: state.nodes,
        edges: state.edges,
        chatMessages: state.chatMessages,
        agentTalkLogs: state.agentTalkLogs,
        executionState: state.executionState,
        statusMessage: state.statusMessage,
        followUpSuggestions: state.followUpSuggestions
      };
      return { sessions: { ...state.sessions, [currentSessionId]: currentSession } };
    });
  }, 500);
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  sessions: {},
  activeSessionId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  executionState: 'setup',
  isOrchestrating: false,
  isThinking: false,
  statusMessage: '',
  chatMessages: [],
  agentTalkLogs: [],
  pendingApproval: null,
  apiKey: null,
  setApiKey: (key) => set({ apiKey: key }),
  provider: "gemini",
  model: "gemini-2.5-flash",
  apiKeys: {},
  availableProviders: {},
  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
  setProviderApiKey: (provider, key) => set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),
  fetchAvailableProviders: async () => {
    try {
      const resp = await fetch("/api/gemini/providers");
      if (resp.ok) {
        const data = await resp.json();
        set({ availableProviders: data });
      }
    } catch (e) {
      console.error("Failed to fetch available providers", e);
    }
  },
  fallbackProvider: "",
  setFallbackProvider: (provider) => set({ fallbackProvider: provider }),
  providerBaseUrls: {},
  setProviderBaseUrl: (provider, url) => set((state) => ({ providerBaseUrls: { ...state.providerBaseUrls, [provider]: url } })),
  providerModels: {},
  fetchProviderModels: async (providerId: string) => {
    try {
      const state = get();
      const apiKey = state.apiKeys[providerId] || state.apiKey || "";
      const baseUrl = state.providerBaseUrls[providerId] || "";
      const resp = await fetch("/api/gemini/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          api_key: apiKey,
          api_keys: state.apiKeys,
          base_url: baseUrl
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        set((state) => ({
          providerModels: {
            ...state.providerModels,
            [providerId]: data.models || []
          }
        }));
      }
    } catch (e) {
      console.error(`Failed to fetch models for provider ${providerId}`, e);
    }
  },
  followUpSuggestions: [],
  liveThoughts: '',
  abortController: null,
  cancelOrchestration: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
      set({ abortController: null, isOrchestrating: false, isThinking: false });
    }
  },

  setNodes: (newNodes) => {
    set((state) => ({
      nodes: typeof newNodes === 'function' ? newNodes(state.nodes) : newNodes
    }));
    get().saveCurrentSession();
  },

  setEdges: (newEdges) => {
    set((state) => ({
      edges: typeof newEdges === 'function' ? newEdges(state.edges) : newEdges
    }));
    get().saveCurrentSession();
  },

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes)
    }));
    get().saveCurrentSession();
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges)
    }));
    get().saveCurrentSession();
  },

  onConnect: (connection) => {
    set((state) => {
      const edge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}`,
        animated: true,
        type: 'custom',
        style: { stroke: '#06b6d4', strokeWidth: 2 }
      };

      // Sync dependency: target node depends on source node
      const updatedNodes = state.nodes.map(node => {
        if (node.id === connection.target) {
          const currentDeps = (node.data as any).dependencies || [];
          if (!currentDeps.includes(connection.source)) {
            return {
              ...node,
              data: { ...node.data, dependencies: [...currentDeps, connection.source] }
            };
          }
        }
        return node;
      });

      return { edges: addEdge(edge, state.edges), nodes: updatedNodes };
    });
    get().saveCurrentSession();
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  updateNodeField: (nodeId, updates) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...updates } };
        }
        return node;
      })
    }));
    get().saveCurrentSession();
  },

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node] }));
    get().saveCurrentSession();
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
    }));
    get().saveCurrentSession();
  },

  deleteEdge: (edgeId) => {
    set((state) => {
      const edge = state.edges.find(e => e.id === edgeId);
      let updatedNodes = state.nodes;

      // Sync dependency: remove source from target's dependencies when edge deleted
      if (edge) {
        updatedNodes = state.nodes.map(node => {
          if (node.id === edge.target) {
            const currentDeps = (node.data as any).dependencies || [];
            return {
              ...node,
              data: { ...node.data, dependencies: currentDeps.filter((d: string) => d !== edge.source) }
            };
          }
          return node;
        });
      }

      return {
        edges: state.edges.filter(e => e.id !== edgeId),
        nodes: updatedNodes
      };
    });
    get().saveCurrentSession();
  },

  addRule: (nodeId, rule) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, rules: [...((node.data as any).rules || []), rule] }
          };
        }
        return node;
      })
    }));
    get().saveCurrentSession();
  },

  deleteRule: (nodeId, ruleIndex) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              rules: ((node.data as any).rules || []).filter((_: any, idx: number) => idx !== ruleIndex)
            }
          };
        }
        return node;
      })
    }));
    get().saveCurrentSession();
  },

  // (simulateToolExecution removed — backend runs real tools)

  // State modifiers
  setExecutionState: (state) => {
    set({ executionState: state });
    get().saveCurrentSession();
  },
  setIsOrchestrating: (val) => set({ isOrchestrating: val }),
  setIsThinking: (val) => set({ isThinking: val }),
  setStatusMessage: (msg) => {
    set({ statusMessage: msg });
    get().saveCurrentSession();
  },
  setChatMessages: (msgs) => {
    set((state) => ({
      chatMessages: typeof msgs === 'function' ? msgs(state.chatMessages) : msgs
    }));
    get().saveCurrentSession();
  },
  setAgentTalkLogs: (logs) => {
    set((state) => ({
      agentTalkLogs: typeof logs === 'function' ? logs(state.agentTalkLogs) : logs
    }));
    get().saveCurrentSession();
  },
  setPendingApproval: (val) => set({ pendingApproval: val }),

  // Session Actions
  createSession: (prompt, mode) => {
    const sessionId = Date.now().toString();
    const newSession: ChatSession = {
      id: sessionId,
      title: prompt.length > 40 ? prompt.substring(0, 40) + "..." : prompt,
      prompt: prompt,
      mode: mode,
      nodes: [],
      edges: [],
      chatMessages: [],
      agentTalkLogs: [],
      executionState: "setup",
      statusMessage: "",
      followUpSuggestions: []
    };

    set((state) => ({
      sessions: { ...state.sessions, [sessionId]: newSession },
      activeSessionId: sessionId,
      nodes: [],
      edges: [],
      chatMessages: [],
      agentTalkLogs: [],
      executionState: "setup",
      statusMessage: "",
      followUpSuggestions: []
    }));

    return sessionId;
  },

  switchSession: (sessionId) => {
    const currentSessionId = get().activeSessionId;
    if (currentSessionId) {
      const currentSession: ChatSession = {
        id: currentSessionId,
        title: get().sessions[currentSessionId]?.title || "Chat",
        prompt: get().sessions[currentSessionId]?.prompt || "",
        mode: get().sessions[currentSessionId]?.mode || "auto",
        nodes: get().nodes,
        edges: get().edges,
        chatMessages: get().chatMessages,
        agentTalkLogs: get().agentTalkLogs,
        executionState: get().executionState,
        statusMessage: get().statusMessage,
        followUpSuggestions: get().followUpSuggestions
      };
      set((state) => ({
        sessions: { ...state.sessions, [currentSessionId]: currentSession }
      }));
    }

    const newSession = get().sessions[sessionId];
    if (newSession) {
      set({
        activeSessionId: sessionId,
        nodes: newSession.nodes,
        edges: newSession.edges,
        chatMessages: newSession.chatMessages,
        agentTalkLogs: newSession.agentTalkLogs,
        executionState: newSession.executionState,
        statusMessage: newSession.statusMessage,
        followUpSuggestions: newSession.followUpSuggestions || [],
        selectedNodeId: null
      });
    }
  },

  saveCurrentSession: () => {
    const currentSessionId = get().activeSessionId;
    if (!currentSessionId) return;
    debounceSave(currentSessionId, get, set);
  },

  fetchSessions: async () => {
    try {
      const response = await fetch("/api/gemini/sessions");
      if (response.ok) {
        const list = await response.json();
        const updatedSessions: Record<string, ChatSession> = { ...get().sessions };
        for (const s of list) {
          if (!updatedSessions[s.session_id]) {
            updatedSessions[s.session_id] = {
              id: s.session_id,
              title: s.title,
              prompt: s.prompt,
              mode: s.mode,
              nodes: [],
              edges: [],
              chatMessages: [],
              agentTalkLogs: [],
              executionState: s.execution_state,
              statusMessage: s.status_message,
              followUpSuggestions: []
            };
          }
        }
        set({ sessions: updatedSessions });
      }
    } catch (e) {
      console.error("Failed to fetch sessions from DB", e);
    }
  },

  loadSessionFromDb: async (sessionId: string) => {
    try {
      const response = await fetch(`/api/gemini/sessions?id=${sessionId}`);
      if (response.ok) {
        const fullSession = await response.json();
        const session: ChatSession = {
          id: fullSession.session_id,
          title: fullSession.title,
          prompt: fullSession.prompt,
          mode: fullSession.mode,
          nodes: fullSession.nodes,
          edges: fullSession.edges,
          chatMessages: fullSession.chat_messages,
          agentTalkLogs: fullSession.agent_talk_logs,
          executionState: fullSession.execution_state,
          statusMessage: fullSession.status_message,
          followUpSuggestions: fullSession.follow_up_suggestions
        };
        
        set((state) => ({
          sessions: { ...state.sessions, [sessionId]: session },
          activeSessionId: sessionId,
          nodes: session.nodes,
          edges: session.edges,
          chatMessages: session.chatMessages,
          agentTalkLogs: session.agentTalkLogs,
          executionState: session.executionState,
          statusMessage: session.statusMessage,
          followUpSuggestions: session.followUpSuggestions || [],
          selectedNodeId: null
        }));
      }
    } catch (e) {
      console.error("Failed to load session from DB", e);
    }
  },

  deleteSessionFromDb: async (sessionId: string) => {
    // Abort orchestration if deleting the currently active session
    if (get().activeSessionId === sessionId) {
      const ctrl = get().abortController;
      if (ctrl) ctrl.abort();
    }

    try {
      const response = await fetch(`/api/gemini/sessions?id=${sessionId}`, {
        method: "DELETE"
      });
      if (response.ok) {
        set((state) => {
          const updated = { ...state.sessions };
          delete updated[sessionId];
          const newActiveId = state.activeSessionId === sessionId ? null : state.activeSessionId;
          return {
            sessions: updated,
            activeSessionId: newActiveId,
            abortController: state.activeSessionId === sessionId ? null : state.abortController,
            isOrchestrating: state.activeSessionId === sessionId ? false : state.isOrchestrating,
            isThinking: state.activeSessionId === sessionId ? false : state.isThinking,
            ...(newActiveId ? {} : {
              nodes: [],
              edges: [],
              chatMessages: [],
              agentTalkLogs: [],
              executionState: "setup",
              statusMessage: "",
              followUpSuggestions: []
            })
          };
        });
      }
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  },

  triggerSteerOrchestration: async (promptText, execute = true) => {
    if (!promptText.trim()) return;

    // Abort any active orchestration
    const currentController = get().abortController;
    if (currentController) {
      currentController.abort();
    }

    const controller = new AbortController();

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    set((state) => ({
      chatMessages: [...state.chatMessages, userMsg],
      isOrchestrating: true,
      isThinking: true,
      statusMessage: "",
      liveThoughts: "",
      agentTalkLogs: [],
      followUpSuggestions: [],
      abortController: controller
    }));
    get().saveCurrentSession();

    // Create target AI message placeholder
    const aiMsgId = (Date.now() + 1).toString();
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        {
          id: aiMsgId,
          sender: "ai",
          text: "",
          thinkingSummary: "",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    }));
    get().saveCurrentSession();

    try {
      const response = await fetch("/api/gemini/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          history: get().chatMessages
            .filter(m => m.id !== aiMsgId) // Exclude current empty prompt placeholder
            .map(m => ({ sender: m.sender, text: m.text })),
          api_key: get().apiKeys[get().provider] || get().apiKey || "",
          api_keys: get().apiKeys,
          session_id: get().activeSessionId || "",
          execute_agents: execute,
          provider: get().provider,
          model: get().model,
          fallback_provider: get().fallbackProvider || null,
          base_url: get().providerBaseUrls[get().provider] || null
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: "Orchestration failed." }));
        throw new Error(errData.detail || `Server status error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream body reader.");

      let assistantResponse = "";
      let thinkingSummary = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;

          const lines = part.split("\n");
          let eventType = "text";
          let dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ")) {
              dataLines.push(line.slice(6));
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5));
            }
          }

          const dataContent = dataLines.join("\n");

          if (eventType === "text") {
            try {
              const textVal = JSON.parse(dataContent);
              assistantResponse += textVal;
              set((state) => ({
                isThinking: false, // Turn off thinking dots on first text token
                chatMessages: state.chatMessages.map(m =>
                  m.id === aiMsgId ? { ...m, text: assistantResponse } : m
                )
              }));
            } catch (e) {
              console.error("Text SSE parse error", e);
            }
          } else if (eventType === "thinking") {
            try {
              const thoughtVal = JSON.parse(dataContent);
              thinkingSummary += thoughtVal;
              set((state) => ({
                liveThoughts: thinkingSummary,
                chatMessages: state.chatMessages.map(m =>
                  m.id === aiMsgId ? { ...m, thinkingSummary: thinkingSummary } : m
                )
              }));
            } catch (e) {
              console.error("Thinking SSE parse error", e);
            }
          } else if (eventType === "status") {
            try {
              const statusVal = JSON.parse(dataContent);
              set({ statusMessage: typeof statusVal === "string" ? statusVal : "" });
            } catch (e) {
              console.error("Status SSE parse error", e);
            }
          } else if (eventType === "metadata") {
            try {
              const meta = JSON.parse(dataContent);
              set({
                nodes: meta.nodes || [],
                edges: meta.edges || [],
                agentTalkLogs: meta.agent_talk || [],
                followUpSuggestions: meta.follow_up_suggestions || []  // Bug 2: populate suggestions
              });
            } catch (e) {
              console.error("Metadata SSE parse error", e);
            }
          } else if (eventType === "tool_approval") {
            try {
              const approval = JSON.parse(dataContent);
              set({ pendingApproval: approval });
            } catch (e) {
              console.error("Tool approval SSE parse error", e);
            }
          }
        }
      }

      if (!assistantResponse) {
        const fallbackMsg = "I'm sorry, I couldn't generate a response. This might be due to a temporary issue with the AI service or an invalid API key. Please check your API key in Settings and try again.";
        set((state) => ({
          chatMessages: state.chatMessages.map(m =>
            m.id === aiMsgId ? { ...m, text: fallbackMsg } : m
          )
        }));
      }

      set({ abortController: null });
      get().saveCurrentSession();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Steer Orchestration manually aborted.");
        set((state) => ({
          chatMessages: state.chatMessages.map(m =>
            m.id === aiMsgId && !m.text ? { ...m, text: "*Generation stopped by user.*" } : m
          )
        }));
      } else {
        console.error("Steer Orchestration stream error:", err);
        const errorMsg = `**Connection Error.**\n\n${err.message || "Failed to parse stream event source. Check backend logs."}`;
        set((state) => ({
          chatMessages: state.chatMessages.map(m =>
            m.id === aiMsgId ? { ...m, text: errorMsg } : m
          ),
          nodes: [],
          edges: [],
          followUpSuggestions: []
        }));
      }
      set({ abortController: null, isThinking: false, isOrchestrating: false });
      get().saveCurrentSession();
    } finally {
      set({ isOrchestrating: false, isThinking: false, statusMessage: '', liveThoughts: '' });
      get().saveCurrentSession();
    }
  },

  triggerCustomExecution: async () => {
    const currentController = get().abortController;
    if (currentController) {
      currentController.abort();
    }

    const controller = new AbortController();

    const sessionId = get().activeSessionId;
    if (!sessionId) return;

    const prompt = get().chatMessages.findLast(m => m.sender === 'user')?.text || "";

    set((state) => ({
      isOrchestrating: true,
      isThinking: true,
      statusMessage: "Running custom orchestration loop...",
      liveThoughts: "",
      agentTalkLogs: [],
      followUpSuggestions: [],
      abortController: controller
    }));
    get().saveCurrentSession();

    const aiMsgId = Date.now().toString();
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        {
          id: aiMsgId,
          sender: "ai",
          text: "",
          thinkingSummary: "",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    }));
    get().saveCurrentSession();

    try {
      const response = await fetch("/api/gemini/execute_custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          prompt: prompt,
          history: get().chatMessages
            .filter(m => m.id !== aiMsgId)
            .map(m => ({ sender: m.sender, text: m.text })),
          api_key: get().apiKeys[get().provider] || get().apiKey || "",
          api_keys: get().apiKeys,
          nodes: get().nodes,
          edges: get().edges,
          provider: get().provider,
          model: get().model,
          fallback_provider: get().fallbackProvider || null,
          base_url: get().providerBaseUrls[get().provider] || null
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: "Execution failed." }));
        throw new Error(errData.detail || `Server status error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream body reader.");

      let assistantResponse = "";
      let thinkingSummary = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;

          const lines = part.split("\n");
          let eventType = "text";
          let dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ")) {
              dataLines.push(line.slice(6));
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5));
            }
          }

          const dataContent = dataLines.join("\n");

          if (eventType === "text") {
            try {
              const textVal = JSON.parse(dataContent);
              assistantResponse += textVal;
              set((state) => ({
                isThinking: false,
                chatMessages: state.chatMessages.map(m =>
                  m.id === aiMsgId ? { ...m, text: assistantResponse } : m
                )
              }));
            } catch (e) {
              console.error("Text SSE parse error", e);
            }
          } else if (eventType === "thinking") {
            try {
              const thoughtVal = JSON.parse(dataContent);
              thinkingSummary += thoughtVal;
              set((state) => ({
                liveThoughts: thinkingSummary,
                chatMessages: state.chatMessages.map(m =>
                  m.id === aiMsgId ? { ...m, thinkingSummary: thinkingSummary } : m
                )
              }));
            } catch (e) {
              console.error("Thinking SSE parse error", e);
            }
          } else if (eventType === "status") {
            try {
              const statusVal = JSON.parse(dataContent);
              set({ statusMessage: typeof statusVal === "string" ? statusVal : "" });
            } catch (e) {
              console.error("Status SSE parse error", e);
            }
          } else if (eventType === "metadata") {
            try {
              const meta = JSON.parse(dataContent);
              set({
                nodes: meta.nodes || [],
                edges: meta.edges || [],
                agentTalkLogs: meta.agent_talk || [],
                followUpSuggestions: meta.follow_up_suggestions || []  // Bug 2: populate suggestions
              });
            } catch (e) {
              console.error("Metadata SSE parse error", e);
            }
          } else if (eventType === "tool_approval") {
            try {
              const approval = JSON.parse(dataContent);
              set({ pendingApproval: approval });
            } catch (e) {
              console.error("Tool approval SSE parse error", e);
            }
          }
        }
      }

      if (!assistantResponse) {
        const fallbackMsg = "I'm sorry, I couldn't generate a response. This might be due to a temporary issue with the AI service or an invalid API key. Please check your API key in Settings and try again.";
        set((state) => ({
          chatMessages: state.chatMessages.map(m =>
            m.id === aiMsgId ? { ...m, text: fallbackMsg } : m
          )
        }));
      }

      set({ abortController: null });
      get().saveCurrentSession();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Steer Orchestration manually aborted.");
        set((state) => ({
          chatMessages: state.chatMessages.map(m =>
            m.id === aiMsgId && !m.text ? { ...m, text: "*Generation stopped by user.*" } : m
          )
        }));
      } else {
        console.error("Steer Orchestration stream error:", err);
        const errorMsg = `**Connection Error.**\n\n${err.message || "Failed to parse stream event source. Check backend logs."}`;
        set((state) => ({
          chatMessages: state.chatMessages.map(m =>
            m.id === aiMsgId ? { ...m, text: errorMsg } : m
          ),
          nodes: [],
          edges: [],
          followUpSuggestions: []
        }));
      }
      set({ abortController: null, isThinking: false, isOrchestrating: false });
      get().saveCurrentSession();
    } finally {
      set({ isOrchestrating: false, isThinking: false, statusMessage: '', liveThoughts: '' });
      get().saveCurrentSession();
    }
  }
}));
