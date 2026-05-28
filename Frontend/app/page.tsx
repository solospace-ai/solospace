'use client';

import React, { useState, useEffect, useRef } from "react";
import {
  Bot, Zap, SquarePlus, Key, History, Settings, User, ChevronRight, ChevronLeft,
  HelpCircle, UploadCloud, Eye, Mic, GitFork, ArrowRight, Database, Sliders,
  X, Trash2, Globe, Terminal, Sparkles, Copy, Check, Square, Pencil, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ReactFlowProvider } from '@xyflow/react';
import { useWorkflowStore, ChatMessage, AgentTalkLog } from "@/store/workflowStore";
import FlowArena from "@/components/FlowArena";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import APIKeysModal from "@/components/APIKeysModal";
import { useWebSocket } from "@/store/hooks/useWebSocket";

const StreamingText = ({ text, isActive }: { text: string; isActive: boolean }) => (
  <span className="whitespace-pre-wrap font-sans text-neutral-200">
    {text}
    {isActive && <span className="ml-1 inline-block w-1.5 h-4 bg-white align-middle animate-blink" />}
  </span>
);

export default function SolospaceApp() {
  return (
    <ReactFlowProvider>
      <SolospaceContent />
    </ReactFlowProvider>
  );
}

function SolospaceContent() {
  const sessions = useWorkflowStore((s) => s.sessions);
  const activeSessionId = useWorkflowStore((s) => s.activeSessionId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const isOrchestrating = useWorkflowStore((s) => s.isOrchestrating);
  const isThinking = useWorkflowStore((s) => s.isThinking);
  const statusMessage = useWorkflowStore((s) => s.statusMessage);
  const chatMessages = useWorkflowStore((s) => s.chatMessages);
  const agentTalkLogs = useWorkflowStore((s) => s.agentTalkLogs);
  const pendingApproval = useWorkflowStore((s) => s.pendingApproval);
  const liveThoughts = useWorkflowStore((s) => s.liveThoughts);
  const provider = useWorkflowStore((s) => s.provider);
  const model = useWorkflowStore((s) => s.model);
  const followUpSuggestions = useWorkflowStore((s) => s.followUpSuggestions);

  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const setExecutionState = useWorkflowStore((s) => s.setExecutionState);
  const updateNodeField = useWorkflowStore((s) => s.updateNodeField);
  const addRule = useWorkflowStore((s) => s.addRule);
  const deleteRule = useWorkflowStore((s) => s.deleteRule);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const setChatMessages = useWorkflowStore((s) => s.setChatMessages);
  const createSession = useWorkflowStore((s) => s.createSession);
  const cancelOrchestration = useWorkflowStore((s) => s.cancelOrchestration);
  const fetchSessions = useWorkflowStore((s) => s.fetchSessions);
  const loadSessionFromDb = useWorkflowStore((s) => s.loadSessionFromDb);
  const deleteSessionFromDb = useWorkflowStore((s) => s.deleteSessionFromDb);
  const fetchAvailableProviders = useWorkflowStore((s) => s.fetchAvailableProviders);
  const triggerSteerOrchestration = useWorkflowStore((s) => s.triggerSteerOrchestration);
  const loadPersistedKeys = useWorkflowStore((s) => s.loadPersistedKeys);
  const loadPersistedState = useWorkflowStore((s) => s.loadPersistedState);

  const { isConnected, sendApprovalResponse } = useWebSocket(activeSessionId);

  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [workspaceState, setWorkspaceState] = useState<"home" | "active">("home");
  const [currentTab, setCurrentTab] = useState<"chat" | "arena">("chat");
  const [executionMode, setExecutionMode] = useState<"auto" | "custom">("auto");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);
  const [userQuery, setUserQuery] = useState<string>("");
  const [isSecretOpen, setIsSecretOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [hoveredSidebarItem, setHoveredSidebarItem] = useState<string | null>(null);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState<boolean>(false);
  const [newRuleText, setNewRuleText] = useState<string>("");
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState<boolean>(true);

  const isEchoHouseMode = useWorkflowStore(s => s.activeSessionId ? s.sessions[s.activeSessionId]?.mode === 'echohouse' : false);

  const activeSession = activeSessionId ? sessions[activeSessionId] : null;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [userQuery]);

  useEffect(() => {
    if (selectedNodeId) setIsConfigPanelOpen(true);
    else setIsConfigPanelOpen(false);
  }, [selectedNodeId]);

  useEffect(() => {
    if (shouldAutoScroll) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isThinking, shouldAutoScroll]);

  useEffect(() => {
    if (workspaceState === "active" && activeSessionId === null) {
      setWorkspaceState("home");
      setCurrentTab("chat");
      setUserQuery("");
    }
  }, [activeSessionId, workspaceState]);

  useEffect(() => {
    const init = async () => {
      await fetchSessions().catch(e => console.error("Failed to load sessions:", e));
      await fetchAvailableProviders().catch(e => console.error("Failed to load providers:", e));
      await loadPersistedKeys().catch(e => console.error("Failed to load API keys:", e));
      await loadPersistedState().catch(e => console.error("Failed to load state:", e));
      if (useWorkflowStore.getState().isOrchestrating) {
        useWorkflowStore.setState({
          isOrchestrating: false,
          isThinking: false,
          abortController: null
        });
      }
    };
    init();

    const handleUnload = () => {
      useWorkflowStore.getState().saveCurrentSession();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsSidebarExpanded(window.innerWidth >= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startOrchestration = async (promptText: string) => {
    if (!promptText.trim()) return;

    if (isEchoHouseMode) {
      const userMsgId = Date.now().toString();
      const userMsg: ChatMessage = {
        id: userMsgId,
        sender: "user",
        text: promptText,
        speakerName: "You (Self)",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages((prev) => [...prev, userMsg]);
      setUserQuery("");
      setCurrentTab("arena");

      const selfNode = {
        id: "self-node",
        type: "custom",
        position: { x: 300, y: 200 },
        data: {
          name: "You (Self)",
          tag: "SELF",
          icon: "bot",
          objective: promptText.length > 120 ? promptText.substring(0, 120) + "..." : promptText,
          systemPrompt: "You are the user themselves, experiencing this problem from the inside.",
          status: "IDLE" as const,
          enabled: true,
          isEchoHouseAgent: true,
          echohouseRole: "self",
          echohouseProblem: promptText,
          rules: [],
          dependencies: [],
          tools: [],
          toolPermissions: {},
          temp: 0.7,
          logic: 70,
          empathy: 50,
          priority: 5,
          toolLogs: [],
          personality: "",
          senderId: "self-node"
        }
      };
      setNodes([selfNode]);
      setEdges([]);

      try {
        const activeProv = useWorkflowStore.getState().provider;
        const apiKey = useWorkflowStore.getState().apiKeys[activeProv] || useWorkflowStore.getState().apiKey || "";
        const resp = await fetch("/api/gemini/echohouse/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem_text: promptText,
            provider: activeProv,
            model: useWorkflowStore.getState().model,
            api_key: apiKey,
            api_keys: useWorkflowStore.getState().apiKeys,
            base_url: useWorkflowStore.getState().providerBaseUrls[activeProv] || null
          })
        });
        if (resp.ok) {
          const suggestedCast = await resp.json();
          const nodesList = [selfNode];
          suggestedCast.forEach((member: any, idx: number) => {
            if (member.is_self || member.role === "self") return;
            
            const angle = (idx * 2 * Math.PI) / (suggestedCast.length - 1 || 1);
            const x = 300 + Math.cos(angle) * 250;
            const y = 200 + Math.sin(angle) * 200;
            
            nodesList.push({
              id: `echo-agent-${idx}-${Date.now()}`,
              type: "custom",
              position: { x: Math.max(50, x), y: Math.max(50, y) },
              data: {
                name: member.inferred_name,
                tag: member.role.toUpperCase().replace(/\s+/g, "_"),
                icon: "science",
                objective: `Provide perspective as ${member.inferred_name} (${member.role}).`,
                systemPrompt: `You are ${member.inferred_name}, whose role in the user's life is ${member.role}. From your perspective about their situation: ${member.inferred_problem}`,
                status: "IDLE" as const,
                enabled: true,
                isEchoHouseAgent: true,
                echohouseRole: member.role,
                echohouseProblem: member.inferred_problem,
                rules: [],
                dependencies: [],
                tools: [],
                toolPermissions: {},
                temp: 0.8,
                logic: 70,
                empathy: 50,
                priority: 5,
                toolLogs: [],
                personality: "",
                senderId: `echo-agent-${idx}-${Date.now()}`
              }
            });
          });
          setNodes(nodesList);
        }
      } catch (e) {
        console.error("Failed to suggest cast:", e);
      }
      return;
    }

    setWorkspaceState("active");
    setCurrentTab("chat");
    let sessionId = activeSessionId;
    if (!sessionId) sessionId = createSession(promptText, executionMode);
    setExecutionState("running");
    triggerSteerOrchestration(promptText, executionMode !== "custom", executionMode);
    setUserQuery("");
  };

  const handleRegenerate = () => {
    const lastAIIdx = chatMessages.findLastIndex(m => m.sender === "ai");
    if (lastAIIdx === -1) return;
    
    const lastUserMsg = chatMessages.slice(0, lastAIIdx).findLast(m => m.sender === "user");
    if (!lastUserMsg) return;

    setChatMessages((prev) => prev.slice(0, lastAIIdx));
    startOrchestration(lastUserMsg.text);
  };

  const handleAddRule = () => {
    if (!newRuleText.trim() || !selectedNodeId) return;
    addRule(selectedNodeId, newRuleText.trim());
    setNewRuleText("");
  };

  const activeNodeDetail = nodes.find(n => n.id === selectedNodeId) as any;

  const ModeSelector = () => (
    <div className="flex items-center gap-1 bg-neutral-900/40 rounded-full p-0.5 border border-[#1f1f1f]">
      <button onClick={() => setExecutionMode("auto")} className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold transition-all ${executionMode === "auto" ? "bg-white text-black shadow-md" : "text-neutral-400 hover:text-white"}`}>Smart</button>
      <button onClick={() => setExecutionMode("custom")} className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold transition-all ${executionMode === "custom" ? "bg-white text-black shadow-md" : "text-neutral-400 hover:text-white"}`}>Custom</button>
    </div>
  );

  const handleFileAttach = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.json,.csv,.py,.js,.ts,.tsx,.html,.css,.yaml,.yml,.xml,.ini,.cfg,.pdf,.jpg,.png";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (['.txt', '.md', '.json', '.csv', '.py', '.js', '.ts', '.tsx', '.html', '.css', '.yaml', '.yml', '.xml', '.ini', '.cfg'].includes(ext)) {
        const reader = new FileReader();
        reader.onload = (ev) => setUserQuery((prev) => prev + `\n[Attached: ${file.name}]\n${ev.target?.result as string}\n`);
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="flex h-screen w-full bg-black text-[#f5f5f5] overflow-hidden font-sans">
      <aside onClick={() => { if (!isSidebarExpanded) setIsSidebarExpanded(true); }} className={`flex flex-col h-full bg-[#0d0d0d] border-r border-[#1f1f1f] shrink-0 transition-all duration-300 z-30 select-none cursor-pointer ${isSidebarExpanded ? "w-64 cursor-default" : "w-[60px]"}`}>
        <div className="flex items-center gap-3 h-16 border-b border-[#1f1f1f] px-4 justify-between">
          {isSidebarExpanded ? (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center"><Bot className="w-4 h-4 text-black stroke-[2.5]" /></div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-none">Solospace</h1>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center mx-auto"><Bot className="w-4 h-4 text-black stroke-[2.5]" /></div>
          )}
          {isSidebarExpanded && <button onClick={(e) => { e.stopPropagation(); setIsSidebarExpanded(false); }} className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto custom-scrollbar">
          <button onClick={(e) => { if (isSidebarExpanded) { e.stopPropagation(); useWorkflowStore.getState().abortController?.abort(); setWorkspaceState("home"); setUserQuery(""); useWorkflowStore.setState({ activeSessionId: null, nodes: [], edges: [], chatMessages: [], agentTalkLogs: [], executionState: "setup", statusMessage: "", isThinking: false, isOrchestrating: false, liveThoughts: "", pendingApproval: null, followUpSuggestions: [], abortController: null }); } }} className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"}`}>
            <SquarePlus className="w-5 h-5 stroke-[1.8]" />
            {isSidebarExpanded && <span className="text-xs font-semibold">New Chat</span>}
          </button>

          <button onClick={(e) => { if (isSidebarExpanded) { e.stopPropagation(); setIsSecretOpen(true); } }} className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"}`}>
            <Key className="w-5 h-5 stroke-[1.8]" />
            {isSidebarExpanded && <span className="text-xs font-semibold">API Keys</span>}
          </button>

          {/* Templates Section */}
          <div className="pt-2 select-none">
            {isSidebarExpanded ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsTemplatesExpanded(!isTemplatesExpanded); }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-neutral-600 hover:text-neutral-400 cursor-pointer"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Templates</span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isTemplatesExpanded ? "rotate-90" : ""}`} />
                </button>
                {isTemplatesExpanded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      createSession("EchoHouse Simulation", "echohouse");
                      setWorkspaceState("active");
                      setCurrentTab("chat");
                    }}
                    className="w-full flex items-center rounded-lg transition-all duration-150 py-2.5 px-3 gap-3 hover:bg-neutral-900 text-neutral-200 cursor-pointer"
                  >
                    <Globe className="w-5 h-5 stroke-[1.8]" />
                    <span className="text-xs font-semibold">EchoHouse</span>
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => {
                  createSession("EchoHouse Simulation", "echohouse");
                  setWorkspaceState("active");
                  setCurrentTab("chat");
                }}
                className="w-full flex items-center justify-center rounded-lg transition-all duration-150 py-2.5 hover:bg-neutral-900 text-neutral-400 cursor-pointer"
                title="EchoHouse Template"
              >
                <Globe className="w-5 h-5 stroke-[1.8]" />
              </button>
            )}
          </div>

          {isSidebarExpanded && (
            <div className="pt-6 space-y-2 select-none">
              <div className="flex items-center gap-1.5 px-3"><History className="w-3.5 h-3.5 text-neutral-600" /><span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest font-mono">Recents</span></div>
              <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar">
                {Object.values(sessions).length === 0 ? <span className="text-[10px] text-neutral-600 italic px-3 block pt-1">No chats yet.</span> : (
                  Object.values(sessions).reverse().map((s) => (
                    <div key={s.id} className="group/session flex items-center justify-between px-2 py-1 rounded-md hover:bg-neutral-900 transition-colors">
                      <button disabled={isLoadingSession} onClick={async (e) => { if (isSidebarExpanded) { e.stopPropagation(); setIsLoadingSession(true); try { await loadSessionFromDb(s.id); setWorkspaceState("active"); setCurrentTab("chat"); } catch (err) { console.error(err); } finally { setIsLoadingSession(false); } } }} className={`text-left text-xs truncate font-medium flex-1 cursor-pointer transition-colors ${activeSessionId === s.id ? "text-white font-bold" : "text-neutral-500 hover:text-white"}`} title={s.prompt}>{s.title}</button>
                      <button onClick={async (e) => { if (isSidebarExpanded) { e.stopPropagation(); if (confirm(`Delete "${s.title}"?`)) await deleteSessionFromDb(s.id); } }} className="opacity-0 group-hover/session:opacity-100 p-1 text-neutral-600 hover:text-rose-400 rounded transition-opacity cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </nav>
      </aside>

      <main onClick={() => { if (isSidebarExpanded && window.innerWidth < 768) setIsSidebarExpanded(false); }} className="flex-1 flex flex-col min-w-0 bg-[#000000] relative transition-all duration-300">
        <header className="flex justify-between items-center w-full px-6 h-16 border-b border-[#141414] shrink-0 z-10 bg-black/85 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {isConnected && activeSessionId && (
              <span className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE SYNC
              </span>
            )}
          </div>
          <div className="flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-[2px] rounded-full select-none">
            <button onClick={() => { if (workspaceState !== "home") setCurrentTab("chat"); }} className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${currentTab === "chat" || workspaceState === "home" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"}`}>Chat</button>
            {workspaceState === "active" && (
              <button onClick={() => setCurrentTab("arena")} className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${currentTab === "arena" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"}`}>
                <GitFork className="w-3 h-3" /> Flow {nodes.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse ml-0.5" />}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 select-none">
            <button onClick={() => alert("Solospace AI OS")} className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer"><HelpCircle className="w-4 h-4 stroke-[1.8]" /></button>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
          {workspaceState === "home" && (
            <div className="absolute inset-0 flex flex-col justify-between overflow-y-auto custom-scrollbar">
              <div />
              <div className="w-full max-w-2xl mx-auto px-6 py-12 flex flex-col items-center">
                <div className="text-center mb-10 space-y-2 select-none">
                  <h1 className="text-4xl font-extrabold tracking-tight text-white antialiased">
                    {isEchoHouseMode ? "What is your problem in life?" : "What's on your mind?"}
                  </h1>
                  <p className="text-sm text-neutral-400 font-sans">
                    {isEchoHouseMode ? "Describe your struggle below to initialize the simulation." : "Ask anything. Get a real, complete answer instantly."}
                  </p>
                </div>
                <div className="w-full chatgpt-input-box rounded-[24px] p-2 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <button onClick={handleFileAttach} className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors shrink-0 cursor-pointer"><UploadCloud className="w-5 h-5 stroke-[1.8]" /></button>
                    <textarea rows={1} value={userQuery} onChange={(e) => setUserQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (userQuery.trim()) startOrchestration(userQuery); } }} placeholder={isEchoHouseMode ? "What is your problem in life?" : "Describe your idea, problem, or question..."} className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 resize-none py-1.5 custom-scrollbar" style={{ maxHeight: "150px" }} />
                    <button onClick={() => startOrchestration(userQuery)} disabled={!userQuery.trim()} className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all font-semibold cursor-pointer"><ArrowRight className="w-4 h-4 text-black stroke-[3]" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-5 select-none">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Mode:</span>
                  <button onClick={() => setExecutionMode("auto")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${executionMode === "auto" ? "bg-white text-black border-white font-bold" : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"}`}><Sparkles className="w-3 h-3 stroke-[2]" /><span>Smart Auto</span></button>
                  <button onClick={() => setExecutionMode("custom")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${executionMode === "custom" ? "bg-white text-black border-white font-bold" : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"}`}><Sliders className="w-3 h-3" /><span>Custom Agent</span></button>
                </div>
              </div>
              <div />
            </div>
          )}

          {workspaceState === "active" && (
            <div className="absolute inset-0 flex">
              {currentTab === "chat" && (
                <div className="flex-1 flex flex-col justify-between overflow-hidden bg-black">
                  <div ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                    {isLoadingSession ? (
                      <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin" /></div>
                    ) : (
                      <div className="max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto space-y-4 select-text">
                        {chatMessages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center space-y-2 select-none">
                            <h1 className="text-2xl font-bold text-white">
                              {isEchoHouseMode ? "What is your problem in life?" : "What's on your mind?"}
                            </h1>
                            <p className="text-xs text-neutral-500">
                              {isEchoHouseMode ? "Type your struggle below to initialize the simulation." : "Start a conversation to see AI response."}
                            </p>
                          </div>
                        ) : (
                          chatMessages.map((msg, msgIdx) => (
                            <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                              {msg.sender === "user" ? (
                                <div className="flex flex-col items-end space-y-1 max-w-[72%] group">
                                  {msg.speakerName && (
                                    <span className="text-[10px] font-mono text-neutral-500 mr-2">{msg.speakerName}</span>
                                  )}
                                  <div className="rounded-3xl px-5 py-3 bg-[#2f2f2f] text-neutral-100 text-sm leading-relaxed"><p className="whitespace-pre-wrap">{msg.text}</p></div>
                                  <div className="flex items-center gap-3 mt-1.5 text-neutral-500 select-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 mr-2">
                                    <button onClick={() => { navigator.clipboard.writeText(msg.text); setCopiedMsgId(msg.id); setTimeout(() => setCopiedMsgId(null), 2000); }} className="flex items-center gap-1 text-[10px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded hover:bg-neutral-800">
                                      {copiedMsgId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                      <span>{copiedMsgId === msg.id ? "Copied" : "Copy"}</span>
                                    </button>
                                    <button onClick={() => { setUserQuery(msg.text); textareaRef.current?.focus(); textareaRef.current?.scrollIntoView({ behavior: "smooth" }); }} className="flex items-center gap-1 text-[10px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded hover:bg-neutral-800">
                                      <Pencil className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex-1 max-w-[88%] flex flex-col items-start space-y-1">
                                  {msg.speakerName === "insight" && (
                                    <div className="w-full flex items-center gap-4 my-6">
                                      <div className="h-px flex-1 bg-[#1f1f1f]" />
                                      <span className="text-[10px] font-mono text-neutral-500 tracking-wider uppercase">Simulation Analysis</span>
                                      <div className="h-px flex-1 bg-[#1f1f1f]" />
                                    </div>
                                  )}
                                  {msg.speakerName && msg.speakerName !== "insight" && (
                                    <span className="text-[10px] font-mono text-neutral-500 ml-1">{msg.speakerName}</span>
                                  )}
                                  <div className="w-full text-neutral-100 text-sm leading-relaxed px-1 py-2">
                                    {isOrchestrating && msgIdx === chatMessages.length - 1 ? <StreamingText text={msg.text} isActive={true} /> : <MarkdownRenderer content={msg.text || ""} />}
                                    {msg.text && (!isOrchestrating || msgIdx !== chatMessages.length - 1) && (
                                      <div className="flex items-center gap-3 mt-4 text-neutral-500 select-none">
                                        <button onClick={() => { navigator.clipboard.writeText(msg.text); setCopiedMsgId(msg.id); setTimeout(() => setCopiedMsgId(null), 2000); }} className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800">
                                          {copiedMsgId === msg.id ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400 font-medium">Copied</span></> : <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>}
                                        </button>
                                        {!isEchoHouseMode && msgIdx === chatMessages.length - 1 && !isOrchestrating && (
                                          <button onClick={handleRegenerate} className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800">
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            <span>Regenerate</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {msgIdx === chatMessages.length - 1 && !isThinking && !isOrchestrating && nodes.length > 0 && (
                                    <div className="flex gap-3 mt-4 select-none">
                                      <button onClick={() => setCurrentTab("arena")} className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-cyan-500/40 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer max-w-max">
                                        <GitFork className="w-3.5 h-3.5 text-cyan-400" /><span>See Agent Flow</span>
                                      </button>
                                      {!isEchoHouseMode && useWorkflowStore.getState().executionState === "paused" && (
                                        <button
                                          onClick={async () => {
                                            setExecutionState("running");
                                            await useWorkflowStore.getState().triggerCustomExecution();
                                          }}
                                          className="px-4 py-2 bg-white hover:bg-neutral-200 rounded-xl text-xs font-bold text-black transition-all flex items-center gap-1.5 cursor-pointer max-w-max"
                                        >
                                          Proceed
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          ))
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </div>
                  <div className="px-4 sm:px-6 py-4 bg-black/60 border-t border-[#141414] backdrop-blur-xl shrink-0 flex flex-col gap-2">
                    <div className="max-w-3xl mx-auto w-full chatgpt-input-box rounded-[24px] p-1.5 flex items-center gap-2">
                      <button onClick={handleFileAttach} className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors shrink-0 cursor-pointer"><UploadCloud className="w-5 h-5 stroke-[1.8]" /></button>
                      <textarea ref={textareaRef} rows={1} value={userQuery} onChange={(e) => setUserQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!isOrchestrating && userQuery.trim()) startOrchestration(userQuery); } }} placeholder={isOrchestrating ? "Streaming..." : isEchoHouseMode ? "What is your problem in life?" : "Ask a follow-up..."} disabled={isOrchestrating} className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 px-3 py-1.5 disabled:opacity-50 resize-none max-h-40 custom-scrollbar" />
                      <div className="flex items-center gap-2 shrink-0">
                        <ModeSelector />
                        {isOrchestrating ? (
                          <button onClick={cancelOrchestration} className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-500 active:scale-95 transition-all cursor-pointer"><Square className="w-3.5 h-3.5 text-white fill-white" /></button>
                        ) : (
                          <button onClick={() => startOrchestration(userQuery)} disabled={!userQuery.trim() || isThinking} className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all cursor-pointer"><ArrowRight className="w-4 h-4 text-black stroke-[3]" /></button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {currentTab === "arena" && (
                <div className="flex-1 relative overflow-hidden bg-[#000000] flex">
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#0d0d0d]/90 border border-[#1f1f1f] rounded-full px-4 py-2 backdrop-blur-md shadow-xl pointer-events-auto">
                    <button onClick={() => setCurrentTab("chat")} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer font-mono"><ChevronLeft className="w-3.5 h-3.5" /> Back to Chat</button>
                  </div>
                  <FlowArena onProceed={() => setCurrentTab("chat")} />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {currentTab === "arena" && isConfigPanelOpen && activeNodeDetail && (
        <div className="fixed top-0 right-0 h-full w-80 bg-[#0c0c0c]/95 border-l border-[#1f1f1f] z-40 flex flex-col justify-between shadow-2xl transition-transform duration-300 right-panel select-none">
          <div className="p-5 border-b border-[#1f1f1f] flex justify-between items-center bg-[#0d0d0d]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{activeNodeDetail.data.name}</h3>
            <button onClick={() => { setIsConfigPanelOpen(false); setSelectedNodeId(null); }} className="text-neutral-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
            {activeNodeDetail.data.isEchoHouseAgent ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Name</label>
                  <input
                    type="text"
                    value={activeNodeDetail.data.name}
                    onChange={(e) => {
                      const nameVal = e.target.value;
                      const roleVal = activeNodeDetail.data.echohouseRole || "";
                      const probVal = activeNodeDetail.data.echohouseProblem || "";
                      updateNodeField(activeNodeDetail.id, {
                        name: nameVal,
                        systemPrompt: `You are ${nameVal}, whose role in the user's life is ${roleVal}. From your perspective about their situation: ${probVal}`,
                        objective: nameVal === "You (Self)" || roleVal === "self"
                          ? (probVal.length > 120 ? probVal.substring(0, 120) + "..." : probVal)
                          : `Provide perspective as ${nameVal} (${roleVal}).`
                      });
                    }}
                    className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Role</label>
                  <input
                    type="text"
                    value={activeNodeDetail.data.echohouseRole}
                    disabled={activeNodeDetail.data.echohouseRole === "self"}
                    onChange={(e) => {
                      const nameVal = activeNodeDetail.data.name || "";
                      const roleVal = e.target.value;
                      const probVal = activeNodeDetail.data.echohouseProblem || "";
                      updateNodeField(activeNodeDetail.id, {
                        echohouseRole: roleVal,
                        tag: roleVal.toUpperCase().replace(/\s+/g, '_'),
                        systemPrompt: `You are ${nameVal}, whose role in the user's life is ${roleVal}. From your perspective about their situation: ${probVal}`,
                        objective: `Provide perspective as ${nameVal} (${roleVal}).`
                      });
                    }}
                    className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none disabled:opacity-40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">
                    {activeNodeDetail.data.echohouseRole === "self" ? "Your problem in life" : "What do they think about your situation?"}
                  </label>
                  <textarea
                    value={activeNodeDetail.data.echohouseProblem}
                    onChange={(e) => {
                      const nameVal = activeNodeDetail.data.name || "";
                      const roleVal = activeNodeDetail.data.echohouseRole || "";
                      const probVal = e.target.value;
                      updateNodeField(activeNodeDetail.id, {
                        echohouseProblem: probVal,
                        systemPrompt: roleVal === "self"
                          ? "You are the user themselves, experiencing this problem from the inside."
                          : `You are ${nameVal}, whose role in the user's life is ${roleVal}. From your perspective about their situation: ${probVal}`,
                        objective: roleVal === "self"
                          ? (probVal.length > 120 ? probVal.substring(0, 120) + "..." : probVal)
                          : `Provide perspective as ${nameVal} (${roleVal}).`
                      });
                    }}
                    className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[100px] resize-none leading-relaxed"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5"><label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Name</label><input type="text" value={activeNodeDetail.data.name} onChange={(e) => updateNodeField(activeNodeDetail.id, { name: e.target.value })} className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none" /></div>
                <div className="space-y-1.5"><label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">System Prompt</label><textarea value={activeNodeDetail.data.systemPrompt} onChange={(e) => updateNodeField(activeNodeDetail.id, { systemPrompt: e.target.value })} className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[80px] resize-none leading-relaxed" /></div>
              </>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isSecretOpen && <APIKeysModal isOpen={isSecretOpen} onClose={() => setIsSecretOpen(false)} />}
        
        {pendingApproval && (
          <div className="fixed bottom-6 right-6 w-96 bg-[#0d0d0d] border border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.15)] rounded-2xl p-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 select-none">
            <div className="flex gap-4 items-start">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 shrink-0"><Sliders className="w-5 h-5 animate-pulse" /></div>
              <div className="flex-1 space-y-2">
                <h4 className="text-xs font-bold text-white">&apos;{(nodes.find(n => n.id === pendingApproval.nodeId)?.data as any)?.name}&apos; wants to use <span className="text-amber-400 font-mono">[{pendingApproval.toolName}]</span></h4>
                <p className="text-[10px] text-neutral-400 leading-normal">Action: <span className="text-white font-semibold">{pendingApproval.action}</span> — {pendingApproval.detail}</p>
                <div className="pt-3 flex gap-2">
                  <button onClick={() => { sendApprovalResponse(pendingApproval.nodeId, pendingApproval.toolName, "approve", pendingApproval.logId); useWorkflowStore.setState({ pendingApproval: null }); }} className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg text-[10px] font-mono transition-colors cursor-pointer">Approve</button>
                  <button onClick={() => { sendApprovalResponse(pendingApproval.nodeId, pendingApproval.toolName, "deny", pendingApproval.logId); useWorkflowStore.setState({ pendingApproval: null }); }} className="px-4 py-2 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-lg text-[10px] font-mono transition-colors cursor-pointer">Deny</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
