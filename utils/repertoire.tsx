import { LichessGame } from "app/models";
import { flatten, forEach, isArray } from "lodash";

export function sideOfLastmove(_line: string[] | string): Side {
  let line = _line;
  if (!isArray(_line)) {
    line = _line.split(" ");
  }
  if (line.length % 2 === 1) {
    return "white";
  } else {
    return "black";
  }
}

export function lineToPgn(line: string[]): string {
  let pgn = "";
  forEach(line, (m, j) => {
    let i = j / 2 + 1;
    if (j % 2 === 1) {
      pgn = `${pgn} ${m}`;
    } else {
      pgn = `${pgn} ${i}.${m}`;
    }
  });

  return pgn.trim();
}

export function pgnToLine(line: string): string[] {
  return line.replaceAll(/\d+\./g, "").split(" ");
}

export type Repertoire = BySide<RepertoireSide>;

export interface BySide<T> {
  white: T;
  black: T;
}

export type Side = "black" | "white";
export const SIDES: Side[] = ["white", "black"];
export function otherSide(side: Side) {
  if (side === "white") {
    return "black";
  } else {
    return "white";
  }
}

export interface RepertoireSide {
  positionResponses: Record<string, RepertoireMove[]>;
  side: Side;
}

export function getAllRepertoireMoves(r: Repertoire): RepertoireMove[] {
  if (!r) {
    return [];
  }
  return [
    ...flatten(Object.values(r.black.positionResponses)),
    ...flatten(Object.values(r.white.positionResponses)),
  ];
}

export interface RepertoireMove {
  id: string;
  epd: string;
  sanPlus: string;
  mine: boolean;
  epdAfter: string;
  pending?: boolean;
  side: Side;
  srs: SpacedRepetitionStatus;
}

export interface SpacedRepetitionStatus {
  needsReview: boolean;
  firstReview: boolean;
  pending?: boolean;
}

export type MoveIdentifier = string;
export type SanPlus = string;

export interface RepertoireGrade {
  // moveIncidence: Record<MoveIdentifier, number>;
  expectedDepth: number;
  // exampleGames: LichessGame[];
  biggestMiss: RepertoireMiss;
}

export interface RepertoireMiss {
  incidence: number;
  lines: string[];
}

export interface PendingLine {
  knownLine: SanPlus[];
  pendingLine: SanPlus[];
}
