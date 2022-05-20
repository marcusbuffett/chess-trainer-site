import { Square } from "@lubert/chess.ts/dist/types";
import client from "app/client";
import { LichessGame } from "app/models";
import { ChessboardState } from "app/types/ChessboardBiref";
import create, {
  GetState,
  SetState,
  State,
  StateCreator,
  StoreApi,
} from "zustand";
import { devtools } from "zustand/middleware";
import {
  createQuick,
  DEFAULT_CHESS_STATE,
  logProxy,
  immer,
  setter,
} from "./state";
import { cloneDeep, dropWhile, isEmpty, last, take } from "lodash";
import {
  BySide,
  lineToPgn,
  PendingLine,
  Repertoire,
  RepertoireGrade,
  RepertoireMove,
  RepertoireSide,
  Side,
  sideOfLastmove,
} from "./repertoire";
import { StorageItem } from "./storageItem";

export interface RepertoireState {
  getPendingLine: (_state?: RepertoireState) => PendingLine;
  quick: (fn: (_: RepertoireState) => void) => void;
  repertoire: StorageItem<Repertoire>;
  repertoireGrades: BySide<RepertoireGrade>;
  activeSide: Side;
  fetchRepertoireGrade: (_state?: RepertoireState) => void;
  initState: (_state?: RepertoireState) => void;
  playPgn: (pgn: string, _state?: RepertoireState) => void;
  addPendingLine: (_state?: RepertoireState) => void;
  onSquarePress: (square: Square) => void;
  chessState: ChessboardState;
}

export const DEFAULT_REPERTOIRE = {
  white: {
    side: "white",
    tree: [
      {
        id: "1.e4",
        sanPlus: "e4",
        mine: true,
        side: "white",
        responses: [
          {
            id: "1.e4 e5",
            sanPlus: "e5",
            mine: false,
            side: "black",
            responses: [
              {
                id: "1.e4 e5 2.f4",
                sanPlus: "f4",
                mine: true,
                side: "white",
                responses: [],
              },
            ],
          },
          {
            id: "1.e4 d5",
            sanPlus: "d5",
            mine: false,
            side: "black",
            responses: [],
          },
        ],
      },
    ],
  },
  black: {
    side: "black",
    tree: [],
  },
} as Repertoire;

export const useRepertoireState = create<RepertoireState>(
  devtools(
    // @ts-ignore for the set stuff
    immer(
      // TODO: figure out why typescript hates this
      // @ts-ignore
      (
        set: SetState<RepertoireState>,
        get: GetState<RepertoireState>
      ): RepertoireState =>
        ({
          // TODO: clone?
          ...createQuick(set),
          repertoire: new StorageItem("repertoire_v1", DEFAULT_REPERTOIRE),
          repertoireGrades: { white: null, black: null },
          activeSide: "white",
          initState: () => {
            let state = get();
            state.chessState.position.move("e4");
            state.chessState.position.move("c5");
            state.chessState.position.move("d4");
            state.fetchRepertoireGrade(state);
          },
          playPgn: (pgn: string, _state?: RepertoireState) =>
            setter(set, _state, (s) => {
              s.chessState.position.loadPgn(pgn);
            }),
          fetchRepertoireGrade: (_state?: RepertoireState) =>
            setter(set, _state, (s) => {
              console.log("s repertoire", logProxy(s));
              let side = s.activeSide;
              client
                .post(
                  "/api/v1/grade_opening",
                  cloneDeep(s.repertoire.value[side])
                )
                .then(({ data }) => {
                  console.log("data", data);
                  set((s) => {
                    s.repertoireGrades[side] = data as RepertoireGrade;
                  });
                });
            }),
          chessState: DEFAULT_CHESS_STATE,
          addPendingLine: (_state?: RepertoireState) =>
            setter(set, _state, (s) => {
              console.log("Before getting pending line");
              const { knownLine, pendingLine } = s.getPendingLine(s);
              console.log("Before adding pending line");
              let line = [...knownLine];
              let activeRepertoire: RepertoireSide =
                s.repertoire.value[s.activeSide];
              let node = getNodeFromRepertoire(activeRepertoire, knownLine);
              while (pendingLine.length > 0) {
                let move = pendingLine.shift();
                line.push(move);
                node.responses.push({
                  id: lineToPgn(line),
                  sanPlus: move,
                  mine: sideOfLastmove(line) === s.activeSide,
                  side: sideOfLastmove(line),
                  responses: [],
                });
                node = last(node.responses);
              }
              console.log("After adding pending line");
              s.repertoire.save();
              s.fetchRepertoireGrade(s);
            }),
          getPendingLine: (_state?: RepertoireState) => {
            let state = _state ?? get();
            let history = state.chessState.position.history();
            let activeRepertoire: RepertoireSide =
              state.repertoire.value[state.activeSide];
            let currentLine: string[] = [];
            let missedMoves = dropWhile(history, (move) => {
              currentLine.push(move);
              return (
                getNodeFromRepertoire(activeRepertoire, currentLine) != null
              );
            });
            console.log("Missed moves", missedMoves);
            if (!isEmpty(missedMoves)) {
              let knownMoves = take(
                history,
                history.length - missedMoves.length
              );
              return {
                pendingLine: missedMoves,
                knownLine: knownMoves,
              };
            }
            return null;
          },
          onSquarePress: (square: Square) =>
            set((state) => {
              let availableMove = state.chessState.availableMoves.find(
                (m) => m.to == square
              );
              if (availableMove) {
                state.chessState.position.move(availableMove);
                state.chessState.availableMoves = [];
                return;
              }
              let moves = state.chessState.position.moves({
                square,
                verbose: true,
              });
              state.chessState.availableMoves = moves;
            }),
        } as RepertoireState)
    ),
    { name: "RepertoireTrainingState" }
  )
);

function getNodeFromRepertoire(repertoire: RepertoireSide, _line: string[]) {
  let line = [..._line];
  let responses = repertoire.tree;
  let node: RepertoireMove = null;
  // console.log("Line is ", line);
  // console.log("Repertoire", repertoire);
  while (line.length > 0) {
    let move = line.shift();

    node = responses.find((n) => {
      return n.sanPlus == move;
    });
    if (!node) {
      break;
    }
    responses = node.responses;
  }
  // console.log("Node is ", node);

  return node;
}