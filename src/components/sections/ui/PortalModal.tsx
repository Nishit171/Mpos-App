import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { usePortal } from './portal';

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  backdropOpacity?: number;
  contentStyle?: StyleProp<ViewStyle>;
  overlayAlign?: 'center' | 'bottom' | 'right';
  overlayPadding?: number;
  animationType?: 'none' | 'fade' | 'slide';
  /**
   * If true, PortalModal will NOT render its own backdrop/overlay chrome.
   * It will just mount `children` into the portal host. Use this to preserve
   * existing modal UI trees (with their own backdrop and layout) while still
   * eliminating native `Modal`.
   */
  passthrough?: boolean;
  /**
   * Animation duration in ms. Default approximates RN Modal.
   */
  animationDurationMs?: number;
};

export default function PortalModal({
  visible,
  onRequestClose,
  children,
  backdropOpacity = 0.5,
  contentStyle,
  overlayAlign = 'center',
  overlayPadding = 16,
  animationType = 'none',
  passthrough = false,
  animationDurationMs = 220,
}: Props) {
  const { mount, update, unmount } = usePortal();

  const key = useMemo(() => `portal-modal-${Math.random().toString(36).slice(2)}`, []);
  const { height, width } = useWindowDimensions();
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  const runAnim = (to: 0 | 1, done?: () => void) => {
    if (animationType === 'none') {
      anim.setValue(to);
      done?.();
      return;
    }
    Animated.timing(anim, {
      toValue: to,
      duration: animationDurationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => done?.());
  };

  const slideFrom = overlayAlign === 'bottom' ? height : overlayAlign === 'right' ? width : 24;
  const slideTransform =
    overlayAlign === 'right'
      ? { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [slideFrom, 0] }) }
      : { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [slideFrom, 0] }) };

  const animatedStyle =
    animationType === 'fade'
      ? { opacity: anim }
      : animationType === 'slide'
        ? { transform: [slideTransform] as any }
        : {};

  const chromeNode = (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: `rgba(0,0,0,${backdropOpacity})` }]}
        onPress={onRequestClose}
      />
      <View
        pointerEvents="box-none"
        style={[
          styles.overlay,
          { padding: overlayPadding },
          overlayAlign === 'bottom' && styles.alignBottom,
          overlayAlign === 'right' && styles.alignRight,
        ]}
      >
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );

  const node = (
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, animatedStyle]}>
      {passthrough ? children : chromeNode}
    </Animated.View>
  );

  useEffect(() => {
    if (!visible) {
      runAnim(0, () => unmount(key));
      return;
    }
    // ensure mounted, then animate in
    mount(key, node);
    runAnim(1);
    return () => unmount(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, key]);

  useEffect(() => {
    if (!visible) return;
    update(key, node);
  }, [visible, key, node, update]);

  return null;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignBottom: {
    justifyContent: 'flex-end',
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  content: {
    width: '100%',
  },
});

