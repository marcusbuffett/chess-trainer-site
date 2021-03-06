import { BlunderPuzzle, LichessPuzzle } from "app/models";
import client from "app/client";
import {
  fakePuzzle,
  fakeBlackPuzzle,
  fakeBlackBlunderPuzzle,
  fakeWhiteBlunderPuzzle,
} from "app/mocks/puzzles";
import { cloneDeep } from "lodash";
import { DEBUG_MOCK_FETCH } from "./test_settings";

interface PuzzleFetchOptions {
  ratingGte?: number;
  ratingLte?: number;
  maxPly?: number;
}

let flipper = 0;
export const fetchNewPuzzle = async (
  args: PuzzleFetchOptions
): Promise<LichessPuzzle> => {
  if (DEBUG_MOCK_FETCH) {
    console.log("Returning mock puzzle");
    let puzzle = flipper % 2 === 0 ? fakeBlackPuzzle : fakePuzzle;
    flipper += 1;
    return cloneDeep(puzzle);
  }
  try {
    let response = await client.post("/api/v2/tactic", {
      ...args,
    });
    // @ts-ignore
    return response.data.tactic as LichessPuzzle;
  } catch (error) {
    console.log(error);
  }
};

export const fetchNewBlunderPuzzle = async ({
  centipawn_loss_max,
  centipawn_loss_min,
  limit,
}: {
  centipawn_loss_max: number;
  centipawn_loss_min: number;
  limit: number;
}): Promise<BlunderPuzzle[]> => {
  if (DEBUG_MOCK_FETCH) {
    console.log("Returning mock puzzle");
    let puzzle =
      flipper % 2 === 0 ? fakeBlackBlunderPuzzle : fakeWhiteBlunderPuzzle;
    flipper += 1;
    return cloneDeep([puzzle]);
  }
  try {
    let response = await client.post("/api/v1/blunder_puzzle", {
      centipawn_loss_min,
      centipawn_loss_max,
      limit,
    });
    // @ts-ignore
    return response.data as BlunderPuzzle[];
  } catch (error) {
    console.log(error);
  }
};
