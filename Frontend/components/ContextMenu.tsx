import React, { useEffect, useRef } from 'react';
import { 
  Trash2, 
  Power, 
  Plus, 
  FolderPlus, 
  Maximize, 
  RefreshCw 
} from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { Node } from '@xyflow/react';

interface ContextMenuProps {
  x: number;
  y: number;
  node: Node | null;
  onClose: () => void;
}

export const ContextMenu = ({ x, y, node, onClose }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  
  const addNode = useWorkflowStore((s) => s.addNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const updateNodeField = useWorkflowStore((s) => s.updateNodeField);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Element)) {
        onClose();
      }
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('contextmenu', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('contextmenu', handleOutsideClick);
    };
  }, [onClose]);

  // Actions
  const handleAddAgent = () => {
    const randomId = `custom_agent_${Date.now().toString().slice(-4)}`;
    // Calculate canvas coordinates based on click coordinate (mock transformation)
    const newNode = {
      id: randomId,
      type: 'custom',
      position: { x: x - 400, y: y - 200 },
      data: {
        name: "New Agent Node",
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
    onClose();
  };

  const handleAddGroup = () => {
    const randomId = `group_${Date.now().toString().slice(-4)}`;
    const newGroup = {
      id: randomId,
      type: 'groupNode',
      position: { x: x - 450, y: y - 200 },
      style: { width: 350, height: 260 },
      data: {
        name: "Custom Cluster Group"
      }
    };
    addNode(newGroup);
    onClose();
  };

  const handleToggleEnable = () => {
    if (!node) return;
    updateNodeField(node.id, { enabled: !(node.data as any).enabled });
    onClose();
  };

  // Run Sandbox removed — real tool execution is handled by backend during orchestration

  const handleDelete = () => {
    if (!node) return;
    deleteNode(node.id);
    onClose();
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all nodes and connections?")) {
      setNodes([]);
      setEdges([]);
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ top: y, left: x }}
      className="fixed z-50 min-w-48 bg-[#0d0d0d]/95 backdrop-blur-md border border-[#1f1f1f] rounded-lg shadow-2xl p-1.5 flex flex-col gap-0.5 select-none"
    >
      {node ? (
        // Node specific menu items
        <>
          <div className="px-2.5 py-1 text-[9px] font-mono text-neutral-500 border-b border-[#141414] mb-1 font-bold uppercase truncate max-w-48">
            Node: {(node.data as any).name}
          </div>
          
          <button
            onClick={() => {
              setSelectedNodeId(node.id);
              onClose();
            }}
            className="w-full text-left px-2.5 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 rounded-md transition-colors flex items-center gap-2 cursor-pointer font-medium"
          >
            <Maximize className="w-3.5 h-3.5" />
            <span>Configure Agent</span>
          </button>
          

          <button
            onClick={handleToggleEnable}
            className="w-full text-left px-2.5 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 rounded-md transition-colors flex items-center gap-2 cursor-pointer font-medium"
          >
            <Power className={`w-3.5 h-3.5 ${(node.data as any).enabled ? 'text-amber-500' : 'text-emerald-500'}`} />
            <span>{(node.data as any).enabled ? 'Disable Node' : 'Enable Node'}</span>
          </button>
          
          <button
            onClick={handleDelete}
            className="w-full text-left px-2.5 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md transition-colors flex items-center gap-2 cursor-pointer border-t border-[#141414] mt-1 pt-1.5 font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Node</span>
          </button>
        </>
      ) : (
        // Canvas/Pane specific menu items
        <>
          <button
            onClick={handleAddAgent}
            className="w-full text-left px-2.5 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 rounded-md transition-colors flex items-center gap-2 cursor-pointer font-medium"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Add Agent Node</span>
          </button>
          
          <button
            onClick={handleAddGroup}
            className="w-full text-left px-2.5 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 rounded-md transition-colors flex items-center gap-2 cursor-pointer font-medium"
          >
            <FolderPlus className="w-3.5 h-3.5 text-purple-400" />
            <span>Add Cluster Group</span>
          </button>
          
          <button
            onClick={handleClearAll}
            className="w-full text-left px-2.5 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md transition-colors flex items-center gap-2 cursor-pointer border-t border-[#141414] mt-1 pt-1.5 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Clear Canvas</span>
          </button>
        </>
      )}
    </div>
  );
};
