import { create } from 'zustand';

export interface RobotHardwareConfig {
  // Chassis & Wheels
  wheelbase: number;      // мм: расстояние между колесами (колесная база)
  wheelRadius: number;    // мм: радиус колеса
  wheelWidth: number;     // мм: ширина профиля колеса (влияет на сцепление)
  tireGrip: number;       // Коэффициент сцепления шин (0.6 - резина, 1.2 - силикон, 1.8 - липкий полиуретан)
  weight: number;         // граммы: общая масса робота
  
  // Motors & Power
  motorRPM: number;       // об/мин при номинальном напряжении (напр. 1500 RPM)
  nominalVoltage: number; // В: номинал моторов (напр. 6V)
  batteryVoltage: number; // В: фактическое напряжение батареи (напр. 7.4V 2S LiPo)
  driverEfficiency: number; // % КПД драйвера моторов (0.7 - 0.98)
  
  // Sensors Array
  sensorCount: number;    // кол-во ИК датчиков (3, 5, 8, 12)
  sensorSpacing: number;  // мм: расстояние между соседними датчиками
  sensorDistance: number; // мм: вынос планки датчиков вперед от оси колес
  sensorHeight: number;   // мм: высота подвеса датчиков над трассой (оптимум 3-5 мм)
}

export type TrackSettings = {
  lineWidth: number;      // мм (на трассе обычно 19 мм или 25 мм)
  width: number;          // px холста
  height: number;         // px холста
  type: 'infinity' | 'oval' | 'sharp';
};

export type SimulationState = {
  isRunning: boolean;
  robotX: number;
  robotY: number;
  robotAngle: number;
  linearVelocity: number;  // м/с
  angularVelocity: number; // рад/с
  leftMotorSpeed: number;  // -1 to 1
  rightMotorSpeed: number; // -1 to 1
  time: number;
  
  // Lap timing & Analytics
  lapCount: number;
  currentLapTime: number;
  bestLapTime: number | null;
  lastLapTime: number | null;
  offTrackCount: number;
  onLinePercentage: number;
  totalDistanceMeters: number;
  trail: Array<{ x: number; y: number }>;
};

export interface HardwarePreset {
  name: string;
  description: string;
  config: RobotHardwareConfig;
}

export const HARDWARE_PRESETS: HardwarePreset[] = [
  {
    name: '⚡ Ufa-Dynamics Pro (1500 RPM)',
    description: 'Боевая компоновка: ESP32-S3, TB6612FNG, N20 1500RPM, 2S LiPo (7.4V), QTR-8RC, колеса 32мм',
    config: {
      wheelbase: 75,
      wheelRadius: 16,
      wheelWidth: 12,
      tireGrip: 1.3,
      weight: 120,
      motorRPM: 1500,
      nominalVoltage: 6.0,
      batteryVoltage: 7.4,
      driverEfficiency: 0.88,
      sensorCount: 8,
      sensorSpacing: 9.5,
      sensorDistance: 65,
      sensorHeight: 4,
    }
  },
  {
    name: '🏆 Скоростной Монстр (3000 RPM Coreless)',
    description: 'Ультралегкий карбоновый болид на бесколлекторных/coreless моторах 3000 RPM, 3S LiPo, 12 датчиков',
    config: {
      wheelbase: 85,
      wheelRadius: 18,
      wheelWidth: 16,
      tireGrip: 1.6,
      weight: 95,
      motorRPM: 3000,
      nominalVoltage: 7.4,
      batteryVoltage: 11.1,
      driverEfficiency: 0.94,
      sensorCount: 12,
      sensorSpacing: 7.0,
      sensorDistance: 80,
      sensorHeight: 3,
    }
  },
  {
    name: '🔰 Надежный Учебный (600 RPM N20)',
    description: 'Стабильная и плавная компоновка для начинающих: 1S LiPo (3.7V), 600 RPM, 5 сенсоров',
    config: {
      wheelbase: 65,
      wheelRadius: 16,
      wheelWidth: 8,
      tireGrip: 0.9,
      weight: 150,
      motorRPM: 600,
      nominalVoltage: 6.0,
      batteryVoltage: 3.7,
      driverEfficiency: 0.82,
      sensorCount: 5,
      sensorSpacing: 12,
      sensorDistance: 50,
      sensorHeight: 5,
    }
  },
  {
    name: '🧱 Lego / Колесный Тандем (300 RPM)',
    description: 'Тяжелое шасси с большими колесами 56мм и высоким крутящим моментом',
    config: {
      wheelbase: 110,
      wheelRadius: 28,
      wheelWidth: 20,
      tireGrip: 1.1,
      weight: 280,
      motorRPM: 350,
      nominalVoltage: 7.4,
      batteryVoltage: 7.4,
      driverEfficiency: 0.85,
      sensorCount: 5,
      sensorSpacing: 16,
      sensorDistance: 70,
      sensorHeight: 6,
    }
  }
];

