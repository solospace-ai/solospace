import React from 'react';
import { NodeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';

export const GroupNode = ({ id, data, selected }: NodeProps & { data: { name: string }; selected?: boolean }) => {
  const deleteNode = useWorkflowStore((s) => s.deleteNode);

  return (
    <div
      className={`w-full h-full rounded-2xl border-2 border-dashed transition-all duration-150 relative bg-neutral-950/20 backdrop-blur-[2px] ${
        selected 
          ? 'border-cyan-400 bg-cyan-950/5 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
          : 'border-neutral-800 hover:border-neutral-600'
      }`}
      style={{ minWidth: 200, minHeight: 150 }}
    >
      {/* Top Header Tag */}
      <div className="absolute -top-3.5 left-4 px-2 py-0.5 bg-[#0a0a0a] border border-[#1f1f1f] rounded-md text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
        <span>{data.name || 'Agent Cluster Group'}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(id);
          }}
          className="text-neutral-600 hover:text-red-400 ml-1.5 transition-colors"
          title="Delete Group"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
};
