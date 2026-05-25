'use client';

import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Zap, 
  SquarePlus, 
  LayoutGrid, 
  Key, 
  Component, 
  History, 
  Settings, 
  User, 
  ChevronRight, 
  ChevronLeft, 
  MoreVertical, 
  CheckCircle2, 
  Circle, 
  FlaskConical, 
  Code, 
  TrendingUp, 
  Globe, 
  Megaphone, 
  Presentation, 
  Hourglass, 
  Bell, 
  HelpCircle, 
  Terminal, 
  UploadCloud, 
  Eye, 
  Mic, 
  GitFork, 
  Plus, 
  Minus, 
  Maximize, 
  ArrowRight, 
  Send, 
  Database,
  Info,
  Sliders,
  Sparkles,
  Lock,
  Pause,
  X,
  Check,
  Trash2,
  Edit,
  Play,
  Volume2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DeployedAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  file: string;
  tokensSec: string;
  progress: number;
  metricLabel: string;
  metricValue: string;
  icon: string;
}

interface CanvasNode {
  id: string;
  name: string;
  tag: string;
  x: number;
  y: number;
  status: "IDLE" | "ACTIVE" | "SCANNING WEB" | "AUDITING" | "QUEUED" | "WAITING" | "PROCESSING" | "STANDBY" | "DISABLED";
  metricLabel: string;
  metricVal: string;
  icon: string;
  objective: string;
  personality: string;
  systemPrompt: string;
  rules: string[];
  tools: string[];
  temp: number;
  logic: number; // 0-100
  empathy: number; // 0-100
  context: string;
  enabled: boolean; // Custom toggle
  priority: number; // 1-10 priority scale
  toolPermissions?: Record<string, "ALLOWED" | "ASK" | "DENIED">;
  toolLogs?: Array<{
    id: string;
    timestamp: string;
    tool: string;
    action: string;
    status: "SUCCESS" | "PENDING" | "BLOCKED" | "ERROR";
    detail: string;
  }>;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  reasoning?: string;
  timestamp: string;
}

interface DiscussionMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderIcon: string;
  text: string;
  timestamp: string;
}

interface RecentChat {
  id: string;
  title: string;
  prompt: string;
  mode: "auto" | "custom";
}

