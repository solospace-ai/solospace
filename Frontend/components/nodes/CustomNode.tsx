'use client';
import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Bot,
  FlaskConical,
  Code2,
  TrendingUp,
  Pencil,
  Trash2,
  Zap,
  Globe,
  Database,
  Plug,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useWorkflowStore, CanvasNodeData } from '@/store/workflowStore';

// ─── Icon Registry ────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  science: FlaskConical,
  code: Code2,
  trending_up: TrendingUp,
  globe: Globe,
  database: Database,
  plug: Plug,
  bot: Bot,
};

function AgentIcon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Bot;
  return <Icon className={className} />;
}

// ─── Tool Pill ────────────────────────────────────────────────────────

const TOOL_COLORS: Record<string, string> = {
  'Web Search':     'bg-sky-950/80 text-sky-400 border-sky-800/60',
  'Browser':        'bg-indigo-950/80 text-indigo-400 border-indigo-800/60',
  'Code Executor':  'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
  'API Connector':  'bg-violet-950/80 text-violet-400 border-violet-800/60',
  'Memory':         'bg-amber-950/80 text-amber-400 border-amber-800/60',
};

function ToolPill({ name }: { name: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold border ${
        TOOL_COLORS[name] ?? 'bg-neutral-900 text-neutral-400 border-neutral-800'
      }`}
    >
      {name}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────

function StatusBadge({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-neutral-950 border border-neutral-700 rounded text-[7px] font-mono text-neutral-500 uppercase tracking-widest font-bold z-20 whitespace-nowrap">
        Disabled
      </span>
    );
  }
  if (status === 'ERROR') {
    return (
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-rose-950 border border-rose-800 rounded text-[7px] font-mono text-rose-400 uppercase tracking-widest font-bold z-20 whitespace-nowrap flex items-center gap-1">
        <AlertTriangle className="w-2.5 h-2.5" /> Error
      </span>
    );
  }
  return null;
}

// ─── Status Ring Color ────────────────────────────────────────────────

function getStatusRing(status: string, enabled: boolean, selected: boolean, dropped: boolean): string {
  if (dropped) return 'ring-2 ring-emerald-500 scale-[1.03] shadow-[0_0_24px_rgba(16,185,129,0.4)]';
  if (!enabled) return 'opacity-40 grayscale saturate-0 border-dashed border-neutral-700';
  if (status === 'ERROR') return 'ring-1 ring-rose-500/70 shadow-[0_0_16px_rgba(244,63,94,0.3)]';
  if (status === 'ACTIVE' || status === 'PROCESSING' || status === 'SCANNING WEB')
    return 'ring-1 ring-cyan-500/70 shadow-[0_0_20px_rgba(6,182,212,0.35)] node-active-pulse';
  if (selected) return 'ring-1 ring-white/40 shadow-[0_0_20px_rgba(255,255,255,0.08)]';
  return '';
}

// ─── Main Component ───────────────────────────────────────────────────

export const CustomNode = ({ id, data, selected }: NodeProps & { data: CanvasNodeData; selected?: boolean }) => {
  const [hovered, setHovered] = useState(false);
  const [dropped, setDropped] = useState(false);

  const deleteNode     = useWorkflowStore((s) => s.deleteNode);
  const setSelectedId  = useWorkflowStore((s) => s.setSelectedNodeId);
  const updateNode     = useWorkflowStore((s) => s.updateNodeField);

  const isEnabled = data.enabled !== false;
  const isActive  = isEnabled && ['ACTIVE', 'PROCESSING', 'SCANNING WEB'].includes(data.status ?? '');
  const isError   = data.status === 'ERROR';

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDrop     = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const tool = e.dataTransfer.getData('toolName');
    if (!tool) return;
    const tools = data.tools || [];
    if (!tools.includes(tool)) {
      const perms = { ...(data.toolPermissions || {}), [tool]: data.toolPermissions?.[tool] ?? 'ALLOWED' };
      updateNode(id, { tools: [...tools, tool], toolPermissions: perms });
      setDropped(true);
      setTimeout(() => setDropped(false), 800);
    }
  }, [data.tools, data.toolPermissions, id, updateNode]);

  const statusRing = getStatusRing(data.status ?? 'IDLE', isEnabled, !!selected, dropped);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Agent node: ${data.name}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => setSelectedId(id)}
      onKeyDown={(e) => e.key === 'Enter' && setSelectedId(id)}
      className={[
        'relative w-64 rounded-2xl cursor-grab active:cursor-grabbing select-none',
        'transition-all duration-200 ease-out',
        // Glassmorphism base
        'bg-gradient-to-b from-neutral-900/90 to-neutral-950/95',
        'border border-white/[0.06]',
        'backdrop-blur-sm',
        // Shadow
        'shadow-[0_4px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]',
        // EchoHouse left border
        data.isEchoHouseAgent
          ? (data.echohouseRole === 'self'
              ? 'border-l-2 border-l-white'
              : 'border-l-2 border-l-neutral-600')
          : '',
        statusRing,
      ].join(' ')}
    >
      {/* ─── Top status bar ─── */}
      <div className={`h-1 w-full rounded-t-2xl transition-all duration-300 ${
        isActive ? 'bg-cyan-500 shadow-[0_1px_8px_rgba(6,182,212,0.6)] animate-pulse' :
        isError ? 'bg-rose-500 shadow-[0_1px_8px_rgba(244,63,94,0.6)]' :
        'bg-neutral-800'
      }`} />

      {/* Ambient glow — active state */}
      {isActive && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none bg-cyan-500/[0.04] animate-pulse" />
      )}

      {/* Top status badge */}
      <StatusBadge status={data.status ?? ''} enabled={isEnabled} />

      {/* Floating action bar */}
      {hovered && isEnabled && !data.isEchoHouseAgent && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 px-1 py-0.5 rounded-xl bg-neutral-900/95 border border-white/[0.07] shadow-xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100">
          <button
            id={`node-edit-${id}`}
            onClick={(e) => { e.stopPropagation(); setSelectedId(id); }}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-neutral-400 hover:text-white transition-colors"
            title="Configure"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <div className="w-px h-3 bg-white/10" />
          <button
            id={`node-delete-${id}`}
            onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400 transition-colors"
            title="Delete agent"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Left Handle (IN) ────────────────────────────────── */}
      {!data.isEchoHouseAgent && (
        <div className="absolute group/in" style={{ top: 22, left: -8, zIndex: 10 }}>
          <Handle
            type="target"
            position={Position.Left}
            id="input"
            isConnectable
            className="!w-3 !h-3 !bg-neutral-950 !border-2 !border-rose-500 !rounded-full !shadow-[0_0_8px_rgba(244,63,94,0.5)] hover:!scale-125 !transition-transform"
          />
          <span className="pointer-events-none select-none absolute left-5 top-1/2 -translate-y-1/2 text-[7px] font-mono font-bold text-rose-400 bg-rose-950/90 border border-rose-500/30 px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover/in:opacity-100 transition-opacity duration-100">
            IN
          </span>
        </div>
      )}

      {/* ── Right Handle (OUT) ──────────────────────────────── */}
      {!data.isEchoHouseAgent && (
        <div className="absolute group/out" style={{ top: 22, right: -8, zIndex: 10 }}>
          <span className="pointer-events-none select-none absolute right-5 top-1/2 -translate-y-1/2 text-[7px] font-mono font-bold text-emerald-400 bg-emerald-950/90 border border-emerald-500/30 px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover/out:opacity-100 transition-opacity duration-100">
            OUT
          </span>
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            isConnectable
            className="!w-3 !h-3 !bg-neutral-950 !border-2 !border-emerald-500 !rounded-full !shadow-[0_0_8px_rgba(16,185,129,0.5)] hover:!scale-125 !transition-transform"
          />
        </div>
      )}

      {/* ── Node Body ──────────────────────────────────────── */}
      <div className="p-4 pt-3.5">
        {/* Header row */}
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="relative shrink-0">
            <div className={[
              'w-8 h-8 rounded-lg flex items-center justify-center',
              'bg-gradient-to-br from-neutral-800 to-neutral-900',
              'border border-white/[0.07]',
              'shadow-inner',
              isActive ? 'text-cyan-400' : isError ? 'text-rose-400' : 'text-neutral-300',
            ].join(' ')}>
              <AgentIcon name={data.icon ?? 'bot'} className="w-4 h-4" />
            </div>
            {/* Active spinner overlay */}
            {isActive && (
              <Loader2 className="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-cyan-400 animate-spin" />
            )}
            {!isActive && !isError && isEnabled && (
              <CheckCircle2 className="absolute -bottom-1 -right-1 w-3 h-3 text-emerald-500" />
            )}
            {isError && (
              <AlertTriangle className="absolute -bottom-1 -right-1 w-3 h-3 text-rose-500" />
            )}
          </div>

          {/* Name + tag */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-white tracking-tight truncate leading-tight">
                {data.name}
              </h4>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </div>
            {data.isEchoHouseAgent ? (
              <span className="text-[7.5px] font-mono text-neutral-500 leading-none mt-0.5 block">
                {data.echohouseRole}
              </span>
            ) : (
              <span className="text-[7.5px] font-mono text-neutral-500 uppercase tracking-widest leading-none mt-0.5 block">
                {data.tag ?? 'AGENT'}
              </span>
            )}
          </div>
        </div>

        {/* Objective */}
        <p className="text-[9.5px] text-neutral-400/90 leading-relaxed mt-2.5 line-clamp-2">
          {data.isEchoHouseAgent ? data.echohouseProblem : data.objective}
        </p>

        {/* Live Progress Bar when ACTIVE */}
        {isActive && (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between items-center text-[8px] font-mono text-cyan-400">
              <span className="flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {data.status || 'PROCESSING'}
              </span>
              <span className="animate-pulse">ACTIVE</span>
            </div>
            <div className="w-full bg-neutral-950/80 border border-neutral-900 rounded-full h-1 overflow-hidden">
              <div className="bg-cyan-500 h-full rounded-full animate-pulse" style={{ width: '65%' }} />
            </div>
          </div>
        )}

        {/* Output Preview when Completed */}
        {!isActive && !isError && data.finalAnswer && (
          <div className="mt-3 p-2 bg-neutral-950/80 border border-white/[0.04] rounded-lg text-[9px] text-neutral-400 leading-normal line-clamp-2 font-mono">
            <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider block mb-0.5">Output:</span>
            {data.finalAnswer}
          </div>
        )}

        {/* Tools chips (max 3) */}
        {!data.isEchoHouseAgent && (data.tools?.length ?? 0) > 0 && (
          <div className="mt-3 pt-2.5 border-t border-white/[0.04] flex flex-wrap gap-1 items-center">
            {data.tools.slice(0, 3).map((tool) => (
              <ToolPill key={tool} name={tool} />
            ))}
            {data.tools.length > 3 && (
              <span className="text-[8px] text-neutral-500 font-mono pl-1">
                +{data.tools.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
