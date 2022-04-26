import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Text, Pressable, View, Platform } from "react-native";
// import { ExchangeRates } from "app/ExchangeRate";
import { c, s } from "app/styles";
import { Spacer } from "app/Space";
import {
  ChessboardView,
  PieceView,
} from "app/components/chessboard/Chessboard";
import { cloneDeep, isEmpty, isNil, takeRight, chunk } from "lodash";
import { TrainerLayout } from "app/components/TrainerLayout";
import { Button } from "app/components/Button";
import { useIsMobile } from "app/utils/isMobile";
import {
  BlindfoldTrainingStage,
  BlindfoldTrainingState,
  BlunderRecognitionDifficulty,
  GamesSearchState,
  BlunderRecognitionTab,
  DEFAULT_CHESS_STATE,
  FinishedBlunderPuzzle,
  GameSearchResult,
  getBlunderRange,
  useBlindfoldTrainingStore,
  useBlunderRecognitionStore,
  useGamesSearchState,
} from "../utils/state";
import { chunked, intersperse } from "../utils/intersperse";
import { Chess, Piece, SQUARES } from "@lubert/chess.ts";
import { NewPuzzleButton } from "app/NewPuzzleButton";
import { useHelpModal } from "./useHelpModal";
import { Modal } from "./Modal";
import { SettingsTitle } from "./SettingsTitle";
import { SelectOneOf } from "./SelectOneOf";
import { SelectRange } from "./SelectRange";
import {
  getPuzzleDifficultyRating,
  getPuzzleDifficultyStepValue,
  PuzzleDifficulty,
  stepValueToPuzzleDifficulty,
} from "app/types/VisualizationState";
import { NavBar } from "./NavBar";
import axios from "axios";
import { LichessGame } from "app/models";
import client from "app/client";
import BeatLoader from "react-spinners/BeatLoader";

const pieceToKey = (piece: Piece) => {
  return `${piece.type}-${piece.color}`;
};

const DIVIDER_COLOR = c.grays[15];
const DIVIDER_SIZE = 2;
const PIECE_TYPES = ["k", "q", "r", "b", "n", "p"];
const COLORS = ["w", "b"];
const MAX_BLUNDERS = 10;

