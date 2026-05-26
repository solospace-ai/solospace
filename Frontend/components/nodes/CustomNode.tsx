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
  const isError = data.status === 'ERROR';

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
        isError ? 'border-rose-500/60 ring-1 ring-rose-500/30' : ''
      } ${
        !isNodeEnabled ? 'opacity-40 grayscale border-dashed border-neutral-700 bg-[#050505] saturate-0' : ''
      }`}
    >
      {!isNodeEnabled && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-neutral-900 border border-neutral-700 rounded text-[7px] font-mono text-neutral-400 uppercase tracking-widest font-bold z-10 select-none">
          Disabled
        </div>
      )}
      {isError && !isActive && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-rose-950 border border-rose-800 rounded text-[7px] font-mono text-rose-400 uppercase tracking-widest font-bold z-10 select-none">
          Failed
        </div>
      )}
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

      {/* ─── Target Handle (Left — Input Port) ─── */}
      <div
        className="absolute group/handle-in"
        style={{ top: '14px', left: '-8px', zIndex: 10 }}
      >
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          isConnectable={true}
          className="!w-3 !h-3 !bg-black !border-2 !border-rose-500 !rounded-full !shadow-[0_0_10px_rgba(244,63,94,0.6)] !transition-all hover:!scale-150 hover:!bg-rose-500"
        />
        {/* IN label — appears on hover */}
        <span className="pointer-events-none select-none absolute left-5 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-rose-400 bg-rose-950/90 border border-rose-500/30 px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover/handle-in:opacity-100 transition-opacity duration-150">
          IN
        </span>
      </div>

      {/* ─── Source Handle (Right — Output Port) ─── */}
      <div
        className="absolute group/handle-out flex items-center"
        style={{ top: '14px', right: '-8px', zIndex: 10 }}
      >
        {/* OUT label — appears on hover */}
        <span className="pointer-events-none select-none absolute right-5 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-emerald-400 bg-emerald-950/90 border border-emerald-500/30 px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover/handle-out:opacity-100 transition-opacity duration-150">
          OUT
        </span>
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          isConnectable={true}
          className="!w-3 !h-3 !bg-black !border-2 !border-emerald-500 !rounded-full !shadow-[0_0_10px_rgba(16,185,129,0.6)] !transition-all hover:!scale-150 hover:!bg-emerald-500"
        />
      </div>

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
