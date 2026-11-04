import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { PressBox } from "@/components/learn-v2/PressBox";
import { Pill, toneOf } from "@/components/learn-v2/ui";
import { amColors, type AmTheme } from "@/constants/tokens/amColors";
import { amSpring } from "@/constants/tokens/amMotion";
import { amFonts } from "@/constants/tokens/amTypography";
import {
  scrimOpacity,
  settleSheet,
  sheetPositionDuringDrag,
} from "@/lib/sheetPhysics";
import { REVIEW_STYLES, type ReviewStyle } from "@/lib/learn/srs";

/**
 * "How often do words come back?" (prototype `.sheet` for SCR-27): sand sheet, 40px top
 * radius, a 44x5 grab bar. The sheet follows the finger one to one, rubber-bands upwards,
 * and lands by momentum projection; the spring starts from the finger velocity.
 */
export function ReviewStyleSheet({
  theme,
  visible,
  value,
  onSelect,
  onClose,
}: {
  theme: AmTheme;
  visible: boolean;
  value: ReviewStyle;
  onSelect: (style: ReviewStyle) => void;
  onClose: () => void;
}) {
  const tone = toneOf(theme);
  const reduce = useReducedMotion();
  const { height: screenHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [height, setHeight] = useState(560);
  const y = useSharedValue(screenHeight);
  const startY = useSharedValue(0);
  const sheetH = useSharedValue(560);

  useEffect(() => {
    sheetH.value = height;
  }, [height, sheetH]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = reduce
        ? withTiming(0, { duration: 150 })
        : withSpring(0, amSpring.default);
      return;
    }
    const done = (finished?: boolean) => {
      "worklet";
      if (finished) scheduleOnRN(setMounted, false);
    };
    y.value = reduce
      ? withTiming(sheetH.value + 40, { duration: 150 }, done)
      : withSpring(sheetH.value + 40, amSpring.default, done);
  }, [visible, reduce, y, sheetH]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startY.value = y.value;
    })
    .onUpdate((event) => {
      y.value = sheetPositionDuringDrag(
        startY.value,
        event.translationY,
        sheetH.value,
      );
    })
    .onEnd((event) => {
      const settle = settleSheet({
        y: y.value,
        velocity: event.velocityY,
        height: sheetH.value,
      });
      if (settle.dismiss) {
        scheduleOnRN(onClose);
      } else {
        y.value = withSpring(0, {
          ...(settle.spring === "fling" ? amSpring.fling : amSpring.default),
          velocity: event.velocityY,
        });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity(y.value, sheetH.value, 1),
  }));

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel="Word review style"
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.page,
            maxHeight: Math.min(780, screenHeight - 64),
          },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.grab} accessibilityLabel="Drag down to close">
            <View style={[styles.grabBar, { backgroundColor: tone.ink300 }]} />
          </View>
        </GestureDetector>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
        >
          <View style={styles.titleBox}>
            <Text style={[styles.title, { color: theme.textHeading }]}>
              How often do words come back?
            </Text>
            <Text style={[styles.intro, { color: theme.textHeading }]}>
              Pick the rhythm that suits you. You can change it any time. Your
              progress stays.
            </Text>
          </View>
          <View
            style={[
              styles.group,
              { backgroundColor: theme.card, borderColor: theme.line },
            ]}
            accessibilityRole="radiogroup"
          >
            {REVIEW_STYLES.map((option, index) => {
              const on = option.key === value;
              return (
                <PressBox
                  key={option.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${option.name}. ${option.tag}`}
                  onPress={() => onSelect(option.key)}
                  pressedScale={0.99}
                  style={[
                    styles.option,
                    index < REVIEW_STYLES.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: theme.line,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      { borderColor: on ? amColors.orange500 : tone.ink300 },
                      on && { backgroundColor: amColors.orange500 },
                    ]}
                  >
                    {on ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.optionMain}>
                    <Text style={[styles.tag, { color: theme.eyebrow }]}>
                      {option.tag}
                    </Text>
                    <Text
                      style={[styles.optionName, { color: theme.textHeading }]}
                    >
                      {option.name}
                    </Text>
                    <Text
                      style={[styles.optionDesc, { color: theme.textHeading }]}
                    >
                      {option.description}
                    </Text>
                    <Text
                      style={[styles.optionLine, { color: theme.textBody }]}
                    >
                      {option.ladder}
                    </Text>
                  </View>
                </PressBox>
              );
            })}
          </View>
          <Text style={[styles.note, { color: theme.textBody }]}>
            New to this? Start with Simple steps. Switch to Adaptive when you
            have fifty words or more.
          </Text>
          <View style={styles.done}>
            <Pill theme={theme} label="Done" onPress={onClose} full />
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: "rgba(30,30,30,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: "hidden",
  },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingBottom: 32 },
  grab: { height: 44, alignItems: "center", justifyContent: "center" },
  grabBar: { width: 44, height: 5, borderRadius: 9999 },
  titleBox: { paddingHorizontal: 20, paddingBottom: 16 },
  title: {
    fontFamily: amFonts.display,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -0.56,
    textTransform: "uppercase",
  },
  intro: {
    fontFamily: amFonts.regular,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
  },
  group: {
    marginHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 9999,
    borderWidth: 2,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 9999,
    backgroundColor: amColors.white,
  },
  optionMain: { flex: 1, minWidth: 0, gap: 4 },
  tag: {
    fontFamily: amFonts.semi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.96,
    textTransform: "uppercase",
    alignSelf: "flex-start",
  },
  optionName: {
    fontFamily: amFonts.display,
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: -0.19,
    textTransform: "uppercase",
  },
  optionDesc: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  optionLine: {
    fontFamily: amFonts.semi,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },
  note: {
    fontFamily: amFonts.medium,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  done: { paddingHorizontal: 20, paddingTop: 16 },
});
