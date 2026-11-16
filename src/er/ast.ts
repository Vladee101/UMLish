import type { Warning } from '../parser/ast.ts';

export interface ErAttribute {
  name: string;
  type?: string;
  key?: 'PK' | 'FK' | 'UK';
  required: boolean;
  visibility?: '+' | '-' | '#' | '~';
  line: number;
}

export interface ErEntity {
  id: string;
  label: string;
  kind: 'entity' | 'enum';
  color?: string;
  attributes: ErAttribute[];
  line: number;
}

export interface ErRelationship {
  from: string;
  to: string;
  fromCardinality: string;
  toCardinality: string;
  label: string;
  dashed: boolean;
  line: number;
}

export interface ErDiagram {
  title?: string;
  entities: ErEntity[];
  relationships: ErRelationship[];
  skinparams: Record<string, string>;
  warnings: Warning[];
}
