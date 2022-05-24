import { PageContainer } from "./PageContainer";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Text, Pressable, View } from "react-native";
// import { ExchangeRates } from "app/ExchangeRate";
import { c, s } from "app/styles";
import { Spacer } from "app/Space";
import { ChessboardView } from "app/components/chessboard/Chessboard";
import { cloneDeep, isEmpty, isNil, takeRight, times } from "lodash";
import { TrainerLayout } from "app/components/TrainerLayout";
import { Button } from "app/components/Button";
import { useIsMobile } from "app/utils/isMobile";
import { useColorTrainingStore } from "../utils/state";
import { navItems } from "./NavBar";
import { chunked } from "app/utils/intersperse";
import Link from "next/link";
import { failOnTrue } from "app/utils/test_settings";
import { useHasBetaAccess } from "app/utils/useHasBetaAccess";
import { useGameMemorizationState } from "app/utils/game_memorization_state";
import { LichessGameCell } from "./LichessGameCell";
import { ProgressMessageView } from "app/components/ProgressMessage";
import client from "app/client";

export const GameMemorization = () => {
  const state = useGameMemorizationState();
  useEffect(() => {
    state.fetchGames();
  }, []);
  const isMobile = useIsMobile();
  let inner = null;
  if (state.activeGame) {
    inner = (
      <TrainerLayout
        chessboard={
          <ChessboardView
            {...{
              state: state.chessState,
              onSquarePress: state.onSquarePress,
            }}
          />
        }
      >
        {state.progressMessage && (
          <>
            <ProgressMessageView progressMessage={state.progressMessage} />
            <Spacer height={12} />
          </>
        )}
        {isEmpty(state.nextMoves) && (
          <>
            <Button
              style={s(c.buttons.primary)}
              onPress={() => state.newRandomGame()}
            >
              New
            </Button>
            <Spacer height={12} />
            <Button
              style={s(c.buttons.basic)}
              onPress={() => state.retryGame()}
            >
              Retry
            </Button>
            <Spacer height={12} />
          </>
        )}
        {!isEmpty(state.nextMoves) && (
          <>
            <Button
              style={s(c.buttons.basic)}
              onPress={() => state.giveUpOnMove()}
            >
              Show Me
            </Button>
            <Spacer height={12} />
          </>
        )}
        <Text style={s(c.fg(c.colors.textPrimary))}>
          Moves left: {state.nextMoves.length}
        </Text>
      </TrainerLayout>
    );
  } else if (state.games) {
    inner = (
      <>
        <Text style={s(c.fg(c.colors.textPrimary))}>
          You've reviewed {state.numReviewed.value} games in total.
        </Text>
        <Spacer height={24} />
        {chunked(
          state.games.map((game, i) => {
            return (
              <View style={s(c.relative)}>
                <Button
                  style={s(
                    c.absolute,
                    c.top(0),
                    c.right(0),
                    c.zIndex(5),
                    c.buttons.squareBasicButtons,
                    c.bg("none")
                  )}
                  onPress={() => {
                    client.post("/api/v1/my_games/remove", {
                      gameIds: [game.id],
                    });
                    state.quick((s) => {
                      s.games = s.games.filter((g) => {
                        return g.id !== game.id;
                      });
                    });
                  }}
                >
                  <Text style={s(c.buttons.basic.textStyles)}>
                    <i
                      style={s(c.fg(c.colors.textInverse))}
                      className="fas fa-trash-can"
                    ></i>
                  </Text>
                </Button>
                <Pressable
                  onPress={() => {
                    state.setActiveGame(game);
                  }}
                >
                  <LichessGameCell game={game} hideLink />
                </Pressable>
              </View>
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
      </>
    );
  }
  return <PageContainer>{inner}</PageContainer>;
};