export const GamesSearch = () => {
  const isMobile = useIsMobile();
  const state = useGamesSearchState();
  console.log("state whiteRating", state.whiteRating);
  // const pieces = state.chessState.position
  //   .board()
  //   .flat()
  //   .filter((sq) => sq !== null);
  const sectionTitleStyles = s(
    c.fontSize(18),
    c.fg(c.colors.textPrimary),
    c.selfStretch,
    c.pb(4),
    c.mb(16),
    c.borderBottom(`1px solid ${c.grays[30]}`)
  );
  const createSlider = (title, key, min, max, step) => {
    return (
      <>
        <Text style={s(sectionTitleStyles)}>{title}</Text>
        <SelectRange
          min={min}
          max={max}
          step={step}
          range={state[key]}
          onChange={function ([lower, upper]): void {
            state.quick((s) => {
              s[key] = [lower, upper];
            });
          }}
          onFinish={function (): void {}}
        />
      </>
    );
  };
  const formSections = [
    <>
      <Text style={s(sectionTitleStyles)}>Result</Text>
      <SelectOneOf
        choices={[
          null,
          GameSearchResult.White,
          GameSearchResult.Draw,
          GameSearchResult.Black,
        ]}
        activeChoice={state.gameResult}
        onSelect={function (c): void {
          state.quick((s) => {
            s.gameResult = c;
          });
        }}
        renderChoice={(r: GameSearchResult) => {
          return <Text style={s()}>{r ? formatGameResult(r) : "Any"}</Text>;
        }}
      />
    </>,
    createSlider("Number of Moves", "numberMoves", 0, 80, 1),
    createSlider("White Rating", "whiteRating", 0, 2800, 50),
    createSlider("Black Rating", "blackRating", 0, 2800, 50),
    createSlider("White Blunders", "whiteBlunders", 0, 10, 1),
    createSlider("Black Blunders", "blackBlunders", 0, MAX_BLUNDERS, 1),
  ];
  let inner = null;
  if (state.loading) {
    inner = (
      <View style={s(c.center, c.minHeight("80vh"))}>
        <BeatLoader color={c.grays[100]} size={20} />;
      </View>
    );
  } else if (!isEmpty(state.returnedGames)) {
    console.log("Returned games, yeah");
    inner = (
      <View style={s(c.column, c.alignCenter, c.fullWidth)}>
        {chunked(
          state.returnedGames.map((game, i) => {
            return (
              <a href={`https://lichess.org/${game.id}`} target="_blank">
                <View
                  style={s(
                    c.px(16),
                    c.py(16),
                    c.bg(c.grays[80]),
                    c.br(4),
                    c.width(400),
                    c.clickable,
                    c.relative
                  )}
                >
                  <View
                    style={s(
                      c.absolute,
                      c.top(0),
                      c.right(0),
                      c.pr(12),
                      c.pt(12)
                    )}
                  >
                    <Text style={s()}>
                      <i
                        style={s(
                          c.fg(c.colors.textInverse),
                          c.fontSize(18),
                          c.fg(c.grays[40])
                        )}
                        className="fas fa-arrow-up-right-from-square"
                      ></i>
                    </Text>
                  </View>
                  <Spacer height={0} />
                  <View style={s(c.row)}>
                    {intersperse(
                      ["white", "black"].map((color, i) => {
                        console.log(game);
                        return (
                          <View style={s(c.column)}>
                            <View style={s(c.row, c.alignCenter)}>
                              <View
                                style={s(c.round, c.size(12), c.bg(color))}
                              ></View>
                              <Spacer width={4} />
                              <Text
                                style={s(
                                  c.fg(c.colors.textInverseSecondary),
                                  c.weightBold
                                )}
                              >
                                {game[`${color}Elo`]}
                              </Text>
                            </View>
                            <Spacer height={4} />
                            <Text
                              style={s(c.fg(c.colors.textInverseSecondary))}
                            >
                              <b>{game[`${color}Blunders`]}</b> blunders
                            </Text>
                            <Spacer height={4} />
                            <Text
                              style={s(c.fg(c.colors.textInverseSecondary))}
                            >
                              <b>{game[`${color}CentipawnLoss`]}</b> avg
                              centipawn loss
                            </Text>
                          </View>
                        );
                      }),
                      (i) => {
                        return <Spacer width={24} key={i} />;
                      }
                    )}
                  </View>
                  <Spacer height={24} />
                  <View style={s(c.row, c.justifyBetween, c.alignEnd)}>
                    <Text style={s(c.weightBold, c.fontSize(18))}>
                      {formatGameResult(game.result)}
                    </Text>
                    <Text style={s(c.row, c.selfEnd, c.alignEnd)}>
                      <Text style={s(c.weightBold, c.fontSize(18))}>
                        {Math.floor(game.numberMoves / 2)}
                      </Text>
                      <Spacer width={4} />
                      <Text style={s(c.fontSize(14), c.mb(0))}>moves</Text>
                    </Text>
                  </View>
                </View>
              </a>
            );
          }),
          (i) => {
            return <Spacer width={12} key={i} />;
          },
          isMobile ? 1 : 2,
          (i) => {
            return <Spacer height={12} key={i} />;
          },
          (children) => {
            return <View style={s(c.row)}>{children}</View>;
          }
        )}
      </View>
    );
  } else {
    inner = (
      <>
        <View
          style={s(
            c.bg(c.grays[20]),
            c.br(4),
            // c.fullWidth,
            // c.selfStretch,
            c.fullWidth,
            c.maxWidth(900),
            c.containerStyles(isMobile),
            c.px(12),
            c.py(12),
            c.alignStretch,
            c.column
          )}
        >
          <Text
            style={s(
              c.fg(c.colors.textPrimary),
              c.lineHeight("1.5em"),
              c.fontSize(14)
            )}
          >
            This is a tool to search through games from Lichess. It{" "}
            <b>does not </b>have all Lichess games, it's only a relatively small
            subset, at about 5 million games. Here's some example queries you
            can run: <br />
            <Spacer height={12} />
            <View style={s(c.column)}>
              <ExampleGame
                {...{
                  name: "Games between highly-ranked players, where White won against the Falkbeer Countergambit, with no blunders",
                  moves: ["e4", "e5", "f4", "d5"],
                  state: state,
                  whiteRating: [2200, 2500],
                  blackRating: [2200, 2500],
                  numberMoves: [0, 30],
                  whiteBlunders: [0, 0],
                  blackBlunders: [0, MAX_BLUNDERS],
                  gameResult: GameSearchResult.White,
                }}
              />
              <Spacer height={4} />
              <ExampleGame
                {...{
                  name: "Games where Black fell for the early bishop trap in the Caro-Kann",
                  moves: ["e4", "c6", "d4", "d5", "e5", "Bf5", "h4", "e6"],
                  state: state,
                  whiteRating: [0, 2500],
                  blackRating: [0, 2500],
                  numberMoves: [6, 50],
                  whiteBlunders: [0, 0],
                  blackBlunders: [0, MAX_BLUNDERS],
                  gameResult: null,
                }}
              />
              <Spacer height={4} />
              <ExampleGame
                {...{
                  name: "Low-elo games that played the first 18 moves of theory in the Grünfeld",
                  moves: [
                    "d4",
                    "c4",
                    "Nf6",
                    "c4",
                    "g6",
                    "Nc3",
                    "d5",
                    "cxd5",
                    "Nxd5",
                    "e4",
                    "Nxc3",
                    "bxc3",
                    "Bg7",
                    "Bc4",
                    "c5",
                    "Ne2",
                    "Nc6",
                    "Be3",
                  ],
                  state: state,
                  whiteRating: [0, 1600],
                  blackRating: [0, 1600],
                  numberMoves: [0, 80],
                  whiteBlunders: [0, MAX_BLUNDERS],
                  blackBlunders: [0, MAX_BLUNDERS],
                  gameResult: null,
                }}
              />
            </View>
          </Text>
        </View>
        <Spacer height={24} />
        <View
          style={s(
            c.bg(c.grays[20]),
            c.br(4),
            // c.fullWidth,
            // c.selfStretch,
            c.fullWidth,
            c.maxWidth(900),
            c.containerStyles(isMobile),
            c.px(12),
            c.py(12),
            c.alignStretch,
            c.column
          )}
        >
          <>
            <Text style={s(sectionTitleStyles)}>Opening</Text>
            <Text style={s(c.fg(c.colors.textSecondary))}>
              Play out moves on the board. Resulting games will be filtered to
              those that started with those moves.
            </Text>
            <Spacer height={12} />
            <View
              style={s(
                c.maxWidth(400),
                c.column,
                c.alignEnd,
                c.selfCenter,
                c.fullWidth
              )}
            >
              <ChessboardView
                onSquarePress={state.onSquarePress}
                state={state.chessState}
              />
              {state.chessState.position.history().length > 0 && (
                <>
                  <Spacer height={12} />
                  <Button
                    style={s(c.buttons.basic)}
                    onPress={() => {
                      state.quick((s) => {
                        s.chessState.position.undo();
                      });
                    }}
                  >
                    <Text
                      style={s(
                        c.buttons.basic.textStyles,
                        c.row,
                        c.alignCenter
                      )}
                    >
                      <i
                        style={s(c.fg(c.colors.textInverse))}
                        className="fas fa-undo"
                      ></i>
                      <Spacer width={8} />
                      Undo
                    </Text>
                  </Button>
                </>
              )}
            </View>
          </>
          <Spacer height={24} />
          {chunked(
            formSections.map((section, i) => {
              return <View style={s(c.column, c.flexible)}>{section}</View>;
            }),
            (i) => {
              return <Spacer width={24} key={i} />;
            },
            isMobile ? 1 : 2,
            (i) => {
              return <Spacer height={48} key={i} />;
            },
            (children) => {
              return <View style={s(c.row, c.fullWidth)}>{children}</View>;
            }
          )}
          <Spacer height={48} />
          <Button
            style={s(c.buttons.primary, c.selfEnd)}
            onPress={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              (async () => {
                state.quick((s) => {
                  s.loading = true;
                });
                let response = await client.post("/api/v1/games", {
                  whiteRating: state.whiteRating,
                  whiteBlunders: state.whiteBlunders,
                  blackRating: state.blackRating,
                  blackBlunders: state.blackBlunders,
                  numberMoves: state.numberMoves,
                  result: state.gameResult,
                  opening: state.chessState.position.history(),
                });
                // @ts-ignore
                state.quick((s) => {
                  s.returnedGames = response.data as LichessGame[];
                  s.loading = false;
                });
              })();
            }}
          >
            <Text style={s(c.buttons.primary.textStyles, c.fontSize(18))}>
              <i
                style={s(c.fg(c.colors.textPrimary))}
                className="fas fa-search"
              ></i>
              <Spacer width={8} />
              Find Games
            </Text>
          </Button>
        </View>
      </>
    );
  }
  return (
    <View style={s(c.column, c.alignCenter, c.pb(80))}>
      <NavBar />
      <Spacer height={40} />
      {inner}
    </View>
  );
};
function formatGameResult(r: GameSearchResult) {
  switch (r) {
    case GameSearchResult.White:
      return "White wins";
    case GameSearchResult.Black:
      return "Black wins";
    case GameSearchResult.Draw:
      return "Draw";
    default:
      break;
  }
}

