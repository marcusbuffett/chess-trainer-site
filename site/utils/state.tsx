import { getSquareOffset, isCheckmate } from "../utils/chess";
import { Store } from "pullstate";
import { StorageItem } from "app/utils/storageItem";
import {
  PlaybackSpeed,
  PuzzleDifficulty,
  VisualizationState,
  ProgressMessage,
  ProgressMessageType,
  getPuzzleDifficultyRating,
  ClimbState,
  ColorTrainingState,
} from "app/types/VisualizationState";
import {
  fakePuzzle,
  fakeBlackPuzzle,
  fakeBlackBlunderPuzzle,
  fakeWhiteBlunderPuzzle,
} from "app/mocks/puzzles";
import { algebraic, Chess, Color, Move, SQUARES } from "@lubert/chess.ts";
import { produce, original } from "immer";
import type { Draft } from "immer";
import create, {
  GetState,
  SetState,
  State,
  StateCreator,
  StoreApi,
} from "zustand";
import {
  PersistOptions,
  StoreApiWithDevtools,
  StoreApiWithPersist,
  StoreApiWithSubscribeWithSelector,
  combine,
  devtools,
  persist,
  redux,
  subscribeWithSelector,
} from "zustand/middleware";
import { fetchNewBlunderPuzzle, fetchNewPuzzle } from "./api";
import {
  takeRight,
  cloneDeep,
  indexOf,
  isEmpty,
  first,
  sample,
  mapValues,
} from "lodash";
import { times } from "../utils";
import { WritableDraft } from "immer/dist/internal";
import { getAnimationDurations } from "../components/chessboard/Chessboard";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import { COLUMNS, ROWS } from "../types/Chess";
import { c } from "../styles";
import { Square } from "@lubert/chess.ts/dist/types";
import {
  DEBUG_CLIMB_START_PLAYING,
  DEBUG_DONE_BLUNDER_VIEW,
  DEBUG_PASS_FAIL_BUTTONS,
} from "./test_settings";
import { ChessboardState } from "../types/ChessboardBiref";
import { BlunderPuzzle } from "../models";

const fensTheSame = (x, y) => {
  if (x.split(" ")[0] == y.split(" ")[0]) {
    return true;
  }
};

const test = false;
const testProgress = false;

const immer =
  <
    T extends State,
    CustomSetState extends SetState<T>,
    CustomGetState extends GetState<T>,
    CustomStoreApi extends StoreApi<T>
  >(
    config: StateCreator<
      T,
      (partial: ((draft: Draft<T>) => void) | T, replace?: boolean) => void,
      CustomGetState,
      CustomStoreApi
    >
  ): StateCreator<T, CustomSetState, CustomGetState, CustomStoreApi> =>
  (set, get, api) =>
    config(
      (partial, replace) => {
        const nextState =
          typeof partial === "function"
            ? produce(partial as (state: Draft<T>) => T)
            : (partial as T);
        return set(nextState, replace);
      },
      get,
      api
    );

const generateClimb = () => {
  let puzzleDifficulty = 1000;
  let hiddenMoves = 1;
  let cutoff = 2400;
  const climb = [{ puzzleDifficulty, hiddenMoves }];
  const addRampingPuzzleDifficulty = () => {
    times(20)((i) => {
      puzzleDifficulty += 10;
      climb.push({ puzzleDifficulty, hiddenMoves });
    });
  };
  const addRampingHiddenMoves = () => {
    times(1)((i) => {
      hiddenMoves += 1;
      if (puzzleDifficulty < cutoff) {
        puzzleDifficulty -= 100;
      }
      climb.push({ puzzleDifficulty, hiddenMoves });
    });
  };
  times(30)((i) => {
    if (puzzleDifficulty < cutoff) {
      addRampingPuzzleDifficulty();
    }
    addRampingHiddenMoves();
  });
  return climb;
};

// climb stuff
const CLIMB = generateClimb();
const TIME_SUCCESSFUL_SOLVE = 30 * 1000;
const TIME_UNSUCCESSFUL_SOLVE = 30 * 1000;
const POINTS_LOST = 20;

