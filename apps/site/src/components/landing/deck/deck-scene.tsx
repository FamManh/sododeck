import type { CSSProperties, ReactNode } from 'react';

import type { SceneEdge, SceneFrame, SceneNode } from '../../../lib/landing/checkout-deck';
import { arrowHead } from '../../../lib/landing/geometry';
import { edgeStroke, layoutScene, type EdgeState } from '../../../lib/landing/scene';
import type { Animated, Timeline } from '../../../lib/landing/timeline';
import { C } from '../../../lib/landing/tokens';
import { DeckCard, type CardState, type CardZoom } from './deck-card';
import { EdgeLabel } from './edge-label';
import { FlowLayerMarks } from './flow-layer-marks';
import { FlowLayerPaths } from './flow-layer-paths';
import type { FlowPlay } from './flow-play';
import { GroupFrame } from './group-frame';
import { OutsideProxy } from './outside-proxy';
import { ShapeNode } from './shape-node';

interface DeckSceneProps {
  nodes: readonly SceneNode[];
  edges: readonly SceneEdge[];
  frames: readonly SceneFrame[];
  width: number;
  height: number;
  zoom?: CardZoom;
  /** Connector labels (off at landscape zoom). */
  labels?: boolean;
  nodeState?: Readonly<Record<string, CardState>>;
  edgeState?: Readonly<Record<string, EdgeState>>;
  timeline?: Timeline | null;
  flow?: FlowPlay;
  nodeMotion?: (node: SceneNode, index: number) => Partial<Animated>;
  frameMotion?: (index: number) => Partial<Animated>;
  edgeMotion?: (edge: SceneEdge, index: number) => Partial<Animated>;
  children?: ReactNode;
}

const layer = (width: number, height: number, zIndex?: number): CSSProperties => ({
  position: 'absolute',
  left: 0,
  top: 0,
  width,
  height,
  overflow: 'visible',
  pointerEvents: 'none',
  ...(zIndex === undefined ? {} : { zIndex }),
});

/**
 * A deck on the canvas in world coordinates: groups, connectors, cards and labels, plus an
 * optional flow layer that plays steps on `timeline`. Without a timeline it draws the final frame.
 */
export function DeckScene({
  nodes,
  edges,
  frames,
  width,
  height,
  zoom = 'component',
  labels = true,
  nodeState = {},
  edgeState = {},
  timeline = null,
  flow,
  nodeMotion,
  frameMotion,
  edgeMotion,
  children,
}: DeckSceneProps) {
  const scene = layoutScene(nodes, edges);
  const byId = new Map(scene.edges.map((e) => [e.edge.id, e]));
  return (
    <>
      {frames.map((frame, i) => {
        const motion = frameMotion?.(i) ?? {};
        return (
          <GroupFrame
            key={frame.title}
            frame={frame}
            style={motion.style ?? {}}
            {...(motion.className === undefined ? {} : { className: motion.className })}
          />
        );
      })}
      <svg aria-hidden width={width} height={height} style={layer(width, height)}>
        {scene.edges.map((laid, i) => {
          const state = edgeState[laid.edge.id] ?? (laid.edge.error === true ? 'error' : 'default');
          const stroke = edgeStroke(state, laid.edge.writes === true);
          const motion = edgeMotion?.(laid.edge, i) ?? {};
          const round = stroke.dash === '2 6';
          return (
            <g
              key={laid.edge.id}
              opacity={stroke.opacity}
              className={motion.className}
              style={motion.style}
            >
              {state === 'current' && (
                <path
                  d={laid.d}
                  fill="none"
                  stroke={C.primary}
                  strokeOpacity={0.18}
                  strokeWidth={stroke.width + 6}
                  strokeLinecap="round"
                />
              )}
              <path
                d={laid.d}
                fill="none"
                stroke={stroke.colour}
                strokeWidth={stroke.width}
                strokeDasharray={stroke.dash}
                strokeLinecap={round ? 'round' : 'butt'}
              />
              <circle cx={laid.start.x} cy={laid.start.y} r={3.5} fill={stroke.colour} />
              <path
                d={arrowHead(laid.end, laid.endSide)}
                stroke={stroke.colour}
                strokeWidth={2}
                fill={stroke.colour}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </svg>
      {flow !== undefined && (
        <FlowLayerPaths flow={flow} byId={byId} timeline={timeline} width={width} height={height} />
      )}
      {nodes.map((node, i) => {
        const box = scene.boxes.get(node.key);
        if (box === undefined) return null;
        const state = nodeState[node.key] ?? {};
        const motion = nodeMotion?.(node, i) ?? {};
        return (
          <div
            key={node.key}
            className={motion.className}
            style={{
              position: 'absolute',
              left: node.x,
              top: node.y,
              width: box.w,
              zIndex: state.selected === true || state.step?.state === 'current' ? 3 : 1,
              ...motion.style,
            }}
          >
            {node.kind === 'card' && <DeckCard card={node.card} zoom={zoom} state={state} />}
            {node.kind === 'shape' && <ShapeNode shape={node.shape} />}
            {node.kind === 'proxy' && <OutsideProxy proxy={node.proxy} />}
          </div>
        );
      })}
      {labels &&
        scene.edges.map((laid, i) => {
          if (laid.edge.label === undefined) return null;
          const state = edgeState[laid.edge.id] ?? (laid.edge.error === true ? 'error' : 'default');
          const motion = edgeMotion?.(laid.edge, i) ?? {};
          return (
            <EdgeLabel
              key={laid.edge.id}
              at={laid.label}
              text={laid.edge.label}
              tone={
                state === 'current'
                  ? 'current'
                  : state === 'error'
                    ? 'error'
                    : state === 'dim'
                      ? 'dim'
                      : 'default'
              }
              {...(motion.style === undefined ? {} : { style: motion.style })}
              {...(motion.className === undefined ? {} : { className: motion.className })}
            />
          );
        })}
      {flow !== undefined && (
        <FlowLayerMarks flow={flow} byId={byId} boxes={scene.boxes} timeline={timeline} />
      )}
      {children}
    </>
  );
}