export default function SolospaceApp() {
  // Screen and Mode States
  const [workspaceState, setWorkspaceState] = useState<"home" | "active">("home");
  const [currentTab, setCurrentTab] = useState<"chat" | "arena">("chat");
  const [isAutoMode, setIsAutoMode] = useState<boolean>(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
  
  // Custom execution states for the collaboration pipeline
  const [executionState, setExecutionState] = useState<"setup" | "running" | "paused">("setup");
  const [isConsoleExpanded, setIsConsoleExpanded] = useState<boolean>(true);
  
  // Input fields
  const [userQuery, setUserQuery] = useState<string>("");
  const [activePrompt, setActivePrompt] = useState<string>("");
  
  // Interactive Flow States
  const [isOrchestrating, setIsOrchestrating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [streamedReasoning, setStreamedReasoning] = useState<string>("");
  const [fullReasoningText, setFullReasoningText] = useState<string>("");
  
  // API and User configuration states
  const [apiKey, setApiKey] = useState<string>("");
  const [isSecretOpen, setIsSecretOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deploymentLog, setDeploymentLog] = useState<string[]>([]);
  const [pendingApproval, setPendingApproval] = useState<{ nodeId: string; toolName: string; action: string; detail: string; logId: string } | null>(null);
  
  // Dynamic Agent Node Connections
  const [connections, setConnections] = useState<Array<{ from: string; to: string }>>([]);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  
  // Tooltip helper state for collapsed sidebar
  const [hoveredSidebarItem, setHoveredSidebarItem] = useState<string | null>(null);

  // Canvas zoom/pan parameters
  const [canvasScale, setCanvasScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Dragging states
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [droppedToolTarget, setDroppedToolTarget] = useState<string | null>(null);

  // Node Configuration Panel
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState<boolean>(false);
  const [newRuleText, setNewRuleText] = useState<string>("");

  // Chat message history
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Live streaming agent discussions
  const [discussionLogs, setDiscussionLogs] = useState<DiscussionMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<{
    senderId: string;
    senderName: string;
    senderIcon: string;
    text: string;
    visibleText: string;
  } | null>(null);
  
  const discussionIndexRef = useRef<number>(0);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const discussionCycleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sidebar Recent chats
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);

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

  // Default Canvas nodes
  const [nodes, setNodes] = useState<CanvasNode[]>([]);

  const nodesRef = useRef<CanvasNode[]>(nodes);
  nodesRef.current = nodes;

  // Typing effect stream simulator
  useEffect(() => {
    if (!fullReasoningText) return;
    let idx = 0;
    setStreamedReasoning("");
    const interval = setInterval(() => {
      setStreamedReasoning((prev) => prev + fullReasoningText.charAt(idx));
      idx++;
      if (idx >= fullReasoningText.length) {
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [fullReasoningText]);

  // Real-time Agent Discussion simulation loop
  useEffect(() => {
    if (executionState !== "running") {
      if (discussionCycleTimerRef.current) clearTimeout(discussionCycleTimerRef.current);
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      return;
    }

    const triggerNextDiscussionMessage = () => {
      // Filter out disabled nodes dynamically using nodesRef
      const activeNodes = nodesRef.current.filter(n => n.enabled);
      if (activeNodes.length === 0) {
        setStreamingMessage({
          senderId: "system",
          senderName: "System Logger",
          senderIcon: "science",
          text: "All agents are currently disabled. Please enable agents on the Arena canvas to resume collaboration.",
          visibleText: "All agents are currently disabled. Please enable agents on the Arena canvas to resume collaboration."
        });
        return;
      }

      // Pick next speaker
      const speakerNode = activeNodes[discussionIndexRef.current % activeNodes.length];
      discussionIndexRef.current++;

      // Generate a dynamic message taking into account updated rules, name, priority and tools
      const toolsText = speakerNode.tools.length > 0 
        ? `our integrated [${speakerNode.tools.join(", ")}] array` 
        : "our basic telemetry";
      
      const firstRule = speakerNode.rules.length > 0 
        ? `abiding by our constraint: "${speakerNode.rules[0]}"` 
        : "ensuring optimal codebase specification";

      const priorityContext = speakerNode.priority > 7 
        ? `running with Critical High Priority (Level ${speakerNode.priority})` 
        : speakerNode.priority < 4 
          ? `operating at low-impact background priority (Level ${speakerNode.priority})`
          : `operating at balanced priority (Level ${speakerNode.priority})`;

      // Content generation templates depending on node type
      let generatedText = "";
      const promptContext = activePrompt || "current objectives";
      
      if (speakerNode.id === "research") {
        generatedText = `As Lead Researcher, I've scanned competitive parameters for "${promptContext}". Triggering ${toolsText} to identify design patterns, while ${firstRule}. I've set my analysis thread to ${priorityContext}.`;
      } else if (speakerNode.id === "coding" || speakerNode.id === "coder" || speakerNode.id === "developer") {
        generatedText = `I am auditing the sandbox compilation loops. Working on the code files ${priorityContext}. In order to ${firstRule}, I am linking the data loops into ${toolsText}. Let me review the safety limits.`;
      } else if (speakerNode.id === "marketing" || speakerNode.id === "marketer" || speakerNode.id === "growth") {
        generatedText = `Drafting outreach coordinates. In line with the objective to ${firstRule}, I am routing channels using ${toolsText}. Pipeline priority is set to ${priorityContext}. Let's capture virality indices.`;
      } else if (speakerNode.id === "designer") {
        generatedText = `Scaffolding visual layers. I am locking style guidelines to absolute-black mockups. In order to ${firstRule}, I will utilize ${toolsText} and verify formatting frames.`;
      } else {
        generatedText = `Acknowledging cluster objectives for "${promptContext}". I am deploying my logic grid, ${priorityContext}, using ${toolsText}. Enforcing the core directive: ${firstRule}.`;
      }

      // Start character-by-character typing animation (typing feel like ChatGPT)
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      
      setStreamingMessage({
        senderId: speakerNode.id,
        senderName: speakerNode.name,
        senderIcon: speakerNode.icon,
        text: generatedText,
        visibleText: ""
      });

      let charIndex = 0;
      typingTimerRef.current = setInterval(() => {
        setStreamingMessage(prev => {
          if (!prev) return null;
          const nextVisible = prev.text.substring(0, charIndex + 1);
          charIndex++;
          
          if (charIndex >= prev.text.length) {
            // Typing complete: flush to logs and trigger next speaker scheduling
            if (typingTimerRef.current) clearInterval(typingTimerRef.current);
            
            const loggedMessage: DiscussionMessage = {
              id: Date.now().toString(),
              senderId: prev.senderId,
              senderName: prev.senderName,
              senderIcon: prev.senderIcon,
              text: prev.text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            };
            
            setDiscussionLogs(logs => [...logs, loggedMessage]);
            setStreamingMessage(null);
            
            // Queue next agent comment in 4 seconds
            discussionCycleTimerRef.current = setTimeout(triggerNextDiscussionMessage, 4000);
            return null;
          }
          
          return {
            ...prev,
            visibleText: nextVisible
          };
        });
      }, 25);
    };

    // Begin conversation loop
    discussionCycleTimerRef.current = setTimeout(triggerNextDiscussionMessage, 1500);

    return () => {
      if (discussionCycleTimerRef.current) clearTimeout(discussionCycleTimerRef.current);
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [executionState, activePrompt]);

  // Global mouse events for node dragging and canvas panning
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setDraggedNodeId(nodeId);
    dragStartOffset.current = {
      x: e.clientX / canvasScale - node.x,
      y: e.clientY / canvasScale - node.y
    };
  };

  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (draggedNodeId) {
      setNodes(prev => prev.map(n => {
        if (n.id === draggedNodeId) {
          return {
            ...n,
            x: Math.max(10, Math.min(2000, e.clientX / canvasScale - dragStartOffset.current.x)),
            y: Math.max(10, Math.min(1200, e.clientY / canvasScale - dragStartOffset.current.y))
          };
        }
        return n;
      }));
    } else if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y
      });
    }
  };

  const handleGlobalMouseUp = () => {
    if (draggedNodeId) {
      setDraggedNodeId(null);
    }
    if (isPanning) {
      setIsPanning(false);
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [draggedNodeId, isPanning, canvasScale]);

  // Panning Trigger
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Prevent panning if user clicks on sliders, panels, or buttons
    if (
      (e.target as HTMLElement).closest('.agent-node-card') || 
      (e.target as HTMLElement).closest('button') || 
      (e.target as HTMLElement).closest('input') ||
      (e.target as HTMLElement).closest('textarea') ||
      (e.target as HTMLElement).closest('.right-panel') ||
      (e.target as HTMLElement).closest('.collapsible-console')
    ) {
      return;
    }
    setIsPanning(true);
    panStart.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y
    };
  };

  // Node drop attachments for Drag and Drop Tools
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropToolOnNode = (e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    const toolName = e.dataTransfer.getData("toolName");
    if (!toolName) return;

    // Attach tool to node
    setNodes(prev => prev.map(node => {
      if (node.id === nodeId && !node.tools.includes(toolName)) {
        return {
          ...node,
          tools: [...node.tools, toolName],
          toolPermissions: {
            ...(node.toolPermissions || {}),
            [toolName]: "ALLOWED"
          }
        };
      }
      return node;
    }));

    // Trigger pulse visualization
    setDroppedToolTarget(nodeId);
    setTimeout(() => setDroppedToolTarget(null), 1000);
  };

  // Dynamic client-side multi-agent builder based on prompt keywords
  const generateThematicAgents = (prompt: string) => {
    const p = prompt.toLowerCase();
    
    if (p.includes("startup") || p.includes("launch") || p.includes("business")) {
      return [
        {
          id: "research",
          name: "Market Analyst Agent",
          tag: "AUTO_RESEARCH_01",
          x: 100,
          y: 220,
          status: "ACTIVE" as const,
          metricLabel: "Competitors scanned",
          metricVal: "48",
          icon: "science",
          objective: "Identify direct market gaps, scan venture directories, and draft value propositions.",
          personality: "Inquisitive, data-backed, extremely realistic",
          systemPrompt: "You are the Market Analyst Agent. Crawl web repositories and isolate core market trends.",
          rules: ["Compile competitor gap metrics", "Audit financial requirements"],
          tools: ["Web Search"],
          temp: 0.3,
          logic: 88,
          empathy: 30,
          context: "128k",
          enabled: true,
          priority: 5
        },
        {
          id: "designer",
          name: "UI/UX Designer",
          tag: "AUTO_DESIGN_02",
          x: 380,
          y: 100,
          status: "PROCESSING" as const,
          metricLabel: "Figma Frames",
          metricVal: "12 Mockups",
          icon: "present_to_all",
          objective: "Map wireframes, design dark-mode styles, and verify visual layouts.",
          personality: "Aesthetically hyper-sensitive, focus on micro-interactions",
          systemPrompt: "You are the UI/UX Designer Agent. Draft Figma specs and write modular Tailwind styling sets.",
          rules: ["Only use absolute-black backgrounds (#000000)", "Keep padding harmonious"],
          tools: ["Vision", "Browser"],
          temp: 0.75,
          logic: 75,
          empathy: 75,
          context: "64k",
          enabled: true,
          priority: 6
        },
        {
          id: "developer",
          name: "Product Strategist",
          tag: "AUTO_PRODUCT_03",
          x: 380,
          y: 350,
          status: "QUEUED" as const,
          metricLabel: "User Stories",
          metricVal: "24 mapped",
          icon: "code",
          objective: "Formulate product requirements, plan development cycles, and outline API requirements.",
          personality: "Structured, product-oriented, feature-prioritizer",
          systemPrompt: "You are the Product Strategist Agent. Draft roadmap features and define minimal viable parameters.",
          rules: ["Prioritize absolute necessities first", "Map database dependencies"],
          tools: ["Memory"],
          temp: 0.5,
          logic: 90,
          empathy: 50,
          context: "128k",
          enabled: true,
          priority: 7
        },
        {
          id: "coach",
          name: "Investor Pitch Coach",
          tag: "AUTO_COACH_04",
          x: 660,
          y: 120,
          status: "WAITING" as const,
          metricLabel: "Slide Score",
          metricVal: "A+",
          icon: "science",
          objective: "Synthesize investor pitch decks and prepare financial estimates.",
          personality: "Charismatic, storytelling expert, direct, constructive",
          systemPrompt: "You are the Investor Pitch Coach. Format content structures into compelling slides.",
          rules: ["Keep text elements below 4 lines per slide", "Explain margins and yields clearly"],
          tools: ["API Connector"],
          temp: 0.7,
          logic: 80,
          empathy: 80,
          context: "128k",
          enabled: true,
          priority: 4
        },
        {
          id: "marketer",
          name: "Growth Hacker",
          tag: "AUTO_GROWTH_05",
          x: 660,
          y: 330,
          status: "WAITING" as const,
          metricLabel: "Viral Coefficient",
          metricVal: "1.4x",
          icon: "trending_up",
          objective: "Schedule content launches and set up marketing funnels.",
          personality: "Aggressive, metric-driven, creative channel strategist",
          systemPrompt: "You are the Growth Hacker Agent. Draft social distributions and define community multipliers.",
          rules: ["Integrate viral sharing hooks", "Leverage referral program parameters"],
          tools: ["Web Search"],
          temp: 0.8,
          logic: 65,
          empathy: 80,
          context: "64k",
          enabled: true,
          priority: 5
        }
      ];
    }

    if (p.includes("code") || p.includes("audit") || p.includes("build") || p.includes("develop")) {
      return [
        {
          id: "architect",
          name: "Lead Systems Architect",
          tag: "CODE_ARCH_01",
          x: 120,
          y: 200,
          status: "ACTIVE" as const,
          metricLabel: "Module Files",
          metricVal: "8 Modules",
          icon: "science",
          objective: "Structure database schemas and establish service router topologies.",
          personality: "Meticulous, focused on performance and low latencies",
          systemPrompt: "You are the Lead Systems Architect. Outline routing layers and optimize SQL queries.",
          rules: ["Enforce strict foreign keys", "Provide Redis caching parameters"],
          tools: ["Memory", "File Upload"],
          temp: 0.1,
          logic: 98,
          empathy: 15,
          context: "256k",
          enabled: true,
          priority: 8
        },
        {
          id: "coder",
          name: "Core Developer",
          tag: "CODE_ENGINE_02",
          x: 420,
          y: 80,
          status: "PROCESSING" as const,
          metricLabel: "Line Count",
          metricVal: "1,240 lines",
          icon: "code",
          objective: "Implement clean scripts, configure routers, and integrate middleware.",
          personality: "Focused, syntax compliance optimizer",
          systemPrompt: "You are the Core Developer. Complete functions and optimize execution pools.",
          rules: ["Integrate comprehensive try-catch statements", "Minimize external dependencies"],
          tools: ["Code Executor"],
          temp: 0.15,
          logic: 95,
          empathy: 20,
          context: "128k",
          enabled: true,
          priority: 9
        },
        {
          id: "auditor",
          name: "Security Auditor",
          tag: "CODE_AUDIT_03",
          x: 420,
          y: 350,
          status: "QUEUED" as const,
          metricLabel: "Vulnerabilities Found",
          metricVal: "0 High",
          icon: "science",
          objective: "Scan file codes, search for secret leakage risks, and run static scripts.",
          personality: "Paranoid, security-first, rule-driven",
          systemPrompt: "You are the Security Auditor. Inspect headers and verify cryptographical keys.",
          rules: ["Check for potential injection avenues", "Inspect token expiration times"],
          tools: ["Browser", "Web Search"],
          temp: 0.1,
          logic: 99,
          empathy: 10,
          context: "256k",
          enabled: true,
          priority: 9
        },
        {
          id: "qa",
          name: "QA Automation Agent",
          tag: "CODE_QA_04",
          x: 720,
          y: 200,
          status: "WAITING" as const,
          metricLabel: "Test Coverage",
          metricVal: "96.4%",
          icon: "trending_up",
          objective: "Run automated validation runners and test boundary cases.",
          personality: "Thorough, regression-focused, exhaustive tester",
          systemPrompt: "You are the QA Automation Agent. Generate comprehensive test suits.",
          rules: ["Run mock integration checks", "Assert response times remain below 150ms"],
          tools: ["Code Executor"],
          temp: 0.2,
          logic: 92,
          empathy: 25,
          context: "128k",
          enabled: true,
          priority: 7
        }
      ];
    }

    // Default backup agents
    return [
      {
        id: "research",
        name: "General Investigator",
        tag: "GEN_RESEARCH_01",
        x: 120,
        y: 200,
        status: "ACTIVE" as const,
        metricLabel: "Sources Visited",
        metricVal: "24 pages",
        icon: "science",
        objective: "Scan the web for context on user requirements and verify resources.",
        personality: "Detail-oriented, quick, thorough",
        systemPrompt: "You are the General Investigator. Gather background data on user's targets.",
        rules: ["Provide exact quotes for facts", "Exclude biased editorial feeds"],
        tools: ["Web Search"],
        temp: 0.35,
        logic: 85,
        empathy: 40,
        context: "128k",
        enabled: true,
        priority: 5
      },
      {
        id: "coder",
        name: "Shorthand Programmer",
        tag: "GEN_DEVELOP_02",
        x: 420,
        y: 80,
        status: "PROCESSING" as const,
        metricLabel: "File Count",
        metricVal: "4 scripts",
        icon: "code",
        objective: "Generate code loops, map script blocks, and run sandbox tests.",
        personality: "Pragmatic developer",
        systemPrompt: "You are the Shorthand Programmer. Write script blocks quickly.",
        rules: ["Include simple setups", "Add descriptions as inline comments"],
        tools: ["Code Executor"],
        temp: 0.2,
        logic: 90,
        empathy: 30,
        context: "128k",
        enabled: true,
        priority: 6
      },
      {
        id: "reviewer",
        name: "Format Reviewer",
        tag: "GEN_REVIEW_03",
        x: 420,
        y: 350,
        status: "QUEUED" as const,
        metricLabel: "Issues Caught",
        metricVal: "3 typos",
        icon: "present_to_all",
        objective: "Check structural parameters and make formatting corrections.",
        personality: "Quality analyst, concise",
        systemPrompt: "You are the Format Reviewer. Inspect generated assets for typos and formatting errors.",
        rules: ["Format readmes in clean Markdown", "Ensure standard parameters are consistent"],
        tools: ["Browser"],
        temp: 0.4,
        logic: 82,
        empathy: 50,
        context: "64k",
        enabled: true,
        priority: 5
      },
      {
        id: "coordinator",
        name: "Deployer Agent",
        tag: "GEN_DEPLOY_04",
        x: 720,
        y: 200,
        status: "WAITING" as const,
        metricLabel: "Target host",
        metricVal: "Vercel / AWS",
        icon: "trending_up",
        objective: "Assemble files and orchestrate deployment to production environments.",
        personality: "Deployment specialist",
        systemPrompt: "You are the Deployer Agent. Assemble code files and execute compile commands.",
        rules: ["Build before deploying", "Check CORS and header setups"],
        tools: ["API Connector"],
        temp: 0.3,
        logic: 88,
        empathy: 35,
        context: "128k",
        enabled: true,
        priority: 6
      }
    ];
  };

  // Process and invoke Gemini Node Orchestrator
  const startOrchestration = async (promptText: string) => {
    if (!promptText.trim()) return;
    setActivePrompt(promptText);
    setWorkspaceState("active");
    setIsOrchestrating(true);
    setStreamedReasoning("");
    setFullReasoningText("");
    setDiscussionLogs([]);
    setStreamingMessage(null);
    discussionIndexRef.current = 0;
    setStatusMessage("Deploying AI Agent environment...");
    setUserQuery(""); // Clear input box to avoid stale text

    // Create user message in chat
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);

    // Handle auto vs custom mode setup
    if (isAutoMode) {
      setCurrentTab("arena"); // Auto Mode opens Arena immediately
      setExecutionState("running"); // Starts execution automatically
    } else {
      setCurrentTab("arena"); // Custom Mode also opens Arena immediately
      setExecutionState("setup"); // Custom mode holds execution in edit phase
    }

    try {
      const response = await fetch("/api/gemini/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText })
      });
      const data = await response.json();
      
      const reasoning = data.reasoning || `Successfully resolved pipeline routing for your goal: "${promptText}". Generating specialized agent nodes for immediate execution.`;
      setFullReasoningText(reasoning);

      // Save AI message to chat log
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: `Orchestrating pipeline. Here is the operational design:\n\n${reasoning}`,
        reasoning: reasoning,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, aiMsg]);

      // Generate dynamic agents
      const thematicNodes = generateThematicAgents(promptText);
      setNodes(thematicNodes);

      // Synchronize connections based on the prompt theme
      const p = promptText.toLowerCase();
      if (p.includes("startup") || p.includes("launch") || p.includes("business")) {
        setConnections([
          { from: "research", to: "designer" },
          { from: "research", to: "developer" },
          { from: "designer", to: "coach" },
          { from: "developer", to: "marketer" }
        ]);
      } else if (p.includes("code") || p.includes("audit") || p.includes("build") || p.includes("develop")) {
        setConnections([
          { from: "architect", to: "coder" },
          { from: "architect", to: "auditor" },
          { from: "coder", to: "qa" },
          { from: "auditor", to: "qa" }
        ]);
      } else {
        setConnections([
          { from: "research", to: "coder" },
          { from: "research", to: "reviewer" },
          { from: "coder", to: "coordinator" },
          { from: "reviewer", to: "coordinator" }
        ]);
      }

      // Add new prompt to Recents history if not already there
      const title = promptText.length > 25 ? promptText.substring(0, 25) + "..." : promptText;
      if (!recentChats.some(c => c.prompt === promptText)) {
        setRecentChats(prev => [{ id: Date.now().toString(), title, prompt: promptText, mode: isAutoMode ? "auto" : "custom" }, ...prev]);
      }
      
      setStatusMessage("");
    } catch (err: any) {
      console.error(err);
      setStatusMessage("Utilizing offline localized agent patterns...");
      
      const fallbackReasoning = `Running localized Solospace model configuration. Orchestrating specialized agent structures for: "${promptText}". Node links are active.`;
      setFullReasoningText(fallbackReasoning);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: `Using local backup coordination pipeline to build workspace nodes:\n\n${fallbackReasoning}`,
        reasoning: fallbackReasoning,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, aiMsg]);

      // Create thematic nodes locally
      const thematicNodes = generateThematicAgents(promptText);
      setNodes(thematicNodes);

      // Synchronize connections on fallback theme
      const p = promptText.toLowerCase();
      if (p.includes("startup") || p.includes("launch") || p.includes("business")) {
        setConnections([
          { from: "research", to: "designer" },
          { from: "research", to: "developer" },
          { from: "designer", to: "coach" },
          { from: "developer", to: "marketer" }
        ]);
      } else if (p.includes("code") || p.includes("audit") || p.includes("build") || p.includes("develop")) {
        setConnections([
          { from: "architect", to: "coder" },
          { from: "architect", to: "auditor" },
          { from: "coder", to: "qa" },
          { from: "auditor", to: "qa" }
        ]);
      } else {
        setConnections([
          { from: "research", to: "coder" },
          { from: "research", to: "reviewer" },
          { from: "coder", to: "coordinator" },
          { from: "reviewer", to: "coordinator" }
        ]);
      }
    }
  };

  // Node editing actions
  const updateSelectedNodeField = (updates: Partial<CanvasNode>) => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.map(n => {
      if (n.id === selectedNodeId) {
        return { ...n, ...updates };
      }
      return n;
    }));
  };

  const handleAddRule = () => {
    if (!newRuleText.trim() || !selectedNodeId) return;
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    updateSelectedNodeField({
      rules: [...node.rules, newRuleText.trim()]
    });
    setNewRuleText("");
  };

  const handleDeleteRule = (ruleIndex: number) => {
    if (!selectedNodeId) return;
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    updateSelectedNodeField({
      rules: node.rules.filter((_, idx) => idx !== ruleIndex)
    });
  };

  const handleDeleteNode = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.from !== nodeId && c.to !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      setIsConfigPanelOpen(false);
    }
  };

  const handleAddNewAgentNode = () => {
    const randomId = `custom_agent_${Date.now().toString().slice(-4)}`;
    const newNode: CanvasNode = {
      id: randomId,
      name: "New Agent",
      tag: "USER_CUSTOM_NODE",
      x: 150 + Math.random() * 100,
      y: 150 + Math.random() * 100,
      status: "IDLE",
      metricLabel: "Tasks Completed",
      metricVal: "0",
      icon: "science",
      objective: "Enter your agent goals here...",
      personality: "Pragmatic, logical, responsive",
      systemPrompt: "You are a custom assistant. Fulfill user demands precisely.",
      rules: ["Verify actions before launching"],
      tools: ["Web Search"],
      temp: 0.5,
      logic: 80,
      empathy: 50,
      context: "128k",
      enabled: true,
      priority: 5,
      toolPermissions: {
        "Web Search": "ALLOWED"
      },
      toolLogs: []
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(randomId);
    setIsConfigPanelOpen(true);
  };

  const simulateToolExecution = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.tools || node.tools.length === 0) return;

    // Pick a random tool
    const tool = node.tools[Math.floor(Math.random() * node.tools.length)];
    
    // Pick an action and details based on tool type
    let action = "Call";
    let detail = "Invoked dynamic agent tool operation";
    
    switch (tool) {
      case "Web Search":
        action = "Search";
        detail = "Searched for cryptocurrency derivatives and token vaults";
        break;
      case "Browser":
        action = "Crawl";
        detail = "Inspected staging endpoints and loaded headless frames";
        break;
      case "Memory":
        action = "Query";
        detail = "Fetched user historical embeddings from vector database store";
        break;
      case "File Upload":
        action = "Upload";
        detail = "Uploaded smart contract audit ledger spreadsheet";
        break;
      case "Code Executor":
        action = "Compile";
        detail = "Executed sandbox script test suite run";
        break;
      case "Vision":
        action = "Analyze";
        detail = "Recognized landing page wireframe alignment margins";
        break;
      case "Voice":
        action = "Synthesize";
        detail = "Generated text-to-speech audio feedback voice";
        break;
      case "API Connector":
        action = "Request";
        detail = "Fired webhook trigger payload to Vercel deploy hook";
        break;
    }

    const permission = node.toolPermissions?.[tool] || "ALLOWED";
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logId = "sim-log-" + Date.now();

    if (permission === "ALLOWED") {
      const newLog = { id: logId, timestamp, tool, action, status: "SUCCESS" as const, detail };
      setNodes(prev => prev.map(n => {
        if (n.id === nodeId) {
          return { ...n, toolLogs: [newLog, ...(n.toolLogs || [])] };
        }
        return n;
      }));
    } else if (permission === "DENIED") {
      const newLog = { 
        id: logId, 
        timestamp, 
        tool, 
        action, 
        status: "BLOCKED" as const, 
        detail: `Permission Denied: blocked run request to '${detail}'` 
      };
      setNodes(prev => prev.map(n => {
        if (n.id === nodeId) {
          return { ...n, toolLogs: [newLog, ...(n.toolLogs || [])] };
        }
        return n;
      }));
    } else if (permission === "ASK") {
      const newLog = { 
        id: logId, 
        timestamp, 
        tool, 
        action, 
        status: "PENDING" as const, 
        detail: `Waiting for user permission to execute '${detail}'` 
      };
      setNodes(prev => prev.map(n => {
        if (n.id === nodeId) {
          return { ...n, toolLogs: [newLog, ...(n.toolLogs || [])] };
        }
        return n;
      }));
      setPendingApproval({ nodeId, toolName: tool, action, detail, logId });
    }
  };

  const handleDeployCluster = () => {
    setIsDeploying(true);
    setDeploymentLog(["Readying container clusters...", "Securing communications...", "Validating agent objective functions..."]);
    
    setTimeout(() => {
      setDeploymentLog(prev => [...prev, `Streaming active tools configuration to ${nodes.length} nodes...`]);
    }, 1000);

    setTimeout(() => {
      nodes.forEach((n, idx) => {
        setTimeout(() => {
          setDeploymentLog(prev => [...prev, `[Node: ${n.name}] Online. Tools attached: [${n.tools.join(", ")}]. Creativity: ${n.temp}.`]);
        }, idx * 400);
      });
    }, 2000);

    setTimeout(() => {
      setDeploymentLog(prev => [...prev, "Compiling pipeline routing... Connections verified.", "Solospace OS container successfully running on Host Port 3000."]);
    }, 2000 + nodes.length * 400);
  };

  const handlePresetSelect = (presetText: string) => {
    setUserQuery(presetText);
  };

  const handleLoadRecentChat = (chat: RecentChat) => {
    setUserQuery(chat.prompt);
    setIsAutoMode(chat.mode === "auto");
    startOrchestration(chat.prompt);
  };

  const activeNodeDetail = nodes.find(n => n.id === selectedNodeId);

  // Helper icons selector
  const getRenderIconNode = (iconName: string) => {
    switch (iconName) {
      case "science": return <FlaskConical className="w-5 h-5 text-white" />;
      case "code": return <Code className="w-5 h-5 text-white" />;
      case "trending_up": return <TrendingUp className="w-5 h-5 text-white" />;
      default: return <Bot className="w-5 h-5 text-white" />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-black text-[#f5f5f5] overflow-hidden font-sans">
      
      {/* 1. Collapsible Sidebar */}
      <aside 
        className={`flex flex-col h-full bg-[#0d0d0d] border-r border-[#1f1f1f] shrink-0 transition-all duration-300 z-30 select-none ${
          isSidebarExpanded ? "w-64" : "w-[60px]"
        }`}
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
              className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sidebar Nav Buttons */}
        <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto custom-scrollbar">
          
          {/* Toggle sidebar button when collapsed */}
          {!isSidebarExpanded && (
            <button 
              onClick={() => setIsSidebarExpanded(true)}
              className="w-full flex items-center justify-center py-2.5 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-all"
              title="Expand sidebar"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* New Chat Button */}
          <button 
            onClick={() => {
              setWorkspaceState("home");
              setUserQuery("");
              setActivePrompt("");
              setStreamedReasoning("");
              setFullReasoningText("");
              setChatMessages([]);
              setDiscussionLogs([]);
              setStreamingMessage(null);
              setExecutionState("setup");
            }}
            onMouseEnter={() => setHoveredSidebarItem("New Chat")}
            onMouseLeave={() => setHoveredSidebarItem(null)}
            className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 ${
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
            onClick={() => setIsSecretOpen(true)}
            onMouseEnter={() => setHoveredSidebarItem("BYOK")}
            onMouseLeave={() => setHoveredSidebarItem(null)}
            className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 ${
              isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
            }`}
          >
            <Key className="w-5 h-5 stroke-[1.8]" />
            {isSidebarExpanded && <span className="text-xs font-semibold">BYOK</span>}
            {!isSidebarExpanded && hoveredSidebarItem === "BYOK" && (
              <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
                Bring Your Own Key
              </div>
            )}
          </button>

          {/* Templates Selector */}
          <button 
            onClick={() => {
              setWorkspaceState("active");
              setCurrentTab("arena");
              startOrchestration("Scaffold smart contract audits for Rust validator nodes");
            }}
            onMouseEnter={() => setHoveredSidebarItem("Templates")}
            onMouseLeave={() => setHoveredSidebarItem(null)}
            className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 ${
              isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
            }`}
          >
            <Component className="w-5 h-5 stroke-[1.8]" />
            {isSidebarExpanded && <span className="text-xs font-semibold">Templates</span>}
            {!isSidebarExpanded && hoveredSidebarItem === "Templates" && (
              <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
                Load Templates
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
                {recentChats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleLoadRecentChat(c)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-neutral-900 text-xs text-neutral-400 hover:text-white truncate font-medium block"
                    title={c.prompt}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          )}

        </nav>

        {/* Sidebar Footer (Profile + Settings) */}
        <div className="p-2 border-t border-[#1f1f1f] space-y-1 select-none">
          <button 
            onClick={() => setIsSecretOpen(true)}
            className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 ${
              isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
            }`}
          >
            <Settings className="w-4 h-4" />
            {isSidebarExpanded && <span className="text-xs">Settings</span>}
          </button>

          <button 
            onClick={() => setIsProfileOpen(true)}
            className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 ${
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

      {/* 2. Core Workspace Window */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#000000] relative">
        
        {/* Dynamic Header Tabs */}
        <header className="flex justify-between items-center w-full px-6 h-16 border-b border-[#141414] shrink-0 z-10 bg-black/85 backdrop-blur-md">
          {/* Left Panel Button placeholder if sidebar collapsed */}
          <div className="flex items-center gap-2">
            {!isSidebarExpanded && (
              <button 
                onClick={() => setIsSidebarExpanded(true)}
                className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors"
                title="Expand sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 select-none">SOLOSPACE PROTOCOL</span>
          </div>

          {/* Core Mode Selectors */}
          <div className="flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-[2px] rounded-full select-none">
            {workspaceState === "home" ? (
              // Tabs in Home mode: Chat and Flow
              <>
                <button 
                  onClick={() => setCurrentTab("chat")}
                  className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    currentTab === "chat" 
                      ? "bg-neutral-800 text-white" 
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Chat
                </button>
                <button 
                  onClick={() => {
                    setWorkspaceState("active");
                    setCurrentTab("arena");
                  }}
                  className="px-6 py-1.5 rounded-full text-xs font-semibold text-neutral-400 hover:text-white transition-all"
                >
                  Flow
                </button>
              </>
            ) : (
              // Tabs in Active mode: Chat and Arena
              <>
                <button 
                  onClick={() => setCurrentTab("chat")}
                  className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    currentTab === "chat" 
                      ? "bg-neutral-800 text-white" 
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Chat
                </button>
                <button 
                  onClick={() => setCurrentTab("arena")}
                  className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    currentTab === "arena" 
                      ? "bg-neutral-800 text-white" 
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Arena
                </button>
              </>
            )}
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-4 select-none">
            {workspaceState === "active" && (
              <button
                onClick={handleDeployCluster}
                className="bg-white hover:bg-neutral-200 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-black text-black" />
                <span>Deploy</span>
              </button>
            )}

            <button 
              onClick={() => alert("Notification center: 0 alerts, cluster container is running.")}
              className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors"
            >
              <Bell className="w-4.5 h-4.5 stroke-[1.8]" />
            </button>
            
            <button 
              onClick={() => alert("Help Center: Describe any idea. Select Auto Agents to dynamically deploy autonomous pipelines, or Custom Agents to configure rule parameters and personality grids before starting.")}
              className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors"
            >
              <HelpCircle className="w-4.5 h-4.5 stroke-[1.8]" />
            </button>
          </div>
        </header>

        {/* View Layout Conditional Render */}
        <div className="flex-1 relative overflow-hidden">
          
          {/* A. HOME SCREEN (Before Search) */}
          {workspaceState === "home" && (
            <div className="absolute inset-0 flex flex-col justify-between overflow-y-auto custom-scrollbar">
              <div /> {/* Spacing */}

              {/* Home Center Block */}
              <div className="w-full max-w-2xl mx-auto px-6 py-12 flex flex-col items-center">
                <div className="text-center mb-10 space-y-2 select-none">
                  <h1 className="text-4xl font-extrabold tracking-tight text-white antialiased">
                    What&apos;s on your mind today?
                  </h1>
                  <p className="text-sm text-neutral-400 font-sans">
                    Design and orchestrate your autonomous AI agent workspace.
                  </p>
                </div>

                {/* Search Bar pill shape */}
                <div className="w-full chatgpt-input-box rounded-[24px] p-2 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    {/* Left Attachment Icon */}
                    <button 
                      onClick={() => alert("File Upload: Maximum 10MB CSV/PDF datasets parsed into context tokens.")}
                      className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors shrink-0"
                      title="Attach File"
                    >
                      <UploadCloud className="w-5 h-5 stroke-[1.8]" />
                    </button>

                    {/* Input */}
                    <input 
                      type="text"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") startOrchestration(userQuery);
                      }}
                      placeholder="Describe your idea, problem, or workflow..."
                      className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0"
                    />

                    {/* Right side icons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={() => alert("Voice transcription interface active...")}
                        className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors"
                        title="Voice Input"
                      >
                        <Mic className="w-5 h-5 stroke-[1.8]" />
                      </button>

                      <button
                        onClick={() => startOrchestration(userQuery)}
                        disabled={!userQuery.trim()}
                        className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all font-semibold"
                        title="Send prompt"
                      >
                        <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mode Selector badges below search bar */}
                <div className="flex items-center gap-3 mt-5 select-none">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Mode Selector:</span>
                  
                  <button 
                    onClick={() => setIsAutoMode(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all ${
                      isAutoMode 
                        ? "bg-white text-black border-white font-bold" 
                        : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
                    }`}
                  >
                    <Zap className="w-3 h-3 stroke-[2]" />
                    <span>Auto Agents</span>
                  </button>

                  <button 
                    onClick={() => setIsAutoMode(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all ${
                      !isAutoMode 
                        ? "bg-white text-black border-white font-bold" 
                        : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
                    }`}
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Custom Agents</span>
                  </button>
                </div>

                {/* Quick start suggestion cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-12 select-none">
                  <div 
                    onClick={() => {
                      setIsAutoMode(true);
                      startOrchestration("Help me launch a DeFi startup with cross-chain staking support");
                    }}
                    className="border border-[#1f1f1f] bg-[#050505] hover:bg-[#0a0a0a] hover:border-neutral-700 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between h-24"
                  >
                    <Bot className="w-4 h-4 text-neutral-500" />
                    <div>
                      <h3 className="text-xs font-semibold text-white">Startup Launchpad</h3>
                      <p className="text-[10px] text-neutral-500 mt-1 truncate">Draft strategy, mockups, and pitch decks.</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => {
                      setIsAutoMode(false);
                      startOrchestration("Audit smart contract algorithms and run code sandbox specifications");
                    }}
                    className="border border-[#1f1f1f] bg-[#050505] hover:bg-[#0a0a0a] hover:border-neutral-700 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between h-24"
                  >
                    <Code className="w-4 h-4 text-neutral-500" />
                    <div>
                      <h3 className="text-xs font-semibold text-white">Smart Contract Audit</h3>
                      <p className="text-[10px] text-neutral-500 mt-1 truncate">Inject rules and custom test suites.</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => {
                      setIsAutoMode(true);
                      startOrchestration("Generate a viral growth loop structure for our web3 app launch");
                    }}
                    className="border border-[#1f1f1f] bg-[#050505] hover:bg-[#0a0a0a] hover:border-neutral-700 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between h-24"
                  >
                    <TrendingUp className="w-4 h-4 text-neutral-500" />
                    <div>
                      <h3 className="text-xs font-semibold text-white">Viral Growth Loop</h3>
                      <p className="text-[10px] text-neutral-500 mt-1 truncate">Optimize conversion coordinates.</p>
                    </div>
                  </div>
                </div>

              </div>

              <div /> {/* Spacing */}
            </div>
          )}

          {/* B. ACTIVE WORKSPACE (After Search) */}
          {workspaceState === "active" && (
            <div className="absolute inset-0 flex">
              
              {/* VIEW 1: CHAT MODE */}
              {currentTab === "chat" && (
                <div className="flex-1 flex flex-col justify-between overflow-hidden bg-black">
                  
                  {/* Streaming conversation messages */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    <div className="max-w-3xl mx-auto space-y-6 select-text">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="flex gap-4 items-start">
                          {msg.sender === "user" ? (
                            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center border border-[#1f1f1f] text-neutral-300 shrink-0 select-none">
                              <User className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-white/10 text-black shrink-0 select-none">
                              <Bot className="w-4 h-4" />
                            </div>
                          )}
                          
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between select-none">
                              <span className="text-[10px] font-bold text-neutral-500 font-mono">
                                {msg.sender === "user" ? "USER REQUEST" : "SOLOSPACE ORCHESTRATOR"}
                              </span>
                              <span className="text-[9px] text-neutral-600 font-mono">{msg.timestamp}</span>
                            </div>
                            
                            {msg.sender === "ai" && msg.reasoning && (
                              <div className="bg-[#050505] border border-[#141414] p-4 rounded-xl font-mono text-[11px] text-neutral-400 leading-relaxed max-w-full overflow-x-auto">
                                <div className="flex items-center gap-1.5 text-neutral-300 font-bold mb-2 text-[10px] tracking-wider select-none">
                                  <Sliders className="w-3.5 h-3.5 text-white" />
                                  <span>REASONING TRACE</span>
                                </div>
                                {streamedReasoning}
                                {streamedReasoning.length < fullReasoningText.length && (
                                  <span className="inline-block w-1 h-3 bg-white ml-0.5 cursor-blink" />
                                )}
                              </div>
                            )}

                            <p className="text-sm text-neutral-200 leading-relaxed font-sans whitespace-pre-wrap">
                              {msg.sender === "user" ? msg.text : "We have generated your custom Agent cluster mapping. Navigate to the Arena tab to visualize their layouts, attach drag-and-drop tools, modify rule systems, and deploy."}
                            </p>
                          </div>
                        </div>
                      ))}

                      {statusMessage && (
                        <div className="flex gap-4 items-center py-2 px-3 bg-neutral-950 border border-neutral-900 rounded-lg max-w-max select-none">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                          <span className="text-xs text-neutral-400 font-mono italic">{statusMessage}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom action suggestions */}
                  <div className="px-6 py-4 bg-black/60 border-t border-[#141414] backdrop-blur-xl">
                    <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => alert("Suggestions: Custom audit rules injected.")}
                          className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] rounded-full text-[10px] text-neutral-400 hover:text-white transition-colors"
                        >
                          Show API specs
                        </button>
                        <button 
                          onClick={() => alert("Suggestions: Initialized security vector matrix.")}
                          className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] rounded-full text-[10px] text-neutral-400 hover:text-white transition-colors"
                        >
                          Run dry mock
                        </button>
                      </div>

                      <div className="text-[10px] font-mono text-neutral-600">
                        LATENCY: 220ms
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* VIEW 2: ARENA CANVAS BUILDER */}
              {currentTab === "arena" && (
                <div 
                  className="flex-1 relative overflow-hidden select-none bg-[#000000] flex flex-col justify-between"
                  onMouseDown={handleCanvasMouseDown}
                >
                  {/* Background dot matrix */}
                  <div 
                    className="absolute inset-0 canvas-grid"
                    style={{
                      backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
                    }}
                  />

                  {/* Zoom / Pan viewport wrapper */}
                  <div
                    className="absolute inset-0 origin-center transition-transform duration-75 ease-out"
                    style={{
                      transform: `translateX(${panOffset.x}px) translateY(${panOffset.y}px) scale(${canvasScale})`,
                    }}
                  >
                    
                    {/* SVG connection cables */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                      <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#333333" />
                        </marker>
                      </defs>

                      {/* Render Dynamic Node Connections */}
                      {connections.map((conn, idx) => {
                        const fromNode = nodes.find(n => n.id === conn.from);
                        const toNode = nodes.find(n => n.id === conn.to);
                        
                        if (!fromNode || !toNode || !fromNode.enabled || !toNode.enabled) return null;

                        const startX = fromNode.x + 240;
                        const startY = fromNode.y + 65;
                        const endX = toNode.x;
                        const endY = toNode.y + 65;

                        return (
                          <path 
                            key={`conn-${idx}`}
                            d={`M ${startX} ${startY} C ${startX + 80} ${startY}, ${endX - 80} ${endY}, ${endX} ${endY}`}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.2)"
                            strokeWidth="1.5"
                            strokeDasharray="5,5"
                            markerEnd="url(#arrow)"
                            className="connection-line"
                          />
                        );
                      })}
                    </svg>

                    {/* RENDER CANVAS NODES */}
                    {nodes.map((node) => {
                      const isSelected = selectedNodeId === node.id;
                      const isTarget = droppedToolTarget === node.id;
                      const isNodeEnabled = node.enabled !== false;
                      const isActive = isNodeEnabled && (node.status === "ACTIVE" || node.status === "PROCESSING" || node.status === "SCANNING WEB");
                      const isConnected = connections.some(c => c.from === node.id || c.to === node.id);

                      return (
                        <div 
                          key={node.id}
                          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDropToolOnNode(e, node.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNodeId(node.id);
                            setIsConfigPanelOpen(true);
                          }}
                          className={`absolute w-60 glass-panel rounded-xl p-4 cursor-move agent-node-card select-none transition-all duration-150 ${
                            isSelected ? "ring-1 ring-white border-white scale-[1.01] bg-[#0c0c0c]/90 shadow-2xl" : ""
                          } ${
                            isTarget ? "ring-2 ring-emerald-500 border-emerald-500 scale-105" : ""
                          } ${
                            isActive ? "node-active-pulse" : ""
                          } ${
                            !isNodeEnabled ? "opacity-35 grayscale border-dashed border-neutral-800 bg-[#050505]" : ""
                          }`}
                          style={{
                            left: `${node.x}px`,
                            top: `${node.y}px`,
                            zIndex: isSelected ? 20 : 10
                          }}
                        >
                          {/* Hover action overlay panel */}
                          {hoveredNodeId === node.id && (
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-1 rounded-lg gap-1 shadow-lg pointer-events-auto z-30">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedNodeId(node.id);
                                  setIsConfigPanelOpen(true);
                                }}
                                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                                title="Edit Configuration"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPanOffset({
                                    x: -node.x * canvasScale + 250,
                                    y: -node.y * canvasScale + 200
                                  });
                                }}
                                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                                title="Focus Node"
                              >
                                <Maximize className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={(e) => handleDeleteNode(node.id, e)}
                                className="p-1 hover:bg-red-950 hover:text-red-400 rounded text-neutral-400"
                                title="Delete Agent"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Node Header */}
                          <div className="flex justify-between items-start mb-3">
                            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center border border-[#1f1f1f]">
                              {getRenderIconNode(node.icon)}
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              {/* Priority Badge */}
                              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-500 border border-[#141414] font-bold">
                                P:{node.priority}
                              </span>
                              
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#1f1f1f] bg-black text-[8px] font-mono">
                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white animate-pulse" : "bg-neutral-600"}`} />
                                <span className="text-neutral-300 font-semibold">
                                  {isNodeEnabled ? node.status : "DISABLED"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Info */}
                          <div>
                            <h4 className="text-xs font-bold text-white tracking-tight">{node.name}</h4>
                            <p className="text-[10px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">{node.objective}</p>
                          </div>

                          {/* Telemetry log output */}
                          <div className="mt-4 pt-3 border-t border-[#141414] space-y-1.5">
                            <div className="flex justify-between items-center bg-black/55 py-1 px-2 rounded text-[9px] font-mono border border-[#141414]">
                              <span className="text-neutral-500">{node.metricLabel}</span>
                              <span className="text-neutral-200 font-bold">{node.metricVal}</span>
                            </div>

                             {/* Active tools tag links */}
                             {node.tools.length > 0 && (
                               <div className="flex flex-wrap gap-1 mt-2">
                                 {node.tools.map((t) => {
                                   const permission = node.toolPermissions?.[t] || "ALLOWED";
                                   return (
                                     <span 
                                       key={t} 
                                       className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 border border-[#1f1f1f] text-neutral-400 flex items-center gap-1 hover:border-neutral-500 transition-colors"
                                       title={`Permission: ${permission}`}
                                     >
                                       <span className={`w-1 h-1 rounded-full ${
                                         permission === "ALLOWED" ? "bg-emerald-500" :
                                         permission === "ASK" ? "bg-amber-500" : "bg-rose-500"
                                       }`} />
                                       {t}
                                     </span>
                                   );
                                 })}
                               </div>
                             )}
                          </div>

                          {/* Left Connection Handle (Input Port) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (connectingSourceId !== null && connectingSourceId !== node.id) {
                                const exists = connections.some(c => c.from === connectingSourceId && c.to === node.id);
                                if (exists) {
                                  setConnections(prev => prev.filter(c => !(c.from === connectingSourceId && c.to === node.id)));
                                } else {
                                  setConnections(prev => [...prev, { from: connectingSourceId, to: node.id }]);
                                }
                                setConnectingSourceId(null);
                              } else if (connectingSourceId === null) {
                                // Disconnect incoming connections when clicked alone
                                setConnections(prev => prev.filter(c => c.to !== node.id));
                              }
                            }}
                            className={`absolute top-[65px] left-0 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border bg-black transition-all flex items-center justify-center cursor-pointer z-30 ${
                              isConnected ? "border-emerald-500 hover:bg-emerald-950/60" : "border-rose-500 hover:bg-rose-950/60"
                            }`}
                            title={
                              connectingSourceId !== null
                                ? `Click to connect ${connectingSourceId} to ${node.name}`
                                : isConnected
                                  ? "Input Port (Click to disconnect incoming connections)"
                                  : "Input Port"
                            }
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                          </button>

                          {/* Right Connection Handle (Output Port) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (connectingSourceId === null) {
                                setConnectingSourceId(node.id);
                              } else if (connectingSourceId === node.id) {
                                setConnectingSourceId(null);
                              } else {
                                setConnectingSourceId(node.id);
                              }
                            }}
                            className={`absolute top-[65px] right-0 translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border bg-black transition-all flex items-center justify-center cursor-pointer z-30 ${
                              isConnected ? "border-emerald-500 hover:bg-emerald-950/60" : "border-rose-500 hover:bg-rose-950/60"
                            } ${connectingSourceId === node.id ? "ring-2 ring-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.8)]" : ""}`}
                            title={
                              connectingSourceId === node.id
                                ? "Click again to cancel connecting"
                                : "Output Port (Click to start connecting)"
                            }
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                          </button>
                        </div>
                      );
                    })}

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
                        
                        {/* Hover Tooltip */}
                        <div className="absolute left-12 bg-[#0c0c0c] border border-[#1f1f1f] p-2.5 rounded-lg text-left hidden group-hover:block w-40 z-30 shadow-2xl pointer-events-none">
                          <h4 className="text-[10px] font-bold text-white">{tool.name}</h4>
                          <p className="text-[9px] text-neutral-400 mt-0.5 leading-relaxed">{tool.desc}</p>
                          <span className="text-[8px] font-mono text-neutral-600 block mt-1.5 italic">Drag onto agent node</span>
                        </div>
                      </div>
                    ))}
                  </div>


                  {/* Floating Action control tools (zoom scale / pans) */}
                  <div className="absolute left-4 bottom-14 flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-1 rounded-xl z-20 shadow-2xl">
                    <button 
                      onClick={() => setCanvasScale(prev => Math.min(2.5, prev * 1.1))}
                      className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
                      title="Zoom In"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    
                    <span className="px-3 font-mono text-[9px] font-bold text-neutral-400 w-12 text-center select-none">
                      {Math.round(canvasScale * 100)}%
                    </span>

                    <button 
                      onClick={() => setCanvasScale(prev => Math.max(0.4, prev / 1.1))}
                      className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
                      title="Zoom Out"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <button 
                      onClick={() => {
                        setCanvasScale(1);
                        setPanOffset({ x: 0, y: 0 });
                      }}
                      className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors border-l border-[#1f1f1f] ml-1"
                      title="Reset View"
                    >
                      <Maximize className="w-3.5 h-3.5" />
                    </button>

                    <button 
                      onClick={handleAddNewAgentNode}
                      className="p-2 text-white hover:bg-neutral-900 rounded-lg transition-colors border-l border-[#1f1f1f] ml-1 flex items-center gap-1 text-[10px]"
                      title="Add Custom Agent Node"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      <span className="font-semibold pr-1">Node</span>
                    </button>
                  </div>

                </div>
              )}

              {/* C. BOTTOM FLOATING INPUT BAR FOR CUSTOM AGENT MODE */}
              {!isAutoMode && executionState === "setup" && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-20 pointer-events-none select-none">
                  <div className="bg-[#0c0c0c]/90 border border-[#1f1f1f] backdrop-blur-md rounded-2xl p-2.5 flex items-center justify-between gap-3 shadow-2xl pointer-events-auto">
                    <div className="flex-1 flex flex-col justify-center px-1">
                      <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider block font-bold">Custom Build Stage</span>
                      <input 
                        type="text"
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") startOrchestration(userQuery);
                        }}
                        placeholder="Steer configuration parameters..."
                        className="bg-transparent border-none text-xs text-neutral-200 outline-none w-full mt-0.5 focus:ring-0"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {userQuery.trim() && (
                        <button
                          onClick={() => startOrchestration(userQuery)}
                          className="bg-neutral-900 border border-[#1f1f1f] hover:border-neutral-500 text-neutral-200 hover:text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md"
                          title="Steer configuration with new parameters"
                        >
                          Steer
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setExecutionState("running");
                          setNodes(prev => prev.map(n => n.enabled ? { ...n, status: "ACTIVE" } : n));
                        }}
                        className="bg-white hover:bg-neutral-200 text-black font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5"
                      >
                        <span>Launch Pipeline</span>
                        <ArrowRight className="w-3.5 h-3.5 text-black stroke-[3]" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </main>

      {/* 3. RIGHT Sliding Configuration Edit Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-[400px] bg-[#0c0c0c]/95 border-l border-[#1f1f1f] z-40 flex flex-col justify-between shadow-2xl transition-transform duration-300 right-panel select-none ${
          isConfigPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel collapse toggle tab */}
        <button 
          onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
          className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-[#0c0c0c]/95 border border-[#1f1f1f] border-r-0 rounded-l-xl flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
        >
          {isConfigPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {activeNodeDetail ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* Header */}
            <div className="p-5 border-b border-[#1f1f1f] flex justify-between items-center bg-[#0d0d0d]">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{activeNodeDetail.name}</h3>
                <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest block mt-0.5">{activeNodeDetail.tag}</span>
              </div>
              <button 
                onClick={() => setIsConfigPanelOpen(false)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Editable Configuration Forms */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
              
              {/* Toggle Switch: Active State (Enable / Disable) */}
              <div className="flex items-center justify-between bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Node Active Toggle</span>
                  <span className="text-[9px] text-neutral-500 mt-0.5">Disable to exclude this agent from pipeline</span>
                </div>
                <button
                  onClick={() => updateSelectedNodeField({ enabled: !activeNodeDetail.enabled })}
                  className={`w-10 h-5 rounded-full p-0.5 transition-all duration-200 ${
                    activeNodeDetail.enabled ? "bg-white" : "bg-neutral-800"
                  }`}
                >
                  <div 
                    className={`w-4 h-4 rounded-full transition-transform ${
                      activeNodeDetail.enabled ? "bg-black translate-x-5" : "bg-neutral-600 translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Priority Slider */}
              <div className="space-y-1 bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
                <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
                  <span>Execution Priority</span>
                  <span className="text-white">Level {activeNodeDetail.priority}</span>
                </div>
                <input 
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={activeNodeDetail.priority}
                  onChange={(e) => updateSelectedNodeField({ priority: parseInt(e.target.value) })}
                  className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer mt-2"
                />
              </div>

              {/* Field 1: Name */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Agent Identifier Name</label>
                <input 
                  type="text"
                  value={activeNodeDetail.name}
                  onChange={(e) => updateSelectedNodeField({ name: e.target.value })}
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
                />
              </div>

              {/* Field 2: Personality */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Personality Alignment</label>
                <input 
                  type="text"
                  value={activeNodeDetail.personality}
                  onChange={(e) => updateSelectedNodeField({ personality: e.target.value })}
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
                />
              </div>

              {/* Field 3: System Prompt */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">System Prompt Directive</label>
                <textarea 
                  value={activeNodeDetail.systemPrompt}
                  onChange={(e) => updateSelectedNodeField({ systemPrompt: e.target.value })}
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[80px] resize-none leading-relaxed"
                />
              </div>

              {/* Field 4: Core Goal Objective */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Goal Objective</label>
                <textarea 
                  value={activeNodeDetail.objective}
                  onChange={(e) => updateSelectedNodeField({ objective: e.target.value })}
                  className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[60px] resize-none leading-relaxed"
                />
              </div>

              {/* Field 5: Rules Manager */}
              <div className="space-y-2">
                <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold block">Instruction Rules</label>
                
                {/* Rule list */}
                <div className="space-y-1.5">
                  {activeNodeDetail.rules.map((rule, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
                      <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">{rule}</span>
                      <button 
                        onClick={() => handleDeleteRule(idx)}
                        className="text-neutral-500 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new rule */}
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newRuleText}
                    onChange={(e) => setNewRuleText(e.target.value)}
                    placeholder="Add operational constraint..."
                    className="flex-1 bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-neutral-500"
                  />
                  <button 
                    onClick={handleAddRule}
                    className="bg-white text-black font-bold text-xs px-3 rounded-lg hover:bg-neutral-200"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Field 6: Sliders Panel */}
              <div className="space-y-4 pt-3 border-t border-[#141414]">
                
                {/* Creativity (Temp) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
                    <span>Creativity (Temp)</span>
                    <span className="text-white">{activeNodeDetail.temp}</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={activeNodeDetail.temp}
                    onChange={(e) => updateSelectedNodeField({ temp: parseFloat(e.target.value) })}
                    className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Logic Depth */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
                    <span>Logic / Depth</span>
                    <span className="text-white">{activeNodeDetail.logic}%</span>
                  </div>
                  <input 
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={activeNodeDetail.logic}
                    onChange={(e) => updateSelectedNodeField({ logic: parseInt(e.target.value) })}
                    className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Empathy Index */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
                    <span>Empathy / Support</span>
                    <span className="text-white">{activeNodeDetail.empathy}%</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={activeNodeDetail.empathy}
                    onChange={(e) => updateSelectedNodeField({ empathy: parseInt(e.target.value) })}
                    className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer"
                  />
              </div>
            </div>

              {/* Dynamic Tool Integrations Section */}
              <div className="pt-5 border-t border-[#141414] space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Dynamic Tool Integrations</label>
                  <span className="text-[8px] font-mono text-neutral-500 uppercase">Attached: {activeNodeDetail.tools?.length || 0}</span>
                </div>

                {/* Attach Tool Selector */}
                <div className="flex gap-2">
                  <select
                    id="tool-selector-dropdown"
                    className="flex-1 bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
                    defaultValue=""
                    onChange={(e) => {
                      const toolName = e.target.value;
                      if (!toolName) return;
                      
                      const currentTools = activeNodeDetail.tools || [];
                      if (!currentTools.includes(toolName)) {
                        const updatedTools = [...currentTools, toolName];
                        const permissions = activeNodeDetail.toolPermissions || {};
                        const updatedPerms = { ...permissions, [toolName]: permissions[toolName] || "ALLOWED" };
                        updateSelectedNodeField({ 
                          tools: updatedTools,
                          toolPermissions: updatedPerms
                        });
                      }
                      e.target.value = ""; // Reset selector
                    }}
                  >
                    <option value="" disabled>+ Attach custom agent tool...</option>
                    {[
                      "Web Search",
                      "Browser",
                      "Memory",
                      "File Upload",
                      "Code Executor",
                      "Vision",
                      "Voice",
                      "API Connector"
                    ].filter(tool => !(activeNodeDetail.tools || []).includes(tool)).map(tool => (
                      <option key={tool} value={tool}>{tool}</option>
                    ))}
                  </select>
                </div>

                {/* Tools Configuration list */}
                <div className="space-y-3">
                  {(!activeNodeDetail.tools || activeNodeDetail.tools.length === 0) ? (
                    <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-4 text-center rounded-xl">
                      <p className="text-[10px] text-neutral-500">No tools attached to this agent. Drag a tool onto the agent node or select one above.</p>
                    </div>
                  ) : (
                    activeNodeDetail.tools.map((tool) => {
                      const currentPermissions = activeNodeDetail.toolPermissions || {};
                      const permission = currentPermissions[tool] || "ALLOWED";
                      return (
                        <div key={tool} className="bg-[#050505] border border-[#1f1f1f] p-3 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                permission === "ALLOWED" ? "bg-emerald-500 animate-pulse" :
                                permission === "ASK" ? "bg-amber-500" : "bg-rose-500"
                              }`} />
                              {tool}
                            </span>
                            <button
                              onClick={() => {
                                const updatedTools = (activeNodeDetail.tools || []).filter(t => t !== tool);
                                const updatedPerms = { ...(activeNodeDetail.toolPermissions || {}) };
                                delete updatedPerms[tool];
                                updateSelectedNodeField({ 
                                  tools: updatedTools,
                                  toolPermissions: updatedPerms
                                });
                              }}
                              className="text-neutral-500 hover:text-red-400 p-1 transition-colors"
                              title="Detach Tool"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Permission Selection Buttons */}
                          <div className="grid grid-cols-3 gap-1 pt-1">
                            {(["ALLOWED", "ASK", "DENIED"] as const).map((level) => (
                              <button
                                key={level}
                                onClick={() => {
                                  const updatedPerms = { 
                                    ...(activeNodeDetail.toolPermissions || {}), 
                                    [tool]: level 
                                  };
                                  updateSelectedNodeField({ toolPermissions: updatedPerms });
                                }}
                                className={`py-1 text-[9px] font-mono font-bold rounded-md border transition-all ${
                                  permission === level
                                    ? level === "ALLOWED"
                                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/50"
                                      : level === "ASK"
                                        ? "bg-amber-950/40 text-amber-400 border-amber-500/50"
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

              {/* Node Connections & Topology Section */}
              <div className="pt-5 border-t border-[#141414] space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Node Connections</label>
                  <span className="text-[8px] font-mono text-neutral-500 uppercase">
                    Links: {connections.filter(c => c.from === activeNodeDetail.id || c.to === activeNodeDetail.id).length}
                  </span>
                </div>

                {/* Attach Connection Dropdown */}
                <div className="flex gap-2">
                  <select
                    id="connection-selector-dropdown"
                    className="flex-1 bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
                    defaultValue=""
                    onChange={(e) => {
                      const targetId = e.target.value;
                      if (!targetId) return;

                      const exists = connections.some(c => 
                        (c.from === activeNodeDetail.id && c.to === targetId) ||
                        (c.from === targetId && c.to === activeNodeDetail.id)
                      );
                      if (!exists) {
                        setConnections(prev => [...prev, { from: activeNodeDetail.id, to: targetId }]);
                      }
                      e.target.value = ""; // Reset selector
                    }}
                  >
                    <option value="" disabled>+ Connect to another agent card...</option>
                    {nodes.filter(n => n.id !== activeNodeDetail.id).map(node => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                </div>

                {/* Linked Nodes List */}
                <div className="space-y-1.5">
                  {(() => {
                    const linkedConns = connections.filter(c => c.from === activeNodeDetail.id || c.to === activeNodeDetail.id);
                    if (linkedConns.length === 0) {
                      return (
                        <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-3 text-center rounded-xl">
                          <p className="text-[10px] text-neutral-500">No active connections. Click the indicator dot on the card or select an agent above to connect.</p>
                        </div>
                      );
                    }
                    return linkedConns.map((conn, index) => {
                      const otherNodeId = conn.from === activeNodeDetail.id ? conn.to : conn.from;
                      const otherNode = nodes.find(n => n.id === otherNodeId);
                      return (
                        <div key={index} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
                          <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">
                            {otherNode ? otherNode.name : otherNodeId}
                          </span>
                          <button 
                            onClick={() => {
                              setConnections(prev => prev.filter(c => c !== conn));
                            }}
                            className="text-neutral-500 hover:text-red-400 transition-colors shrink-0"
                            title="Disconnect Node"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Tool Execution Logs Section */}
              <div className="pt-5 border-t border-[#141414] space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Execution Logging</label>
                  <button
                    onClick={() => {
                      updateSelectedNodeField({ toolLogs: [] });
                    }}
                    className="text-[8px] font-mono text-neutral-500 hover:text-white uppercase transition-colors"
                  >
                    Clear Console
                  </button>
                </div>

                {/* Console Log Output */}
                <div className="bg-black border border-[#1f1f1f] rounded-xl p-3 h-44 overflow-y-auto font-mono text-[9px] space-y-1.5 custom-scrollbar">
                  {(!activeNodeDetail.toolLogs || activeNodeDetail.toolLogs.length === 0) ? (
                    <div className="h-full flex items-center justify-center text-neutral-600 text-center">
                      <span>Console idle. No tool logs recorded.</span>
                    </div>
                  ) : (
                    activeNodeDetail.toolLogs.map((log) => (
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

                {/* Simulation controls */}
                {activeNodeDetail.tools && activeNodeDetail.tools.length > 0 && (
                  <button
                    onClick={() => simulateToolExecution(activeNodeDetail.id)}
                    className="w-full py-2 bg-neutral-900 border border-[#1f1f1f] hover:border-neutral-500 text-neutral-200 hover:text-white rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Simulate Tool Execution
                  </button>
                )}
              </div>

            </div>

            {/* Save Buttons Drawer footer */}
            <div className="p-4 border-t border-[#1f1f1f] bg-[#0d0d0d] grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  alert("Discarded recent edits.");
                  setIsConfigPanelOpen(false);
                }}
                className="py-2.5 border border-[#1f1f1f] text-xs font-semibold text-neutral-400 hover:text-white rounded-lg transition-colors font-mono"
              >
                Discard
              </button>

              <button 
                onClick={() => {
                  alert("Saved custom agent configuration matrix.");
                  setIsConfigPanelOpen(false);
                }}
                className="py-2.5 bg-white hover:bg-neutral-100 text-black text-xs font-bold rounded-lg transition-all font-mono"
              >
                Save Config
              </button>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
            <Bot className="w-12 h-12 text-neutral-700 mb-3 animate-pulse" />
            <p className="text-xs text-neutral-500">Pick any active agent node in Arena to edit its configuration matrix.</p>
          </div>
        )}
      </div>

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
              <button 
                onClick={() => setIsSecretOpen(false)}
                className="absolute top-4 right-4 text-neutral-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex gap-4 items-center mb-6">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <Key className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Bring Your Own Key</h3>
                  <p className="text-xs text-neutral-400 font-sans mt-0.5">Integrate Solospace directly with your personal LLM API models.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">GEMINI_API_KEY override</label>
                  <input 
                    type="password"
                    placeholder="Enter AIzaSy... Google Studio Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500" 
                  />
                  <p className="text-[9px] text-neutral-500 font-mono leading-normal">
                    This overrides system API credentials and streams requests directly using your personal token.
                  </p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => {
                      alert("API credentials saved successfully.");
                      setIsSecretOpen(false);
                    }}
                    className="flex-1 py-2.5 bg-white hover:bg-neutral-100 text-black font-bold rounded-xl text-xs font-mono transition-colors"
                  >
                    Save API Key
                  </button>
                  <button 
                    onClick={() => setIsSecretOpen(false)}
                    className="px-5 py-2.5 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-xl text-xs font-mono transition-colors"
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
              <button 
                onClick={() => setIsProfileOpen(false)}
                className="absolute top-4 right-4 text-neutral-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center space-y-4 py-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1f1f1f] flex items-center justify-center bg-neutral-900">
                  <User className="w-8 h-8 text-neutral-500" />
                </div>
                
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">User Profile</h3>
                  <span className="text-xs text-neutral-400 font-mono">solospace_developer@gmail.com</span>
                </div>

                <div className="w-full pt-4 space-y-2 border-t border-[#141414]">
                  <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
                    <span className="text-neutral-500">Tier Grid:</span>
                    <span className="text-white font-bold">Enterprise Pro</span>
                  </div>
                  <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
                    <span className="text-neutral-500">Containers Deployed:</span>
                    <span className="text-white font-bold">18 Clusters</span>
                  </div>
                </div>

                <button 
                  onClick={() => setIsProfileOpen(false)}
                  className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-[#1f1f1f] text-neutral-300 hover:text-white font-bold rounded-xl text-xs font-mono transition-colors"
                >
                  Close Profile
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}

        {/* CONTAINER LIVE DEPLOYING LOG PROMPT MODAL */}
        {isDeploying && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-6 select-text"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-xl bg-black border border-[#1f1f1f] rounded-2xl p-6 relative font-mono space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#141414] select-none">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Deploying Cluster Pipeline</h3>
                </div>
                {deploymentLog.length >= nodes.length + 4 && (
                  <button 
                    onClick={() => {
                      setIsDeploying(false);
                      setDeploymentLog([]);
                    }}
                    className="p-1 hover:bg-neutral-950 text-neutral-400 hover:text-white rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Logs area */}
              <div className="space-y-2 min-h-[160px] bg-neutral-950 border border-[#141414] p-4 rounded-xl text-[10px] text-neutral-300 leading-relaxed overflow-y-auto custom-scrollbar max-h-80 select-all">
                {deploymentLog.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-neutral-600 select-none">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
                {deploymentLog.length < nodes.length + 4 && (
                  <div className="flex gap-2 animate-pulse text-white">
                    <span>&gt;</span>
                    <span>Synchronizing node parameters...</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-[10px] text-neutral-500 select-none">
                <span>PORT MAPPING: 3000 &rarr; 3000</span>
                {deploymentLog.length >= nodes.length + 4 ? (
                  <button 
                    onClick={() => {
                      setIsDeploying(false);
                      setDeploymentLog([]);
                    }}
                    className="px-4 py-2 bg-white text-black font-bold rounded font-mono text-[10px] hover:bg-neutral-200"
                  >
                    Finish
                  </button>
                ) : (
                  <span>ACTIVE PROCESS ROUTINES...</span>
                )}
              </div>

            </motion.div>
          </motion.div>
        )}

        {/* INTERACTIVE TOOL APPROVAL PROMPT TOAST */}
        {pendingApproval && (
          <div className="fixed bottom-6 right-6 w-96 bg-[#0d0d0d] border border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.15)] rounded-2xl p-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 select-none">
            <div className="flex gap-4 items-start">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 shrink-0">
                <Sliders className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-amber-500 font-mono tracking-widest uppercase">Permission Requested</span>
                  <span className="text-[9px] text-neutral-500 font-mono">Dynamic Agent Tool</span>
                </div>
                <h4 className="text-xs font-bold text-white">
                  Agent &apos;{nodes.find(n => n.id === pendingApproval.nodeId)?.name}&apos; calls <span className="text-amber-400 font-mono">[{pendingApproval.toolName}]</span>
                </h4>
                <p className="text-[10px] text-neutral-400 leading-normal">
                  Action: <span className="text-white font-semibold">{pendingApproval.action}</span> - {pendingApproval.detail}
                </p>
                
                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => {
                      // APPROVE Action
                      const node = nodes.find(n => n.id === pendingApproval.nodeId);
                      if (node) {
                        setNodes(prev => prev.map(n => {
                          if (n.id === pendingApproval.nodeId) {
                            const updatedLogs = (n.toolLogs || []).map(log => {
                              if (log.id === pendingApproval.logId) {
                                return {
                                  ...log,
                                  status: "SUCCESS" as const,
                                  detail: `User Approved: successfully executed '${pendingApproval.detail}'`
                                };
                              }
                              return log;
                            });
                            return { ...n, toolLogs: updatedLogs };
                          }
                          return n;
                        }));
                      }
                      setPendingApproval(null);
                    }}
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
                  >
                    Approve Request
                  </button>
                  <button
                    onClick={() => {
                      // DENY Action
                      const node = nodes.find(n => n.id === pendingApproval.nodeId);
                      if (node) {
                        setNodes(prev => prev.map(n => {
                          if (n.id === pendingApproval.nodeId) {
                            const updatedLogs = (n.toolLogs || []).map(log => {
                              if (log.id === pendingApproval.logId) {
                                return {
                                  ...log,
                                  status: "BLOCKED" as const,
                                  detail: `User Denied: blocked run request to '${pendingApproval.detail}'`
                                };
                              }
                              return log;
                            });
                            return { ...n, toolLogs: updatedLogs };
                          }
                          return n;
                        }));
                      }
                      setPendingApproval(null);
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

      </AnimatePresence>

    </div>
  );
}
