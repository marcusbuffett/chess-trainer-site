import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
  Text,
} from "react-native";
import { s, c } from "app/styles";
import { times } from "app/utils";
import BishopBlackIcon from "app/components/chessboard/pieces/BishopBlackIcon";
import BishopWhiteIcon from "app/components/chessboard/pieces/BishopWhiteIcon";
import KingBlackIcon from "app/components/chessboard/pieces/KingBlackIcon";
import KingWhiteIcon from "app/components/chessboard/pieces/KingWhiteIcon";
import KnightBlackIcon from "app/components/chessboard/pieces/KnightBlackIcon";
import KnightWhiteIcon from "app/components/chessboard/pieces/KnightWhiteIcon";
import PawnBlackIcon from "app/components/chessboard/pieces/PawnBlackIcon";
import PawnWhiteIcon from "app/components/chessboard/pieces/PawnWhiteIcon";
import QueenBlackIcon from "app/components/chessboard/pieces/QueenBlackIcon";
import QueenWhiteIcon from "app/components/chessboard/pieces/QueenWhiteIcon";
import RookBlackIcon from "app/components/chessboard/pieces/RookBlackIcon";
import RookWhiteIcon from "app/components/chessboard/pieces/RookWhiteIcon";
import { Chess, PieceSymbol, SQUARES } from "@lubert/chess.ts";
import { Move, Piece, Square } from "@lubert/chess.ts/dist/types";
import { ChessColor, COLUMNS, ROWS } from "app/types/Chess";
import {
  PlaybackSpeed,
  PuzzleDifficulty,
  VisualizationState,
} from "app/types/VisualizationState";
import { getSquareOffset } from "../../utils/chess";
import { ChessboardState } from "app/utils/chessboard_state";
import { Spacer } from "app/Space";
import { useIsMobile } from "app/utils/isMobile";

const animatedXYToPercentage = (x) => {
  return s(
    c.top(
      x.y.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
      })
    ),
    c.left(
      x.x.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
      })
    )
  );
};

const cloneBoard = (board: Chess): Chess => {
  return new Chess(board.fen());
};

export const getPlaybackSpeedDescription = (ps: PlaybackSpeed) => {
  switch (ps) {
    case PlaybackSpeed.Slow:
      return "Slow";
    case PlaybackSpeed.Normal:
      return "Normal";
    case PlaybackSpeed.Fast:
      return "Fast";
    case PlaybackSpeed.Ludicrous:
      return "Ludicrous";
  }
};

enum ChessPiece {
  Pawn = "p",
  Rook = "r",
  Knight = "n",
  Bishop = "b",
  Queen = "q",
  King = "k",
}

const getIconForPiece = (piece: PieceSymbol, color: ChessColor) => {
  switch (color) {
    case "b":
      switch (piece) {
        case ChessPiece.Rook:
          return <RookBlackIcon />;
        case ChessPiece.Pawn:
          return <PawnBlackIcon />;
        case ChessPiece.Knight:
          return <KnightBlackIcon />;
        case ChessPiece.Queen:
          return <QueenBlackIcon />;
        case ChessPiece.Bishop:
          return <BishopBlackIcon />;
        case ChessPiece.King:
          return <KingBlackIcon />;
      }
    case "w":
      switch (piece) {
        case ChessPiece.Rook:
          return <RookWhiteIcon />;
        case ChessPiece.Pawn:
          return <PawnWhiteIcon />;
        case ChessPiece.Knight:
          return <KnightWhiteIcon />;
        case ChessPiece.Queen:
          return <QueenWhiteIcon />;
        case ChessPiece.Bishop:
          return <BishopWhiteIcon />;
        case ChessPiece.King:
          return <KingWhiteIcon />;
      }
  }
};

export const PieceView = ({ piece }: { piece: Piece }) => {
  return getIconForPiece(piece.type, piece.color);
};

export const getAnimationDurations = (playbackSpeed: PlaybackSpeed) => {
  switch (playbackSpeed) {
    case PlaybackSpeed.Slow:
      return {
        moveDuration: 300,
        fadeDuration: 200,
        stayDuration: 500,
      };
    case PlaybackSpeed.Normal:
      return {
        moveDuration: 200,
        fadeDuration: 150,
        stayDuration: 300,
      };
    case PlaybackSpeed.Fast:
      return {
        moveDuration: 200,
        fadeDuration: 100,
        stayDuration: 100,
      };
    case PlaybackSpeed.Ludicrous:
      return {
        moveDuration: 150,
        fadeDuration: 50,
        stayDuration: 50,
      };
  }
};