export const DEFAULT_CHESS_STATE = {
  availableMoves: [],
  ringColor: null,
  ringIndicatorAnim: new Animated.Value(0),
  squareHighlightAnims: mapValues(SQUARES, (number, square) => {
    return new Animated.Value(0.0);
  }),
  flipped: false,
  position: new Chess(),
  moveIndicatorAnim: new Animated.ValueXY({ x: 0, y: 0 }),
  moveIndicatorOpacityAnim: new Animated.Value(0),
};

const createVisualizationState = (
  // TODO: some better way to have climb state and viz state
  set: SetState<ClimbState>,
  get,
  isClimb = false
): ClimbState => {
  // @ts-ignore this is really bad, really need to figure out how to create a store that extends from another
  return {
    ...(isClimb
      ? {
          isPlayingClimb: DEBUG_CLIMB_START_PLAYING,
          scoreOpacityAnim: new Animated.Value(0.0),
          // TODO: bring back intro screen
          climb: CLIMB,
          score: new StorageItem("climb-score", 0),
          highScore: new StorageItem("climb-high-score", 0),
          delta: 0,
          step: null,
          puzzleStartTime: null,
          startPlayingClimb: (state?: VisualizationState) =>
            setter(set, state, (s) => {
              s.isPlayingClimb = true;
              s.animateMoves(s);
            }),
          onFail: (state?: VisualizationState) =>
            setter(set, state, (s) => {
              // TODO: fix repetition here
              s.currentPuzzleFailed = true;
              let delta = -10;
              s.delta = delta;
              s.lastPuzzleSuccess = false;
              s.animatePointChange(s);
              s.score.value = Math.max(s.score.value + delta, 0);
              s.updateStep(s);
            }),
          onSuccess: (state?: VisualizationState) =>
            setter(set, state, (s) => {
              if (s.currentPuzzleFailed) {
                return;
              }
              let timeTaken = performance.now() - s.puzzleStartTime;
              let delta = Math.round(
                Math.max(1, 10 - (timeTaken / TIME_SUCCESSFUL_SOLVE) * 10)
              );
              s.lastPuzzleSuccess = true;
              s.delta = delta;
              s.animatePointChange(delta, s);
              s.score.value = s.score.value + delta;
              if (s.score.value > s.highScore.value) {
                s.highScore.value = s.score.value;
              }
              s.updateStep(s);
            }),
          lastPuzzleSuccess: false,
          currentPuzzleFailed: false,
          animatePointChange: (success: boolean, state?: VisualizationState) =>
            setter(set, state, (s) => {
              let animDuration = 300;
              Animated.sequence([
                Animated.timing(s.scoreOpacityAnim, {
                  toValue: 1,
                  duration: animDuration,
                  useNativeDriver: false,
                }),

                Animated.timing(s.scoreOpacityAnim, {
                  toValue: 0,
                  duration: animDuration,
                  useNativeDriver: false,
                }),
              ]).start();
            }),
          onAutoPlayEnd: (state?: VisualizationState) =>
            setter(set, state, (s) => {
              s.puzzleStartTime = performance.now();
              s.currentPuzzleFailed = false;
            }),
          initState: (state?: VisualizationState) =>
            setter(set, state, (state) => {
              state.updateStep(state);
              state.refreshPuzzle();
            }),
          updateStep: (state?: VisualizationState) =>
            setter(set, state, (state) => {
              state.step = state.climb[state.score.value];
            }),
        }
      : {}),
    progressMessage: (testProgress
      ? { message: "Test message", type: ProgressMessageType.Error }
      : null) as ProgressMessage,

    isDone: false,
    playButtonFlashAnim: new Animated.Value(0.0),
    availableMoves: [],
    mockPassFail: DEBUG_PASS_FAIL_BUTTONS,
    showNotation: new StorageItem("show-notation", false),
    plyUserSetting: new StorageItem("visualization-ply", 2),
    ratingGteUserSetting: new StorageItem(
      "puzzle-rating-gte-v2",
      PuzzleDifficulty.Beginner
    ),
    ratingLteUserSetting: new StorageItem(
      "puzzle-rating-lte-v2",
      PuzzleDifficulty.Intermediate
    ),
    playbackSpeedUserSetting: new StorageItem(
      "playback-speed",
      PlaybackSpeed.Normal
    ),
    hiddenMoves: null,
    autoPlay: false,
    solutionMoves: [] as Move[],
    puzzle: test ? fakeBlackPuzzle : null,
    turn: "w",
    showHelpButton: true,
    nextPuzzle: null,
    isPlaying: false,
    focusedMoveIndex: null,
    focusedMove: null,
    canFocusNextMove: false,
    canFocusLastMove: false,
    // onSuccess: onSuccess,
    // onFail: onFail,
    helpOpen: false,
    futurePosition: new Chess(),
    currentPosition: new Chess(),
    showFuturePosition: false,
    chessState: DEFAULT_CHESS_STATE,
    getFetchOptions: () => {
      let state: ClimbState = get();
      if (state.step) {
        return {
          ratingGte: state.step.puzzleDifficulty - 25,
          ratingLte: state.step.puzzleDifficulty + 25,
          maxPly: state.step.hiddenMoves,
        };
      }
      return {
        ratingGte: getPuzzleDifficultyRating(state.ratingGteUserSetting.value),
        ratingLte: getPuzzleDifficultyRating(state.ratingLteUserSetting.value),
        maxPly: state.plyUserSetting.value,
      };
    },
    getPly: () => {
      const state = get();
      return state.step?.hiddenMoves ?? state.plyUserSetting.value;
    },
    resetState: (state?: VisualizationState) => {
      setter<VisualizationState>(set, state, (state) => {
        state.showFuturePosition = false;
        state.progressMessage = null;
        state.finishedAutoPlaying = false;
        state.isDone = false;
      });
    },
    refreshPuzzle: async () => {
      let state = get();
      let p = state.nextPuzzle;
      if (!p) {
        p = await fetchNewPuzzle(state.getFetchOptions(state));
      }
      if (!p) {
        window.alert(
          "Problem fetching puzzles, please report this if you run into it, to me@mbuffett.com"
        );
        return;
      }
      set((s) => {
        s.puzzle = p;
        s.resetState(s);
        s.setupForPuzzle(s);
      });
    },
    flashRing: (success: boolean, state?: VisualizationState) =>
      setter(set, state, (state) => {
        flashRing(state.chessState, success);
      }),
    quick: (fn) => {
      setter<VisualizationState>(set, undefined, (state) => {
        fn(state);
      });
    },
    animateMoves: (state?: VisualizationState) => {
      setter<VisualizationState>(set, state, (state) => {
        if (state.isPlaying) {
          return;
        }
        state.stopLoopingPlayFlash(state);
        state.isPlaying = true;
        let moves = cloneDeep(state.hiddenMoves);
        let i = 0;
        let delay = getAnimationDurations(
          state.playbackSpeedUserSetting.value
        )[2];
        let animateNextMove = (state: VisualizationState) => {
          let move = moves.shift();
          // TODO: something to deal with this state being old
          if (move && state.isPlaying) {
            state.animateMove(state, move, false, () => {
              window.setTimeout(() => {
                set((state) => {
                  animateNextMove(state);
                });
              }, delay);
            });
            i++;
          } else {
            if (isClimb && !state.finishedAutoPlaying) {
              state.onAutoPlayEnd(state);
            }
            state.isPlaying = false;
            state.finishedAutoPlaying = true;
            state.focusedMoveIndex = null;
            // cb?.()
          }
        };
        animateNextMove(state);
      });
    },
    getSquareOffset: (square: Square, state?: VisualizationState) =>
      setter(set, state, (state) => {
        return getSquareOffset(square, state.chessState.flipped);
      }),
    animateMove: (
      state: VisualizationState,
      move: Move,
      backwards = false,
      callback: () => void
    ) => {
      // TODO: use own flipped value, but it gets outdated right now, so passing it in.
      let { fadeDuration, moveDuration, stayDuration } = getAnimationDurations(
        state.playbackSpeedUserSetting.value
      );
      state.chessState.indicatorColor =
        move.color == "b" ? c.hsl(180, 15, 10, 80) : c.hsl(180, 15, 100, 80);
      // @ts-ignore
      let [start, end]: Square[] = backwards
        ? [move.to, move.from]
        : [move.from, move.to];
      state.chessState.moveIndicatorAnim.setValue(
        state.getSquareOffset(start, state)
      );
      Animated.sequence([
        Animated.timing(state.chessState.moveIndicatorOpacityAnim, {
          toValue: 1.0,
          duration: fadeDuration,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.delay(stayDuration),
        Animated.timing(state.chessState.moveIndicatorAnim, {
          toValue: state.getSquareOffset(end, state),
          duration: moveDuration,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.delay(stayDuration),
        Animated.timing(state.chessState.moveIndicatorOpacityAnim, {
          toValue: 0,
          duration: fadeDuration,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
      ]).start(callback);
    },
    setupForPuzzle: (state?: VisualizationState) => {
      setter<VisualizationState>(set, state, (state) => {
        state.focusedMoveIndex = null;
        let currentPosition = new Chess();
        let futurePosition = new Chess();
        for (let move of state.puzzle.allMoves) {
          currentPosition.move(move);
          futurePosition.move(move);
          if (fensTheSame(currentPosition.fen(), state.puzzle.fen)) {
            futurePosition.move(state.puzzle.moves[0], { sloppy: true });
            currentPosition.move(state.puzzle.moves[0], { sloppy: true });
            let hiddenMoves = takeRight(
              currentPosition.history({ verbose: true }),
              state.getPly()
            );
            let boardForPuzzleMoves = futurePosition.clone();
            boardForPuzzleMoves.undo();
            for (let solutionMove of state.puzzle.moves) {
              boardForPuzzleMoves.move(solutionMove, { sloppy: true });
            }
            // @ts-ignore
            state.solutionMoves = takeRight(
              boardForPuzzleMoves.history({ verbose: true }),
              state.puzzle.moves.length - 1
            );
            // currentPosition.undo()

            state.hiddenMoves = hiddenMoves;
            for (let i = 0; i < state.getPly(); i++) {
              currentPosition.undo();
            }
            // state.currentPosition = currentPosition
            state.futurePosition = futurePosition;
            state.currentPosition = currentPosition;
            state.showFuturePosition = false;
            state.chessState.position = currentPosition;
            state.chessState.flipped = futurePosition.turn() === "b";
            state.availableMoves = [];
            break;
          }
        }
        state.turn = state.futurePosition.turn();
        state.startLoopingPlayFlash(state);
        // TODO
        if (isClimb && state.isPlayingClimb) {
          state.animateMoves(state);
        }
      });
    },
    stopLoopingPlayFlash: (state?: VisualizationState) => {
      setter<VisualizationState>(set, state, (state) => {
        state.playButtonFlashAnim.setValue(1.0);
      });
    },
    startLoopingPlayFlash: (state?: VisualizationState) => {
      setter<VisualizationState>(set, state, (state) => {
        let animDuration = 1000;
        Animated.loop(
          Animated.sequence([
            Animated.timing(state.playButtonFlashAnim, {
              toValue: 1.0,
              duration: animDuration,
              useNativeDriver: false,
            }),

            Animated.timing(state.playButtonFlashAnim, {
              toValue: 0,
              duration: animDuration,
              useNativeDriver: false,
            }),
          ])
        ).start();
      });
    },
    onSquarePress: (square: Square) =>
      set((state) => {
        let piece = state.futurePosition?.get(square);
        let availableMove = state.chessState.availableMoves.find(
          (m) => m.to == square
        );
        if (availableMove) {
          state.chessState.availableMoves = [];
          state.attemptSolution(availableMove, state);
          // TODO:
          // biref.attemptSolution(availableMove)
          return;
        }
        if (!state.futurePosition) {
          return;
        }
        let moves = state.futurePosition.moves({
          square,
          verbose: true,
        });
        if (
          !isEmpty(state.chessState.availableMoves) &&
          first(state.chessState.availableMoves).from == square
        ) {
          state.chessState.availableMoves = [];
        } else if (!state.chessState.frozen) {
          // @ts-ignore
          state.chessState.availableMoves = moves;
        }
      }),
    toggleNotation: (state?: VisualizationState) => {
      setter<VisualizationState>(set, state, (state) => {
        state.showNotation.value = !state.showNotation.value;
      });
    },
    setPlaybackSpeed: (
      playbackSpeed: PlaybackSpeed,
      state?: VisualizationState
    ) => {
      setter<VisualizationState>(set, state, (state) => {
        state.playbackSpeedUserSetting.value = playbackSpeed;
        return true;
      });
    },
    updatePly: (increment: number, state?: VisualizationState) => {
      setter<VisualizationState>(set, state, (state) => {
        state.plyUserSetting.value = Math.max(
          state.plyUserSetting.value + increment,
          1
        );
        state.setupForPuzzle(state);
      });
    },
    attemptSolution: (move: Move, state?: VisualizationState) => {
      setter<VisualizationState>(set, state, (state) => {
        if (
          move.san == state.solutionMoves[0].san ||
          isCheckmate(move, state.futurePosition)
        ) {
          state.showFuturePosition = true;
          state.flashRing(true, state);
          let otherSideMove = state.solutionMoves[1];
          // if (state.showFuturePosition) {
          //   state.animateMove(move)
          // } else {
          // }
          // if (otherSideMove) {
          //   biref.animateMove(state.solutionMoves[1])
          // }
          // TODO: clone board?
          state.futurePosition.move(move);
          if (otherSideMove) {
            state.futurePosition.move(otherSideMove);
          }
          state.chessState.position = state.futurePosition;
          state.solutionMoves.shift();
          state.solutionMoves.shift();
          if (!isEmpty(state.solutionMoves)) {
            state.progressMessage = {
              message: "Keep going...",
              type: ProgressMessageType.Success,
            };
          } else {
            state.progressMessage = null;
            state.isDone = true;
            if (isClimb) {
              state.onSuccess(state);
            }
          }
        } else {
          state.flashRing(false, state);
          if (isClimb) {
            state.onFail(state);
          }
          state.progressMessage = {
            message: `${move.san} was not the right move, try again.`,
            type: ProgressMessageType.Error,
          };
        }
      });
    },
  };
};

export const useVisualizationStore = create<VisualizationState>(
  devtools(
    // @ts-ignore for the set stuff
    immer((set, get) => createVisualizationState(set, get)),
    { name: "VisualizationState" }
  )
);

export const useColorTrainingStore = create<ColorTrainingState>(
  devtools(
    // @ts-ignore for the set stuff
    immer((set, get) => ({
      isPlaying: false,
      startTime: null,
      score: 0,
      lastRoundScore: null,
      widthAnim: new Animated.Value(0.0),
      highScore: new StorageItem("high-score-color-trainer", 0),
      roundDuration: 30 * 1000,
      remainingTime: null,
      penalties: 0,
      currentSquare: null,
      chessState: { ...DEFAULT_CHESS_STATE, hideColors: true, position: null },
      calculateRemainingTime: (state?: ColorTrainingState) => {
        setter(set, state, (state) => {
          let remainingTime =
            state.roundDuration -
            (performance.now() - state.startTime) -
            state.penalties * 5 * 1000;
          state.remainingTime = remainingTime;
          state.widthAnim.setValue(remainingTime / state.roundDuration);
          Animated.timing(state.widthAnim, {
            toValue: 0.0,
            duration: remainingTime,
            useNativeDriver: false,
            easing: Easing.linear,
          }).start(() => {
            let state = get();
            state.stopRound();
          });
        });
      },
      stopRound: (state?: ColorTrainingState) =>
        setter(set, state, (state) => {
          state.isPlaying = false;
          state.lastRoundScore = state.score;
          if (state.score > state.highScore.value) {
            state.highScore.value = state.score;
          }
          state.score = 0;
          state.penalties = 0;
          state.remainingTime = 0;
          state.clearHighlights(state);
          state.currentSquare = null;
        }),

      startPlaying: (state?: ColorTrainingState) =>
        setter(set, state, (state) => {
          state.widthAnim.setValue(1.0);
          state.startTime = performance.now();
          state.remainingTime = state.roundDuration;
          state.isPlaying = true;
          state.score = 0;
          state.highlightNewSquare(state);
          state.calculateRemainingTime(state);
        }),
      flashRing: (success: boolean, state?: ColorTrainingState) =>
        setter(set, state, (state) => {
          flashRing(state.chessState, success);
        }),
      guessColor: (color: "light" | "dark", state?: ColorTrainingState) => {
        setter(set, state, (state) => {
          let correct = new Chess().squareColor(state.currentSquare) == color;
          state.flashRing(correct, state);
          if (correct) {
            state.score = state.score + 1;
          } else {
            state.penalties = state.penalties + 1;
          }
          state.calculateRemainingTime(state);
          state.highlightNewSquare(state);
        });
      },
      clearHighlights: (state?: ColorTrainingState) =>
        setter(set, state, (state) => {
          let animDuration = 200;
          if (state.currentSquare) {
            Animated.timing(
              state.chessState.squareHighlightAnims[state.currentSquare],
              {
                toValue: 0,
                duration: animDuration,
                useNativeDriver: false,
              }
            ).start();
          }
        }),
      highlightNewSquare: (state?: ColorTrainingState) =>
        setter(set, state, (state) => {
          let randomSquare = algebraic(sample(SQUARES)) as Square;
          let animDuration = 200;
          state.clearHighlights(state);
          state.currentSquare = randomSquare;
          Animated.timing(
            state.chessState.squareHighlightAnims[state.currentSquare],
            {
              toValue: 0.8,
              duration: animDuration,
              useNativeDriver: false,
            }
          ).start();
        }),
    })),
    { name: "ColorTrainingState" }
  )
);

export enum BlunderRecognitionTab {
  Passed = "Passed",
  Failed = "Failed",
}

interface BlunderRecognitionState {
  isPlaying: boolean;
  startTime: number;
  difficulty: StorageItem<BlunderRecognitionDifficulty>;
  score: number;
  activeTab: BlunderRecognitionTab;
  puzzles: BlunderPuzzle[];
  currentPuzzle: BlunderPuzzle;
  currentMove: string;
  isBlunder: boolean;
  lastRoundScore: number;
  widthAnim: Animated.Value;
  highScore: StorageItem<Record<BlunderRecognitionDifficulty, number>>;
  roundDuration: number;
  remainingTime: number;
  penalties: number;
  currentSquare: Square;
  chessState: ChessboardState;
  calculateRemainingTime: (state?: BlunderRecognitionState) => void;
  stopRound: (state?: BlunderRecognitionState) => void;
  startPlaying: (state?: BlunderRecognitionState) => void;
  playAgain: (state?: BlunderRecognitionState) => void;
  flashRing: (success: boolean, state?: BlunderRecognitionState) => void;
  guessColor: (
    color: "light" | "dark",
    state?: BlunderRecognitionState
  ) => void;
  clearHighlights: (state?: BlunderRecognitionState) => void;
  highlightNewSquare: (state?: BlunderRecognitionState) => void;
  setupNextRound: (state?: BlunderRecognitionState) => void;
  guess: (isBlunder: boolean, state?: BlunderRecognitionState) => void;
  addFinishedPuzzle: (
    correct: boolean,
    state?: BlunderRecognitionState
  ) => void;
  donePlaying: boolean;
  seenPuzzles: FinishedBlunderPuzzle[];
  prefetchPuzzles: (state?: BlunderRecognitionState) => void;
  quick: (fn: (_: BlunderRecognitionState) => void) => void;
}
export enum BlunderRecognitionDifficulty {
  Easy = "Easy",
  Medium = "Medium",
  Hard = "Hard",
}

export const getBlunderRange = (
  d: BlunderRecognitionDifficulty
): [number, number] => {
  if (d === BlunderRecognitionDifficulty.Easy) {
    return [500, 10000];
  }
  if (d === BlunderRecognitionDifficulty.Medium) {
    return [300, 500];
  }
  if (d === BlunderRecognitionDifficulty.Hard) {
    return [200, 300];
  }
};

export interface FinishedBlunderPuzzle {
  puzzle: BlunderPuzzle;
  showedBlunder: boolean;
  correct: boolean;
  timeTaken: number;
}

export const useBlunderRecognitionStore = create<BlunderRecognitionState>(
  devtools(
    // @ts-ignore for the set stuff
    immer((set, get) => ({
      isPlaying: false,
      startTime: null,
      score: 0,
      lastRoundScore: null,
      widthAnim: new Animated.Value(0.0),
      highScore: new StorageItem("high-score-blunder-recognition", {
        [BlunderRecognitionDifficulty.Easy]: 0,
        [BlunderRecognitionDifficulty.Medium]: 0,
        [BlunderRecognitionDifficulty.Hard]: 0,
      } as Record<BlunderRecognitionDifficulty, number>),
      roundDuration: 60 * 1 * 1000,
      remainingTime: null,
      penalties: 0,
      difficulty: new StorageItem(
        "blunder-recognition-difficulty",
        BlunderRecognitionDifficulty.Easy as BlunderRecognitionDifficulty
      ),
      puzzle: null,
      nextPuzzle: null,
      chessState: { ...DEFAULT_CHESS_STATE },
      donePlaying: DEBUG_DONE_BLUNDER_VIEW,
      seenPuzzles: DEBUG_DONE_BLUNDER_VIEW
        ? Array(20)
            .fill(0)
            .map(() => {
              return {
                puzzle: fakeBlackBlunderPuzzle,
                showedBlunder: Math.random() < 0.5,
                correct:
                  Math.random() < 0.5
                    ? true
                    : Math.random() < 0.5
                    ? false
                    : null,
                timeTaken: Math.random() * 100,
              };
            })
        : [],
      activeTab: BlunderRecognitionTab.Failed,
      quick: (fn) => {
        setter<BlunderRecognitionState>(set, undefined, (state) => {
          fn(state);
        });
      },
      calculateRemainingTime: (state?: BlunderRecognitionState) => {
        setter(set, state, (state) => {
          let remainingTime =
            state.roundDuration -
            (performance.now() - state.startTime) -
            state.penalties * 5 * 1000;
          state.remainingTime = remainingTime;
          state.widthAnim.setValue(remainingTime / state.roundDuration);
          Animated.timing(state.widthAnim, {
            toValue: 0.0,
            duration: remainingTime,
            useNativeDriver: false,
            easing: Easing.linear,
          }).start(({ finished }) => {
            if (finished) {
              set((state) => {
                state.stopRound();
              });
            }
          });
        });
      },
      stopRound: (state?: BlunderRecognitionState) =>
        setter(set, state, (state) => {
          state.isPlaying = false;
          state.donePlaying = true;
          state.lastRoundScore = state.score;
          state.addFinishedPuzzle(null, state);
          if (state.score > state.highScore.value[state.difficulty.value]) {
            state.highScore.value = {
              ...state.highScore.value,
              [state.difficulty.value]: state.score,
            };
          }
          state.penalties = 0;
          state.remainingTime = 0;
        }),
      startPlaying: (state?: BlunderRecognitionState) =>
        setter(set, state, (state) => {
          state.finishedPuzzles = [];
          state.donePlaying = false;
          state.widthAnim.setValue(1.0);
          state.startTime = performance.now();
          state.remainingTime = state.roundDuration;
          state.isPlaying = true;
          state.score = 0;
          state.prefetchPuzzles().then(() => {
            set((state) => {
              // @ts-ignore
              state.setupNextRound(state);
              // @ts-ignore
              state.calculateRemainingTime(state);
            });
          });
        }),
      playAgain: (state?: BlunderRecognitionState) =>
        setter(set, state, (state: BlunderRecognitionState) => {
          state.donePlaying = false;
        }),
      flashRing: (success: boolean, state?: BlunderRecognitionState) =>
        setter(set, state, (state) => {
          flashRing(state.chessState, success);
        }),
      guess: (isBlunder: boolean, state?: BlunderRecognitionState) =>
        setter(set, state, (state: BlunderRecognitionState) => {
          let correct = isBlunder === state.isBlunder;
          if (correct) {
            state.score = state.score + 1;
          } else {
            state.penalties = state.penalties + 1;
          }
          state.calculateRemainingTime(state);
          state.flashRing(correct, state);
          state.addFinishedPuzzle(correct, state);
          state.setupNextRound(state);
        }),
      addFinishedPuzzle: (
        correct: boolean | null,
        state?: BlunderRecognitionState
      ) =>
        setter(set, state, (state: BlunderRecognitionState) => {
          if (state.currentPuzzle) {
            state.seenPuzzles.unshift({
              puzzle: state.currentPuzzle,
              showedBlunder: state.isBlunder,
              correct: correct,
              timeTaken: 0,
            });
          }
        }),
      prefetchPuzzles: async () => {
        let state = get();
        let puzzles = await fetchNewBlunderPuzzle({
          centipawn_loss_max: getBlunderRange(state.difficulty.value)[1],
          centipawn_loss_min: getBlunderRange(state.difficulty.value)[0],
        });
        set((s) => {
          s.puzzles = puzzles;
        });
      },
      setupNextRound: (state?: BlunderRecognitionState) => {
        setter<BlunderRecognitionState>(
          set,
          state,
          (state: BlunderRecognitionState) => {
            let showBlunder = Math.random() < 0.5;
            state.currentPuzzle = state.puzzles.shift();
            if (!state.currentPuzzle) {
              state.stopRound(state);
              return;
            }
            state.currentMove = showBlunder
              ? state.currentPuzzle.blunder
              : state.currentPuzzle.bestMove;
            state.isBlunder = showBlunder;
            let pos = new Chess(state.currentPuzzle.fen);
            state.chessState.position = pos;
            state.chessState.flipped = pos.turn() === "b";
          }
        );
      },
    })),
    { name: "BlunderRecognitionState" }
  )
);

export const useClimbStore = create<ClimbState>(
  // @ts-ignore for the set stuff
  devtools(
    // @ts-ignore for the set stuff
    immer((set, get) => createVisualizationState(set, get, true)),
    { name: "ClimbState" }
  )
);

const setter = <T,>(set, state: T, fn: (T) => void) => {
  if (state) {
    // To force re-render when changing just a class or something
    // @ts-ignore
    state.bogus = Math.random();
    return fn(state);
  } else {
    set((state) => {
      // To force re-render when changing just a class or something
      // @ts-ignore
      state.bogus = Math.random();
      fn(state);
    });
  }
};

function flashRing(chessState: ChessboardState, success: boolean) {
  const animDuration = 200;
  chessState.ringColor = success
    ? c.colors.successColor
    : c.colors.failureColor;
  Animated.sequence([
    Animated.timing(chessState.ringIndicatorAnim, {
      toValue: 1,
      duration: animDuration,
      useNativeDriver: false,
    }),

    Animated.timing(chessState.ringIndicatorAnim, {
      toValue: 0,
      duration: animDuration,
      useNativeDriver: false,
    }),
  ]).start();
}
// const setter = <T,>(
//   set: (
//     state: (
//       partial:
//         | VisualizationState
//         | ((draft: WritableDraft<VisualizationState>) => void),
//       replace?: boolean
//     ) => void
//   ) => void,
//   state: VisualizationState | WritableDraft<VisualizationState>
// ): ((state?: VisualizationState) => void) => {

// }