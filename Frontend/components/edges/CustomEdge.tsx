import React, { useState } from 'react';
import { EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react';
import { X } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  source,
  target,
}: EdgeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const edges = useWorkflowStore((s) => s.edges);  // Bug 6: needed for parallel Y-offset

  // Y offset for parallel edges between the same pair of nodes
  const parallelEdges = edges.filter(
    e => (e.source === source && e.target === target) ||
         (e.source === target && e.target === source)
  );
  const edgeIndex = parallelEdges.findIndex(e => e.id === id);
  const totalParallel = parallelEdges.length;
  const offset = totalParallel > 1 ? (edgeIndex - (totalParallel - 1) / 2) * 25 : 0;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY: sourceY + offset,
    targetX,
    targetY: targetY + offset,
    sourcePosition,
    targetPosition,
  });

  const strokeColor = (style as any).stroke || '#06b6d4'; // default cyan neon

  return (
    <g 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      className="group"
    >
      <defs>
        <marker
          id={`arrowhead-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill={strokeColor}
            opacity={isHovered ? 1 : 0.75}
          />
        </marker>
        
        {/* Glow filter */}
        <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background thicker glow path */}
      <path
        id={`${id}-glow`}
        className="react-flow__edge-path-glow"
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={6}
        strokeOpacity={isHovered ? 0.45 : 0.18}
        filter={`url(#glow-${id})`}
        style={{
          transition: 'stroke-width 0.2s, stroke-opacity 0.2s',
        }}
      />

      {/* Main Core Path */}
      <path
        id={id}
        className="react-flow__edge-path connection-line"
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isHovered ? 2.5 : 1.5}
        markerEnd={`url(#arrowhead-${id})`}
        style={{
          transition: 'stroke-width 0.2s',
          ...style,
        }}
      />

      {/* Animated data packet flowing along bezier path */}
      <circle r="3" fill="#ffffff" filter={`url(#glow-${id})`}>
        <animateMotion
          dur="3s"
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>

      {/* Invisible thicker interaction path for easier hovering */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={15}
        className="cursor-pointer"
      />

      {/* Delete Button Label overlay */}
      {isHovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan z-40"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteEdge(id);
              }}
              className="w-5 h-5 rounded-full bg-[#0d0d0d] border border-[#1f1f1f] text-neutral-400 hover:text-red-400 flex items-center justify-center shadow-lg transition-all hover:scale-115 active:scale-95 cursor-pointer"
              title="Delete connection"
            >
              <X className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
};