const ExampleGame = ({
  name,
  moves,
  whiteRating,
  blackRating,
  numberMoves,
  whiteBlunders,
  blackBlunders,
  gameResult,
  state,
}: {
  name: string;
  moves: string[];
  whiteRating: [number, number];
  blackRating: [number, number];
  numberMoves: [number, number];
  whiteBlunders: [number, number];
  blackBlunders: [number, number];
  gameResult: GameSearchResult;
  state: GamesSearchState;
}) => {
  return (
    <View style={s()}>
      <Button
        onPress={() => {
          state.quick((s) => {
            s.whiteRating = whiteRating;
            s.blackRating = blackRating;
            s.numberMoves = numberMoves;
            s.whiteBlunders = whiteBlunders;
            s.blackBlunders = blackBlunders;
            s.gameResult = gameResult;
            s.chessState.position = new Chess();
            moves.map((move) => {
              s.chessState.position.move(move);
            });
          });
        }}
        style={s(c.row, c.alignCenter)}
      >
        <i
          style={s(c.fg(c.colors.textPrimary))}
          className="fas fa-angle-right"
        ></i>
        <Spacer width={8} />
        <Text
          style={s(c.fg(c.colors.textPrimary), c.weightBold, c.fontSize(14))}
        >
          {name}
        </Text>
      </Button>
    </View>
  );
};