export const getTrackStartPosition = (type: 'infinity' | 'oval' | 'sharp', width = 800, height = 600) => {
  switch (type) {
    case 'oval':
      return { x: width / 2, y: height / 2 - height * 0.3, angle: 0 };
    case 'sharp':
      return { x: width * 0.35, y: height * 0.2, angle: 0 };
    case 'infinity':
    default:
      return { x: width / 2, y: height / 2 - height * 0.35, angle: 0 };
  }
};

export const DEFAULT_ARDUINO_CODE = `/* ============================================================
 *  Робот по линии — Arduino / C++ PID контроллер
 *  Совместим с симулятором компоновки и платой ESP32-S3 / Arduino
 * ============================================================
 */

// Коэффициенты PID-регулятора
float Kp = 0.08;
float Ki = 0.0001;
float Kd = 1.35;

int baseSpeed = 210;     // Базовая скорость (0 - 255)
int maxSpeed  = 255;

float lastError = 0;
float integral  = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("Robot Ready!");
}

void loop() {
  // Считываем положение линии (0 - крайний левый, (N-1)*1000 - крайний правый)
  // Центр линии = (SENSOR_COUNT - 1) * 500
  uint16_t position = readLineBlack(sensorValues);
  
  float centerPos = (SENSOR_COUNT - 1) * 500.0;
  float error = (float)position - centerPos;
  
  // Интеграл с ограничением (Anti-windup)
  integral += error;
  integral = constrain(integral, -8000, 8000);
  
  // Дифференциал
  float derivative = error - lastError;
  
  // Управляющее воздействие
  float correction = Kp * error + Ki * integral + Kd * derivative;
  lastError = error;
  
  // Расчет скоростей моторов
  int leftSpeed  = constrain((int)(baseSpeed + correction), 0, maxSpeed);
  int rightSpeed = constrain((int)(baseSpeed - correction), 0, maxSpeed);
  
  // Подача на моторы (-255 .. +255)
  setMotors(leftSpeed, rightSpeed);
}
`;

export const CODE_TEMPLATES = [
  {
    name: '🏎️ Спортивный PID (ESP32-S3 / Ufa-Dynamics)',
    code: DEFAULT_ARDUINO_CODE
  },
  {
    name: '⚡ Пропорциональный P-регулятор (Быстрый старт)',
    code: `/* Простой и быстрый P-регулятор для подбора базовой скорости */
float Kp = 0.06;
int baseSpeed = 180;

void loop() {
  uint16_t position = readLineBlack(sensorValues);
  float center = (SENSOR_COUNT - 1) * 500.0;
  float error = (float)position - center;
  
  float correction = Kp * error;
  
  int left  = constrain((int)(baseSpeed + correction), 0, 255);
  int right = constrain((int)(baseSpeed - correction), 0, 255);
  
  setMotors(left, right);
}
`
  },
  {
    name: '🛟 PID + Защита от схода с линии (Recovery)',
    code: `/* PID-регулятор с интеллектуальным возвратом при потере линии */
float Kp = 0.09;
float Ki = 0.0001;
float Kd = 1.4;
int baseSpeed = 200;

float lastError = 0;
float integral = 0;

void loop() {
  uint16_t position = readLineBlack(sensorValues);
  float center = (SENSOR_COUNT - 1) * 500.0;
  
  // Проверяем, видит ли хоть один датчик черную линию
  bool onLine = false;
  for (int i = 0; i < SENSOR_COUNT; i++) {
    if (sensorValues[i] > 300) onLine = true;
  }
  
  if (!onLine) {
    // Линия потеряна: доворачиваем на месте в сторону последней ошибки
    if (lastError > 0) {
      setMotors(-120, 120); // крутим вправо
    } else {
      setMotors(120, -120); // крутим влево
    }
    return;
  }
  
  float error = (float)position - center;
  integral = constrain(integral + error, -8000, 8000);
  float derivative = error - lastError;
  
  float correction = Kp * error + Ki * integral + Kd * derivative;
  lastError = error;
  
  setMotors(
    constrain((int)(baseSpeed + correction), 0, 255),
    constrain((int)(baseSpeed - correction), 0, 255)
  );
}
`
  }
];

