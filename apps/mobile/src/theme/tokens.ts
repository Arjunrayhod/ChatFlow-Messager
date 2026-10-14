/**
 * @file ChatFlow Single Source of Truth for Design Tokens.
 * Strict compliance with RULE 0.7: No hardcoded hex or magic numbers outside this file.
 */

import { Platform } from 'react-native';

/**
 * Color tokens for both Light and Dark themes.
 */
export const colors = {
  light: {
    primary: '#008069',
    primaryVariant: '#006854',
    secondary: '#25D366',
    background: '#FFFFFF',
    surface: '#F0F2F5',
    surfaceEmphasized: '#E9EDEF',
    bubbleSent: '#E7FFDB',
    bubbleReceived: '#FFFFFF',
    textPrimary: '#111B21',
    textSecondary: '#667781',
    textDisabled: '#8696A0',
    textInverse: '#FFFFFF',
    success: '#1FA855',
    warning: '#F15C6D',
    error: '#EA0038',
    info: '#027EB5',
    divider: '#E9EDEF',
    overlay: 'rgba(11, 20, 26, 0.45)',
  },
  dark: {
    primary: '#00A884',
    primaryVariant: '#008f70',
    secondary: '#25D366',
    background: '#121B22',
    surface: '#1F2C34',
    surfaceEmphasized: '#2A3942',
    bubbleSent: '#005C4B',
    bubbleReceived: '#1F2C34',
    textPrimary: '#E9EDEF',
    textSecondary: '#8696A0',
    textDisabled: '#667781',
    textInverse: '#111B21',
    success: '#25D366',
    warning: '#F7808E',
    error: '#EF5350',
    info: '#53BDEB',
    divider: '#222E35',
    overlay: 'rgba(0, 0, 0, 0.70)',
  },
} as const;

export type ThemeColors = typeof colors.light;

/** System font family based on running OS. */
const systemFontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

/**
 * Typography scale tokens.
 */
export const typography = {
  display: {
    fontFamily: systemFontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  h1: {
    fontFamily: systemFontFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  h2: {
    fontFamily: systemFontFamily,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.1,
  },
  h3: {
    fontFamily: systemFontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  h4: {
    fontFamily: systemFontFamily,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  h5: {
    fontFamily: systemFontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  h6: {
    fontFamily: systemFontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  body: {
    fontFamily: systemFontFamily,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontFamily: systemFontFamily,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500' as const,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: systemFontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    letterSpacing: 0.2,
  },
  button: {
    fontFamily: systemFontFamily,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  overline: {
    fontFamily: systemFontFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;

/**
 * 4px-based Spacing scale tokens.
 */
export const spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48, // Minimum touch target constraint per Mobile UX standards
} as const;

/**
 * Border corner radius scale tokens.
 */
export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

/**
 * Elevation and cross-platform shadow definitions.
 */
export const elevation = {
  0: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  1: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  2: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  3: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },
  4: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 12,
  },
} as const;

/**
 * Icon size tokens.
 */
export const iconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
} as const;

/**
 * Motion and animation timing tokens.
 */
export const motion = {
  fast: 150,
  normal: 250,
  slow: 400,
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  },
} as const;

/** Unified design tokens export. */
export const tokens = {
  colors,
  typography,
  spacing,
  radii,
  elevation,
  iconSizes,
  motion,
} as const;

export default tokens;
