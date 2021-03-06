import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Text,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
// import { ExchangeRates } from "app/ExchangeRate";
import { c, s } from "app/styles";
import { Spacer } from "app/Space";
import {
  ChessboardView,
  getAnimationDurations,
  getPlaybackSpeedDescription,
} from "app/components/chessboard/Chessboard";
import { TrainerLayout } from "app/components/TrainerLayout";
import { useVisualizationTraining } from "../utils/useVisualizationTraining";
import { useVisualizationStore } from "../utils/state";
import { PageContainer } from "./PageContainer";

export const VisualizationTraining = () => {
  const state = useVisualizationStore();
  const { chessboardProps, ui } = useVisualizationTraining({ state });
  useEffect(() => {
    state.refreshPuzzle();
  }, []);
  return (
    <PageContainer>
      <TrainerLayout chessboard={<ChessboardView {...chessboardProps} />}>
        {ui}
      </TrainerLayout>
    </PageContainer>
  );
};
