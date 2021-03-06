import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Text, Pressable, View } from "react-native";
// import { ExchangeRates } from "app/ExchangeRate";
import { c, s } from "app/styles";
import { Spacer } from "app/Space";
import { ChessboardView } from "app/components/chessboard/Chessboard";
import { cloneDeep, isEmpty, isNil, takeRight } from "lodash";
import { TrainerLayout } from "app/components/TrainerLayout";
import { Button } from "app/components/Button";
import { useIsMobile } from "app/utils/isMobile";
import { keyBy, groupBy } from "lodash";
import { intersperse } from "app/utils/intersperse";
import {
  RepertoireState,
  useRepertoireState,
} from "app/utils/repertoire_state";
import {
  RepertoireGrade,
  RepertoireMove,
  RepertoireSide,
} from "app/utils/repertoire";
import { PageContainer } from "./PageContainer";
import { Modal } from "./Modal";
import { SelectOneOf } from "./SelectOneOf";
import { CMTextInput } from "./TextInput";
import { failOnTrue } from "app/utils/test_settings";
import client from "app/client";
import { DragAndDropInput } from "./DragAndDropInput";
import { RepertoireTemplateWizard } from "./RepertoireTemplateWizard";
import { PlayerTemplateWizard } from "./PlayerTemplateWizard";

const MOBILE_CUTOFF = 800;

enum OpeningSource {
  Import,
  Templates,
  PlayerTemplates,
  // ChessCom,
  // Pgn,
  Manual,
  Chessmood,
}

enum RatingSource {
  Lichess,
  ChessCom,
  Fide,
}

// function formatRatingSource(ratingSource: RatingSource) {
//   switch (ratingSource) {
//     case RatingSource.Lichess:
//       return "Lichess";
//     case RatingSource.ChessCom:
//       return "Chess.com";
//     case RatingSource.Fide:
//       return "FIDE";
//   }
// }

enum RatingRange {
  RatingLessThan1200 = "<1200",
  Rating1200To1500 = "1200-1500",
  Rating1500To1800 = "1500-1800",
  Rating1800To2100 = "1800-2100",
  RatingGreaterThan2100 = "2100+",
}

function formatRatingRange(ratingRange: RatingRange) {
  switch (ratingRange) {
    case RatingRange.RatingLessThan1200:
      return "<1200";
    case RatingRange.Rating1200To1500:
      return "1200-1500";
    case RatingRange.Rating1500To1800:
      return "1500-1800";
    case RatingRange.Rating1800To2100:
      return "1800-2100";
    case RatingRange.RatingGreaterThan2100:
      return "2100+";
  }
}

