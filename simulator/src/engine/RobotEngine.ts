import type { RobotHardwareConfig, TrackSettings, SimulationState } from '../store/useStore';
import { arduinoEnv } from './ArduinoTranspiler';

export const PIXELS_PER_METER = 700; // 700 px = 1 meter (~1.43 px per mm)

export class RobotEngine {
  private trackCtx: CanvasRenderingContext2D | null = null;
  public trackImageData: ImageData | null = null;
  private lastLapCrossTime: number = 0;
  private crossedStartGate: boolean = false;

  constructor() {}

  setTrackContext(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.trackCtx = ctx;
    this.trackImageData = ctx.getImageData(0, 0, width, height);
  }

  drawTrack(ctx: CanvasRenderingContext2D, trackSettings: TrackSettings) {
    const { width, height, lineWidth, type } = trackSettings;
    const linePx = Math.round(lineWidth * (PIXELS_PER_METER / 1000));

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw checkered Start/Finish line
    this.drawStartFinishGate(ctx, type, width, height, linePx);

    // Draw main black track line
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = Math.max(12, linePx);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (type === 'infinity') {
      ctx.ellipse(width / 2, height / 2, width * 0.35, height * 0.35, 0, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(width * 0.15, height / 2);
      ctx.bezierCurveTo(width * 0.15, height * 0.8, width * 0.85, height * 0.2, width * 0.85, height / 2);
      ctx.stroke();
    } else if (type === 'oval') {
      ctx.ellipse(width / 2, height / 2, width * 0.4, height * 0.3, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (type === 'sharp') {
      ctx.moveTo(width * 0.2, height * 0.2);
      ctx.lineTo(width * 0.8, height * 0.2);
      ctx.lineTo(width * 0.8, height * 0.8);
      ctx.lineTo(width * 0.5, height * 0.8);
      ctx.lineTo(width * 0.5, height * 0.5);
      ctx.lineTo(width * 0.2, height * 0.5);
      ctx.closePath();
      ctx.stroke();
    }

    this.setTrackContext(ctx, width, height);
  }

  private drawStartFinishGate(
    ctx: CanvasRenderingContext2D,
    type: 'infinity' | 'oval' | 'sharp',
    width: number,
    height: number,
    linePx: number
  ) {
    let gateX = width / 2;
    let gateY = height / 2 - height * 0.35;

    if (type === 'oval') {
      gateY = height / 2 - height * 0.3;
    } else if (type === 'sharp') {
      gateX = width * 0.35;
      gateY = height * 0.2;
    }

    // Draw red/white finish checker banner
    ctx.save();
    ctx.translate(gateX, gateY);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-3, -linePx - 8, 6, (linePx + 8) * 2);
    ctx.fillStyle = '#ffffff';
    for (let y = -linePx - 6; y < linePx + 6; y += 6) {
      ctx.fillRect(-2, y, 4, 3);
    }
    ctx.restore();
  }

  readSensors(state: SimulationState, hardware: RobotHardwareConfig): number[] {
    if (!this.trackImageData) return Array(hardware.sensorCount).fill(0);

    const sensors: number[] = [];
    const count = hardware.sensorCount;
    const spacingPx = hardware.sensorSpacing * (PIXELS_PER_METER / 1000);
    const distPx = hardware.sensorDistance * (PIXELS_PER_METER / 1000);

    const totalWidthPx = (count - 1) * spacingPx;
    const startOffsetPx = -totalWidthPx / 2;

    const width = this.trackImageData.width;
    const height = this.trackImageData.height;
    const data = this.trackImageData.data;

    // Height attenuation factor (ideal height is 3-5mm)
    const heightFactor = Math.max(0.3, Math.min(1.0, 1.0 - Math.abs(hardware.sensorHeight - 4) * 0.12));

    for (let i = 0; i < count; i++) {
      const latOffset = startOffsetPx + i * spacingPx;
      
      const sX = Math.round(state.robotX + Math.cos(state.robotAngle) * distPx - Math.sin(state.robotAngle) * latOffset);
      const sY = Math.round(state.robotY + Math.sin(state.robotAngle) * distPx + Math.cos(state.robotAngle) * latOffset);

      if (sX >= 0 && sX < width && sY >= 0 && sY < height) {
        const index = (sY * width + sX) * 4;
        const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
        const raw = 1 - (brightness / 255);
        sensors.push(Math.max(0, Math.min(1, raw * heightFactor)));
      } else {
        sensors.push(0);
      }
    }
    return sensors;
  }

  update(
    state: SimulationState,
    hardware: RobotHardwareConfig,
    userCode: string,
    dt: number
  ): SimulationState {
    // 1. Compile/prepare Arduino C++ environment
    arduinoEnv.compile(userCode, hardware.sensorCount);

    // 2. Read sensor array
    const sensors = this.readSensors(state, hardware);

    // 3. Execute Arduino loop()
    const { leftSpeed, rightSpeed } = arduinoEnv.executeTick(sensors, state.time, dt);

    // 4. Physical powertrain model:
    // Voltage scaling and motor efficiency
    const voltageRatio = Math.max(0.5, Math.min(2.0, hardware.batteryVoltage / hardware.nominalVoltage));
    const effectiveRPM = hardware.motorRPM * voltageRatio * hardware.driverEfficiency;
    
    // Top linear speed (m/s)
    const maxWheelSpeedMps = (2 * Math.PI * (hardware.wheelRadius / 1000) * effectiveRPM) / 60;
    
    // Target speeds in m/s
    const targetVL = leftSpeed * maxWheelSpeedMps;
    const targetVR = rightSpeed * maxWheelSpeedMps;

    // Weight and grip influence acceleration (motor torque limit & traction)
    const massKg = Math.max(0.05, hardware.weight / 1000);
    const tractionCoeff = hardware.tireGrip * (1 + (hardware.wheelWidth - 10) * 0.02);
    const maxAccel = Math.min(25, (9.81 * tractionCoeff) / (massKg * 2.5)); // m/s^2

    // Inertial smoothing for wheel speed transitions
    const accelStep = maxAccel * dt;
    const currentVL = state.linearVelocity - (state.angularVelocity * (hardware.wheelbase / 2000));
    const currentVR = state.linearVelocity + (state.angularVelocity * (hardware.wheelbase / 2000));

    const vL = currentVL + Math.max(-accelStep, Math.min(accelStep, targetVL - currentVL));
    const vR = currentVR + Math.max(-accelStep, Math.min(accelStep, targetVR - currentVR));

    // Linear velocity & angular velocity
    let linearVel = (vL + vR) / 2;
    const wheelbaseM = hardware.wheelbase / 1000;
    let angularVel = (vL - vR) / wheelbaseM;

    // 5. Lateral tire slip (занос при резких поворотах):
    // Centrifugal acceleration ac = v^2 / R = v * omega
    const centrifugalAccel = Math.abs(linearVel * angularVel);
    const lateralGripLimit = 9.81 * tractionCoeff;
    let slipDriftAngle = 0;

    if (centrifugalAccel > lateralGripLimit) {
      // Robot slips outward!
      const slipRatio = Math.min(0.5, (centrifugalAccel - lateralGripLimit) / lateralGripLimit);
      linearVel *= (1 - slipRatio * 0.4); // speed scrubbed due to sliding
      angularVel *= (1 - slipRatio * 0.6); // understeer
      slipDriftAngle = Math.sign(angularVel) * -slipRatio * 0.2;
    }

    // 6. Integrate position
    const moveAngle = state.robotAngle + slipDriftAngle;
    const newAngle = state.robotAngle + angularVel * dt;
    const linearDistM = linearVel * dt;
    const linearDistPx = linearDistM * PIXELS_PER_METER;

    const newX = state.robotX + linearDistPx * Math.cos(moveAngle);
    const newY = state.robotY + linearDistPx * Math.sin(moveAngle);

    // 7. Track analytics & Lap timer
    const hasLine = sensors.some(s => s > 0.35);
    const offTrackCount = state.offTrackCount + (hasLine ? 0 : (state.time > 1 && Math.random() < 0.05 ? 1 : 0));
    const onLinePercentage = Math.round(state.onLinePercentage * 0.99 + (hasLine ? 1 : 0) * 100 * 0.01);

    // Lap gate check
    let lapCount = state.lapCount;
    let currentLapTime = state.currentLapTime + dt;
    let bestLapTime = state.bestLapTime;
    let lastLapTime = state.lastLapTime;

    // Detect passing through start area
    const startX = 400;
    const startY = 180;
    const distToStart = Math.hypot(newX - startX, newY - startY);

    if (distToStart < 35 && currentLapTime > 4.0) {
      if (!this.crossedStartGate) {
        this.crossedStartGate = true;
        lapCount++;
        lastLapTime = currentLapTime;
        if (!bestLapTime || currentLapTime < bestLapTime) {
          bestLapTime = currentLapTime;
        }
        currentLapTime = 0;
      }
    } else if (distToStart > 60) {
      this.crossedStartGate = false;
    }

    // Trajectory history (sampled every 3 frames)
    let trail = state.trail;
    if (Math.random() < 0.35) {
      trail = [...trail.slice(-120), { x: newX, y: newY }];
    }

    return {
      ...state,
      robotX: newX,
      robotY: newY,
      robotAngle: newAngle,
      linearVelocity: linearVel,
      angularVelocity: angularVel,
      leftMotorSpeed: leftSpeed,
      rightMotorSpeed: rightSpeed,
      time: state.time + dt,
      lapCount,
      currentLapTime,
      bestLapTime,
      lastLapTime,
      offTrackCount,
      onLinePercentage,
      totalDistanceMeters: state.totalDistanceMeters + Math.abs(linearDistM),
      trail,
    };
  }
}

export const engine = new RobotEngine();
