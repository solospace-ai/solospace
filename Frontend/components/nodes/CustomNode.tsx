import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { 
  Bot, 
  FlaskConical, 
  Code, 
  TrendingUp, 
  Edit, 
  Trash2, 
  Maximize
} from 'lucide-react';
import { useWorkflowStore, CanvasNodeData } from '@/store/workflowStore';

export const CustomNode = ({ id, data, selected }: NodeProps & { data: CanvasNodeData; selected?: boolean }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [droppedPulse, setDroppedPulse] = useState(false);
  
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const updateNodeField = useWorkflowStore((s) => s.updateNodeField);

  // Icon selector
  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'science': return <FlaskConical className="w-4 h-4 text-white" />;
      case 'code': return <Code className="w-4 h-4 text-white" />;
      case 'trending_up': return <TrendingUp className="w-4 h-4 text-white" />;
      default: return <Bot className="w-4 h-4 text-white" />;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropTool = (e: React.DragEvent) => {
    e.preventDefault();
    const toolName = e.dataTransfer.getData('toolName');
    if (!toolName) return;

    const currentTools = data.tools || [];
    if (!currentTools.includes(toolName)) {
      const updatedTools = [...currentTools, toolName];
      const permissions = data.toolPermissions || {};
      const updatedPerms = { ...permissions, [toolName]: permissions[toolName] || 'ALLOWED' };
      
      updateNodeField(id, {
        tools: updatedTools,
        toolPermissions: updatedPerms
      });
      
      // Visual feedback pulse
      setDroppedPulse(true);
      setTimeout(() => setDroppedPulse(false), 1000);
    }
  };

  const handleFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(id);
  };

  const isNodeEnabled = data.enabled !== false;
  const isActive = isNodeEnabled && (data.status === 'ACTIVE' || data.status === 'PROCESSING' || data.status === 'SCANNING WEB');

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDrop={handleDropTool}
      onClick={() => {
        setSelectedNodeId(id);
      }}
      className={`relative w-60 glass-panel rounded-xl p-4 cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
        selected ? 'ring-1 ring-white border-white scale-[1.01] bg-[#0c0c0c]/90 shadow-2xl' : ''
      } ${
        droppedPulse ? 'ring-2 ring-emerald-500 border-emerald-500 scale-105' : ''
      } ${
        isActive ? 'node-active-pulse' : ''
      } ${
        !isNodeEnabled ? 'opacity-35 grayscale border-dashed border-neutral-800 bg-[#050505]' : ''
      }`}
    >
      {/* Floating Hover Controls Panel */}
      {isHovered && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-1 rounded-lg gap-1 shadow-lg pointer-events-auto z-30 animate-in fade-in zoom-in-95 duration-150">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedNodeId(id);
            }}
            className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white cursor-pointer"
            title="Edit Configuration"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleFocus}
            className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white cursor-pointer"
            title="Select Node"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              deleteNode(id);
            }}
            className="p-1 hover:bg-red-950 hover:text-red-400 rounded text-neutral-400 cursor-pointer"
            title="Delete Agent"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Target Handle (Left input port) */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!w-2.5 !h-2.5 !bg-black !border-2 !border-rose-500 !shadow-[0_0_8px_#f43f5e] !transition-all hover:!scale-125"
        style={{ top: '24px', left: '-5px' }}
      />

      {/* Source Handle (Right output port) */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!w-2.5 !h-2.5 !bg-black !border-2 !border-emerald-500 !shadow-[0_0_8px_#10b981] !transition-all hover:!scale-125"
        style={{ top: '24px', right: '-5px' }}
      />

      {/* Node Header */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center border border-[#1f1f1f] shrink-0">
          {renderIcon(data.icon)}
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-white tracking-tight truncate">{data.name}</h4>
          <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider block leading-none mt-0.5">{data.tag || 'AGENT_NODE'}</span>
        </div>
      </div>

      {/* Description / Objective */}
      <p className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">{data.objective}</p>

      {/* Bulleted Instruction Rules (Antigravity Rules Style) */}
      {data.rules && data.rules.length > 0 && (
        <ul className="mt-3 pt-2.5 border-t border-[#141414] space-y-1 list-disc list-inside text-[9px] text-neutral-400 font-sans leading-normal">
          {data.rules.slice(0, 3).map((rule, idx) => (
            <li key={idx} className="truncate text-neutral-400/90 pl-0.5" title={rule}>
              {rule}
            </li>
          ))}
          {data.rules.length > 3 && (
            <li className="list-none text-neutral-600 text-[8px] italic pl-2 mt-0.5">
              + {data.rules.length - 3} more constraints
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
