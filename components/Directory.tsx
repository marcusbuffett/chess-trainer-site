import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Text, Pressable, View } from "react-native";
// import { ExchangeRates } from "app/ExchangeRate";
import { c, s } from "app/styles";
import { Spacer } from "app/Space";
import { ChessboardView } from "app/components/chessboard/Chessboard";
import { cloneDeep, isEmpty, isNil, takeRight } from "lodash";
import { TrainerLayout } from "app/components/TrainerLayout";
import { Button } from "app/components/Button";
import { useIsMobile } from "app/utils/isMobile";
import { useColorTrainingStore } from "../utils/state";
import { navItems } from "./NavBar";
import { chunked } from "app/utils/intersperse";
import { PageContainer } from "./PageContainer";
import Link from "next/link";

export const Directory = () => {
  const isMobile = useIsMobile();
  return (
    <PageContainer hideNavBar>
      <Spacer height={44} />
      <View style={s(c.containerStyles(isMobile), c.grow, c.justifyCenter)}>
        <Text
          style={s(
            c.fg(c.colors.textPrimary),
            c.fontSize(32),
            c.weightSemiBold
          )}
        >
          Chess Madra
        </Text>
        <Spacer height={24} />
        <Text
          style={s(
            c.fg(c.colors.textSecondary),
            c.fontSize(16),
            c.lineHeight("1.5em")
          )}
        >
          Welcome to my little chess training site! Please{" "}
          <a
            href="mailto:me@mbuffett.com"
            style={s(c.borderBottom(`1px solid ${c.grays[80]}`))}
          >
            let me know
          </a>{" "}
          if you have any feedback, or just to say hi :)
        </Text>
        <Spacer height={44} />
        {chunked(
          navItems.map(({ path, title, description }, i) => {
            return (
              <Link href={path}>
                <View
                  style={s(
                    c.clickable,
                    c.column,
                    c.flexible,
                    c.px(12),
                    c.py(16),
                    c.br(4),
                    c.bg(c.grays[90])
                    // c.shadow(0, 5, 25, 1, "rgba(255,255,255,0.5)")
                  )}
                >
                  <Text
                    style={s(
                      c.fg(c.colors.textInverse),
                      c.fontSize(24),
                      c.weightBold
                    )}
                  >
                    {title}
                  </Text>
                  <Spacer height={24} />
                  <Text
                    style={s(c.fg(c.colors.textInverse), c.lineHeight("1.5em"))}
                  >
                    {description}
                  </Text>
                  <Spacer grow height={12} />
                  <View
                    style={s(c.buttons.primary, c.selfEnd, c.minWidth(120))}
                    onPress={(e) => {}}
                  >
                    <Text style={s(c.buttons.primary.textStyles)}>Start</Text>
                  </View>
                </View>
              </Link>
            );
          }),
          (i) => {
            return <Spacer width={24} key={i} />;
          },
          isMobile ? 1 : 2,
          (i) => {
            return <Spacer height={24} key={i} />;
          },
          (children) => {
            return <View style={s(c.row, c.fullWidth)}>{children}</View>;
          }
        )}
      </View>
    </PageContainer>
  );
};