interface AppState {
  // Robot Hardware
  hardware: RobotHardwareConfig;
  updateHardware: (newConfig: Partial<RobotHardwareConfig>) => void;
  applyPreset: (preset: HardwarePreset) => void;

  // Track Settings
  trackSettings: TrackSettings;
  updateTrackSettings: (newSettings: Partial<TrackSettings>) => void;

  // Arduino Code
  code: string;
  setCode: (code: string) => void;
  
  // Simulation State
  simState: SimulationState;
  updateSimState: (newState: Partial<SimulationState>) => void;
  resetSim: (startX?: number, startY?: number, angle?: number) => void;
  toggleSim: () => void;

  // Real-world calculated kinematics
  getTheoreticalTopSpeed: () => { mps: number; kmh: number };
}

const initialPreset = HARDWARE_PRESETS[0];

const initialTrack: TrackSettings = {
  lineWidth: 22,
  width: 800,
  height: 600,
  type: 'infinity',
};

const initialPos = getTrackStartPosition(initialTrack.type, initialTrack.width, initialTrack.height);

export const useStore = create<AppState>((set, get) => ({
  hardware: initialPreset.config,
  updateHardware: (newConfig) =>
    set((state) => ({ hardware: { ...state.hardware, ...newConfig } })),

  applyPreset: (preset) =>
    set({ hardware: { ...preset.config } }),

  trackSettings: initialTrack,
  updateTrackSettings: (newSettings) => {
    set((state) => {
      const updated = { ...state.trackSettings, ...newSettings };
      if (newSettings.type && newSettings.type !== state.trackSettings.type) {
        const newPos = getTrackStartPosition(newSettings.type, updated.width, updated.height);
        return {
          trackSettings: updated,
          simState: {
            ...state.simState,
            isRunning: false,
            robotX: newPos.x,
            robotY: newPos.y,
            robotAngle: newPos.angle,
            linearVelocity: 0,
            angularVelocity: 0,
            leftMotorSpeed: 0,
            rightMotorSpeed: 0,
            time: 0,
            currentLapTime: 0,
            trail: [],
          },
        };
      }
      return { trackSettings: updated };
    });
  },

  code: DEFAULT_ARDUINO_CODE,
  setCode: (code) => set({ code }),

  simState: {
    isRunning: false,
    robotX: initialPos.x,
    robotY: initialPos.y,
    robotAngle: initialPos.angle,
    linearVelocity: 0,
    angularVelocity: 0,
    leftMotorSpeed: 0,
    rightMotorSpeed: 0,
    time: 0,
    lapCount: 0,
    currentLapTime: 0,
    bestLapTime: null,
    lastLapTime: null,
    offTrackCount: 0,
    onLinePercentage: 100,
    totalDistanceMeters: 0,
    trail: [],
  },

  updateSimState: (newState) =>
    set((state) => ({ simState: { ...state.simState, ...newState } })),

  resetSim: (startX, startY, angle) => {
    const { trackSettings } = get();
    const defaultPos = getTrackStartPosition(trackSettings.type, trackSettings.width, trackSettings.height);
    set((state) => ({
      simState: {
        ...state.simState,
        isRunning: false,
        robotX: startX ?? defaultPos.x,
        robotY: startY ?? defaultPos.y,
        robotAngle: angle ?? defaultPos.angle,
        linearVelocity: 0,
        angularVelocity: 0,
        leftMotorSpeed: 0,
        rightMotorSpeed: 0,
        time: 0,
        currentLapTime: 0,
        trail: [],
      }
    }));
  },

  toggleSim: () => set((state) => ({
    simState: { ...state.simState, isRunning: !state.simState.isRunning }
  })),

  getTheoreticalTopSpeed: () => {
    const { hardware } = get();
    // Effective RPM scaled by actual battery voltage vs nominal
    const voltageRatio = Math.max(0.5, Math.min(2.0, hardware.batteryVoltage / hardware.nominalVoltage));
    const effectiveRPM = hardware.motorRPM * voltageRatio * hardware.driverEfficiency;
    // Radius in meters
    const radiusMeters = hardware.wheelRadius / 1000;
    // v = 2 * pi * r * (RPM / 60)
    const mps = (2 * Math.PI * radiusMeters * effectiveRPM) / 60;
    const kmh = mps * 3.6;
    return { mps, kmh };
  }
}));
