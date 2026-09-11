/**
 * Arduino C++ Simulator & Transpiler
 * Transpiles Arduino/C++ code into executable JavaScript that runs in a persistent sandbox.
 * Supports Arduino types, math functions, persistent global variables, and QTR / Motor APIs.
 */

export interface ArduinoExecutionResult {
  leftSpeed: number; // -1 to 1
  rightSpeed: number; // -1 to 1
  logs: string[];
}

export class ArduinoEnvironment {
  private instance: any = null;
  private currentCode: string = '';
  private compileError: string | null = null;
  private runtimeError: string | null = null;
  private logs: string[] = [];

  constructor() {}

  public getCompileError(): string | null {
    return this.compileError;
  }

  public getRuntimeError(): string | null {
    return this.runtimeError;
  }

  public getLogs(): string[] {
    return this.logs;
  }

  /**
   * Transpiles Arduino C++ code to JavaScript.
   */
  private transpile(cppCode: string): string {
    let js = cppCode;

    // 1. Remove single-line comments for directives, but preserve normal comments
    js = js.replace(/#include\s+<[^>]+>/g, '// [included header]');
    js = js.replace(/#include\s+"[^"]+"/g, '// [included header]');
    js = js.replace(/#pragma\s+.*/g, '');

    // 2. Transpile #define NAME VALUE to const NAME = VALUE;
    js = js.replace(/#define\s+([A-Za-z0-9_]+)\s+([^\r\n]+)/g, 'const $1 = $2;');

    // 3. Remove C++ qualifiers (const, unsigned, static, volatile)
    js = js.replace(/\b(static|volatile)\b\s+/g, '');

    // 4. Replace Arduino/C++ types with 'let' in variable declarations
    // Examples: float Kp = 0.07; -> let Kp = 0.07;
    // int left = 0; -> let left = 0;
    // uint16_t sensorValues[8]; -> let sensorValues = new Array(8).fill(0);
    js = js.replace(/\b(?:unsigned\s+)?(?:int|long|short|char|float|double|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t|bool|boolean|byte|word)\s+([A-Za-z0-9_]+)\s*\[\s*([0-9A-Za-z_]+)\s*\]\s*;/g, 'let $1 = new Array($2).fill(0);');
    
    // Normal declarations: type varName = expr; -> let varName = expr;
    js = js.replace(/\b(?:const\s+)?(?:unsigned\s+)?(?:int|long|short|char|float|double|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t|bool|boolean|byte|word|String)\s+([A-Za-z0-9_]+)\s*([=,;])/g, 'let $1 $2');

    // 5. Function declarations: void loop() -> function loop()
    js = js.replace(/\b(?:void|int|float|double|bool|uint16_t)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{/g, 'function $1($2) {');

    // 6. Casts: (float)x -> x (unneeded in JS), (int)x -> Math.floor(x)
    js = js.replace(/\(\s*(?:float|double)\s*\)/g, '');
    js = js.replace(/\(\s*(?:int|uint16_t|uint8_t|int8_t|int16_t|int32_t|uint32_t|long)\s*\)\s*\(/g, 'Math.floor(');
    js = js.replace(/\(\s*(?:int|uint16_t|uint8_t|int8_t|int16_t|int32_t|uint32_t|long)\s*\)\s*([A-Za-z0-9_]+)/g, 'Math.floor($1)');
    js = js.replace(/\(\s*(?:int|uint16_t|uint8_t|int8_t|int16_t|int32_t|uint32_t|long)\s*\)/g, '');

    // 7. Suffixes on numbers: 3500.0f -> 3500.0
    js = js.replace(/([0-9]+\.?[0-9]*)f\b/g, '$1');

    return js;
  }

  /**
   * Recompiles and initializes the persistent Arduino sandbox environment.
   */
  public compile(cppCode: string, sensorCount: number): boolean {
    if (this.currentCode === cppCode && this.instance) {
      return this.compileError === null;
    }

    this.currentCode = cppCode;
    this.compileError = null;
    this.runtimeError = null;
    this.logs = [];

    try {
      const transpiledJs = this.transpile(cppCode);

      // Wrapper function creating a persistent closure
      const factory = new Function('env', `
        with (env) {
          ${transpiledJs}

          return {
            setup: typeof setup === 'function' ? setup : null,
            loop: typeof loop === 'function' ? loop : null,
            getGlobals: () => ({
              ...(typeof Kp !== 'undefined' ? { Kp } : {}),
              ...(typeof Ki !== 'undefined' ? { Ki } : {}),
              ...(typeof Kd !== 'undefined' ? { Kd } : {}),
              ...(typeof baseSpeed !== 'undefined' ? { baseSpeed } : {}),
            })
          };
        }
      `);

      // Environment helpers provided to the user code
      const envContext: any = {
        // Math & Arduino helpers
        constrain: (amt: number, low: number, high: number) => Math.max(low, Math.min(high, amt)),
        map: (x: number, in_min: number, in_max: number, out_min: number, out_max: number) => 
          (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min,
        abs: Math.abs,
        min: Math.min,
        max: Math.max,
        sq: (x: number) => x * x,
        sqrt: Math.sqrt,
        pow: Math.pow,
        round: Math.round,
        floor: Math.floor,
        ceil: Math.ceil,
        
        // System / Time
        millis: () => Math.floor(this.simTime * 1000),
        micros: () => Math.floor(this.simTime * 1000000),
        delay: () => {}, // non-blocking in frame loop
        
        // Pin mocks
        HIGH: 1,
        LOW: 0,
        INPUT: 0,
        OUTPUT: 1,
        INPUT_PULLUP: 2,
        pinMode: () => {},
        digitalWrite: () => {},
        digitalRead: () => 1,
        analogRead: () => 512,
        
        // Motor output state (speed -255 .. +255)
        _motorLeft: 0,
        _motorRight: 0,
        setMotors: (left: number, right: number) => {
          envContext._motorLeft = left;
          envContext._motorRight = right;
        },
        setMotorA: (speed: number) => { envContext._motorLeft = speed; },
        setMotorB: (speed: number) => { envContext._motorRight = speed; },
        ledcWrite: (_pin: number, val: number) => {
          // generic fallback
        },

        // Sensors
        SENSOR_COUNT: sensorCount,
        sensorValues: new Array(sensorCount).fill(0),
        readLineBlack: (values?: number[]) => {
          // Standard Pololu QTR algorithm:
          // Returns position 0 .. (N-1)*1000, where center is (N-1)*500
          const arr = values || envContext.sensorValues;
          let weightedSum = 0;
          let sum = 0;
          for (let i = 0; i < arr.length; i++) {
            const v = arr[i];
            weightedSum += v * (i * 1000);
            sum += v;
          }
          if (sum === 0) {
            return (arr.length - 1) * 500;
          }
          return Math.round(weightedSum / sum);
        },

        // Serial logging
        Serial: {
          begin: () => {},
          print: (val: any) => {
            if (this.logs.length < 50) this.logs.push(String(val));
          },
          println: (val: any = '') => {
            if (this.logs.length < 50) this.logs.push(String(val));
          },
        }
      };

      this.envContext = envContext;
      this.instance = factory(envContext);

      if (this.instance.setup) {
        this.instance.setup();
      }

      return true;
    } catch (err: any) {
      this.compileError = err.message || String(err);
      this.instance = null;
      return false;
    }
  }

  private envContext: any = null;
  private simTime: number = 0;

  /**
   * Executes one iteration of the Arduino loop() with updated sensor values.
   */
  public executeTick(sensors0to1: number[], timeSeconds: number, dt: number): ArduinoExecutionResult {
    this.simTime = timeSeconds;

    if (!this.instance || !this.instance.loop) {
      return { leftSpeed: 0, rightSpeed: 0, logs: this.logs };
    }

    try {
      // Update sensorValues array (scaled to 0-1000 matching QTR sensors)
      for (let i = 0; i < sensors0to1.length; i++) {
        this.envContext.sensorValues[i] = Math.round((sensors0to1[i] || 0) * 1000);
      }

      // Execute loop
      this.instance.loop(this.envContext.sensorValues, dt);

      // Normalize motor outputs: if user used 0-255, map to -1..1
      let left = this.envContext._motorLeft;
      let right = this.envContext._motorRight;

      if (Math.abs(left) > 1 || Math.abs(right) > 1) {
        left = Math.max(-1, Math.min(1, left / 255));
        right = Math.max(-1, Math.min(1, right / 255));
      }

      this.runtimeError = null;
      return { leftSpeed: left, rightSpeed: right, logs: this.logs };
    } catch (err: any) {
      this.runtimeError = err.message || String(err);
      return { leftSpeed: 0, rightSpeed: 0, logs: this.logs };
    }
  }
}

export const arduinoEnv = new ArduinoEnvironment();
