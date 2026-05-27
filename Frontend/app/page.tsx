'use client';

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Zap,
  SquarePlus,
  Key,
  History,
  Settings,
  User,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  UploadCloud,
  Eye,
  Mic,
  GitFork,
  ArrowRight,
  Database,
  Sliders,
  X,
  Trash2,
  Globe,
  Terminal,
  Sparkles,
  Copy,
  Check,
  Square,
  DollarSign
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ReactFlowProvider } from '@xyflow/react';
import { useWorkflowStore, ChatSession, ChatMessage, AgentTalkLog } from "@/store/workflowStore";
import FlowArena from "@/components/FlowArena";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { useWebSocket } from "@/store/hooks/useWebSocket";
import CostDashboard from "@/components/CostDashboard";

// Simple streaming text component to avoid complete markdown parsing on every single token chunk
const StreamingText = ({ text, isActive }: { text: string; isActive: boolean }) => (
  <span className="whitespace-pre-wrap font-sans text-neutral-200">
    {text}
    {isActive && (
      <span className="ml-1 inline-block w-1.5 h-4 bg-white align-middle animate-blink" />
    )}
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
  // Store bindings
  const sessions = useWorkflowStore((s) => s.sessions);
  const activeSessionId = useWorkflowStore((s) => s.activeSessionId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const executionState = useWorkflowStore((s) => s.executionState);
  const isOrchestrating = useWorkflowStore((s) => s.isOrchestrating);
  const isThinking = useWorkflowStore((s) => s.isThinking);
  const statusMessage = useWorkflowStore((s) => s.statusMessage);
  const chatMessages = useWorkflowStore((s) => s.chatMessages);
  const agentTalkLogs = useWorkflowStore((s) => s.agentTalkLogs);
  const pendingApproval = useWorkflowStore((s) => s.pendingApproval);

  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const setExecutionState = useWorkflowStore((s) => s.setExecutionState);
  const updateNodeField = useWorkflowStore((s) => s.updateNodeField);
  const addRule = useWorkflowStore((s) => s.addRule);
  const deleteRule = useWorkflowStore((s) => s.deleteRule);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const liveThoughts = useWorkflowStore((s) => s.liveThoughts);
  const setApiKey = useWorkflowStore((s) => s.setApiKey);
  const apiKey = useWorkflowStore((s) => s.apiKey);
  const provider = useWorkflowStore((s) => s.provider);
  const model = useWorkflowStore((s) => s.model);
  const apiKeys = useWorkflowStore((s) => s.apiKeys);
  const availableProviders = useWorkflowStore((s) => s.availableProviders);
  const setProvider = useWorkflowStore((s) => s.setProvider);
  const setModel = useWorkflowStore((s) => s.setModel);
  const setProviderApiKey = useWorkflowStore((s) => s.setProviderApiKey);
  const loadPersistedKeys = useWorkflowStore((s) => s.loadPersistedKeys);
  const loadPersistedState = useWorkflowStore((s) => s.loadPersistedState);
  const fetchAvailableProviders = useWorkflowStore((s) => s.fetchAvailableProviders);
  const fallbackProvider = useWorkflowStore((s) => s.fallbackProvider);
  const providerBaseUrls = useWorkflowStore((s) => s.providerBaseUrls);
  const providerModels = useWorkflowStore((s) => s.providerModels);
  const setFallbackProvider = useWorkflowStore((s) => s.setFallbackProvider);
  const setProviderBaseUrl = useWorkflowStore((s) => s.setProviderBaseUrl);
  const fetchProviderModels = useWorkflowStore((s) => s.fetchProviderModels);

  const triggerSteerOrchestration = useWorkflowStore((s) => s.triggerSteerOrchestration);
  const setChatMessages = useWorkflowStore((s) => s.setChatMessages);
  const createSession = useWorkflowStore((s) => s.createSession);
  const switchSession = useWorkflowStore((s) => s.switchSession);
  const cancelOrchestration = useWorkflowStore((s) => s.cancelOrchestration);
  const followUpSuggestions = useWorkflowStore((s) => s.followUpSuggestions);
  const fetchSessions = useWorkflowStore((s) => s.fetchSessions);
  const loadSessionFromDb = useWorkflowStore((s) => s.loadSessionFromDb);
  const deleteSessionFromDb = useWorkflowStore((s) => s.deleteSessionFromDb);
  const forkSession = useWorkflowStore((s) => s.forkSession);
  const { isConnected, sendApprovalResponse } = useWebSocket(activeSessionId);

  const handleForkSession = async () => {
    if (!activeSessionId) return;
    const newId = await forkSession(activeSessionId);
    if (newId) {
      alert("Session successfully forked!");
    }
  };

  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const copyToClipboard = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    setShouldAutoScroll(isAtBottom);
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustTextareaHeight = () => {
    const tx = textareaRef.current;
    if (tx) {
      tx.style.height = "auto";
      tx.style.height = `${Math.min(tx.scrollHeight, 200)}px`;
    }
  };

  // Screen and Tab States
  const [workspaceState, setWorkspaceState] = useState<"home" | "active">("home");
  const [currentTab, setCurrentTab] = useState<"chat" | "arena">("chat");
  const [executionMode, setExecutionMode] = useState<"auto" | "custom">("auto");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState<boolean>(false);

  // Input fields
  const [userQuery, setUserQuery] = useState<string>("");
  const [attachedFileContent, setAttachedFileContent] = useState<string>("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const activeSession = activeSessionId ? sessions[activeSessionId] : null;
  const activePrompt = activeSession ? activeSession.prompt : "";
  const estimatedTokens = chatMessages.reduce((sum, m) => sum + Math.ceil((m.text?.length || 0) / 4), 0);
  const formattedTokens = estimatedTokens >= 1000 ? `${(estimatedTokens / 1000).toFixed(1)}k` : `${estimatedTokens}`;
  const estimatedCost = (estimatedTokens * 0.0005) / 1000;

  // Shortcuts overlay state
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Prompt Library state
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState<boolean>(false);
  const [prompts, setPrompts] = useState<Array<{ id: string; text: string; tag: string }>>([
    { id: "p1", text: "Create a complete Next.js contact form with Tailwind styling and API validation.", tag: "React" },
    { id: "p2", text: "Write a robust python script to scrape duckduckgo search results safely using beautifulsoup.", tag: "Python" },
    { id: "p3", text: "Explain the differences between SQL and NoSQL databases with performance tradeoffs.", tag: "Database" },
  ]);
  const [promptSearch, setPromptSearch] = useState<string>("");
  const [newPromptText, setNewPromptText] = useState<string>("");
  const [newPromptTag, setNewPromptTag] = useState<string>("");

  // Template Library state
  const [isTemplateLibOpen, setIsTemplateLibOpen] = useState<boolean>(false);

  // Cost Dashboard state
  const [isCostDashboardOpen, setIsCostDashboardOpen] = useState<boolean>(false);

  // Command Palette state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [commandPaletteSearch, setCommandPaletteSearch] = useState<string>("");

  // Voice Input state
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setUserQuery(prev => prev ? prev + " " + transcript : transcript);
      };

      recognition.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        setIsListening(false);
      }
    }
  };

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("solospace_prompt_library");
    if (saved) {
      try { setPrompts(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  const savePrompt = (text: string, tag: string) => {
    if (!text.trim()) return;
    const newPrompt = {
      id: `prompt-${Date.now()}`,
      text: text.trim(),
      tag: tag.trim() || "General",
    };
    const updated = [...prompts, newPrompt];
    setPrompts(updated);
    localStorage.setItem("solospace_prompt_library", JSON.stringify(updated));
    setNewPromptText("");
    setNewPromptTag("");
  };

  const deletePrompt = (id: string) => {
    const updated = prompts.filter(p => p.id !== id);
    setPrompts(updated);
    localStorage.setItem("solospace_prompt_library", JSON.stringify(updated));
  };

  const loadTemplate = (templateName: string) => {
    let newNodes: any[] = [];
    let newEdges: any[] = [];

    if (templateName === "Code Reviewer") {
      newNodes = [
        {
          id: "analyzer",
          type: "custom",
          position: { x: 100, y: 150 },
          data: { name: "Code Analyzer", tag: "ANALYZER", status: "IDLE", enabled: true, tools: ["Code Executor"], temp: 0.2, objective: "Analyze source code structure and locate syntax/logic errors.", systemPrompt: "You are a code analyzer.", rules: ["Focus on efficiency", "Suggest refactoring"], dependencies: [], toolPermissions: {} }
        },
        {
          id: "auditor",
          type: "custom",
          position: { x: 380, y: 150 },
          data: { name: "Security Auditor", tag: "AUDITOR", status: "IDLE", enabled: true, tools: ["API Connector"], temp: 0.2, objective: "Scan code for SSRF, SQL Injection, key leaks, and library vulnerabilities.", systemPrompt: "You are a security auditor.", rules: ["Be paranoid", "Check all external URLs"], dependencies: ["analyzer"], toolPermissions: {} }
        },
        {
          id: "reviewer",
          type: "custom",
          position: { x: 240, y: 350 },
          data: { name: "Senior Reviewer", tag: "REVIEWER", status: "IDLE", enabled: true, tools: ["Memory"], temp: 0.7, objective: "Synthesize insights and write a concise senior code review summary.", systemPrompt: "You are a senior reviewer.", rules: ["Provide code examples", "Suggest next steps"], dependencies: ["auditor"], toolPermissions: {} }
        }
      ];
      newEdges = [
        { id: "e-analyzer-auditor", source: "analyzer", target: "auditor", type: "custom", animated: true },
        { id: "e-auditor-reviewer", source: "auditor", target: "reviewer", type: "custom", animated: true }
      ];
    } else if (templateName === "Data Analyst") {
      newNodes = [
        {
          id: "scraper",
          type: "custom",
          position: { x: 100, y: 150 },
          data: { name: "Data Scraper", tag: "SCRAPER", status: "IDLE", enabled: true, tools: ["Web Search", "Browser"], temp: 0.3, objective: "Scrape reference pages and compile raw tables.", systemPrompt: "You are a data scraper.", rules: ["Use DDG search", "Clean raw html"], dependencies: [], toolPermissions: {} }
        },
        {
          id: "parser",
          type: "custom",
          position: { x: 380, y: 150 },
          data: { name: "Data Parser", tag: "PARSER", status: "IDLE", enabled: true, tools: ["Code Executor"], temp: 0.2, objective: "Parse tables, filter outliers, and run mathematical summaries.", systemPrompt: "You are a data parser.", rules: ["Use python pandas", "No external calls"], dependencies: ["scraper"], toolPermissions: {} }
        }
      ];
      newEdges = [
        { id: "e-scraper-parser", source: "scraper", target: "parser", type: "custom", animated: true }
      ];
    } else if (templateName === "Research Assistant") {
      newNodes = [
        {
          id: "researcher",
          type: "custom",
          position: { x: 100, y: 150 },
          data: { name: "Search Specialist", tag: "RESEARCH", status: "IDLE", enabled: true, tools: ["Web Search", "Browser"], temp: 0.5, objective: "Search topics, find verified citations, compile research document.", systemPrompt: "You are a research assistant.", rules: ["Verify claims", "Provide links"], dependencies: [], toolPermissions: {} }
        },
        {
          id: "writer",
          type: "custom",
          position: { x: 380, y: 150 },
          data: { name: "Synthesis Expert", tag: "WRITER", status: "IDLE", enabled: true, tools: ["Memory"], temp: 0.7, objective: "Summarize research and write a final comprehensive essay.", systemPrompt: "You are a synthesis writer.", rules: ["Structured Markdown", "Concise sections"], dependencies: ["researcher"], toolPermissions: {} }
        }
      ];
      newEdges = [
        { id: "e-researcher-writer", source: "researcher", target: "writer", type: "custom", animated: true }
      ];
    } else if (templateName === "Content Writer") {
      newNodes = [
        {
          id: "research",
          type: "custom",
          position: { x: 100, y: 150 },
          data: { name: "Topic Researcher", tag: "RESEARCH", status: "IDLE", enabled: true, tools: ["Web Search"], temp: 0.6, objective: "Research the given keyword and fetch top competitor structures.", systemPrompt: "You are a content researcher.", rules: ["Find top keywords", "No code execution"], dependencies: [], toolPermissions: {} }
        },
        {
          id: "writer",
          type: "custom",
          position: { x: 380, y: 150 },
          data: { name: "Draft Author", tag: "WRITER", status: "IDLE", enabled: true, tools: [], temp: 0.8, objective: "Write a high-quality blog draft using researched keywords.", systemPrompt: "You are a content writer.", rules: ["Engaging hook", "Conversational tone"], dependencies: ["research"], toolPermissions: {} }
        }
      ];
      newEdges = [
        { id: "e-research-writer", source: "research", target: "writer", type: "custom", animated: true }
      ];
    }

    setNodes(newNodes);
    setEdges(newEdges);
    alert(`Loaded "${templateName}" template into canvas!`);
  };

  // Keyboard Shortcuts Effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Escape") {
        setIsConfigPanelOpen(false);
        setIsSecretOpen(false);
        setIsProfileOpen(false);
        setIsShortcutsOpen(false);
        setIsPromptLibraryOpen(false);
        setIsTemplateLibOpen(false);
        setIsCostDashboardOpen(false);
        setIsCommandPaletteOpen(false);
        setSelectedNodeId(null);
      }

      if (cmdOrCtrl && e.key === "1") {
        e.preventDefault();
        setCurrentTab("chat");
      }

      if (cmdOrCtrl && e.key === "2") {
        e.preventDefault();
        setCurrentTab("arena");
      }

      if (cmdOrCtrl && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }

      if (e.key === "?" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [userQuery]);

  // API key — read directly from Zustand (not local state, to avoid disconnect)
  const [isSecretOpen, setIsSecretOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);

  // Tooltip helper state for collapsed sidebar
  const [hoveredSidebarItem, setHoveredSidebarItem] = useState<string | null>(null);

  // Node Configuration Panel
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState<boolean>(false);
  const [newRuleText, setNewRuleText] = useState<string>("");

  // Chat scroll ref
  const chatEndRef = useRef<HTMLDivElement>(null);

  // List of available tools in the Arena tool panel
  const toolsList = [
    { name: "Web Search", icon: <Globe className="w-4 h-4" />, desc: "Real-time Google search indices" },
    { name: "Memory", icon: <Database className="w-4 h-4" />, desc: "Persistent memory vector vault" },
    { name: "Browser", icon: <Eye className="w-4 h-4" />, desc: "Headless browser sandbox access" },
    { name: "File Upload", icon: <UploadCloud className="w-4 h-4" />, desc: "Parsing spreadsheet/code datasets" },
    { name: "Vision", icon: <Eye className="w-4 h-4" />, desc: "Image recognition & layout review" },
    { name: "Voice", icon: <Mic className="w-4 h-4" />, desc: "Acoustic synthesis & recognition" },
    { name: "Code Executor", icon: <Terminal className="w-4 h-4" />, desc: "Sandboxed node/python runs" },
    { name: "API Connector", icon: <GitFork className="w-4 h-4" />, desc: "Synchronize external webhooks" }
  ];

  // Sync config panel with selectedNodeId
  useEffect(() => {
    if (selectedNodeId) {
      setIsConfigPanelOpen(true);
    } else {
      setIsConfigPanelOpen(false);
    }
  }, [selectedNodeId]);

  // Synchronize modal's local display state when it opens
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string>("gemini");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [baseUrlInput, setBaseUrlInput] = useState<string>("");
  const [fallbackProviderInput, setFallbackProviderInput] = useState<string>("");
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [modelsFetchStatus, setModelsFetchStatus] = useState<string>("");
  const [useCustomModelId, setUseCustomModelId] = useState<boolean>(false);

  useEffect(() => {
    if (isSecretOpen) {
      setSelectedProvider(provider);
      setSelectedModel(model);
      setApiKeyInput(apiKeys[provider] || apiKey || "");
      setBaseUrlInput(providerBaseUrls[provider] || "");
      setFallbackProviderInput(fallbackProvider || "");
      setModelsFetchStatus("");

      const pConfig = availableProviders[provider];
      const modelsList = providerModels[provider] || pConfig?.models || [];
      const modelExists = modelsList.some((m: any) => m.id === model);
      setUseCustomModelId(model ? !modelExists : false);
    }
  }, [isSecretOpen, provider, model, apiKeys, apiKey, providerBaseUrls, fallbackProvider, availableProviders, providerModels]);

  // When selectedProvider changes, set selectedModel to its default model, and load key and base url
  useEffect(() => {
    if (isSecretOpen && availableProviders[selectedProvider]) {
      const pConfig = availableProviders[selectedProvider];
      const modelsList = providerModels[selectedProvider] || pConfig.models || [];
      const modelExists = modelsList.some((m: any) => m.id === selectedModel);
      if (!modelExists) {
        setSelectedModel(pConfig.default_model);
        const defaultExists = modelsList.some((m: any) => m.id === pConfig.default_model);
        setUseCustomModelId(!defaultExists);
      } else {
        setUseCustomModelId(false);
      }
      setApiKeyInput(apiKeys[selectedProvider] || "");
      setBaseUrlInput(providerBaseUrls[selectedProvider] || pConfig.base_url || "");
      setModelsFetchStatus("");
    }
  }, [selectedProvider, availableProviders, providerModels]);

  // Scroll helper
  const scrollToBottom = () => {
    if (shouldAutoScroll) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Auto-scroll chat to bottom if enabled
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isThinking, shouldAutoScroll]);

  // Auto-scroll when chat tab becomes active
  useEffect(() => {
    if (workspaceState === "active" && currentTab === "chat") {
      scrollToBottom();
    }
  }, [currentTab, workspaceState]);

  // Reset to home when active session is deleted
  useEffect(() => {
    if (workspaceState === "active" && activeSessionId === null) {
      setWorkspaceState("home");
      setCurrentTab("chat");
      setUserQuery("");
    }
  }, [activeSessionId, workspaceState]);

  // Load sessions and available providers from DB on mount
  useEffect(() => {
    const init = async () => {
      await loadPersistedState();
      await fetchSessions().catch(e => console.error("Failed to load sessions:", e));
      await fetchAvailableProviders().catch(e => console.error("Failed to load providers:", e));
      await loadPersistedKeys().catch(e => console.error("Failed to load persisted keys:", e));
    };
    init();
  }, []);

  // Handle sidebar collapse on mobile/tablet widths (<768px)
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsSidebarExpanded(!mobile);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleCloseConfigPanel = () => {
    setIsConfigPanelOpen(false);
    setSelectedNodeId(null);
  };

  // Orchestrator — always stays in chat first
  const startOrchestration = (promptText: string) => {
    if (!promptText.trim()) return;
    setWorkspaceState("active");
    setCurrentTab("chat"); // ALWAYS stay in chat

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = createSession(promptText, executionMode === "quick" ? "quick" : executionMode === "custom" ? "custom" : "auto");
    }

    setExecutionState("running");
    triggerSteerOrchestration(promptText, executionMode !== "custom", executionMode);
    setUserQuery("");
  };

  // Node editing actions
  const handleAddRule = () => {
    if (!newRuleText.trim() || !selectedNodeId) return;
    addRule(selectedNodeId, newRuleText.trim());
    setNewRuleText("");
  };

  const handleDeleteRule = (ruleIndex: number) => {
    if (!selectedNodeId) return;
    deleteRule(selectedNodeId, ruleIndex);
  };

  const activeNodeDetail = nodes.find(n => n.id === selectedNodeId) as any;

  // DeepSeek-style mode toggle buttons
  const ModeSelector = () => (
    <div className="flex items-center gap-1 bg-neutral-900/40 rounded-full p-0.5 border border-[#1f1f1f]">
      <button
        onClick={() => setExecutionMode("auto")}
        className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold transition-all ${
          executionMode === "auto"
            ? "bg-white text-black shadow-md"
            : "text-neutral-400 hover:text-white"
        }`}
      >
        Smart
      </button>
      <button
        onClick={() => setExecutionMode("custom")}
        className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold transition-all ${
          executionMode === "custom"
            ? "bg-white text-black shadow-md"
            : "text-neutral-400 hover:text-white"
        }`}
      >
        Custom
      </button>
    </div>
  );

  const handleFileAttach = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.json,.csv,.py,.js,.ts,.tsx,.html,.css,.yaml,.yml,.xml,.ini,.cfg,.pdf,.jpg,.png";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setAttachedFile(file);

      const textExtensions = ['.txt', '.md', '.json', '.csv', '.py', '.js', '.ts', '.tsx', '.html', '.css', '.yaml', '.yml', '.xml', '.ini', '.cfg'];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (textExtensions.includes(ext) || file.type.indexOf("text/") === 0) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setUserQuery((prev) => prev + `\n\n[Attached: ${file.name}]\n${content}\n`);
          setAttachedFileContent(content);
        };
        reader.readAsText(file);
      } else {
        alert(`File "${file.name}" attached successfully! Note: PDF and image content will not be injected directly into the prompt text but will be uploaded once backend file tools are fully configured.`);
      }
    };
    input.click();
  };

  // ── Thinking indicator bubble
  const ThinkingBubble = () => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex flex-col gap-1.5 py-2 px-1"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 italic">Thinking</span>
        <span className="flex gap-1">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
            />
          ))}
        </span>
      </div>
      {statusMessage && (
        <span className="text-[10px] font-mono text-neutral-600 pl-0.5 truncate max-w-sm">
          {statusMessage}
        </span>
      )}
      {liveThoughts && (
        <div className="mt-1 text-[10px] text-neutral-500 font-sans leading-relaxed max-w-lg whitespace-pre-wrap border-l-2 border-neutral-800 pl-2">
          {liveThoughts.slice(-400)}
        </div>
      )}
    </motion.div>
  );

  // ── Collapsible agent trace (real data from backend)
  const AgentTraceBlock = ({ logs, thinkingSummary }: { logs: AgentTalkLog[], thinkingSummary?: string }) => {
    if (logs.length === 0 && !thinkingSummary) return null;
    return (
      <div className="border border-[#1f1f1f] rounded-xl overflow-hidden bg-[#050505] mt-3 max-w-2xl w-full">
        <details className="group" open>
          <summary className="flex items-center justify-between p-3 cursor-pointer select-none text-[11px] font-semibold text-neutral-500 hover:text-white hover:bg-neutral-900/40 transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-neutral-500 group-hover:text-cyan-400 transition-colors" />
              <span className="font-mono text-[10px] tracking-wider uppercase">Agent Trace & Thinking</span>
            </div>
            <div className="flex items-center gap-2">
              {logs.length > 0 && <span className="text-[9px] text-neutral-600 font-mono">{logs.length} specialist{logs.length !== 1 ? "s" : ""}</span>}
              <ChevronRight className="w-3.5 h-3.5 text-neutral-600 group-open:rotate-90 transition-transform" />
            </div>
          </summary>
          <div className="border-t border-[#1f1f1f] p-3 space-y-3 bg-[#030303]">
            {thinkingSummary && (
              <div className="space-y-1.5 pb-2 border-b border-[#0d0d0d] last:border-0 last:pb-0">
                <span className="text-[9px] font-mono text-neutral-500 font-bold uppercase tracking-wider">Reasoning Process</span>
                <p className="text-[11px] text-neutral-400 leading-relaxed font-sans whitespace-pre-wrap">
                  {thinkingSummary}
                </p>
              </div>
            )}
            {logs.map((log) => (
              <div key={log.id} className="flex gap-2 items-start text-[10.5px] leading-relaxed border-b border-[#0d0d0d] pb-2 last:border-0 last:pb-0">
                <div className="w-5 h-5 rounded-md bg-neutral-900 flex items-center justify-center border border-white/5 shrink-0 select-none text-[10px] font-mono text-neutral-400">
                  {log.senderIcon === "science" ? "[S]" : log.senderIcon === "code" ? "[C]" : log.senderIcon === "trending_up" ? "[T]" : log.senderIcon === "present_to_all" ? "[U]" : "[G]"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline select-none">
                    <span className="font-bold text-white uppercase tracking-wider text-[8.5px] leading-none">{log.senderName}</span>
                    <span className="text-[7.5px] text-neutral-600 font-mono leading-none">{log.timestamp}</span>
                  </div>
                  <p className="text-neutral-400 mt-0.5 font-sans leading-relaxed">{log.text}</p>
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full bg-black text-[#f5f5f5] overflow-hidden font-sans relative">
      {/* Mobile Sidebar Overlay */}
      {isMobile && isSidebarExpanded && (
        <div
          onClick={() => setIsSidebarExpanded(false)}
          className="fixed inset-0 bg-black/60 z-35 animate-fade-in"
        />
      )}

      {/* Floating Hamburger Button for Mobile */}
      {isMobile && !isSidebarExpanded && (
        <button
          onClick={() => setIsSidebarExpanded(true)}
          className="fixed top-4 left-4 z-40 p-2 bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl hover:bg-neutral-800 text-white cursor-pointer shadow-lg active:scale-95 transition-all"
          title="Open Menu"
        >
          <Bot className="w-5 h-5" />
        </button>
      )}

      <aside
        className={`flex flex-col h-full bg-[#0d0d0d] border-r border-[#1f1f1f] shrink-0 transition-all duration-300 z-40 select-none ${
          isMobile
            ? (isSidebarExpanded ? "fixed inset-y-0 left-0 w-64 shadow-2xl" : "fixed inset-y-0 left-0 w-0 -translate-x-full overflow-hidden")
            : (isSidebarExpanded ? "w-64" : "w-[60px]")
        }`}
        onClick={(e) => {
          if (!isSidebarExpanded) {
            const target = e.target as HTMLElement;
            if (!target.closest('button, a, input')) {
              setIsSidebarExpanded(true);
            }
          }
        }}
      >
        {/* Top Header Area */}
        <div className="flex items-center gap-3 h-16 border-b border-[#1f1f1f] px-4 justify-between">
          {isSidebarExpanded ? (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
                <Bot className="w-4 h-4 text-black stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight leading-none">Solospace</h1>
              </div>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center mx-auto">
              <Bot className="w-4 h-4 text-black stroke-[2.5]" />
            </div>
          )}
          {isSidebarExpanded && (
            <button
              onClick={() => setIsSidebarExpanded(false)}
              className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sidebar Nav Buttons */}
        <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto custom-scrollbar">



          {/* New Chat Button */}
          <button
            id="new-chat-btn"
            onClick={() => {
              const ctrl = useWorkflowStore.getState().abortController;
              if (ctrl) ctrl.abort();

              setWorkspaceState("home");
              setUserQuery("");
              useWorkflowStore.setState({
                activeSessionId: null,
                nodes: [],
                edges: [],
                chatMessages: [],
                agentTalkLogs: [],
                executionState: "setup",
                statusMessage: "",
                isThinking: false,
                isOrchestrating: false,
                liveThoughts: "",
                pendingApproval: null,
                followUpSuggestions: [],
                abortController: null
              });
            }}
            onMouseEnter={() => setHoveredSidebarItem("New Chat")}
            onMouseLeave={() => setHoveredSidebarItem(null)}
            className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${
              isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
            }`}
          >
            <SquarePlus className="w-5 h-5 stroke-[1.8]" />
            {isSidebarExpanded && <span className="text-xs font-semibold">New Chat</span>}
            {!isSidebarExpanded && hoveredSidebarItem === "New Chat" && (
              <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
                New Chat
              </div>
            )}
          </button>

          {/* BYOK Button */}
          <button
            id="byok-sidebar-btn"
            onClick={() => setIsSecretOpen(true)}
            onMouseEnter={() => setHoveredSidebarItem("BYOK")}
            onMouseLeave={() => setHoveredSidebarItem(null)}
            className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${
              isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
            }`}
          >
            <Key className="w-5 h-5 stroke-[1.8]" />
            {isSidebarExpanded && <span className="text-xs font-semibold">API Keys</span>}
            {!isSidebarExpanded && hoveredSidebarItem === "BYOK" && (
              <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
                Bring Your Own Key
              </div>
            )}
          </button>

          {/* Recents Log */}
          {isSidebarExpanded && (
            <div className="pt-6 space-y-2 select-none">
              <div className="flex items-center gap-1.5 px-3">
                <History className="w-3.5 h-3.5 text-neutral-600" />
                <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest font-mono">Recents</span>
              </div>
              <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar">
                {Object.values(sessions).length === 0 ? (
                  <span className="text-[10px] text-neutral-600 italic px-3 block pt-1">No chats yet.</span>
                ) : (
                  Object.values(sessions).reverse().map((s) => (
                    <div key={s.id} className="group/session flex items-center justify-between px-2 py-1 rounded-md hover:bg-neutral-900 transition-colors">
                      <button
                        disabled={isLoadingSession}
                        onClick={async () => {
                          setIsLoadingSession(true);
                          try {
                            await loadSessionFromDb(s.id);
                            setWorkspaceState("active");
                            setCurrentTab("chat");
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setIsLoadingSession(false);
                          }
                        }}
                        className={`text-left text-xs truncate font-medium flex-1 cursor-pointer transition-colors ${
                          activeSessionId === s.id
                            ? "text-white font-bold"
                            : "text-neutral-500 hover:text-white"
                        }`}
                        title={s.prompt}
                      >
                        {s.title}
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete "${s.title}"?`)) {
                            await deleteSessionFromDb(s.id);
                          }
                        }}
                        className="opacity-0 group-hover/session:opacity-100 p-1 text-neutral-600 hover:text-rose-400 rounded transition-opacity cursor-pointer"
                        title="Delete Chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-2 border-t border-[#1f1f1f] space-y-1 select-none">
          <button
            onClick={() => setIsSecretOpen(true)}
            className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
              isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
            }`}
          >
            <Settings className="w-4 h-4" />
            {isSidebarExpanded && <span className="text-xs">Engine Settings</span>}
          </button>
          
          <button
            onClick={() => setIsPromptLibraryOpen(true)}
            className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
              isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
            }`}
          >
            <History className="w-4 h-4" />
            {isSidebarExpanded && <span className="text-xs">Prompt Library</span>}
          </button>
          <button
            onClick={() => setIsCostDashboardOpen(true)}
            className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
              isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-500" />
            {isSidebarExpanded && <span className="text-xs">Cost Dashboard</span>}
          </button>
          <button
            onClick={() => setIsProfileOpen(true)}
            className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
              isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-700">
              <User className="w-3.5 h-3.5 text-neutral-300" />
            </div>
            {isSidebarExpanded && <span className="text-xs truncate font-medium">Profile</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#000000] relative transition-all duration-300">

        {/* Header */}
        <header className="flex justify-between items-center w-full px-6 h-16 border-b border-[#141414] shrink-0 z-10 bg-black/85 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {workspaceState === "active" && activeSession && (
              <>
                <Bot className="w-5 h-5 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-neutral-300 truncate max-w-[200px]" title={activeSession.title}>
                  {activeSession.title}
                </span>
                <button
                  onClick={handleForkSession}
                  className="p-1 text-neutral-500 hover:text-white rounded hover:bg-neutral-900 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-mono"
                  title="Fork (duplicate) this session"
                >
                  <GitFork className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Fork</span>
                </button>
              </>
            )}
          </div>

          {/* Tab Switcher — Chat always left, Flow/Arena only visible when complex task ran */}
          <div className="flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-[2px] rounded-full select-none">
            <button
              id="tab-chat"
              onClick={() => {
                if (workspaceState === "home") return;
                setCurrentTab("chat");
              }}
              className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                currentTab === "chat" || workspaceState === "home"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Chat
            </button>
            {/* Flow tab only shown when complex task (nodes exist) */}
            {workspaceState === "active" && (
              <button
                id="tab-flow"
                onClick={() => setCurrentTab("arena")}
                className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  currentTab === "arena"
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <GitFork className="w-3 h-3" />
                Flow
                {nodes.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse ml-0.5" />
                )}
              </button>
            )}
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-4 select-none">
            <button
              onClick={() => alert("Solospace — AI-powered assistant. Enter any prompt to get a complete, detailed response. For complex tasks, use the Flow tab to inspect the multi-agent pipeline.")}
              className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 stroke-[1.8]" />
            </button>
          </div>
        </header>

        {/* View Layout */}
        <div className="flex-1 relative overflow-hidden">

          {/* A. HOME SCREEN */}
          {workspaceState === "home" && (
            <div className="absolute inset-0 flex flex-col justify-between overflow-y-auto custom-scrollbar">
              <div />
              <div className="w-full max-w-2xl mx-auto px-6 py-12 flex flex-col items-center">
                <div className="text-center mb-10 space-y-2 select-none">
                  <h1 className="text-4xl font-extrabold tracking-tight text-white antialiased">
                    What&apos;s on your mind?
                  </h1>
                  <p className="text-sm text-neutral-400 font-sans">
                    Ask anything. Get a real, complete answer instantly.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="w-full chatgpt-input-box rounded-[24px] p-2 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleFileAttach}
                      className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors shrink-0 cursor-pointer"
                      title="Attach File"
                    >
                      <UploadCloud className="w-5 h-5 stroke-[1.8]" />
                    </button>
                    <textarea
                      id="home-prompt-input"
                      rows={1}
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      onKeyDown={(e) => {
                        const isCmdEnter = e.key === "Enter" && (e.ctrlKey || e.metaKey);
                        const isPlainEnter = e.key === "Enter" && !e.shiftKey;
                        if (isPlainEnter || isCmdEnter) {
                          e.preventDefault();
                          if (userQuery.trim()) startOrchestration(userQuery);
                        }
                      }}
                      placeholder="Describe your idea, problem, or question..."
                      className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 resize-none py-1.5 custom-scrollbar"
                      style={{ maxHeight: "150px" }}
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={toggleVoiceInput}
                        className={`p-2 rounded-full transition-colors cursor-pointer ${
                          isListening 
                            ? "text-red-500 bg-red-500/10 hover:bg-red-500/20" 
                            : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900"
                        }`}
                        title={isListening ? "Stop listening" : "Voice Input"}
                      >
                        <Mic className={`w-5 h-5 stroke-[1.8] ${isListening ? "animate-pulse" : ""}`} />
                      </button>
                      <button
                        id="home-send-btn"
                        onClick={() => startOrchestration(userQuery)}
                        disabled={!userQuery.trim()}
                        className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all font-semibold cursor-pointer"
                        title="Send prompt"
                      >
                        <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center gap-3 mt-5 select-none">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Mode:</span>
                  <button
                    onClick={() => setExecutionMode("auto")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
                      executionMode === "auto"
                        ? "bg-white text-black border-white font-bold"
                        : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
                    }`}
                  >
                    <Sparkles className="w-3 h-3 stroke-[2]" />
                    <span>Smart Agent</span>
                  </button>
                  <button
                    onClick={() => setExecutionMode("custom")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
                      executionMode === "custom"
                        ? "bg-white text-black border-white font-bold"
                        : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
                    }`}
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Custom Agent</span>
                  </button>
                </div>
              </div>
              <div />
            </div>
          )}

          {/* B. ACTIVE WORKSPACE */}
          {workspaceState === "active" && (
            <div className="absolute inset-0 flex">

              {/* VIEW 1: CHAT (Primary — always shown first) */}
              {currentTab === "chat" && (
                <div className="flex-1 flex flex-col justify-between overflow-hidden bg-black">

                  {/* Chat messages */}
                  <div
                    ref={chatContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4"
                  >
                    {isLoadingSession ? (
                      <div className="max-w-3xl mx-auto space-y-6 py-4">
                        <div className="flex gap-4 items-start py-6 border-b border-[#141414] animate-pulse">
                          <div className="w-8 h-8 rounded-full bg-neutral-900 border border-white/5 shrink-0 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-neutral-700" />
                          </div>
                          <div className="flex-1 space-y-2.5 pt-1">
                            <div className="h-3.5 bg-neutral-900 rounded w-1/4" />
                            <div className="h-3 bg-neutral-900 rounded w-3/4" />
                          </div>
                        </div>
                        <div className="flex gap-4 items-start py-6 border-b border-[#141414] animate-pulse">
                          <div className="w-8 h-8 rounded-full bg-neutral-900 border border-white/5 shrink-0 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-neutral-700" />
                          </div>
                          <div className="flex-1 space-y-2.5 pt-1">
                            <div className="h-3.5 bg-neutral-900 rounded w-1/3" />
                            <div className="h-3 bg-neutral-900 rounded w-5/6" />
                            <div className="h-3 bg-neutral-900 rounded w-2/3" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto space-y-4 select-text">

                      {chatMessages.map((msg, msgIdx) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {msg.sender === "user" ? (
                            <div className="max-w-[72%] rounded-3xl px-5 py-3 bg-[#2f2f2f] text-neutral-100 text-sm leading-relaxed">
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          ) : (
                            <div className="flex-1 max-w-[88%] flex flex-col items-start space-y-1">
                              <div className="w-full text-neutral-100 text-sm leading-relaxed px-1 py-2">
                                {isOrchestrating && msgIdx === chatMessages.length - 1 ? (
                                  <StreamingText 
                                    text={msg.text} 
                                    isActive={isOrchestrating && msgIdx === chatMessages.length - 1}
                                  />
                                ) : (
                                  <MarkdownRenderer content={msg.text || ""} />
                                )}
                                
                                {/* Action Buttons for AI Response */}
                                {msg.text && (!isOrchestrating || msgIdx !== chatMessages.length - 1) && (
                                  <div className="flex items-center gap-3 mt-4 text-neutral-500 select-none">
                                    <button
                                      onClick={() => copyToClipboard(msg.text, msg.id)}
                                      className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800"
                                      title="Copy response"
                                    >
                                      {copiedMsgId === msg.id ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                                          <span className="text-emerald-400 font-medium">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>Copy</span>
                                        </>
                                      )}
                                    </button>
                                    {msgIdx === chatMessages.length - 1 && !isThinking && !isOrchestrating && (
                                      <button
                                        onClick={() => {
                                          const lastUser = chatMessages.slice().reverse().find(m => m.sender === "user");
                                          if (lastUser) {
                                            setChatMessages(prev => {
                                              const lastAiIdx = prev.map((m, i) => m.sender === 'ai' ? i : -1).filter(i => i >= 0).pop();
                                              if (lastAiIdx !== undefined) {
                                                return prev.filter((_, i) => i !== lastAiIdx);
                                              }
                                              return prev;
                                            });
                                            startOrchestration(lastUser.text);
                                          }
                                        }}
                                        className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800"
                                        title="Regenerate response"
                                      >
                                        <Zap className="w-3.5 h-3.5" />
                                        <span>Regenerate</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Collapsible trace block and see flow buttons outside bubble */}
                              {msgIdx === chatMessages.length - 1 && (
                                <div className="space-y-3 pt-1 w-full">
                                  <AgentTraceBlock
                                    logs={agentTalkLogs}
                                    thinkingSummary={msg.thinkingSummary}
                                  />
                                  
                                  {!isThinking && !isOrchestrating && nodes.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      <button
                                        id="see-flow-btn"
                                        onClick={() => setCurrentTab("arena")}
                                        className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-cyan-500/40 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer max-w-max select-none"
                                      >
                                        <GitFork className="w-3.5 h-3.5 text-cyan-400" />
                                        <span>See Agent Flow</span>
                                        <span className="text-[9px] font-mono text-neutral-600">({nodes.length} agents)</span>
                                      </button>

                                      {executionMode === "custom" && (
                                        <button
                                          onClick={() => setCurrentTab("arena")}
                                          className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-neutral-500 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer max-w-max select-none"
                                        >
                                          <Sliders className="w-3.5 h-3.5" />
                                          <span>Customize Agents</span>
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {!isThinking && !isOrchestrating && followUpSuggestions && followUpSuggestions.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2 select-none">
                                      <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider self-center">Suggestions:</span>
                                      {followUpSuggestions.map((suggestion, idx) => (
                                        <button
                                          key={idx}
                                          onClick={() => {
                                            setUserQuery(suggestion);
                                            startOrchestration(suggestion);
                                          }}
                                          className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-cyan-500/30 rounded-full text-[10px] text-neutral-400 hover:text-white transition-all cursor-pointer animate-fade-in"
                                        >
                                          {suggestion}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ))}

                      {/* Thinking indicator */}
                      <AnimatePresence>
                        {isThinking && <ThinkingBubble />}
                      </AnimatePresence>

                      {/* Auto-scroll anchor */}
                      <div ref={chatEndRef} />
                    </div>
                    )}
                  </div>

                  {/* Bottom input bar */}
                  <div className="px-4 sm:px-6 py-4 bg-black/60 border-t border-[#141414] backdrop-blur-xl shrink-0 flex flex-col gap-2">
                    {executionMode === "custom" && workspaceState === "active" && (
                      <div className="text-[10px] font-mono text-amber-400 bg-amber-950/30 px-3 py-1 rounded-full self-center border border-amber-500/20 max-w-max select-none">
                        Planning Mode – Edit agents in Flow, then click Proceed
                      </div>
                    )}
                    <div className="max-w-3xl mx-auto w-full chatgpt-input-box rounded-[24px] p-1.5 flex items-center gap-2">
                      <button
                        id="attach-file-btn"
                        onClick={handleFileAttach}
                        className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors shrink-0 cursor-pointer"
                        title="Attach File"
                      >
                        <UploadCloud className="w-5 h-5 stroke-[1.8]" />
                      </button>
                      {chatMessages.length > 0 && (
                        <div className="flex items-center gap-1.5 shrink-0 select-none">
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950/80 border border-[#1f1f1f] px-2 py-0.5 rounded-full" title="Estimated history token usage">
                            ~{formattedTokens} tokens
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 px-2 py-0.5 rounded-full" title="Estimated session cost">
                            ${estimatedCost.toFixed(4)}
                          </span>
                        </div>
                      )}

                      <textarea
                        ref={textareaRef}
                        id="chat-prompt-input"
                        rows={1}
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        onKeyDown={(e) => {
                          const isCmdEnter = e.key === "Enter" && (e.ctrlKey || e.metaKey);
                          const isPlainEnter = e.key === "Enter" && !e.shiftKey;
                          if (isPlainEnter || isCmdEnter) {
                            e.preventDefault();
                            if (!isOrchestrating && userQuery.trim()) startOrchestration(userQuery);
                          }
                        }}
                        placeholder={isOrchestrating ? "Streaming response..." : (executionMode === "auto" ? "Ask a follow-up or new question..." : executionMode === "quick" ? "Ask a quick question directly..." : "Enter a new idea to generate agents (no auto-run)...")}
                        disabled={isOrchestrating}
                        className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 px-3 py-1.5 disabled:opacity-50 resize-none max-h-40 custom-scrollbar"
                      />

                      <div className="flex items-center gap-2 shrink-0">
                        <ModeSelector />

                        <button
                          onClick={toggleVoiceInput}
                          className={`p-2 rounded-full transition-colors cursor-pointer ${
                            isListening 
                              ? "text-red-500 bg-red-500/10 hover:bg-red-500/20" 
                              : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900"
                          }`}
                          title={isListening ? "Stop listening" : "Voice Input"}
                        >
                          <Mic className={`w-5 h-5 stroke-[1.8] ${isListening ? "animate-pulse" : ""}`} />
                        </button>

                        {isOrchestrating ? (
                          <button
                            onClick={cancelOrchestration}
                            className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-500 active:scale-95 transition-all cursor-pointer"
                            title="Stop generating"
                          >
                            <Square className="w-3.5 h-3.5 text-white fill-white" />
                          </button>
                        ) : (
                          <button
                            id="chat-send-btn"
                            onClick={() => startOrchestration(userQuery)}
                            disabled={!userQuery.trim() || isThinking}
                            className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all cursor-pointer"
                            title="Send message"
                          >
                            <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: ARENA CANVAS (Optional — Flow inspection/editing) */}
              {currentTab === "arena" && (
                <div className="flex-1 relative overflow-hidden bg-[#000000] flex">

                  {/* Back to chat bar at top */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#0d0d0d]/90 border border-[#1f1f1f] rounded-full px-4 py-2 backdrop-blur-md shadow-xl pointer-events-auto">
                    <button
                      onClick={() => setCurrentTab("chat")}
                      className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer font-mono"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Back to Chat
                    </button>
                    <span className="text-neutral-700 text-xs">|</span>
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                      Agent Flow — {nodes.length} active
                    </span>
                    <span className="text-neutral-700 text-xs">|</span>
                    <button
                      onClick={() => setIsTemplateLibOpen(true)}
                      className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" /> Template Library
                    </button>
                  </div>

                  {/* FLOATING LEFT SIDE Arena Tools Panel */}
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col bg-[#0d0d0d]/80 border border-[#1f1f1f] p-1.5 rounded-xl z-20 backdrop-blur-md shadow-2xl">
                    <div className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest px-2 pb-2 text-center select-none border-b border-[#141414] mb-2 font-bold">
                      Tools
                    </div>
                    {toolsList.map((tool) => (
                      <div
                        key={tool.name}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("toolName", tool.name)}
                        className="p-2.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-900 transition-all cursor-grab active:cursor-grabbing flex items-center justify-center relative group"
                      >
                        {tool.icon}
                        <div className="absolute left-12 bg-[#0c0c0c] border border-[#1f1f1f] p-2.5 rounded-lg text-left hidden group-hover:block w-40 z-30 shadow-2xl pointer-events-none">
                          <h4 className="text-[10px] font-bold text-white">{tool.name}</h4>
                          <p className="text-[9px] text-neutral-400 mt-0.5 leading-relaxed">{tool.desc}</p>
                          <span className="text-[8px] font-mono text-neutral-600 block mt-1.5 italic">Drag onto agent node</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Flow Arena */}
                  <FlowArena />

                  {/* Bottom controls — Proceed & Return to Chat */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-3 font-semibold select-none">
                    <button
                      disabled={isOrchestrating}
                      onClick={async () => {
                        if (isOrchestrating) return;
                        // Bug 11: Immediately set orchestrating to prevent double-fire before async fn sets it
                        useWorkflowStore.setState({ isOrchestrating: true });
                        setCurrentTab("chat"); // Switch back to chat to see the output stream
                        const triggerCustomExecution = useWorkflowStore.getState().triggerCustomExecution;
                        await triggerCustomExecution();
                      }}
                      className="bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-bold text-xs h-10 px-6 rounded-[24px] shadow-2xl flex items-center gap-1.5 cursor-pointer shrink-0 transition-all active:scale-95 disabled:scale-100 disabled:cursor-not-allowed"
                    >
                      {isOrchestrating ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-neutral-500 border-t-neutral-200 rounded-full animate-spin" />
                          <span>Running Flow...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-black fill-black" />
                          <span>Proceed with Agents</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setCurrentTab("chat")}
                      className="h-10 px-4 rounded-[24px] border border-[#1f1f1f] hover:border-neutral-600 bg-black/80 backdrop-blur-md text-neutral-400 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-2xl"
                    >
                      Return to Chat
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 3. RIGHT Sliding Configuration Edit Panel */}
      {currentTab === "arena" && (
        <div
          className={`fixed top-0 right-0 h-full w-80 bg-[#0c0c0c]/95 border-l border-[#1f1f1f] z-40 flex flex-col justify-between shadow-2xl transition-transform duration-300 right-panel select-none ${
            isConfigPanelOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
        <button
          onClick={handleCloseConfigPanel}
          className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-[#0c0c0c]/95 border border-[#1f1f1f] border-r-0 rounded-l-xl flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          {isConfigPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {activeNodeDetail ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="p-5 border-b border-[#1f1f1f] flex justify-between items-center bg-[#0d0d0d]">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{activeNodeDetail.data.name}</h3>
                <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest block mt-0.5">{activeNodeDetail.data.tag}</span>
              </div>
              <button onClick={handleCloseConfigPanel} className="text-neutral-500 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
              {/* Enable/Disable toggle */}
              <div className="flex items-center justify-between bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Active</span>
                  <span className="text-[9px] text-neutral-500 mt-0.5">Disable to exclude from pipeline</span>
                </div>
                <button
                  onClick={() => updateNodeField(activeNodeDetail.id, { enabled: !activeNodeDetail.data.enabled })}
                  className={`w-10 h-5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${activeNodeDetail.data.enabled ? "bg-white" : "bg-neutral-800"}`}
                >
                  <div className={`w-4 h-4 rounded-full transition-transform ${activeNodeDetail.data.enabled ? "bg-black translate-x-5" : "bg-neutral-600 translate-x-0"}`} />
                </button>
              </div>

              {/* Priority Slider */}
              <div className="space-y-1 bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
                <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
                  <span>Priority</span>
                  <span className="text-white">Level {activeNodeDetail.data.priority}</span>
                </div>
                <input
                  type="range" min="1" max="10" step="1"
                  value={activeNodeDetail.data.priority}
                  onChange={(e) => updateNodeField(activeNodeDetail.id, { priority: parseInt(e.target.value) })}
                  className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer mt-2"
                />
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Agent Name</label>
                <input
                  type="text" value={activeNodeDetail.data.name}
                  onChange={(e) => updateNodeField(activeNodeDetail.id, { name: e.target.value })}
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
                />
              </div>

              {/* Output Schema */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Output Schema (JSON)</label>
                <textarea
                  placeholder='e.g. { "type": "object", "properties": { "result": { "type": "string" } } }'
                  value={activeNodeDetail.data.outputSchema || ""}
                  onChange={(e) => updateNodeField(activeNodeDetail.id, { outputSchema: e.target.value })}
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-2.5 text-xs text-white focus:border-neutral-500 outline-none font-mono min-h-[60px] resize-none leading-relaxed"
                />
              </div>

              {/* Memory Scope & Timeout */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Memory Scope</label>
                  <select
                    value={activeNodeDetail.data.memoryScope || "session"}
                    onChange={(e) => updateNodeField(activeNodeDetail.id, { memoryScope: e.target.value })}
                    className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2 py-1.5 text-xs text-white focus:border-neutral-500 outline-none"
                  >
                    <option value="session">Session</option>
                    <option value="global">Global</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Timeout (sec)</label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={activeNodeDetail.data.timeout || 60}
                    onChange={(e) => updateNodeField(activeNodeDetail.id, { timeout: parseInt(e.target.value) || 60 })}
                    className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-neutral-500 outline-none"
                  />
                </div>
              </div>

              {/* Cost Budget & Retry Policy */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Cost Budget ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.00"
                    max="5.00"
                    value={activeNodeDetail.data.costBudget || 0.05}
                    onChange={(e) => updateNodeField(activeNodeDetail.id, { costBudget: parseFloat(e.target.value) || 0.05 })}
                    className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-neutral-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Retry Policy</label>
                  <select
                    value={activeNodeDetail.data.retryPolicy || "1"}
                    onChange={(e) => updateNodeField(activeNodeDetail.id, { retryPolicy: e.target.value })}
                    className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2 py-1.5 text-xs text-white focus:border-neutral-500 outline-none"
                  >
                    <option value="none">No Retries</option>
                    <option value="1">1 Retry</option>
                    <option value="2">2 Retries</option>
                    <option value="3">3 Retries</option>
                  </select>
                </div>
              </div>

              {/* Few Shot Examples */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Few-Shot Examples</label>
                <textarea
                  placeholder='e.g. Input: "Hello" -> Output: "World"'
                  value={activeNodeDetail.data.fewShot || ""}
                  onChange={(e) => updateNodeField(activeNodeDetail.id, { fewShot: e.target.value })}
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-2.5 text-xs text-white focus:border-neutral-500 outline-none min-h-[60px] resize-none leading-relaxed"
                />
              </div>

              {/* System Prompt */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">System Prompt</label>
                <textarea
                  value={activeNodeDetail.data.systemPrompt}
                  onChange={(e) => updateNodeField(activeNodeDetail.id, { systemPrompt: e.target.value })}
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[80px] resize-none leading-relaxed"
                />
              </div>

              {/* Goal Objective */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Objective</label>
                <textarea
                  value={activeNodeDetail.data.objective}
                  onChange={(e) => updateNodeField(activeNodeDetail.id, { objective: e.target.value })}
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[60px] resize-none leading-relaxed"
                />
              </div>

              {/* Rules */}
              <div className="space-y-2">
                <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold block">Rules</label>
                <div className="space-y-1.5">
                  {activeNodeDetail.data.rules && activeNodeDetail.data.rules.map((rule: any, idx: number) => (
                    <div key={idx} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
                      <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">{rule}</span>
                      <button onClick={() => handleDeleteRule(idx)} className="text-neutral-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text" value={newRuleText}
                    onChange={(e) => setNewRuleText(e.target.value)}
                    placeholder="Add constraint..."
                    className="flex-1 bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-neutral-500"
                  />
                  <button onClick={handleAddRule} className="bg-white text-black font-bold text-xs px-3 rounded-lg hover:bg-neutral-200 cursor-pointer">Add</button>
                </div>
              </div>

              {/* Creativity (LLM Temp) Slider */}
              <div className="space-y-1 pt-3 border-t border-[#141414]">
                <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
                  <span>Creativity (Temperature)</span>
                  <span className="text-white">{(activeNodeDetail.data.temp ?? 0.7).toString()}</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={activeNodeDetail.data.temp ?? 0.7}
                  onChange={(e) => updateNodeField(activeNodeDetail.id, { temp: parseFloat(e.target.value) })}
                  className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Tool Integrations */}
              <div className="pt-5 border-t border-[#141414] space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Tools</label>
                  <span className="text-[8px] font-mono text-neutral-500 uppercase">Attached: {activeNodeDetail.data.tools?.length || 0}</span>
                </div>
                <select
                  id="tool-selector-dropdown"
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
                  defaultValue=""
                  onChange={(e) => {
                    const toolName = e.target.value;
                    if (!toolName) return;
                    const currentTools = activeNodeDetail.data.tools || [];
                    if (!currentTools.includes(toolName)) {
                      const updatedTools = [...currentTools, toolName];
                      const permissions = activeNodeDetail.data.toolPermissions || {};
                      const updatedPerms = { ...permissions, [toolName]: permissions[toolName] || "ALLOWED" };
                      updateNodeField(activeNodeDetail.id, { tools: updatedTools, toolPermissions: updatedPerms });
                    }
                    e.target.value = "";
                  }}
                >
                  <option value="" disabled>+ Attach tool...</option>
                  {["Web Search", "Browser", "Memory", "File Upload", "Code Executor", "Vision", "Voice", "API Connector"]
                    .filter(tool => !(activeNodeDetail.data.tools || []).includes(tool))
                    .map((tool: string) => (
                      <option key={tool} value={tool}>{tool}</option>
                    ))}
                </select>

                <div className="space-y-3">
                  {(!activeNodeDetail.data.tools || activeNodeDetail.data.tools.length === 0) ? (
                    <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-4 text-center rounded-xl">
                      <p className="text-[10px] text-neutral-500">No tools attached.</p>
                    </div>
                  ) : (
                    activeNodeDetail.data.tools.map((tool: any) => {
                      const currentPermissions = activeNodeDetail.data.toolPermissions || {};
                      const permission = currentPermissions[tool] || "ALLOWED";
                      return (
                        <div key={tool} className="bg-[#050505] border border-[#1f1f1f] p-3 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${permission === "ALLOWED" ? "bg-emerald-500 animate-pulse" : permission === "ASK" ? "bg-amber-500" : "bg-rose-500"}`} />
                              {tool}
                            </span>
                            <button
                              onClick={() => {
                                const updatedTools = (activeNodeDetail.data.tools || []).filter((t: string) => t !== tool);
                                const updatedPerms = { ...(activeNodeDetail.data.toolPermissions || {}) };
                                delete updatedPerms[tool];
                                updateNodeField(activeNodeDetail.id, { tools: updatedTools, toolPermissions: updatedPerms });
                              }}
                              className="text-neutral-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1 pt-1">
                            {(["ALLOWED", "ASK", "DENIED"] as const).map((level) => (
                              <button
                                key={level}
                                onClick={() => {
                                  const updatedPerms = { ...(activeNodeDetail.data.toolPermissions || {}), [tool]: level };
                                  updateNodeField(activeNodeDetail.id, { toolPermissions: updatedPerms });
                                }}
                                className={`py-1 text-[9px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
                                  permission === level
                                    ? level === "ALLOWED" ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/50"
                                    : level === "ASK" ? "bg-amber-950/40 text-amber-400 border-amber-500/50"
                                    : "bg-rose-950/40 text-rose-400 border-rose-500/50"
                                    : "bg-transparent text-neutral-500 border-[#1f1f1f] hover:text-neutral-300"
                                }`}
                              >
                                {level === "ALLOWED" ? "ALLOW" : level === "ASK" ? "ASK" : "DENY"}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Connections */}
              <div className="pt-5 border-t border-[#141414] space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Connections</label>
                  <span className="text-[8px] font-mono text-neutral-500 uppercase">
                    Links: {edges.filter(c => c.source === activeNodeDetail.id || c.target === activeNodeDetail.id).length}
                  </span>
                </div>
                <select
                  id="connection-selector-dropdown"
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
                  defaultValue=""
                  onChange={(e) => {
                    const targetId = e.target.value;
                    if (!targetId) return;
                    const exists = edges.some(c =>
                      (c.source === activeNodeDetail.id && c.target === targetId) ||
                      (c.source === targetId && c.target === activeNodeDetail.id)
                    );
                    if (!exists) {
                      setEdges(prev => [...prev, {
                        id: `e-${activeNodeDetail.id}-${targetId}`,
                        source: activeNodeDetail.id,
                        target: targetId,
                        animated: true,
                        type: 'custom'
                      }]);
                      // Bug 1: Sync dependency — the target node now depends on this (source) node
                      const targetNode = nodes.find(n => n.id === targetId);
                      if (targetNode) {
                        const currentDeps = (targetNode.data as any).dependencies || [];
                        if (!currentDeps.includes(activeNodeDetail.id)) {
                          updateNodeField(targetId, {
                            dependencies: [...currentDeps, activeNodeDetail.id]
                          });
                        }
                      }
                    }
                    e.target.value = "";
                  }}
                >
                  <option value="" disabled>+ Connect to agent...</option>
                  {nodes.filter(n => n.id !== activeNodeDetail.id && n.type === 'custom').map(node => (
                    <option key={node.id} value={node.id}>{(node.data as any).name}</option>
                  ))}
                </select>
                <div className="space-y-1.5">
                  {(() => {
                    const linkedConns = edges.filter(c => c.source === activeNodeDetail.id || c.target === activeNodeDetail.id);
                    if (linkedConns.length === 0) {
                      return (
                        <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-3 text-center rounded-xl">
                          <p className="text-[10px] text-neutral-500">No connections.</p>
                        </div>
                      );
                    }
                    return linkedConns.map((conn, index) => {
                      const otherNodeId = conn.source === activeNodeDetail.id ? conn.target : conn.source;
                      const otherNode = nodes.find(n => n.id === otherNodeId);
                      return (
                        <div key={index} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
                          <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">
                            {otherNode ? (otherNode.data as any).name : otherNodeId}
                          </span>
                          <button onClick={() => deleteEdge(conn.id)} className="text-neutral-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Execution Logs */}
              <div className="pt-5 border-t border-[#141414] space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Execution Log</label>
                  <button
                    onClick={() => updateNodeField(activeNodeDetail.id, { toolLogs: [] })}
                    className="text-[8px] font-mono text-neutral-500 hover:text-white uppercase transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div className="bg-black border border-[#1f1f1f] rounded-xl p-3 h-44 overflow-y-auto font-mono text-[9px] space-y-1.5 custom-scrollbar">
                  {(!activeNodeDetail.data.toolLogs || activeNodeDetail.data.toolLogs.length === 0) ? (
                    <div className="h-full flex items-center justify-center text-neutral-600 text-center">
                      <span>No logs recorded.</span>
                    </div>
                  ) : (
                    activeNodeDetail.data.toolLogs.map((log: any) => (
                      <div key={log.id} className="flex gap-1.5 items-start leading-normal text-neutral-300">
                        <span className="text-neutral-500 shrink-0 select-none">[{log.timestamp}]</span>
                        <div className="flex-1">
                          <span className="font-bold text-white uppercase mr-1">[{log.tool}]</span>
                          <span>{log.detail}</span>
                        </div>
                        <span className={`shrink-0 font-bold px-1 rounded-sm text-[8px] ${
                          log.status === "SUCCESS" ? "bg-emerald-950 text-emerald-400" :
                          log.status === "PENDING" ? "bg-amber-950 text-amber-400 animate-pulse" :
                          log.status === "BLOCKED" ? "bg-rose-950 text-rose-400" : "bg-neutral-800 text-neutral-400"
                        }`}>
                          {log.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#1f1f1f] bg-[#0d0d0d] flex flex-col gap-2">
              <button
                onClick={async () => {
                  try {
                    const resp = await fetch("/api/gemini/test_agent", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        node: activeNodeDetail,
                        provider: provider,
                        api_key: apiKeys[provider] || apiKey || "",
                        api_keys: apiKeys,
                        base_url: providerBaseUrls[provider] || ""
                      })
                    });
                    const data = await resp.json();
                    if (data.status === "success") {
                      alert(`✅ Agent Test Success!\n\nResponse:\n${data.response}`);
                    } else {
                      alert(`❌ Agent Test Failed:\n\n${data.detail || data.error || "Unknown error"}`);
                    }
                  } catch (err: any) {
                    alert(`❌ Network Error: ${err.message}`);
                  }
                }}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-lg transition-all font-mono cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 fill-white" /> Test Agent
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { handleCloseConfigPanel(); }}
                  className="py-2 border border-[#1f1f1f] text-xs font-semibold text-neutral-400 hover:text-white rounded-lg transition-colors font-mono cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    alert("Agent configuration saved.");
                    handleCloseConfigPanel();
                  }}
                  className="py-2 bg-white hover:bg-neutral-100 text-black text-xs font-bold rounded-lg transition-all font-mono cursor-pointer"
                >
                  Save Config
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
            <Bot className="w-12 h-12 text-neutral-700 mb-3 animate-pulse" />
            <p className="text-xs text-neutral-500">Click any agent node in the Flow to edit its configuration.</p>
          </div>
        )}
        </div>
      )}

      {/* 4. Modals & Overlays */}
      <AnimatePresence>

        {/* BYOK MODAL */}
        {isSecretOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl"
            >
              <button onClick={() => setIsSecretOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
              <div className="flex gap-4 items-center mb-6">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <Key className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">AI Engine Settings</h3>
                  <p className="text-xs text-neutral-400 font-sans mt-0.5">Select your AI provider and configure keys.</p>
                </div>
              </div>
              <div className="space-y-4">
                {/* 1. Provider Selector */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Provider</label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
                  >
                    {Object.keys(availableProviders).length > 0 ? (
                      Object.entries(availableProviders).map(([pid, cfg]: [string, any]) => (
                        <option key={pid} value={pid}>{cfg.name}</option>
                      ))
                    ) : (
                      <option value="gemini">Google Gemini</option>
                    )}
                  </select>
                </div>

                {/* 1.5 Base URL Selector (conditionally displayed) */}
                {availableProviders[selectedProvider]?.requires_base_url && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Base URL</label>
                    <input
                      type="text"
                      placeholder={availableProviders[selectedProvider]?.is_local ? "http://localhost:11434/v1" : "https://YOUR_RESOURCE.openai.azure.com/openai/deployments"}
                      value={baseUrlInput}
                      onChange={(e) => setBaseUrlInput(e.target.value)}
                      className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
                    />
                  </div>
                )}

                {/* 2. Model Selector */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Model</label>
                    <div className="flex items-center gap-3">
                      {availableProviders[selectedProvider] && (
                        <button
                          onClick={async () => {
                            setIsFetchingModels(true);
                            setModelsFetchStatus("Testing connection...");
                            try {
                              setProviderApiKey(selectedProvider, apiKeyInput.trim());
                              setProviderBaseUrl(selectedProvider, baseUrlInput.trim());
                              await fetchProviderModels(selectedProvider);
                              setModelsFetchStatus("✅ Connection successful — models loaded!");
                            } catch (e) {
                              setModelsFetchStatus("❌ Connection failed. Check your API key.");
                            } finally {
                              setIsFetchingModels(false);
                            }
                          }}
                          disabled={isFetchingModels || (!apiKeyInput.trim() && !availableProviders[selectedProvider]?.is_local && !availableProviders[selectedProvider]?.is_custom)}
                          className="text-[9px] text-emerald-400 hover:underline cursor-pointer disabled:opacity-50 font-mono"
                        >
                          {isFetchingModels ? "Testing..." : "Test Connection ↗"}
                        </button>
                      )}
                      <label className="flex items-center gap-1 text-[9px] text-neutral-500 hover:text-neutral-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={useCustomModelId}
                          onChange={(e) => setUseCustomModelId(e.target.checked)}
                          className="accent-white w-2.5 h-2.5"
                        />
                        <span>Custom ID</span>
                      </label>
                    </div>
                  </div>
                  {useCustomModelId ? (
                    <input
                      type="text"
                      placeholder="e.g. claude-sonnet-4-20250514"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500 font-mono"
                    />
                  ) : (
                    (providerModels[selectedProvider] || availableProviders[selectedProvider]?.models)?.length > 0 ? (
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
                      >
                        {(providerModels[selectedProvider] || availableProviders[selectedProvider].models).map((m: any) => (
                          <option key={m.id} value={m.id}>{m.name || m.id} {m.tier ? `(${m.tier})` : ""}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. gpt-4o, llama3, custom-deployment-id"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
                      />
                    )
                  )}
                  {modelsFetchStatus && (
                    <p className={`text-[8px] font-mono ${modelsFetchStatus.toLowerCase().includes("failed") || modelsFetchStatus.toLowerCase().includes("❌") ? "text-red-400" : "text-emerald-400"}`}>
                      {modelsFetchStatus}
                    </p>
                  )}
                </div>

                {/* 3. API Key Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">
                      {selectedProvider.toUpperCase()}_API_KEY
                    </label>
                    {availableProviders[selectedProvider]?.key_url && (
                      <a
                        href={availableProviders[selectedProvider].key_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[9px] text-cyan-400 hover:underline"
                      >
                        Get key ↗
                      </a>
                    )}
                  </div>
                  <input
                    id="api-key-input"
                    type="password"
                    placeholder={
                      availableProviders[selectedProvider]
                        ? `Enter key (starts with ${availableProviders[selectedProvider].key_hint || "sk-..."})`
                        : "Enter API key"
                    }
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
                  />
                  <p className="text-[9px] text-neutral-500 font-mono leading-normal">
                    {availableProviders[selectedProvider]?.description || "Configure key for custom models. Key is stored locally in-memory."}
                  </p>
                </div>

                {/* 3.5 Fallback Provider */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Fallback Provider (Optional)</label>
                  <select
                    value={fallbackProviderInput}
                    onChange={(e) => setFallbackProviderInput(e.target.value)}
                    className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
                  >
                    <option value="">None (Disabled)</option>
                    {Object.entries(availableProviders)
                      .filter(([pid]) => pid !== selectedProvider)
                      .map(([pid, cfg]: [string, any]) => (
                        <option key={pid} value={pid}>{cfg.name}</option>
                      ))}
                  </select>
                </div>

                {/* 4. Save and Cancel Buttons */}
                <div className="pt-4 flex gap-3">
                  <button
                    id="save-api-key-btn"
                    disabled={isFetchingModels}
                    onClick={async () => {
                      const isLocal = availableProviders[selectedProvider]?.is_local;
                      if (!isLocal && !apiKeyInput.trim()) {
                        setModelsFetchStatus("❌ API key is required for this provider.");
                        return;
                      }

                      setIsFetchingModels(true);
                      setModelsFetchStatus("Validating API key...");

                      try {
                        const tempApiKeys = { ...apiKeys, [selectedProvider]: apiKeyInput.trim() };
                        const resp = await fetch("/api/gemini/models", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            provider: selectedProvider,
                            api_key: apiKeyInput.trim(),
                            api_keys: tempApiKeys,
                            base_url: baseUrlInput.trim()
                          })
                        });

                        if (!resp.ok) {
                          const errData = await resp.json().catch(() => ({}));
                          throw new Error(errData.error || errData.detail || `HTTP error ${resp.status}`);
                        }

                        const data = await resp.json();
                        if (!isLocal && (!data.models || data.models.length === 0)) {
                          throw new Error("No models returned. API key may be invalid or restricted.");
                        }

                        setProvider(selectedProvider);
                        setModel(selectedModel);
                        await setProviderApiKey(selectedProvider, apiKeyInput.trim());
                        setProviderBaseUrl(selectedProvider, baseUrlInput.trim());
                        setFallbackProvider(fallbackProviderInput);
                        setIsSecretOpen(false);
                      } catch (e: any) {
                        setModelsFetchStatus(`❌ Validation failed: ${e.message || e}`);
                      } finally {
                        setIsFetchingModels(false);
                      }
                    }}
                    className="flex-1 py-2.5 bg-white hover:bg-neutral-100 disabled:opacity-50 text-black font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
                  >
                    Save Settings
                  </button>
                  <button
                    onClick={() => setIsSecretOpen(false)}
                    className="px-5 py-2.5 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-xl text-xs font-mono transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* USER PROFILE MODAL */}
        {isProfileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-sm bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl"
            >
              <button onClick={() => setIsProfileOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
              <div className="flex flex-col items-center text-center space-y-4 py-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1f1f1f] flex items-center justify-center bg-neutral-900">
                  <User className="w-8 h-8 text-neutral-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">User Profile</h3>
                  <span className="text-xs text-neutral-400 font-mono">solospace_user@gmail.com</span>
                </div>
                <div className="w-full pt-4 space-y-2 border-t border-[#141414]">
                  <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
                    <span className="text-neutral-500">Plan:</span>
                    <span className="text-white font-bold">Pro</span>
                  </div>
                  <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
                    <span className="text-neutral-500">Sessions:</span>
                    <span className="text-white font-bold">{Object.values(sessions).length}</span>
                  </div>
                  <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
                    <span className="text-neutral-500">Session Cost:</span>
                    <span className="text-emerald-400 font-bold">${estimatedCost.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
                    <span className="text-neutral-500">Accumulated Cost:</span>
                    <span className="text-emerald-400 font-bold">${estimatedCost.toFixed(4)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsProfileOpen(false)}
                  className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-[#1f1f1f] text-neutral-300 hover:text-white font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* TOOL APPROVAL TOAST */}
        {pendingApproval && (
          <div className="fixed bottom-6 right-6 w-96 bg-[#0d0d0d] border border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.15)] rounded-2xl p-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 select-none">
            <div className="flex gap-4 items-start">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 shrink-0">
                <Sliders className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-amber-500 font-mono tracking-widest uppercase">Permission Required</span>
                  <span className="text-[9px] text-neutral-500 font-mono">Agent Tool</span>
                </div>
                <h4 className="text-xs font-bold text-white">
                  &apos;{(nodes.find(n => n.id === pendingApproval.nodeId)?.data as any)?.name}&apos; wants to use <span className="text-amber-400 font-mono">[{pendingApproval.toolName}]</span>
                </h4>
                <p className="text-[10px] text-neutral-400 leading-normal">
                  Action: <span className="text-white font-semibold">{pendingApproval.action}</span> — {pendingApproval.detail}
                </p>
                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => {
                      sendApprovalResponse(
                        pendingApproval.nodeId,
                        pendingApproval.toolName,
                        "approve",
                        pendingApproval.logId
                      );

                      const node = nodes.find(n => n.id === pendingApproval.nodeId);
                      if (node) {
                        const updatedLogs = ((node.data as any).toolLogs || []).map((log: any) => {
                          if (log.id === pendingApproval.logId) {
                            return { ...log, status: "SUCCESS" as const, detail: `Approved: ${pendingApproval.detail}` };
                          }
                          return log;
                        });
                        updateNodeField(pendingApproval.nodeId, { toolLogs: updatedLogs });
                      }
                      useWorkflowStore.setState({ pendingApproval: null });
                    }}
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      sendApprovalResponse(
                        pendingApproval.nodeId,
                        pendingApproval.toolName,
                        "deny",
                        pendingApproval.logId
                      );

                      const node = nodes.find(n => n.id === pendingApproval.nodeId);
                      if (node) {
                        const updatedLogs = ((node.data as any).toolLogs || []).map((log: any) => {
                          if (log.id === pendingApproval.logId) {
                            return { ...log, status: "BLOCKED" as const, detail: `Denied: ${pendingApproval.detail}` };
                          }
                          return log;
                        });
                        updateNodeField(pendingApproval.nodeId, { toolLogs: updatedLogs });
                      }
                      useWorkflowStore.setState({ pendingApproval: null });
                    }}
                    className="px-4 py-2 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
                  >
                    Deny
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KEYBOARD SHORTCUTS OVERLAY */}
        {isShortcutsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-sm bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl space-y-4"
            >
              <button onClick={() => setIsShortcutsOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
              <div className="flex gap-3 items-center border-b border-[#141414] pb-3">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Keyboard Shortcuts</h3>
              </div>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Switch to Chat Tab</span>
                  <span className="bg-neutral-900 border border-[#1f1f1f] px-2 py-0.5 rounded text-neutral-200">Ctrl + 1</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Switch to Flow Tab</span>
                  <span className="bg-neutral-900 border border-[#1f1f1f] px-2 py-0.5 rounded text-neutral-200">Ctrl + 2</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">AI Engine Settings</span>
                  <span className="bg-neutral-900 border border-[#1f1f1f] px-2 py-0.5 rounded text-neutral-200">Ctrl + K</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Close Active Panel</span>
                  <span className="bg-neutral-900 border border-[#1f1f1f] px-2 py-0.5 rounded text-neutral-200 font-bold">ESC</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Toggle Shortcuts Overlay</span>
                  <span className="bg-neutral-900 border border-[#1f1f1f] px-2 py-0.5 rounded text-neutral-200">?</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* PROMPT LIBRARY MODAL */}
        {isPromptLibraryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-lg bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl flex flex-col max-h-[85vh]"
            >
              <button onClick={() => setIsPromptLibraryOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex gap-3 items-center border-b border-[#141414] pb-4 mb-4 shrink-0">
                <History className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Prompt Library</h3>
                  <p className="text-[10px] text-neutral-500">Save and reload your frequently used system prompts.</p>
                </div>
              </div>

              {/* Add New Prompt */}
              <div className="bg-[#050505] border border-[#1f1f1f] p-3 rounded-xl space-y-2 mb-4 shrink-0">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Add to Library</span>
                </div>
                <textarea
                  placeholder="Enter prompt content..."
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  className="w-full bg-black border border-[#1f1f1f] rounded-lg p-2 text-xs text-white focus:border-neutral-500 outline-none resize-none h-16 leading-relaxed"
                />
                <div className="flex gap-2 justify-between">
                  <input
                    type="text"
                    placeholder="Tag (e.g. React, SQL)"
                    value={newPromptTag}
                    onChange={(e) => setNewPromptTag(e.target.value)}
                    className="bg-black border border-[#1f1f1f] rounded-lg px-3 py-1.5 text-xs text-white focus:border-neutral-500 outline-none w-1/3"
                  />
                  <button
                    onClick={() => savePrompt(newPromptText, newPromptTag)}
                    disabled={!newPromptText.trim()}
                    className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-30 cursor-pointer"
                  >
                    Save Prompt
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="mb-3 shrink-0">
                <input
                  type="text"
                  placeholder="Search saved prompts..."
                  value={promptSearch}
                  onChange={(e) => setPromptSearch(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-neutral-500"
                />
              </div>

              {/* Prompts list */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {prompts.filter(p => p.text.toLowerCase().includes(promptSearch.toLowerCase()) || p.tag.toLowerCase().includes(promptSearch.toLowerCase())).length === 0 ? (
                  <div className="text-center py-8 text-xs text-neutral-500">No prompts found matching search.</div>
                ) : (
                  prompts
                    .filter(p => p.text.toLowerCase().includes(promptSearch.toLowerCase()) || p.tag.toLowerCase().includes(promptSearch.toLowerCase()))
                    .map((p) => (
                      <div key={p.id} className="bg-[#050505] border border-[#1f1f1f] p-3 rounded-xl space-y-2 hover:border-neutral-700 transition-colors group">
                        <div className="flex justify-between items-start">
                          <span className="text-[8px] font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-1.5 py-0.5 rounded uppercase tracking-wider">{p.tag}</span>
                          <button
                            onClick={() => deletePrompt(p.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-neutral-600 hover:text-rose-400 rounded transition-opacity cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-neutral-300 leading-relaxed font-sans">{p.text}</p>
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => {
                              setUserQuery(p.text);
                              setIsPromptLibraryOpen(false);
                            }}
                            className="text-[10px] font-mono text-white hover:underline cursor-pointer flex items-center gap-1 font-bold"
                          >
                            Use Prompt →
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* AGENT TEMPLATE LIBRARY MODAL */}
        {isTemplateLibOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-xl bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl flex flex-col max-h-[85vh]"
            >
              <button onClick={() => setIsTemplateLibOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>

              <div className="flex gap-3 items-center border-b border-[#141414] pb-4 mb-5 shrink-0">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Agent Template Library</h3>
                  <p className="text-[10px] text-neutral-500">Inject pre-configured agent orchestration teams directly into the workspace.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {[
                  { name: "Code Reviewer", desc: "Specialist team consisting of Code Analyzer, Security Auditor, and Senior Reviewer.", tools: "Code Exec, API Call, Memory", icon: "code" },
                  { name: "Data Analyst", desc: "Data collection and scraping workflow using Browser, Web Search, and Parser.", tools: "Browser, Web Search, Code Exec", icon: "science" },
                  { name: "Research Assistant", desc: "Deep study workflow consisting of Search Specialist and Synthesis Writer.", tools: "Web Search, Browser, Memory", icon: "globe" },
                  { name: "Content Writer", desc: "Content marketing team featuring Keyword Researcher and Draft Writer.", tools: "Web Search, Memory", icon: "bot" },
                ].map((tpl) => (
                  <div
                    key={tpl.name}
                    className="bg-[#050505] border border-[#1f1f1f] p-4 rounded-xl flex flex-col justify-between hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all group"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">{tpl.name}</h4>
                        <span className="text-neutral-500"><Sparkles className="w-4 h-4 text-cyan-500" /></span>
                      </div>
                      <p className="text-[10.5px] text-neutral-400 leading-relaxed font-sans">{tpl.desc}</p>
                      <div className="text-[9px] font-mono text-neutral-600">
                        Tools: <span className="text-neutral-400">{tpl.tools}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        loadTemplate(tpl.name);
                        setIsTemplateLibOpen(false);
                      }}
                      className="mt-4 w-full py-2 bg-neutral-900 border border-[#1f1f1f] hover:bg-neutral-800 text-white hover:text-cyan-400 text-[10px] font-mono font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Load Template
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* COST DASHBOARD MODAL */}
        <CostDashboard
          isOpen={isCostDashboardOpen}
          onClose={() => setIsCostDashboardOpen(false)}
          currentSessionId={activeSessionId}
          currentSessionCost={estimatedCost}
          currentModel={model}
          currentProvider={provider}
        />

        {/* COMMAND PALETTE OVERLAY */}
        {isCommandPaletteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-start justify-center z-50 p-6 pt-[15vh] select-none"
            onClick={() => setIsCommandPaletteOpen(false)}
          >
            <motion.div
              initial={{ y: -20, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: -20, scale: 0.98 }}
              className="w-full max-w-xl bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#141414] bg-[#050505]">
                <Terminal className="w-5 h-5 text-cyan-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Type a command or search..."
                  value={commandPaletteSearch}
                  onChange={(e) => setCommandPaletteSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0"
                  autoFocus
                />
                <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900 border border-[#1f1f1f] px-2 py-0.5 rounded uppercase">ESC to close</span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {[
                  { name: "New Chat Session", desc: "Create a clean slate workspace for agent flows", action: () => { createSession("New Session", executionMode); setWorkspaceState("home"); }, category: "General Actions" },
                  { name: "Configure API Keys (BYOK)", desc: "Open provider key manager and base URLs", action: () => setIsSecretOpen(true), category: "General Actions" },
                  { name: "Open Prompt Library", desc: "Access saved agent system prompts", action: () => setIsPromptLibraryOpen(true), category: "General Actions" },
                  { name: "View Cost Dashboard", desc: "Inspect real-time token counts & pricing budgets", action: () => setIsCostDashboardOpen(true), category: "General Actions" },
                  { name: "Toggle Shortcuts Overlay", desc: "Show complete list of system hotkeys", action: () => setIsShortcutsOpen(true), category: "General Actions" },

                  { name: "Load Code Reviewer Template", desc: "Initialize 3-agent software review pipeline", action: () => loadTemplate("Code Reviewer"), category: "Orchestration Templates" },
                  { name: "Load Data Analyst Template", desc: "Initialize scraper & computational parser nodes", action: () => loadTemplate("Data Analyst"), category: "Orchestration Templates" },
                  { name: "Load Research Assistant Template", desc: "Initialize double-agent search and synthesis pipeline", action: () => loadTemplate("Research Assistant"), category: "Orchestration Templates" },
                  { name: "Load Content Writer Template", desc: "Initialize Competitor Research & Draft Author nodes", action: () => loadTemplate("Content Writer"), category: "Orchestration Templates" },

                  { name: "Switch to Chat View", desc: "Interact with agents via conversational interface", action: () => { if (workspaceState !== "home") setCurrentTab("chat"); }, category: "Navigation" },
                  { name: "Switch to Flow Arena Canvas", desc: "Inspect and wire agent dependencies visually", action: () => { if (workspaceState === "active") setCurrentTab("arena"); }, category: "Navigation" }
                ]
                .filter(cmd => 
                  cmd.name.toLowerCase().includes(commandPaletteSearch.toLowerCase()) || 
                  cmd.desc.toLowerCase().includes(commandPaletteSearch.toLowerCase()) ||
                  cmd.category.toLowerCase().includes(commandPaletteSearch.toLowerCase())
                )
                .reduce((acc, cmd) => {
                  const found = acc.find(g => g.category === cmd.category);
                  if (found) {
                    found.items.push(cmd);
                  } else {
                    acc.push({ category: cmd.category, items: [cmd] });
                  }
                  return acc;
                }, [] as Array<{ category: string; items: any[] }>)
                .map((group) => (
                  <div key={group.category} className="space-y-1 mb-3">
                    <span className="px-3 text-[9px] font-bold font-mono text-neutral-500 uppercase tracking-wider block mt-2">{group.category}</span>
                    {group.items.map((cmd) => (
                      <button
                        key={cmd.name}
                        onClick={() => {
                          cmd.action();
                          setIsCommandPaletteOpen(false);
                          setCommandPaletteSearch("");
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-900/60 border border-transparent hover:border-[#1f1f1f] transition-all flex justify-between items-center group/item cursor-pointer"
                      >
                        <div>
                          <span className="text-xs font-semibold text-neutral-200 block group-hover/item:text-cyan-400 transition-colors font-mono">{cmd.name}</span>
                          <span className="text-[10px] text-neutral-500 leading-relaxed font-sans">{cmd.desc}</span>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-600 group-hover/item:text-cyan-500/80 transition-colors font-bold">RUN →</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* MOBILE CANVAS BOTTOM SHEET */}
        {isMobile && workspaceState === "active" && (
          <>
            {/* Toggle trigger bar */}
            {!isBottomSheetOpen && (
              <button
                onClick={() => setIsBottomSheetOpen(true)}
                className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-cyan-600 to-blue-600 border border-cyan-500/50 hover:from-cyan-500 hover:to-blue-500 text-white text-[10px] font-mono font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <GitFork className="w-3.5 h-3.5" /> Show Agent Flow
              </button>
            )}

            {/* Bottom Sheet */}
            <div
              className="mobile-bottom-sheet"
              style={{
                transform: isBottomSheetOpen ? 'translateY(0)' : 'translateY(100%)',
                pointerEvents: isBottomSheetOpen ? 'all' : 'none',
              }}
            >
              <div
                className="mobile-bottom-sheet-header"
                onClick={() => setIsBottomSheetOpen(false)}
              >
                <div className="mobile-bottom-sheet-handle" />
              </div>
              <div className="h-[calc(55vh-40px)] relative">
                <FlowArena />
              </div>
            </div>
          </>
        )}

      </AnimatePresence>
    </div>
  );
}
