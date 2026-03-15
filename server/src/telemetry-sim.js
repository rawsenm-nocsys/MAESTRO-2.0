// Simulates realistic MAVLink telemetry for development
// Generates a figure-8 flight pattern with realistic dynamics

const DEG2RAD = Math.PI / 180;

class TelemetrySim {
  constructor() {
    this.t = 0;
    this.armed = true;
    this.flightMode = 5; // LOITER
    this.baseAlt = 50; // meters
    this.baseLat = 37.4419;   // Stanford area
    this.baseLon = -122.1430;

    // Smoothed values for realistic dynamics
    this._roll = 0;
    this._pitch = 0;
  }

  tick(dt = 0.1) {
    this.t += dt;
    const t = this.t;

    // Figure-8 pattern
    const pathScale = 0.002; // ~200m radius
    const speed = 0.15;      // angular speed
    const rawLat = this.baseLat + pathScale * Math.sin(speed * t);
    const rawLon = this.baseLon + pathScale * Math.sin(speed * t * 2);

    // Altitude: gentle sinusoidal variation
    const alt = this.baseAlt + 15 * Math.sin(t * 0.08) + 5 * Math.sin(t * 0.23);

    // Heading from path tangent
    const dx = pathScale * speed * 2 * Math.cos(speed * t * 2);
    const dy = pathScale * speed * Math.cos(speed * t);
    const heading = Math.atan2(dx, dy);

    // Roll follows turn rate (bank angle)
    const turnRate = pathScale * speed * speed * 2 * -Math.sin(speed * t * 2);
    const targetRoll = Math.max(-35, Math.min(35, turnRate * 8000)) * DEG2RAD;
    this._roll += (targetRoll - this._roll) * 0.15;

    // Pitch: slight nose-down in turns, nose-up when climbing
    const climbRate = 15 * 0.08 * Math.cos(t * 0.08) + 5 * 0.23 * Math.cos(t * 0.23);
    const targetPitch = (climbRate * 0.8 + Math.abs(this._roll) * -0.15) * DEG2RAD;
    this._pitch += (targetPitch - this._pitch) * 0.1;

    // Groundspeed: 8-15 m/s
    const gs = 12 + 3 * Math.sin(t * 0.3) + Math.random() * 0.5;

    // Velocity components
    const vx = gs * Math.cos(heading);
    const vy = gs * Math.sin(heading);
    const vz = climbRate * 0.1;

    // Acceleration (with noise)
    const ax = Math.sin(t * 1.5) * 0.3 + (Math.random() - 0.5) * 0.2;
    const ay = Math.cos(t * 1.2) * 0.2 + (Math.random() - 0.5) * 0.15;
    const az = -9.81 + Math.sin(t * 0.8) * 0.1 + (Math.random() - 0.5) * 0.1;

    // Battery: slowly draining
    const batteryV = 16.2 - t * 0.001 + Math.sin(t * 0.5) * 0.05;
    const batteryA = 12 + gs * 0.3 + Math.random() * 0.5;
    const batteryPct = Math.max(0, Math.min(100, 85 - t * 0.005));

    // GPS
    const satellites = 12 + Math.floor(Math.sin(t * 0.02) * 3);
    const rssi = 75 + Math.floor(Math.sin(t * 0.1) * 15 + Math.random() * 5);

    return {
      type: 0x01, // Telemetry Snapshot
      ts: Date.now(),
      r: this._roll,
      p: this._pitch,
      w: heading,
      la: Math.round(rawLat * 1e7),
      lo: Math.round(rawLon * 1e7),
      am: Math.round(alt * 1000),
      ar: Math.round((alt - this.baseAlt + 50) * 1000),
      gs: Math.round(gs * 100),
      as: Math.round((gs + 1.5) * 100),
      cr: Math.round(climbRate * 10),
      vx: Math.round(vx * 100),
      vy: Math.round(vy * 100),
      vz: Math.round(vz * 100),
      ax: Math.round(ax * 1000),
      ay: Math.round(ay * 1000),
      az: Math.round(az * 1000),
      bv: Math.round(batteryV * 1000),
      bc: Math.round(batteryA * 100),
      br: Math.round(batteryPct),
      sat: satellites,
      rs: Math.min(100, Math.max(0, rssi)),
      arm: this.armed ? 1 : 0,
      fm: this.flightMode,
    };
  }
}

export default TelemetrySim;