export const RepertoireWizard = ({ state }: { state: RepertoireState }) => {
  const isMobile = useIsMobile(MOBILE_CUTOFF);
  useEffect(() => {
    state.fetchRepertoireTemplates();
    state.fetchPlayerTemplates();
  }, []);
  // const [uploadModalOpen, setUploadModalOpen] = useState(false);
  // const [rating, setRating] = useState(RatingRange.Rating1500To1800);
  // const [ratingSource, setRatingSource] = useState(RatingSource.Lichess);
  const [openingSource, setOpeningSource] = useState(
    OpeningSource.PlayerTemplates
  );
  const [activeOpeningSource, setActiveOpeningSource] = useState(
    null
    // failOnTrue(OpeningSource.PlayerTemplates)
  );
  // const [ratingTimeControl, setRatingTimeControl] = useState(true);
  const [username, setUsername] = useState("");
  const [lichessStudy, setLichessStudy] = useState("");
  const [whitePgn, setWhitePgn] = useState(null as string);
  const [blackPgn, setBlackPgn] = useState(null as string);

  const importFromLichessUsername = () => {
    state.initializeRepertoire({ lichessUsername: username });
  };

  const introText = (
    <>
      <Text
        style={s(
          c.fg(c.colors.textPrimary),
          c.weightSemiBold,
          c.fontSize(14),
          c.lineHeight("1.7em")
        )}
      >
        This tool will help you build and remember your opening repertoire.
      </Text>
      <Spacer height={12} />
      <Text
        style={s(
          c.fg(c.colors.textPrimary),
          c.weightSemiBold,
          c.fontSize(14),
          c.lineHeight("1.7em")
        )}
      >
        How do you want to create your opening?
      </Text>
    </>
  );

  let playerTemplatesWarningSection = (
    <WarningSection
      title="Risk of deleting moves"
      isMobile={isMobile}
      copy={
        <>New lines in these templates will overwrite your existing lines.</>
      }
    />
  );

  let pgnWarningSection = (
    <WarningSection
      title="Risk of deleting moves"
      isMobile={isMobile}
      copy={
        <>
          New lines will overwrite any existing lines. Ex. if you have 1.e4 in
          your repertoire, but 1.d4 is in the white PGN, your 1.e4 repertoire
          will be lost.
        </>
      }
    />
  );

  let templatesWarningSection = (
    <WarningSection
      title="Risk of deleting moves"
      isMobile={isMobile}
      copy={
        <>
          New lines will overwrite any existing lines. Ex. if your current
          repertoire has 1.e4 d5, but you add the Najdorf template, all moves
          after 1.e4 d5 will be lost.
        </>
      }
    />
  );

  return (
    <>
      <Spacer height={32} grow />
      <View
        style={s(
          c.column,
          c.containerStyles(
            isMobile,
            activeOpeningSource === OpeningSource.Templates ||
              activeOpeningSource === OpeningSource.PlayerTemplates
              ? 700
              : 500
          )
        )}
      >
        {isNil(activeOpeningSource) &&
          !state.hasCompletedRepertoireInitialization && (
            <>
              {introText}
              <Spacer height={24} />
            </>
          )}
        {isNil(activeOpeningSource) &&
          state.hasCompletedRepertoireInitialization && (
            <>
              <View
                style={s(c.row, c.alignCenter, c.clickable, c.pl(4))}
                onClick={() => {
                  state.backToOverview();
                }}
              >
                <i
                  className="fa-light fa-angle-left"
                  style={s(c.fg(c.grays[70]), c.fontSize(16))}
                />
                <Spacer width={6} />
                <Text style={s(c.fg(c.grays[70]), c.weightSemiBold)}>
                  Back to repertoire
                </Text>
              </View>
              <Spacer height={24} />
            </>
          )}
        {isNil(activeOpeningSource) && (
          <>
            <View style={s(c.column)}>
              <ImportOptions {...{ state, openingSource, setOpeningSource }} />
              <Spacer height={12} />
              <Button
                onPress={() => {
                  setActiveOpeningSource(openingSource);
                  if (openingSource === OpeningSource.Manual) {
                    state.quick((s) => {
                      s.hasCompletedRepertoireInitialization = true;
                      s.backToOverview(s);
                    });
                  }
                }}
                style={s(
                  c.maxWidth(100),
                  c.fullWidth,
                  c.selfEnd,
                  !isNil(openingSource)
                    ? c.buttons.primary
                    : c.buttons.primaryDisabled
                )}
              >
                Continue
              </Button>
            </View>
          </>
        )}
        {!isNil(activeOpeningSource) && (
          <View style={s(c.column, c.fullWidth)}>
            {!state.inProgressUsingPlayerTemplate && (
              <View
                style={s(c.row, c.alignCenter, c.clickable, c.pl(4))}
                onClick={() => {
                  setActiveOpeningSource(null);
                }}
              >
                <i
                  className="fa-light fa-angle-left"
                  style={s(c.fg(c.grays[70]), c.fontSize(16))}
                />
                <Spacer width={6} />
                <Text style={s(c.fg(c.grays[70]), c.weightSemiBold)}>Back</Text>
              </View>
            )}
            <Spacer height={12} />
            {activeOpeningSource === OpeningSource.Templates && (
              <>
                {!state.getIsRepertoireEmpty() && templatesWarningSection}
                <RepertoireTemplateWizard state={state} />
              </>
            )}
            {activeOpeningSource === OpeningSource.PlayerTemplates && (
              <>
                {!state.getIsRepertoireEmpty() && playerTemplatesWarningSection}
                <PlayerTemplateWizard state={state} />
              </>
            )}
            {activeOpeningSource == OpeningSource.Import && (
              <>
                {!state.getIsRepertoireEmpty() && pgnWarningSection}
                <ImportSection
                  isMobile={isMobile}
                  title="PGN"
                  description="If you have an opening repertoire with other software, you can export each side as a pgn and upload both here."
                  isValid={blackPgn || whitePgn}
                  submit={() => {
                    state.initializeRepertoire({
                      blackPgn,
                      whitePgn,
                    });
                  }}
                >
                  <View style={s(c.row)}>
                    <DragAndDropInput
                      humanName="White Openings"
                      accept="*.pgn"
                      onUpload={async (e) => {
                        let file = e.target.files[0];
                        if (file) {
                          let body = await file.text();
                          setWhitePgn(body);
                          return true;
                        }
                      }}
                    />
                    <Spacer width={12} />
                    <DragAndDropInput
                      humanName="Black Openings"
                      accept="*.pgn"
                      onUpload={async (e) => {
                        let file = e.target.files[0];
                        if (file) {
                          let body = await file.text();
                          setBlackPgn(body);
                          return true;
                        }
                      }}
                    />
                  </View>
                </ImportSection>
                <Spacer height={12} />
                <ImportSection
                  isMobile={isMobile}
                  title="Lichess Games"
                  description="Parses your last 200 Lichess games, to see what openings you use. This is less accurate than a PGN file, so only use this if you can't get a PGN of your openings."
                  isValid={username}
                  submit={importFromLichessUsername}
                >
                  <View style={s(c.row)} key={"username"}>
                    <CMTextInput
                      placeholder="username"
                      value={username}
                      setValue={setUsername}
                    />
                  </View>
                </ImportSection>
              </>
            )}
          </View>
        )}
      </View>
      <Spacer height={0} grow />
    </>
  );
};

