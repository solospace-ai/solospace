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
}: EdgeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = style.stroke || '#06b6d4'; // default cyan neon

  return (
    <g 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      className="group"
    >
      {/* Background thicker glow path */}
      <path
        id={`${id}-glow`}
        className="react-flow__edge-path-glow"
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={6}
        strokeOpacity={isHovered ? 0.35 : 0.15}
        style={{
          transition: 'stroke-width 0.2s, stroke-opacity 0.2s',
          filter: `drop-shadow(0 0 4px ${strokeColor})`,
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
        markerEnd={markerEnd}
        style={{
          transition: 'stroke-width 0.2s',
          ...style,
        }}
      />

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
