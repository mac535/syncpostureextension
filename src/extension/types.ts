import type { PostureStatus, PostureSeverity } from '../lib/posture/postureClassifier';
import type { DebouncerState } from '../lib/posture/temporalDebounce';
import type { PostureBaseline } from '../lib/posture/calibration';

export interface PostureSettings {
  holdDurationSec: number;
  blurEnabled: boolean;
  soundEnabled: boolean;
  monitoringActive: boolean;
  breakIntervalMin: number;
  blinkObservationPeriodSec: number;
  lowBlinkRateThreshold: number;
}

export const DEFAULT_SETTINGS: PostureSettings = {
  holdDurationSec: 10,
  blurEnabled: true,
  soundEnabled: true,
  monitoringActive: false,
  breakIntervalMin: 30, // 30 minutes standard screen break reminder
  blinkObservationPeriodSec: 120, // 2 minutes observation period
  lowBlinkRateThreshold: 10 // < 10 bpm is low
};

export type MonitoringStatus = 'stopped' | 'initializing' | 'running' | 'suspended';
export type SuspensionReason = 'edge_unfocused' | 'manual' | null;

export interface PostureTelemetryPayload {
  status: PostureStatus;
  severity: PostureSeverity;
  intensity: number;
  debouncerState: DebouncerState;
  accumulatingMs: number;
  holdMs: number;
  timestamp: number;
  sequenceNumber?: number;
  monitoringStatus?: MonitoringStatus;
  suspensionReason?: SuspensionReason;
  // Progressive blur & alert level
  alertLevel?: number; // 0: none, 1: initial (3px), 2: continued (6px), 3: persistent (11px)
  blurPx?: number;
  alertMessage?: string;
  // Real blink metrics from facial eye landmarks
  blinkCount?: number;
  blinksPerMinute?: number | null;
  blinkRateStatus?: 'collecting' | 'normal' | 'low';
  lowBlinkRate?: boolean;
  faceDetected?: boolean;
  poseDetected?: boolean;
  personCount?: number;
  observationProgress?: number;
  trackingStatus?: 'reliable' | 'unreliable' | 'lost';
  blinkObservationPeriodSec?: number;
}

export type ExtensionMessage =
  | { type: 'START_MONITORING' }
  | { type: 'STOP_MONITORING' }
  | { type: 'GET_STATUS' }
  | {
      type: 'STATUS_RESPONSE';
      monitoringActive: boolean;
      monitoringStatus?: MonitoringStatus;
      suspensionReason?: SuspensionReason;
      sequenceNumber?: number;
      timestamp?: number;
      status: PostureStatus;
      severity: PostureSeverity;
      intensity: number;
      debouncerState: DebouncerState;
      accumulatingMs: number;
      holdMs: number;
      isAlertActive: boolean;
      settings: PostureSettings;
      isCalibrated: boolean;
      alertLevel?: number;
      blurPx?: number;
      alertMessage?: string;
      blinkCount?: number;
      blinksPerMinute?: number | null;
      blinkRateStatus?: 'collecting' | 'normal' | 'low';
      lowBlinkRate?: boolean;
      faceDetected?: boolean;
      poseDetected?: boolean;
      personCount?: number;
      observationProgress?: number;
      trackingStatus?: 'reliable' | 'unreliable' | 'lost';
      breakRemainingMs?: number;
      isBreakActive?: boolean;
      isSuspended?: boolean;
      isEdgeAppFocused?: boolean;
    }
  | {
      type: 'POSTURE_TELEMETRY';
      payload: PostureTelemetryPayload;
    }
  | {
      type: 'APPLICATION_FOCUS_LIFECYCLE';
      action: 'SUSPEND' | 'RESUME' | 'STOP';
      isAppFocused: boolean;
      monitoringStatus?: MonitoringStatus;
      sequenceNumber?: number;
      timestamp?: number;
    }
  | {
      type: 'POSTURE_ALERT';
      status: PostureStatus;
      severity: PostureSeverity;
      intensity: number;
      reason?: string;
      alertLevel?: number;
      blurPx?: number;
      message?: string;
    }
  | {
      type: 'PROGRESSIVE_ALERT_UPDATE';
      alertLevel: number;
      blurPx: number;
      status: PostureStatus;
      message: string;
      soundEnabled: boolean;
      isRecovering?: boolean;
    }
  | {
      type: 'APPLY_PROGRESSIVE_BLUR';
      alertLevel: number;
      blurPx: number;
      message: string;
      status: string;
      soundEnabled?: boolean;
      isRecovering?: boolean;
    }
  | {
      type: 'BLINK_ALERT_UPDATE';
      isLowBlinkRate: boolean;
      rate: number | null;
      trackingStatus: 'reliable' | 'unreliable' | 'lost';
      message: string;
    }
  | {
      type: 'BLINK_REMINDER';
      message: string;
    }
  | {
      type: 'BREAK_REMINDER';
      message: string;
      intervalMinutes?: number;
    }
  | { type: 'DISMISS_BREAK_REMINDER' }
  | { type: 'SNOOZE_BREAK_REMINDER'; snoozeMinutes?: number }
  | { type: 'BREAK_REMINDER_CLEARED' }
  | { type: 'POSTURE_RESTORED' }
  | { type: 'MONITORING_STOPPED' }
  | { type: 'MONITOR_FEED_ACTIVE'; active: boolean }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<PostureSettings> }
  | { type: 'TRIGGER_CALIBRATION' }
  | { type: 'TRIGGER_CALIBRATION_FROM_POPUP' }
  | { type: 'CALIBRATION_COMPLETED'; baseline: PostureBaseline }
  | { type: 'OPEN_MONITOR_PAGE' }
  | {
      type: 'TAB_VISIBILITY_CHANGE';
      visibilityState: 'visible' | 'hidden';
      timestamp?: number;
    }
  | { type: 'QUERY_TAB_VISIBILITY' };