const UploadPgnsView = () => {
  const isMobile = useIsMobile(MOBILE_CUTOFF);
  return (
    <View style={s(isMobile ? c.column : c.row)}>
      <PgnUploadDropper color="White" />
      <Spacer width={12} />
      <PgnUploadDropper color="Black" />
    </View>
  );
};

const PgnUploadDropper = ({ color }) => {
  return (
    <View style={s(c.column, c.alignCenter)}>
      <Text style={s(c.fg(c.colors.textPrimary), c.fontSize(18), c.weightBold)}>
        {color}
      </Text>
      <Spacer height={12} />
      <View
        style={s(
          c.width(240),
          c.height(200),
          c.center,
          c.textAlign("center"),
          c.bg(c.grays[20]),
          c.br(4),
          c.clickable,
          c.relative
        )}
      >
        <input
          style={s(
            c.top(0),
            c.left(0),
            c.absolute,
            c.fullWidth,
            c.fullHeight,
            c.opacity(0),
            c.clickable
          )}
          accept=".pgn"
          multiple={true}
          onChange={() => {}}
          type="file"
        ></input>
        <Text style={s(c.fg(c.colors.textSecondary))}>
          Drag a pgn in here, or click to browse
        </Text>
      </View>
    </View>
  );
};

const ImportSection = ({
  title,
  submit,
  children,
  isValid,
  description,
  isMobile,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <View
      key={title}
      style={s(
        c.column,
        c.fullWidth,
        c.bg(c.grays[15]),
        c.px(12),
        c.py(12),
        c.br(2)
      )}
    >
      <Text
        style={s(
          c.fg(c.colors.textPrimary),
          c.weightSemiBold,
          c.selfStretch,
          c.fontSize(16)
        )}
      >
        {title}
      </Text>
      <Spacer height={12} />
      <Text style={s(c.fg(c.grays[75]), c.weightRegular, c.fontSize(12))}>
        {description}
      </Text>
      <Spacer height={12} />
      {children}
      <Spacer height={isMobile ? 18 : 4} />
      <Button
        isLoading={isLoading}
        loaderProps={{ color: c.grays[75] }}
        style={s(
          isValid ? c.buttons.primary : c.buttons.primaryDisabled,
          c.py(8),
          c.selfEnd
        )}
        onPress={() => {
          setIsLoading(true);
          submit();
        }}
      >
        Import
      </Button>
    </View>
  );
};

