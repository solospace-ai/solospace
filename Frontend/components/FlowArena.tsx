import React, { useState, useCallback, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  BackgroundVariant, 
  MiniMap, 
  Panel, 
  useReactFlow,
  reconnectEdge,
  Connection,
  Edge,
  Node,
  Viewport
} from '@xyflow/react';
import { Plus, Minus, Maximize, PlusCircle, LayoutGrid, X } from 'lucide-react';
import { useWorkflowStore, CanvasNodeData } from '@/store/workflowStore';
import { CustomNode } from './nodes/CustomNode';
import { GroupNode } from './nodes/GroupNode';
import { CustomEdge } from './edges/CustomEdge';
import { ContextMenu } from './ContextMenu';
import dagre from 'dagre';

const nodeTypes = {
  custom: CustomNode,
  groupNode: GroupNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 150, ranksep: 200 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 240, height: 220 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 120,
        y: nodeWithPosition.y - 110,
      },
    };
  });
  return { nodes: layoutedNodes, edges };
};

export default function FlowArena({ onProceed }: { onProceed?: () => void }) {
  const { zoomIn, zoomOut, setViewport, getViewport, fitView } = useReactFlow();
  
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const addNode = useWorkflowStore((s) => s.addNode);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const isOrchestrating = useWorkflowStore((s) => s.isOrchestrating);
  const executionState = useWorkflowStore((s) => s.executionState);
  
  const isEchoHouseMode = useWorkflowStore((s) => s.activeSessionId ? s.sessions[s.activeSessionId]?.mode === 'echohouse' : false);

  // EchoHouse creation form state
  const [isEchoHouseCreateFormOpen, setIsEchoHouseCreateFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formProblem, setFormProblem] = useState("");

  const handleEchoHouseProceed = async () => {
    if (onProceed) onProceed();
    await useWorkflowStore.getState().triggerEchoHouseSimulation();
  };

  const handleNormalProceed = async () => {
    if (onProceed) onProceed();
    
    const activeSession = useWorkflowStore.getState().sessions[useWorkflowStore.getState().activeSessionId || ""];
    const mode = activeSession?.mode || "auto";
    
    if (mode === "auto") {
      const chatMessages = useWorkflowStore.getState().chatMessages;
      const lastUserMsg = chatMessages.findLast(m => m.sender === "user")?.text || "";
      useWorkflowStore.getState().triggerSteerOrchestration(lastUserMsg, true, "auto");
    } else if (mode === "custom") {
      await useWorkflowStore.getState().triggerCustomExecution();
    }
  };

  const handleCreateEchoHousePerson = () => {
    if (!formName.trim() || !formRole.trim() || !formProblem.trim()) return;

    const randomId = `echo_agent_${Date.now()}`;
    const view = getViewport();
    // Center new node inside view coordinates
    let x = (-view.x + window.innerWidth / 2 - 120) / view.zoom;
    let y = (-view.y + window.innerHeight / 2 - 100) / view.zoom;

    // Avoid collision
    const NODE_W = 240;
    const NODE_H = 220;
    const existingPositions = nodes.map(n => n.position);
    for (const pos of existingPositions) {
      if (Math.abs(x - pos.x) < NODE_W && Math.abs(y - pos.y) < NODE_H) {
        y = pos.y + NODE_H + 40;
      }
    }

    const newNode = {
      id: randomId,
      type: 'custom',
      position: { x: Math.max(50, x), y: Math.max(50, y) },
      data: {
        name: formName.trim(),
        tag: formRole.trim().toUpperCase().replace(/\s+/g, '_'),
        icon: "science",
        objective: `Provide perspective as ${formName.trim()} (${formRole.trim()}).`,
        systemPrompt: `You are ${formName.trim()}, whose role in the user's life is ${formRole.trim()}. From your perspective about their situation: ${formProblem.trim()}`,
        isEchoHouseAgent: true,
        echohouseRole: formRole.trim(),
        echohouseProblem: formProblem.trim(),
        status: "IDLE" as const,
        enabled: true,
        rules: [],
        dependencies: [],
        tools: [],
        toolPermissions: {},
        temp: 0.8,
        logic: 70,
        empathy: 50,
        priority: 5,
        toolLogs: [],
        personality: ""
      }
    };

    addNode(newNode);
    setFormName("");
    setFormRole("");
    setFormProblem("");
    setIsEchoHouseCreateFormOpen(false);
    setSelectedNodeId(newNode.id);
  };

  const [initialLayoutDone, setInitialLayoutDone] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node | null } | null>(null);

  // Reconnection state
  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
  }, [setEdges]);

  // Context Menu triggers
  const onNodeContextMenu = useCallback((event: any, node: Node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node,
    });
  }, []);

  const onPaneContextMenu = useCallback((event: any) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node: null,
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Zoom/Viewport Controls
  const handleZoomIn = () => {
    zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    zoomOut({ duration: 300 });
  };

  const handleResetView = () => {
    setViewport({ x: 100, y: 50, zoom: 0.9 }, { duration: 400 });
  };

  const applyLayout = useCallback(() => {
    if (nodes.length === 0) return;
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
  }, [nodes, edges, setNodes]);

  // Layout nodes once initially when loaded
  useEffect(() => {
    if (!initialLayoutDone && nodes.length > 0) {
      const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges);
      setNodes(layoutedNodes);
      setInitialLayoutDone(true);
    }
  }, [nodes, edges, initialLayoutDone, setNodes]);

  // Reset layout state if node length changes back to 0 (new chat)
  useEffect(() => {
    if (nodes.length === 0) {
      setInitialLayoutDone(false);
    }
  }, [nodes.length]);

  // Auto-fit viewport on node count changes
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.2, duration: 400 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  const handleAddAgentNode = () => {
    const randomId = `custom_agent_${Date.now().toString().slice(-4)}`;
    const view = getViewport();
    // Center new node inside view coordinates
    let x = (-view.x + window.innerWidth / 2 - 120) / view.zoom;
    let y = (-view.y + window.innerHeight / 2 - 100) / view.zoom;

    // Avoid collision
    const NODE_W = 240;
    const NODE_H = 220;
    const existingPositions = nodes.map(n => n.position);
    for (const pos of existingPositions) {
      if (Math.abs(x - pos.x) < NODE_W && Math.abs(y - pos.y) < NODE_H) {
        y = pos.y + NODE_H + 40;
      }
    }

    const newNode = {
      id: randomId,
      type: 'custom',
      position: { x: Math.max(50, x), y: Math.max(50, y) },
      data: {
        name: "Custom Agent Node",
        tag: "USER_CUSTOM_NODE",
        status: "IDLE" as const,
        metricLabel: "Tasks Completed",
        metricVal: "0",
        icon: "science",
        objective: "Enter agent goals...",
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
          "Web Search": "ALLOWED" as const
        },
        toolLogs: []
      }
    };
    addNode(newNode);
    setSelectedNodeId(newNode.id);
  };

  // Node styles for MiniMap representation
  const getMiniMapNodeColor = (node: Node) => {
    if (node.type === 'groupNode') return 'rgba(255, 255, 255, 0.03)';
    const data = node.data as CanvasNodeData;
    if (data && data.enabled === false) return '#262626';
    if (data && (data.status === 'ACTIVE' || data.status === 'PROCESSING')) return '#06b6d4';
    return '#404040';
  };

  return (
    <div className="w-full h-full flex-1 relative bg-black">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        snapToGrid={true}
        snapGrid={[15, 15]}
        fitViewOptions={{ padding: 0.2 }}
        className="flow-arena-editor"
        minZoom={0.2}
        maxZoom={2.5}
        defaultViewport={{ x: 100, y: 50, zoom: 0.9 }}
      >
        {/* Subtle grid background dots */}
        <Background 
          variant={BackgroundVariant.Dots} 
          color="rgba(255, 255, 255, 0.06)" 
          gap={24} 
          size={1}
        />

        {/* Custom Minimap Overlay */}
        <MiniMap 
          zoomable 
          pannable 
          nodeColor={getMiniMapNodeColor}
          nodeStrokeWidth={3}
          nodeBorderRadius={8}
          maskColor="rgba(0, 0, 0, 0.65)"
          className="!right-4 !top-4"
        />

        {/* Custom Floating Zoom & Node controls */}
        <Panel position="bottom-left" className="!left-4 !bottom-14 flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-1 rounded-xl z-20 shadow-2xl">
          <button 
            onClick={handleZoomIn}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
            title="Zoom In"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button 
            onClick={handleZoomOut}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button 
            onClick={handleResetView}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors border-l border-[#1f1f1f] ml-1 cursor-pointer"
            title="Reset Viewport"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>

          <button 
            onClick={applyLayout}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors border-l border-[#1f1f1f] ml-1 cursor-pointer"
            title="Auto Layout Graph"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>

          <button 
            onClick={isEchoHouseMode ? () => setIsEchoHouseCreateFormOpen(true) : handleAddAgentNode}
            className="p-2 text-white hover:bg-neutral-900 rounded-lg transition-colors border-l border-[#1f1f1f] ml-1 flex items-center gap-1 text-[10px] cursor-pointer"
            title={isEchoHouseMode ? "Add Person" : "Add Custom Agent Node"}
          >
            <PlusCircle className="w-3.5 h-3.5 text-white" />
            <span className="font-semibold pr-1">Node</span>
          </button>
        </Panel>

        {/* Right-click Context Menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={contextMenu.node}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Connection hint — shown when nodes exist but no edges drawn yet */}
        {!isEchoHouseMode && nodes.length > 1 && edges.length === 0 && !isOrchestrating && (
          <Panel position="top-right" className="!right-4 !top-16 select-none">
            <div className="bg-[#0d0d0d]/92 border border-[#1f1f1f] rounded-xl p-3 backdrop-blur-md shadow-xl w-52">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider font-bold">How to Connect</span>
              </div>
              <div className="space-y-2 text-[10px] text-neutral-500 leading-relaxed">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-black border-2 border-emerald-500 shrink-0" />
                  <span>Drag from <span className="text-emerald-400 font-semibold">green (OUT)</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-black border-2 border-rose-500 shrink-0" />
                  <span>Drop on <span className="text-rose-400 font-semibold">red (IN)</span></span>
                </div>
                <div className="flex items-center gap-2 pt-0.5 border-t border-[#141414] mt-1">
                  <span className="w-5 h-0.5 bg-cyan-500 rounded shrink-0" />
                  <span>Wire = agent dependency</span>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {/* EchoHouse instructional panel */}
        {isEchoHouseMode && (
          <Panel position="top-right" className="!right-4 !top-16 select-none z-20">
            <div className="bg-[#0d0d0d]/92 border border-[#1f1f1f] rounded-xl p-4 backdrop-blur-md shadow-xl w-72">
              <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                Add the people in your life — give each one a name, their role, and what they think about your situation. Then click Proceed to begin the simulation.
              </p>
            </div>
          </Panel>
        )}

        {/* Top-center Proceed Buttons */}
        {isEchoHouseMode ? (
          nodes.filter(n => (n.data as any).isEchoHouseAgent && (n.data as any).echohouseRole !== "self").length > 0 && (
            <Panel position="top-center" className="!top-4 z-20">
              <button
                onClick={handleEchoHouseProceed}
                disabled={isOrchestrating}
                className="px-6 py-2.5 bg-white text-black font-bold text-xs rounded-full shadow-2xl hover:bg-neutral-200 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2 select-none"
              >
                {isOrchestrating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <span>Proceed</span>
                )}
              </button>
            </Panel>
          )
        ) : (
          nodes.length > 0 && executionState !== "running" && (
            <Panel position="top-center" className="!top-4 z-20">
              <button
                onClick={handleNormalProceed}
                disabled={isOrchestrating}
                className="px-6 py-2.5 bg-white text-black font-bold text-xs rounded-full shadow-2xl hover:bg-neutral-200 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2 select-none"
              >
                {isOrchestrating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <span>Proceed</span>
                )}
              </button>
            </Panel>
          )
        )}

        {/* Persistent legend — bottom right */}
        <Panel position="bottom-right" className="!right-4 !bottom-14 select-none">
          <div className="bg-[#0d0d0d]/80 border border-[#1f1f1f] rounded-lg p-2.5 backdrop-blur-md shadow-xl text-[9px] font-mono text-neutral-600 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-black border-2 border-rose-500 shrink-0" />
              <span>Input (data in)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-black border-2 border-emerald-500 shrink-0" />
              <span>Output (data out)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-0.5 bg-cyan-500 rounded shrink-0" />
              <span>Dependency wire</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] leading-none">✥</span>
              <span>Drag card to reposition</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* EchoHouse Inline Creation Form */}
      {isEchoHouseCreateFormOpen && isEchoHouseMode && (
        <div className="absolute bottom-28 left-4 w-72 bg-[#0c0c0c]/95 border border-[#1f1f1f] rounded-xl p-4 shadow-2xl z-30 space-y-3 select-none">
          <div className="flex justify-between items-center pb-2 border-b border-[#1f1f1f]">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Add Person</span>
            <button onClick={() => setIsEchoHouseCreateFormOpen(false)} className="text-neutral-500 hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider font-bold">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Sarah, Dad, Crush..."
                className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-neutral-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider font-bold">Role in your life</label>
              <input
                type="text"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                placeholder="Girlfriend, Father, Best Friend..."
                className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-neutral-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider font-bold">What do they think about your situation?</label>
              <textarea
                value={formProblem}
                onChange={(e) => setFormProblem(e.target.value)}
                placeholder="Their perspective/context..."
                rows={3}
                className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-2 text-white outline-none focus:border-neutral-500 resize-none"
              />
            </div>
            <button
              onClick={handleCreateEchoHousePerson}
              disabled={!formName.trim() || !formRole.trim() || !formProblem.trim()}
              className="w-full py-2 bg-white text-black font-bold rounded-lg text-xs hover:bg-neutral-200 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 cursor-pointer text-center"
            >
              Add Person
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
