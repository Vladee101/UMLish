export type ParticipantKind =
  | 'participant' | 'actor' | 'boundary' | 'control'
  | 'entity' | 'database' | 'collections' | 'queue';

export interface Participant {
  id: string;
  label: string;
  kind: ParticipantKind;
  color?: string;
  order?: number;
  /** index into Diagram.boxes */
  box?: number;
  /** declared mid-diagram with `create` (drawn at the message row, not the top) */
  created?: boolean;
  /** true if it was never declared, only referenced in a message */
  implicit: boolean;
  line: number;
}

export type Endpoint =
  | { kind: 'participant'; id: string }
  | { kind: 'edge'; side: 'left' | 'right' }; // found / lost messages: [-> and ->]

export type ArrowHead =
  | 'none' | 'filled' | 'open' | 'half-filled' | 'half-open' | 'cross' | 'circle';

export interface Message {
  type: 'message';
  line: number;
  /** Always normalised so the arrow points from -> to (`A <- B` becomes from=B, to=A). */
  from: Endpoint;
  to: Endpoint;
  text: string;
  dashed: boolean;
  color?: string;
  startHead: ArrowHead; // non-'none' only for bidirectional arrows
  endHead: ArrowHead;
  /** ++ / -- / ** / !! shorthand. Recorded verbatim; the layout step decides who it applies to. */
  activation?: { op: '++' | '--' | '**' | '!!'; color?: string };
}

export interface Note {
  type: 'note';
  line: number;
  shape: 'note' | 'hnote' | 'rnote';
  position: 'left' | 'right' | 'over' | 'across';
  targets: string[]; // participant ids; empty for `across`
  text: string;
  color?: string;
}

export interface FragmentSection {
  label: string;
  line: number;
  events: Event[];
}

export type FragmentKind =
  | 'alt' | 'opt' | 'loop' | 'par' | 'par2' | 'break' | 'critical' | 'group';

export interface Fragment {
  type: 'fragment';
  kind: FragmentKind;
  line: number;
  endLine: number;
  /** First section is the opening branch; each `else` adds another. */
  sections: FragmentSection[];
}

export interface ActivationEvent {
  type: 'activation';
  line: number;
  op: 'activate' | 'deactivate' | 'destroy' | 'create';
  target: string;
  color?: string;
}

export interface ReturnEvent { type: 'return'; line: number; text: string }
export interface Divider { type: 'divider'; line: number; text: string }
export interface Delay { type: 'delay'; line: number; text: string }
export interface Spacing { type: 'spacing'; line: number; height?: number }
export interface Ref { type: 'ref'; line: number; targets: string[]; text: string }

export interface Autonumber {
  type: 'autonumber';
  line: number;
  action: 'start' | 'stop' | 'resume';
  start?: number;
  step?: number;
  format?: string;
}

export type Event =
  | Message | Note | Fragment | ActivationEvent | ReturnEvent
  | Divider | Delay | Spacing | Ref | Autonumber;

export interface Box {
  name: string;
  color?: string;
  line: number;
}

export interface Warning {
  line: number; // 1-based, matches the editor
  message: string;
}

export interface Diagram {
  title?: string;
  header?: string;
  footer?: string;
  participants: Participant[];
  boxes: Box[];
  events: Event[];
  options: { hideFootbox: boolean };
  skinparams: Record<string, string>;
  warnings: Warning[];
}