export const ChessboardView = ({
  state,
  disableDrag,
  styles,
}: {
  state?: ChessboardState;
  disableDrag?: boolean;
  styles?: any;
}) => {
  const { position, availableMoves } = state;
  const tileStyles = s(c.bg("green"), c.grow);
  const stateRef = useRef(state);
  stateRef.current = state;
  const chessboardLayout = useRef(null);
  const getSquareFromLayoutAndGesture = (chessboardLayout, gesture): Square => {
    let columnPercent =
      (gesture.moveX - chessboardLayout.left) / chessboardLayout.width;
    let rowPercent =
      (gesture.moveY - chessboardLayout.top - window.scrollY) /
      chessboardLayout.height;
    let row = Math.min(7, Math.max(0, Math.floor(rowPercent * 8)));
    let column = Math.min(7, Math.max(0, Math.floor(columnPercent * 8)));
    if (stateRef.current.flipped) {
      column = 7 - column;
      row = 7 - row;
    }
    // @ts-ignore
    return `${COLUMNS[column]}${ROWS[7 - row]}`;
  };

  const { moveIndicatorAnim, moveIndicatorOpacityAnim, indicatorColor } = state;

  const hiddenColorsBorder = `1px solid ${c.grays[70]}`;
  const pans = useMemo(() => {
    // @ts-ignore
    let pans: Record<Square, Animated.ValueXY> = {};
    Object.keys(SQUARES).map((sq) => {
      pans[sq] = new Animated.ValueXY();
    });
    return pans;
  }, []);
  const tapTimeout = useRef(null);
  const isTap = useRef(false);
  const chessboardContainerRef = useRef(null);
  const didImmediatelyTap = useRef(false);
  const panResponders = useMemo(() => {
    // @ts-ignore
    let panResponders: Record<Square, PanResponder> = {};
    Object.keys(SQUARES).map((sq: Square) => {
      panResponders[sq] = PanResponder.create({
        // Ask to be the responder:
        onStartShouldSetPanResponder: (evt, gestureState) => true,
        onStartShouldSetPanResponderCapture: (evt, gestureState) => true,
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          return true;
        },

        onPanResponderGrant: (evt, gestureState) => {
          if (chessboardContainerRef.current) {
            chessboardLayout.current =
              chessboardContainerRef.current.getBoundingClientRect();
          }
          const state = stateRef.current;
          didImmediatelyTap.current = false;
          if (sq !== state.activeFromSquare) {
            didImmediatelyTap.current = true;
            state.onSquarePress(sq, false);
          }
          isTap.current = true;
          tapTimeout.current = window.setTimeout(() => {
            isTap.current = false;
          }, 100);
        },
        // The gesture has started. Show visual feedback so the user knows
        // what is happening!
        // gestureState.d{x,y} will be set to zero now
        onPanResponderMove: (evt, gesture) => {
          let square = getSquareFromLayoutAndGesture(
            chessboardLayout.current,
            gesture
          );
          Animated.event([null, { dx: pans[sq].x, dy: pans[sq].y }], {
            useNativeDriver: true,
          })(evt, gesture);
          if (chessboardLayout.current) {
            let isOverMovableSquare = stateRef.current.availableMoves.find(
              (m) => m.to == square
            );
            let newSquare = square;
            let currentSquare = stateRef.current.draggedOverSquare;
            if (
              (currentSquare !== newSquare && isOverMovableSquare) ||
              (!isOverMovableSquare && stateRef.current.draggedOverSquare)
            ) {
              state.quick((s) => {
                if (isOverMovableSquare) {
                  s.draggedOverSquare = square;
                } else {
                  s.draggedOverSquare = null;
                }
              });
            }
          }
        },
        onPanResponderTerminationRequest: (evt, gestureState) => {
          pans[sq].setValue({ x: 0, y: 0 });
          return true;
        },
        onPanResponderRelease: (evt, gestureState) => {
          window.clearTimeout(tapTimeout.current);
          pans[sq].setValue({ x: 0, y: 0 });
          if (isTap.current && !stateRef.current.draggedOverSquare) {
            if (!didImmediatelyTap.current) {
              state.onSquarePress(sq);
            }
            // if (stateRef.current.activeFromSquare) {
            // }
          } else {
            state.quick((s) => {
              s.draggedOverSquare = null;
              s.activeFromSquare = null;
            });
            let square = getSquareFromLayoutAndGesture(
              chessboardLayout.current,
              gestureState
            );
            state.onSquarePress(square, true);

            // The user has released all touches while this view is the
            // responder. This typically means a gesture has succeeded
          }
        },
        onPanResponderTerminate: (evt, gestureState) => {
          pans[sq].setValue({ x: 0, y: 0 });
          // Another component has become the responder, so this gesture
          // should be cancelled
        },
        onShouldBlockNativeResponder: (evt, gestureState) => {
          // Returns whether this component should block native components from becoming the JS
          // responder. Returns true by default. Is currently only supported on android.
          return true;
        },
      });
    });
    return panResponders;
  }, []);

  const isMobile = useIsMobile();
  const moveLogRef = useRef(null);
  useLayoutEffect(() => {
    if (moveLogRef.current) {
      console.log("SCROLLING");
      moveLogRef.current.scrollLeft = moveLogRef.current.scrollWidth;
    }
  }, [state.moveLog]);

  const { width: windowWidth } = useWindowDimensions();
  return (
    <>
      <View
        style={s(c.pb("100%"), c.height(0), c.width("100%"), styles, {
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          KhtmlUserSelect: "none",
          MozUserSelect: "none",
          MsUserSelect: "none",
          UserSelect: "none",
        })}
      >
        <View
          style={s(
            {
              width: "100%",
              height: "100%",
              position: "absolute",
              overflow: "hidden",
              // shadowColor: "black",
              // shadowOpacity: 0.4,
              // shadowRadius: 10,
            },
            c.brt(2),
            !state.showMoveLog && c.brb(2),
            state.hideColors && c.border(hiddenColorsBorder)
          )}
          ref={chessboardContainerRef}
          onLayout={({ nativeEvent: { layout } }) => {
            chessboardLayout.current = layout;
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={s(
              c.size("calc(1/8 * 100%)"),
              c.zIndex(5),
              c.absolute,
              c.center,
              c.opacity(moveIndicatorOpacityAnim),
              moveIndicatorAnim && animatedXYToPercentage(moveIndicatorAnim)
            )}
          >
            <View
              style={s(
                c.size("50%"),
                c.round,
                c.bg(indicatorColor),
                c.shadow(0, 0, 4, 0, c.hsl(0, 0, 0, 50))
              )}
            ></View>
          </Animated.View>
          <Animated.View // Special animatable View
            style={s(
              c.absolute,
              c.fullWidth,
              c.fullHeight,
              c.zIndex(3),
              // c.bg("black"),
              c.border(`6px solid ${state.ringColor}`),
              // @ts-ignore
              c.opacity(state.ringIndicatorAnim)
            )}
            pointerEvents="none"
          ></Animated.View>
          {Object.keys(SQUARES).map((sq) => {
            let pos = position;
            let piece: Piece = null;
            if (pos) {
              piece = pos.get(sq);
            }

            let posStyles = s(
              c.top(`${getSquareOffset(sq, state.flipped).y * 100}%`),
              c.left(`${getSquareOffset(sq, state.flipped).x * 100}%`)
            );
            let animated = false;
            if (state.animatedMove?.to && sq == state.animatedMove?.to) {
              animated = true;
              posStyles = animatedXYToPercentage(state.pieceMoveAnim);
            } else {
            }
            let priority = state.activeFromSquare === sq;
            let containerViewStyles = s(
              c.fullWidth,
              c.absolute,
              posStyles,
              c.zIndex(priority ? 11 : 1),
              c.size("12.5%")
            );
            let pieceView = null;
            if (piece) {
              let pieceViewInner = (
                <View style={s(c.fullWidth, c.fullHeight)}>
                  <PieceView piece={piece} />
                </View>
              );
              if (animated) {
                pieceView = (
                  <Animated.View
                    style={s(containerViewStyles)}
                    key={`piece-${sq}`}
                    pointerEvents="none"
                  >
                    {pieceViewInner}
                  </Animated.View>
                );
              } else {
                pieceView = (
                  <Animated.View
                    key={sq}
                    style={s(
                      containerViewStyles,
                      c.keyedProp("touchAction")("none"),
                      {
                        transform: [
                          { translateX: pans[sq].x },
                          { translateY: pans[sq].y },
                        ],
                      }
                    )}
                    {...panResponders[sq].panHandlers}
                  >
                    {pieceViewInner}
                  </Animated.View>
                );
              }
            }
            let moveIndicatorView = null;
            let availableMove = availableMoves.find((m) => m.to == sq);
            if (
              availableMove ||
              state.activeFromSquare === sq ||
              state.draggedOverSquare == sq
            ) {
              let isFromSquare = state.activeFromSquare === sq;
              let isDraggedOverSquare = state.draggedOverSquare == sq;
              let isJustIndicator = !isDraggedOverSquare && !isFromSquare;
              moveIndicatorView = (
                <Animated.View
                  key={`indicator-${sq}`}
                  style={s(
                    c.fullWidth,
                    c.absolute,
                    posStyles,
                    c.zIndex(2),
                    c.center,
                    c.size("12.5%")
                  )}
                  pointerEvents="none"
                >
                  <View
                    style={s(
                      isJustIndicator ? c.size("30%") : c.size("100%"),
                      isJustIndicator ? c.opacity(50) : c.opacity(40),
                      isJustIndicator
                        ? c.bg(c.primaries[0])
                        : c.bg(c.primaries[40]),
                      isJustIndicator && c.round,
                      c.absolute,
                      c.zIndex(4)
                    )}
                  />
                </Animated.View>
              );
            }

            return (
              <React.Fragment key={sq}>
                {pieceView}
                {moveIndicatorView}
              </React.Fragment>
            );
          })}
          <View style={s(c.column, c.fullWidth, c.fullHeight)}>
            {times(8)((i) => {
              return (
                <View key={i} style={s(c.fullWidth, c.row, c.grow, c.flexible)}>
                  {times(8)((j) => {
                    let [color, inverseColor] =
                      (i + j) % 2 == 0
                        ? [c.colors.lightTile, c.colors.darkTile]
                        : [c.colors.darkTile, c.colors.lightTile];
                    if (state.hideColors) {
                      color = c.grays[30];
                    }
                    let tileLetter = state.flipped
                      ? COLUMNS[7 - j]
                      : COLUMNS[j];
                    let tileNumber = state.flipped ? ROWS[i] : ROWS[7 - i];
                    let square = `${tileLetter}${tileNumber}` as Square;
                    const isBottomEdge = i == 7;
                    const isRightEdge = j == 7;
                    const isLeftEdge = j == 0;
                    return (
                      <View
                        key={j}
                        style={s(
                          tileStyles,
                          c.bg(color),

                          c.center,
                          c.clickable,
                          c.flexible,
                          c.overflowHidden,
                          state.hideColors &&
                            s(
                              !isBottomEdge &&
                                c.borderBottom(hiddenColorsBorder),
                              !isRightEdge && c.borderRight(hiddenColorsBorder)
                            )
                        )}
                      >
                        <Pressable
                          key={j}
                          style={s(c.fullWidth, c.fullHeight)}
                          onPress={() => {}}
                          onPressIn={() => {
                            state.onSquarePress(square);
                          }}
                        >
                          <Animated.View
                            style={s(
                              {
                                opacity: state.squareHighlightAnims[square],
                              },
                              c.bg(c.primaries[60]),
                              c.absolute,
                              c.size("100%"),
                              c.zIndex(4)
                            )}
                          ></Animated.View>
                          {isBottomEdge && (
                            <Text
                              style={s(
                                c.fg(
                                  state.hideColors ? c.grays[80] : inverseColor
                                ),
                                c.weightBold,
                                c.absolute,
                                c.fontSize(isMobile ? 8 : 10),
                                c.left(isMobile ? 2 : 4),
                                c.bottom(isMobile ? 0 : 2),
                                c.opacity(80)
                              )}
                            >
                              {tileLetter}
                            </Text>
                          )}
                          {isRightEdge && (
                            <Text
                              style={s(
                                c.fg(
                                  state.hideColors ? c.grays[80] : inverseColor
                                ),
                                c.weightBold,
                                c.absolute,
                                c.fontSize(isMobile ? 8 : 10),
                                c.right(isMobile ? 2 : 3),
                                c.opacity(80),
                                c.top(isMobile ? 0 : 1)
                              )}
                            >
                              {tileNumber}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </View>
      </View>
      {state.showMoveLog && state.moveLog && (
        <>
          <View
            ref={moveLogRef}
            style={s(
              c.fullWidth,
              c.bg(c.grays[15]),
              c.pt(14),
              c.pb(8),
              c.mt(-6),
              c.px(4),
              c.br(2),
              c.zIndex(-1),
              c.scrollX
            )}
          >
            <Text
              style={s(
                c.fg(c.colors.textSecondary),
                c.weightBold,
                c.keyedProp("textOverflow")("ellipsis"),
                c.whitespace("nowrap")
              )}
            >
              {state.moveLog}
            </Text>
          </View>
        </>
      )}
    </>
  );
};
