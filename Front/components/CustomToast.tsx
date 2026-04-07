import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BaseToastProps } from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOAST_WIDTH = Math.min(SCREEN_WIDTH - 32, 420);

const THEME = {
  success: { icon: 'checkmark-circle' as const, accent: '#2ECC71', bg: 'rgba(46, 204, 113, 0.12)', border: 'rgba(46, 204, 113, 0.35)' },
  error:   { icon: 'alert-circle' as const,     accent: '#E74C3C', bg: 'rgba(231, 76, 60, 0.12)',  border: 'rgba(231, 76, 60, 0.35)' },
  info:    { icon: 'information-circle' as const, accent: '#3498DB', bg: 'rgba(52, 152, 219, 0.12)', border: 'rgba(52, 152, 219, 0.35)' },
};

function StapleToast({ text1, text2, onPress, type }: BaseToastProps & { type: keyof typeof THEME }) {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const theme = THEME[type] || THEME.info;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 4,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.bg,
          borderColor: theme.border,
          transform: [{ translateX: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {/* Accent bar */}
      <View style={[styles.accentBar, { backgroundColor: theme.accent }]} />

      <TouchableOpacity
        style={styles.inner}
        activeOpacity={onPress ? 0.7 : 1}
        onPress={onPress}
      >
        <View style={[styles.iconCircle, { backgroundColor: theme.accent + '22' }]}>
          <Ionicons name={theme.icon} size={22} color={theme.accent} />
        </View>

        <View style={styles.textContainer}>
          {text1 ? <Text style={styles.text1} numberOfLines={2}>{text1}</Text> : null}
          {text2 ? <Text style={styles.text2} numberOfLines={3}>{text2}</Text> : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function SuccessToast(props: BaseToastProps) {
  return <StapleToast {...props} type="success" />;
}

export function ErrorToast(props: BaseToastProps) {
  return <StapleToast {...props} type="error" />;
}

export function InfoToast(props: BaseToastProps) {
  return <StapleToast {...props} type="info" />;
}

export const toastConfig = {
  success: (props: BaseToastProps) => <SuccessToast {...props} />,
  error:   (props: BaseToastProps) => <ErrorToast {...props} />,
  info:    (props: BaseToastProps) => <InfoToast {...props} />,
};

const styles = StyleSheet.create({
  container: {
    width: TOAST_WIDTH,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    backgroundColor: '#1A1F2B',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  text1: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  text2: {
    color: '#A0A6B1',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
});