const ImportOptions = ({
  state,
  openingSource,
  setOpeningSource,
}: {
  state: RepertoireState;
  openingSource: any;
  setOpeningSource;
}) => {
  return (
    <>
      {intersperse(
        [
          {
            title: "Player Repertoires",
            source: OpeningSource.PlayerTemplates,
            description: (
              <>
                Copy the repertoires of some famous chess streamers, like Daniel
                Naroditsky, Hikaru Nakamura, Levy Rozman, and Eric Rosen.
              </>
            ),
            buttonCopy: "Choose",
          },
          {
            title: "Templates",
            source: OpeningSource.Templates,
            description: state.hasCompletedRepertoireInitialization ? (
              <>Choose among some popular openings for both sides.</>
            ) : (
              <>
                Choose among some popular openings for both sides. An easy way
                to get started if you don't have any openings yet.
              </>
            ),
            buttonCopy: "Choose",
          },
          ...(!state.hasCompletedRepertoireInitialization
            ? [
                {
                  title: "From scratch",
                  buttonCopy: "Start",
                  source: OpeningSource.Manual,
                  description: (
                    <>
                      Create your opening from scratch. The quickest way to get
                      started, and you can always come back.
                    </>
                  ),
                },
              ]
            : []),
          {
            title: "Import",
            source: OpeningSource.Import,
            description: state.hasCompletedRepertoireInitialization ? (
              <>
                Import your existing opening repertoire from a pgn, or just
                provide your Lichess username and we'll figure it out from your
                recent games.
              </>
            ) : (
              <>
                Import your existing opening repertoire from a pgn, or just
                provide your Lichess username and we'll figure it out from your
                recent games.
              </>
            ),
            buttonCopy: "Import",
          },
          // {
          //   title: "ChessMood Pack",
          //   buttonCopy: "Start",
          //   source: OpeningSource.Chessmood,
          //   logo: (
          //     <img
          //       style={s(c.width(100), c.opacity(80))}
          //       src="/chessmood_logo.png"
          //     />
          //   ),
          //   description: (
          //     <>
          //       A full repertoire from the GMs over at{" "}
          //       <a href="https://chessmood.com">ChessMood</a>.{" "}
          //       <span style={s(c.fg(c.grays[75]), c.weightBold)}>
          //         Check out their videos
          //       </span>{" "}
          //       for the ideas behind the moves in this repertoire.
          //     </>
          //   ),
          // },
        ].map((x, i) => {
          const selected = openingSource === x.source;
          return (
            <Pressable
              onPress={() => {
                setOpeningSource(x.source);
              }}
            >
              <View
                style={s(
                  c.row,
                  selected ? c.bg(c.grays[15]) : c.bg(c.grays[15]),
                  c.br(2),
                  c.overflowHidden,
                  c.px(12),
                  c.py(14)
                )}
              >
                <i
                  className={
                    selected ? "fas fa-circle" : "fa-regular fa-circle"
                  }
                  style={s(
                    c.fontSize(18),
                    c.fg(selected ? c.grays[80] : c.grays[50])
                  )}
                />
                <Spacer width={12} />
                <View style={s(c.column, c.flexible, c.mt(-1))}>
                  <View style={s()}>
                    <View style={s(c.row, c.justifyBetween)}>
                      <Text
                        style={s(
                          c.fg(c.colors.textPrimary),
                          c.fontSize(16),
                          c.weightSemiBold
                        )}
                      >
                        {x.title}
                      </Text>
                    </View>
                    <Spacer height={12} />
                    <Text
                      style={s(
                        c.fg(c.grays[70]),
                        c.fontSize(13),
                        c.lineHeight("1.5em")
                      )}
                    >
                      {x.description}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }),
        (i) => {
          return <Spacer height={12} key={i} />;
        }
      )}
    </>
  );
};

const WarningSection = ({ copy, title, isMobile }) => {
  return (
    <View
      style={s(
        c.row,
        c.alignStart,
        c.fullWidth,
        c.bg(c.grays[80]),
        c.px(12),
        c.py(12),
        c.br(2),
        c.mb(14)
      )}
    >
      <i
        className="fa fa-triangle-exclamation"
        style={s(c.fontSize(14), c.mt(2), c.fg(c.yellows[50]))}
      />
      <Spacer width={8} />
      <View style={s(c.column, c.flexible)}>
        <Text style={s(c.fg(c.yellows[40]), c.fontSize(14), c.weightBold)}>
          {title}
        </Text>
        <Spacer height={4} />
        <Text
          style={s(
            c.fg(c.colors.textInverseSecondary),
            c.fontSize(isMobile ? 12 : 14)
          )}
        >
          {copy}
        </Text>
      </View>
    </View>
  );
};
