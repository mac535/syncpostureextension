export type PostureStatusType = 'good' | 'slouching' | 'leaning';
export type SeverityLevel = 0 | 1 | 2 | 3;

export interface PostureStatusMessage {
  type: 'POSTURE_STATUS';
  status: PostureStatusType;
  severity: SeverityLevel;
  intensity: number; // 0.0-1.0, continuous deviation score
}

export interface BlinkAlertMessage {
  type: 'BLINK_ALERT';
  blinksPerMin: number;
}

export interface BreakReminderMessage {
  type: 'BREAK_REMINDER';
  state?: 'break' | 'complete';
  remainingSeconds?: number;
}

export interface ClearInterventionMessage {
  type: 'CLEAR_INTERVENTION';
}

export interface DemoReadyMessage {
  type: 'DEMO_READY';
}

export interface SetupCompleteMessage {
  type: 'SETUP_COMPLETE';
}

export interface PostureTelemetryMessage {
  type: 'POSTURE_TELEMETRY';
  status: 'good' | 'slouching' | 'leaning' | 'insufficient_data';
  severity: 0 | 1 | 2 | 3;
  intensity: number;
  debouncerState: 'idle' | 'accumulating' | 'triggered' | 'recovering';
  timestamp: number;
}

export type SyncMessage =
  | PostureStatusMessage
  | BlinkAlertMessage
  | BreakReminderMessage
  | ClearInterventionMessage
  | DemoReadyMessage
  | SetupCompleteMessage
  | PostureTelemetryMessage;


