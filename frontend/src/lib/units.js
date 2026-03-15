// Unit conversions from MAVLink wire format to display units

export function mmToM(mm) { return mm / 1000; }
export function cmsToMs(cms) { return cms / 100; }
export function mvToV(mv) { return mv / 1000; }
export function caToA(ca) { return ca / 100; }
export function degE7ToDeg(d) { return d / 1e7; }
export function radToDeg(r) { return r * 180 / Math.PI; }
export function mgToMs2(mg) { return mg * 9.81 / 1000; }

// Format number to fixed decimal places
export function fmt(val, decimals = 1) {
  if (val == null || isNaN(val)) return '--';
  return val.toFixed(decimals);
}
