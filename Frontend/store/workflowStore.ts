import { create } from 'zustand';
import { parseSSEStream, mergeCanvasState } from './hooks/useSSEStream';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { encryptKey, decryptKey } from '../lib/crypto';
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
  mode: 'auto' | 'custom' | 'quick';
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
  setProviderApiKey: (provider: string, key: string) => Promise<void>;
  loadPersistedKeys: () => Promise<void>;
  loadPersistedState: () => Promise<void>;
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
  createSession: (prompt: string, mode: 'auto' | 'custom' | 'quick') => string;
  forkSession: (sessionId: string) => Promise<string | null>;
  switchSession: (sessionId: string) => void;
  saveCurrentSession: () => void;
  fetchSessions: () => Promise<void>;
  loadSessionFromDb: (sessionId: string) => Promise<void>;
  deleteSessionFromDb: (sessionId: string) => Promise<void>;

  triggerSteerOrchestration: (promptText: string, execute?: boolean, mode?: string) => void;
  triggerCustomExecution: () => Promise<void>;
}

let saveTimeout: any = null;
const debounceSave = (currentSessionId: string, get: any, set: any) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    // Re-verify the session is still active before saving to prevent stale writes
    const activeId = get().activeSessionId;
    if (activeId !== currentSessionId) return;

    let updatedSession: any = null;

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
      updatedSession = currentSession;
      return { sessions: { ...state.sessions, [currentSessionId]: currentSession } };
    });

    if (updatedSession) {
      try {
        await fetch("/api/gemini/sessions/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: updatedSession.id,
            title: updatedSession.title,
            prompt: updatedSession.prompt,
            mode: updatedSession.mode,
            nodes: updatedSession.nodes,
            edges: updatedSession.edges,
            chat_messages: updatedSession.chatMessages,
            agent_talk_logs: updatedSession.agentTalkLogs,
            execution_state: updatedSession.executionState,
            status_message: updatedSession.statusMessage,
            follow_up_suggestions: updatedSession.followUpSuggestions || [],
          }),
        });
      } catch (e) {
        console.error("Failed to save session to SQLite DB:", e);
      }
    }
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
  setProviderApiKey: async (provider, key) => {
    set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } }));
    try {
      if (key) {
        const encrypted = await encryptKey(key);
        await idbSet(`apikey_${provider}`, encrypted);
      } else {
        await idbDel(`apikey_${provider}`);
      }
    } catch (e) {
      console.error(`Failed to encrypt/persist key for provider ${provider}:`, e);
    }
  },
  loadPersistedKeys: async () => {
    try {
      const state = get();
      const providers = ['gemini', 'openai', 'anthropic', 'groq', 'deepseek', 'openrouter', 'ollama'];
      const loadedKeys: Record<string, string> = {};
      for (const p of providers) {
        const encrypted = await idbGet<string>(`apikey_${p}`);
        if (encrypted) {
          try {
            const decrypted = await decryptKey(encrypted);
            loadedKeys[p] = decrypted;
          } catch (err) {
            console.error(`Failed to decrypt key for provider ${p}:`, err);
          }
        }
      }
      set({ apiKeys: { ...state.apiKeys, ...loadedKeys } });
    } catch (e) {
      console.error("Failed to load persisted API keys:", e);
    }
  },
  loadPersistedState: async () => {
    try {
      const raw = await idbGet<string>('solospace_workflow_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          activeSessionId: parsed.activeSessionId ?? null,
          sessions: parsed.sessions ?? {},
          nodes: parsed.nodes ?? [],
          edges: parsed.edges ?? [],
          provider: parsed.provider ?? "gemini",
          model: parsed.model ?? "gemini-2.5-flash",
          fallbackProvider: parsed.fallbackProvider ?? "",
          providerBaseUrls: parsed.providerBaseUrls ?? {},
        });
      }
    } catch (e) {
      console.error("Failed to load persisted state from IndexedDB:", e);
    }
  },
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

  forkSession: async (sessionId) => {
    const sourceSession = get().sessions[sessionId];
    if (!sourceSession) return null;

    const newSessionId = `forked-${Date.now()}`;
    const newTitle = `${sourceSession.title} (Fork)`;
    
    const newSession: ChatSession = {
      id: newSessionId,
      title: newTitle,
      prompt: sourceSession.prompt,
      mode: sourceSession.mode,
      nodes: JSON.parse(JSON.stringify(sourceSession.nodes || [])),
      edges: JSON.parse(JSON.stringify(sourceSession.edges || [])),
      chatMessages: JSON.parse(JSON.stringify(sourceSession.chatMessages || [])),
      agentTalkLogs: JSON.parse(JSON.stringify(sourceSession.agentTalkLogs || [])),
      executionState: sourceSession.executionState || "setup",
      statusMessage: sourceSession.statusMessage || "",
      followUpSuggestions: sourceSession.followUpSuggestions || []
    };

    set((state) => ({
      sessions: { ...state.sessions, [newSessionId]: newSession },
      activeSessionId: newSessionId,
      nodes: newSession.nodes,
      edges: newSession.edges,
      chatMessages: newSession.chatMessages,
      agentTalkLogs: newSession.agentTalkLogs,
      executionState: newSession.executionState,
      statusMessage: newSession.statusMessage,
      followUpSuggestions: newSession.followUpSuggestions,
      selectedNodeId: null
    }));

    try {
      await fetch("/api/gemini/sessions/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: newSession.id,
          title: newSession.title,
          prompt: newSession.prompt,
          mode: newSession.mode,
          nodes: newSession.nodes,
          edges: newSession.edges,
          chat_messages: newSession.chatMessages,
          agent_talk_logs: newSession.agentTalkLogs,
          execution_state: newSession.executionState,
          status_message: newSession.statusMessage,
          follow_up_suggestions: newSession.followUpSuggestions,
        }),
      });
    } catch (e) {
      console.error("Failed to save forked session to DB", e);
    }

    return newSessionId;
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
      const response = await fetch(`/api/gemini/sessions/${sessionId}`);
      if (response.ok) {
        const fullSession = await response.json();
        const session: ChatSession = {
          id: fullSession.id,
          title: fullSession.title,
          prompt: fullSession.prompt,
          mode: fullSession.mode,
          nodes: fullSession.nodes,
          edges: fullSession.edges,
          chatMessages: fullSession.chatMessages,
          agentTalkLogs: fullSession.agentTalkLogs,
          executionState: fullSession.executionState,
          statusMessage: fullSession.statusMessage,
          followUpSuggestions: fullSession.followUpSuggestions
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
      const response = await fetch(`/api/gemini/sessions/${sessionId}`, {
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

  triggerSteerOrchestration: async (promptText, execute = true, mode) => {
    if (!promptText.trim()) return;

    // Abort any active orchestration
    const currentController = get().abortController;
    if (currentController) {
      currentController.abort();
    }

    const controller = new AbortController();

    const preExistingNodes = [...get().nodes];
    const preExistingEdges = [...get().edges];

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
          base_url: get().providerBaseUrls[get().provider] || null,
          existing_nodes: preExistingNodes,
          existing_edges: preExistingEdges,
          mode: mode || (execute ? "auto" : "custom")
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: "Orchestration failed." }));
        throw new Error(errData.detail || `Server status error: ${response.status}`);
      }

      let assistantResponse = "";
      let thinkingSummary = "";

      const handlers = {
        onText: (token: string) => {
          assistantResponse += token;
          set((state) => ({
            isThinking: false,
            chatMessages: state.chatMessages.map(m =>
              m.id === aiMsgId ? { ...m, text: assistantResponse } : m
            )
          }));
        },
        onThinking: (thought: string) => {
          thinkingSummary += thought;
          set((state) => ({
            liveThoughts: thinkingSummary,
            chatMessages: state.chatMessages.map(m =>
              m.id === aiMsgId ? { ...m, thinkingSummary } : m
            )
          }));
        },
        onStatus: (msg: string) => set({ statusMessage: msg }),
        onMetadata: (meta: Record<string, any>) => {
          const { nodes: mergedNodes, edges: mergedEdges } = mergeCanvasState(
            preExistingNodes, preExistingEdges,
            meta.nodes || [], meta.edges || []
          );
          set({ nodes: mergedNodes, edges: mergedEdges, agentTalkLogs: meta.agent_talk || [], followUpSuggestions: meta.follow_up_suggestions || [] });
          const talk = meta.agent_talk || [];
          if (talk.length > 0) {
            const latest = talk[talk.length - 1];
            set({ statusMessage: `⚙️ **${latest.senderName}** completed — ${latest.text?.substring(0, 80) ?? ''}${(latest.text?.length ?? 0) > 80 ? '...' : ''}` });
          }
        },
        onToolApproval: (approval: Record<string, any>) => set({ pendingApproval: approval as any }),
        onDone: () => {},
        onError: (err: Error) => { throw err; },
      };

      await parseSSEStream(response, handlers, controller.signal);

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

    const preExistingNodes = [...get().nodes];
    const preExistingEdges = [...get().edges];

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

      const customHandlers = {
        onText: (token: string) => {
          assistantResponse += token;
          set((state) => ({
            isThinking: false,
            chatMessages: state.chatMessages.map(m =>
              m.id === aiMsgId ? { ...m, text: assistantResponse } : m
            )
          }));
        },
        onThinking: (thought: string) => {
          thinkingSummary += thought;
          set((state) => ({
            liveThoughts: thinkingSummary,
            chatMessages: state.chatMessages.map(m =>
              m.id === aiMsgId ? { ...m, thinkingSummary } : m
            )
          }));
        },
        onStatus: (msg: string) => set({ statusMessage: msg }),
        onMetadata: (meta: Record<string, any>) => {
          const { nodes: mergedNodes, edges: mergedEdges } = mergeCanvasState(
            preExistingNodes, preExistingEdges,
            meta.nodes || [], meta.edges || []
          );
          set({ nodes: mergedNodes, edges: mergedEdges, agentTalkLogs: meta.agent_talk || [], followUpSuggestions: meta.follow_up_suggestions || [] });
          const talk = meta.agent_talk || [];
          if (talk.length > 0) {
            const latest = talk[talk.length - 1];
            set({ statusMessage: `⚙️ **${latest.senderName}** completed — ${latest.text?.substring(0, 80) ?? ''}${(latest.text?.length ?? 0) > 80 ? '...' : ''}` });
          }
        },
        onToolApproval: (approval: Record<string, any>) => set({ pendingApproval: approval as any }),
        onDone: () => {},
        onError: (err: Error) => { throw err; },
      };

      await parseSSEStream(response, customHandlers, controller.signal);

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

let persistTimeout: any = null;
useWorkflowStore.subscribe((state) => {
  if (typeof window === 'undefined') return;
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(async () => {
    try {
      const stateToPersist = {
        activeSessionId: state.activeSessionId,
        sessions: state.sessions,
        nodes: state.nodes,
        edges: state.edges,
        provider: state.provider,
        model: state.model,
        fallbackProvider: state.fallbackProvider,
        providerBaseUrls: state.providerBaseUrls,
      };
      await idbSet('solospace_workflow_state', JSON.stringify(stateToPersist));
    } catch (e) {
      console.error("Failed to persist state to IndexedDB:", e);
    }
  }, 500);
});
