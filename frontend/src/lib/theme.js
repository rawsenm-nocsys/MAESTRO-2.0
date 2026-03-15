// MAESTRO color palette — matches 1.2 exactly
export const COLORS = {
  // Backgrounds
  bg_black: '#000000',
  bg_dark: '#0D0D0D',
  panel_bg: '#141414',
  panel_border: '#2A2A2A',
  surface: '#1A1A1A',
  surface_light: '#222222',
  border: '#3A3A3A',

  // Text
  text_white: '#FFFFFF',
  text_gray: '#AAAAAA',
  text_dim: '#666666',

  // Accents
  accent_blue: '#003D7A',
  accent_blue_light: '#00508F',
  accent_navy: '#00264D',

  // Status
  green: '#34C759',
  yellow: '#FFCC00',
  red_warn: '#FF3B30',
  cyan: '#00BFFF',

  // Chart line colors
  chart_cyan: '#00BFFF',
  chart_green: '#00FF00',
  chart_orange: '#FF9933',
  chart_purple: '#BB66FF',
  chart_red: '#FF6666',
  chart_green2: '#66FF66',
  chart_blue: '#6666FF',
  chart_yellow: '#FFCC00',
  chart_pink: '#FF66CC',
  chart_teal: '#33FF99',
  chart_violet: '#9933FF',

  // Map
  map_bg: '#101820',
  map_grid: '#202A34',
  waypoint_blue: '#0099FF',

  // Attitude indicator
  sky: 'rgba(26,58,92,0.9)',
  ground: 'rgba(74,46,26,0.9)',
};

// Flight mode lookup (ArduCopter)
export const FLIGHT_MODES = {
  0: 'STABILIZE', 1: 'ACRO', 2: 'ALT_HOLD', 3: 'AUTO',
  4: 'GUIDED', 5: 'LOITER', 6: 'RTL', 7: 'CIRCLE',
  9: 'LAND', 11: 'DRIFT', 13: 'SPORT', 14: 'FLIP',
  15: 'AUTOTUNE', 16: 'POSHOLD', 17: 'BRAKE', 18: 'THROW',
  19: 'AVOID_ADSB', 20: 'GUIDED_NOGPS', 21: 'SMART_RTL',
};
