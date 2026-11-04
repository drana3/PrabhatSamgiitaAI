import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { overStyle } from "@/components/songs-v2/primitives";
import { PressScale } from "@/components/today/motion";
import { amSpring } from "@/constants/tokens/amMotion";
import type { SongsTheme } from "@/constants/tokens/amSongs";
import { amFonts } from "@/constants/tokens/amTypography";
import {
  resolveRelease,
  scrimOpacity,
  sheetOffsetForDrag,
} from "@/lib/songsV2/sheetPhysics";

type Props = {
  open: boolean;
  /** Called after the sheet has left the screen (drag, scrim tap, Done). */
  onClose: () => void;
  theme: SongsTheme;
  eyebrow?: string;
  accessibilityLabel: string;
  doneLabel?: string;
  /** Share of the window the sheet may fill (prototype: 780 of 844). */
  maxHeightRatio?: number;
  /** No side padding or gap on the body: the content sets its own (prototype `.group` margin 0 10). */
  flush?: boolean;
  children: ReactNode;
};

const FADE_MS = 150;
/** prototype `.scrim`: rgba(30,30,30,0.45) */
const SCRIM_ALPHA = 0.45;

/**
 * White sheet, radius 40 (spec section 1). The finger drags it 1:1 from the
 * grab area; on release it lands where momentum projection says, with the
 * finger's velocity handed to a no-overshoot spring. Pulling up past open is
 * rubber-banded. A catch mid-spring starts from the on-screen value, so every
 * transition can be interrupted. Only transform and opacity animate.
 * With reduced motion the slide becomes a cross-fade.
 */
export function BottomSheet({
  open,
  onClose,
  theme,
  eyebrow,
  accessibilityLabel,
  doneLabel = "Done",
  maxHeightRatio = 0.92,
  flush = false,
  children,
}: Props) {
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const offset = useSharedValue(window.height);
  const sheetHeight = useSharedValue(window.height);
  const fade = useSharedValue(0);
  const start = useSharedValue(0);

  const finishClose = useCallback(() => {
    setMounted(false);
    onClose();
  }, [onClose]);

  const animateTo = useCallback(
    (target: number, velocity: number, closing: boolean) => {
      if (reduce) {
        cancelAnimation(offset);
        offset.value = target;
        fade.value = withTiming(
          closing ? 0 : 1,
          { duration: FADE_MS },
          (done) => {
            if (done && closing) runOnJS(finishClose)();
          },
        );
        return;
      }
      fade.value = withTiming(closing ? 0 : 1, { duration: FADE_MS * 2 });
      offset.value = withSpring(
        target,
        { ...amSpring.default, velocity },
        (done) => {
          if (done && closing) runOnJS(finishClose)();
        },
      );
    },
    [fade, finishClose, offset, reduce],
  );

  // Open and close from the parent travel the same path.
  useEffect(() => {
    if (open) {
      setMounted(true);
      animateTo(0, 0, false);
    } else if (mounted) {
      animateTo(sheetHeight.value, 0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(offset);
      start.value = offset.value;
    })
    .onUpdate((event) => {
      offset.value = sheetOffsetForDrag(start.value, event.translationY);
    })
    .onEnd((event) => {
      const release = resolveRelease({
        offset: offset.value,
        velocity: event.velocityY,
        height: sheetHeight.value,
      });
      fade.value = withTiming(release.closes ? 0 : 1, {
        duration: FADE_MS * 2,
      });
      offset.value = withSpring(
        release.target,
        { ...amSpring.default, velocity: event.velocityY },
        (done) => {
          if (done && release.closes) runOnJS(finishClose)();
        },
      );
    });

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduce ? fade.value : 1,
    transform: [{ translateY: reduce ? 0 : offset.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity:
      (reduce ? fade.value : scrimOpacity(offset.value, sheetHeight.value, 1)) *
      SCRIM_ALPHA,
  }));

  if (!mounted) return null;

  const close = () => animateTo(sheetHeight.value, 0, true);

  // A Modal puts the sheet above the floating tab bar and the mini player, like the prototype
  // (`.scrim` and `.sheet` cover the whole app, nav included).
  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.fill}>
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="box-none"
          accessibilityViewIsModal
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${accessibilityLabel}`}
              onPress={close}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            accessibilityRole="none"
            accessibilityLabel={accessibilityLabel}
            onLayout={(event) => {
              sheetHeight.value = event.nativeEvent.layout.height;
            }}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.page,
                maxHeight: window.height * maxHeightRatio,
                paddingBottom: Math.max(insets.bottom, 32),
              },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View>
                <View style={styles.grab}>
                  <View
                    style={[styles.grabber, { backgroundColor: theme.ink300 }]}
                  />
                </View>
                <View style={styles.titleRow}>
                  <Text
                    style={[overStyle, { color: theme.accent, flex: 1 }]}
                    numberOfLines={1}
                  >
                    {eyebrow ?? ""}
                  </Text>
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={doneLabel}
                    onPress={close}
                    pressedScale={0.97}
                    style={styles.done}
                  >
                    <Text
                      style={[styles.doneText, { color: theme.textHeading }]}
                    >
                      {doneLabel}
                    </Text>
                  </PressScale>
                </View>
              </View>
            </GestureDetector>
            <ScrollView
              bounces
              showsVerticalScrollIndicator={false}
              contentContainerStyle={flush ? undefined : styles.body}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { backgroundColor: "#1E1E1E" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: "hidden",
  },
  grab: { height: 44, alignItems: "center", justifyContent: "center" },
  grabber: { width: 44, height: 5, borderRadius: 9999 },
  titleRow: {
    paddingLeft: 20,
    paddingRight: 10,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  done: { height: 44, paddingHorizontal: 16, justifyContent: "center" },
  doneText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
});
