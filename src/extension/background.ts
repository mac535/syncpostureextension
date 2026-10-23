import type {
  ExtensionMessage,
  PostureSettings,
  PostureTelemetryPayload
} from './types';
import { DEFAULT_SETTINGS } from './types';

const SETTINGS_KEY = 'posturesync_settings';
const CALIBRATION_KEY = 'posturesync_calibrated_baseline';

let settings: PostureSettings = { ...DEFAULT_SETTINGS };
let isAlertActive: boolean = false;
let isBreakActive: boolean = false;
let breakTimerId: ReturnType<typeof setTimeout> | null = null;
let breakDueTimestamp: number | null = null;

let latestTelemetry: PostureTelemetryPayload = {
  status: 'good',
  severity: 0,
  intensity: 0,
  debouncerState: 'idle',
  accumulatingMs: 0,
  holdMs: 10000,
  timestamp: Date.now(),
  alertLevel: 0,
  blurPx: 0,
  alertMessage: '',
  blinkCount: 0,
  blinksPerMinute: null,
  blinkRateStatus: 'collecting',
  lowBlinkRate: false,
  faceDetected: false,
  poseDetected: false,
  observationProgress: 0,
  trackingStatus: 'lost'
};

async function initSettings(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    if (data && data[SETTINGS_KEY]) {
      settings = { ...DEFAULT_SETTINGS, ...data[SETTINGS_KEY] };
    }
  } catch (err) {
    console.warn('PostureSync background: failed to load settings:', err);
  }
}
initSettings();

function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:')
  );
}

// ---------- Screen-Session Break Reminder Engine ----------
function startBreakTimer(intervalMs?: number): void {
  stopBreakTimer();
  const duration = intervalMs ?? (settings.breakIntervalMin || 30) * 60 * 1000;
  breakDueTimestamp = Date.now() + duration;
  breakTimerId = setTimeout(() => {
    triggerBreakReminder();
  }, duration);
}

function stopBreakTimer(): void {
  if (breakTimerId !== null) {
    clearTimeout(breakTimerId);
    breakTimerId = null;
  }
  breakDueTimestamp = null;
  isBreakActive = false;
}

function triggerBreakReminder(): void {
  if (!settings.monitoringActive) return;
  isBreakActive = true;
  const intervalMin = settings.breakIntervalMin || 30;
  const message =
    "You've been looking at a screen for a while. Take a short break, look into the distance, stretch, and relax your eyes.";

  broadcastToTabs({
    type: 'BREAK_REMINDER',
    message,
    intervalMinutes: intervalMin
  });
}

function dismissBreakReminder(): void {
  isBreakActive = false;
  broadcastToTabs({ type: 'BREAK_REMINDER_CLEARED' });
  if (settings.monitoringActive) {
    startBreakTimer(); // Start next cycle
  }
}

function snoozeBreakReminder(snoozeMin: number = 5): void {
  isBreakActive = false;
  broadcastToTabs({ type: 'BREAK_REMINDER_CLEARED' });
  if (settings.monitoringActive) {
    // If testing mode with 1 minute interval, snooze for 30s; otherwise snooze for snoozeMin * 60s
    const snoozeDurationMs =
      (settings.breakIntervalMin || 30) <= 1
        ? 30 * 1000
        : snoozeMin * 60 * 1000;
    startBreakTimer(snoozeDurationMs);
  }
}

/**
 * Broadcast an intervention or notification message to active tabs or all tabs across all windows.
 */
async function broadcastToTabs(message: unknown, activeOnly: boolean = false): Promise<void> {
  try {
    const queryOptions = activeOnly ? { active: true } : {};
    const tabs = await chrome.tabs.query(queryOptions);

    for (const tab of tabs) {
      if (tab.id && !isRestrictedUrl(tab.url)) {
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch {
          // If content script was not yet loaded (e.g. tab opened before extension loaded), inject it dynamically
          try {
            if (chrome.scripting && tab.id) {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
              });
              await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['content.css']
              });
              await chrome.tabs.sendMessage(tab.id, message);
            }
          } catch {
            // Safe ignore on restricted pages
          }
        }
      }
    }
  } catch (err) {
    console.warn('PostureSync background: error broadcasting to tabs:', err);
  }
}

async function openOrFocusMonitorTab(): Promise<chrome.tabs.Tab> {
  const monitorUrl = chrome.runtime.getURL('monitor.html');
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => t.url && t.url.startsWith(monitorUrl));

  if (existing && existing.id) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
    return existing;
  }

  return await chrome.tabs.create({ url: monitorUrl, active: true });
}

// Runtime Message Listener
chrome.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || !('type' in msg)) {
    return false;
  }

  switch (msg.type) {
    case 'GET_STATUS': {
      (async () => {
        let isCalibrated = false;
        try {
          const calData = await chrome.storage.local.get(CALIBRATION_KEY);
          isCalibrated = Boolean((calData?.[CALIBRATION_KEY] as { isCalibrated?: boolean } | undefined)?.isCalibrated);
        } catch {}

        const remainingMs = breakDueTimestamp !== null ? Math.max(0, breakDueTimestamp - Date.now()) : 0;

        sendResponse({
          type: 'STATUS_RESPONSE',
          monitoringActive: settings.monitoringActive,
          status: latestTelemetry.status,
          severity: latestTelemetry.severity,
          intensity: latestTelemetry.intensity,
          debouncerState: latestTelemetry.debouncerState,
          accumulatingMs: latestTelemetry.accumulatingMs,
          holdMs: latestTelemetry.holdMs || settings.holdDurationSec * 1000,
          isAlertActive,
          settings,
          isCalibrated,
          alertLevel: latestTelemetry.alertLevel ?? 0,
          blurPx: latestTelemetry.blurPx ?? 0,
          alertMessage: latestTelemetry.alertMessage ?? '',
          blinkCount: latestTelemetry.blinkCount ?? 0,
          blinksPerMinute: latestTelemetry.blinksPerMinute ?? null,
          blinkRateStatus: latestTelemetry.blinkRateStatus ?? 'collecting',
          lowBlinkRate: latestTelemetry.lowBlinkRate ?? false,
          faceDetected: latestTelemetry.faceDetected ?? false,
          poseDetected: latestTelemetry.poseDetected ?? false,
          observationProgress: latestTelemetry.observationProgress ?? 0,
          trackingStatus: latestTelemetry.trackingStatus ?? 'lost',
          breakRemainingMs: remainingMs,
          isBreakActive
        });
      })();
      return true;
    }

    case 'MONITOR_FEED_ACTIVE': {
      if (msg.active) {
        settings.monitoringActive = true;
      }
      return false;
    }

    case 'START_MONITORING': {
      settings.monitoringActive = true;
      chrome.storage.local.set({ [SETTINGS_KEY]: settings }).catch(() => {});
      startBreakTimer();
      openOrFocusMonitorTab();
      broadcastToTabs({ type: 'MONITORING_STARTED' });
      sendResponse({ success: true, monitoringActive: true });
      return false;
    }

    case 'STOP_MONITORING': {
      settings.monitoringActive = false;
      isAlertActive = false;
      latestTelemetry.alertLevel = 0;
      latestTelemetry.blurPx = 0;
      latestTelemetry.alertMessage = '';
      latestTelemetry.lowBlinkRate = false;
      stopBreakTimer();
      chrome.storage.local.set({ [SETTINGS_KEY]: settings }).catch(() => {});
      broadcastToTabs({ type: 'MONITORING_STOPPED' }, false);
      sendResponse({ success: true, monitoringActive: false });
      return false;
    }

    case 'TRIGGER_CALIBRATION_FROM_POPUP': {
      const monitorUrl = chrome.runtime.getURL('monitor.html');
      chrome.tabs.query({}, (tabs) => {
        const mon = tabs.find((t) => t.url && t.url.startsWith(monitorUrl));
        if (mon && mon.id) {
          chrome.tabs.sendMessage(mon.id, { type: 'TRIGGER_CALIBRATION_FROM_POPUP' }).catch(() => {});
        }
      });
      sendResponse({ success: true });
      return false;
    }

    case 'OPEN_MONITOR_PAGE': {
      openOrFocusMonitorTab().then(() => {
        sendResponse({ success: true });
      });
      return true;
    }

    case 'UPDATE_SETTINGS': {
      const wasInterval = settings.breakIntervalMin;
      settings = { ...settings, ...msg.settings };
      chrome.storage.local.set({ [SETTINGS_KEY]: settings }).catch(() => {});

      // If break interval changed while monitoring active, reschedule break timer
      if (settings.monitoringActive && msg.settings.breakIntervalMin && msg.settings.breakIntervalMin !== wasInterval) {
        startBreakTimer(settings.breakIntervalMin * 60 * 1000);
      }

      sendResponse({ success: true, settings });
      return false;
    }

    case 'POSTURE_TELEMETRY': {
      latestTelemetry = { ...latestTelemetry, ...msg.payload };
      return false;
    }

    case 'PROGRESSIVE_ALERT_UPDATE': {
      if (!settings.monitoringActive) return false;
      isAlertActive = msg.alertLevel > 0;
      latestTelemetry.alertLevel = msg.alertLevel;
      latestTelemetry.blurPx = msg.blurPx;
      latestTelemetry.alertMessage = msg.message;

      if (settings.blurEnabled || msg.isRecovering) {
        broadcastToTabs(
          {
            type: 'APPLY_PROGRESSIVE_BLUR',
            alertLevel: msg.alertLevel,
            blurPx: msg.blurPx,
            message: msg.message,
            status: msg.status,
            soundEnabled: msg.soundEnabled && settings.soundEnabled,
            isRecovering: msg.isRecovering
          },
          false
        );
      }
      return false;
    }

    case 'POSTURE_ALERT': {
      if (!settings.monitoringActive) return false;
      isAlertActive = true;
      if (settings.blurEnabled) {
        broadcastToTabs(
          {
            type: 'APPLY_PROGRESSIVE_BLUR',
            alertLevel: msg.alertLevel ?? 1,
            blurPx: msg.blurPx ?? 3,
            message: msg.message || 'Sustained poor posture detected — please sit upright.',
            status: msg.status,
            soundEnabled: settings.soundEnabled
          },
          false
        );
      }
      return false;
    }

    case 'BLINK_ALERT_UPDATE': {
      if (!settings.monitoringActive) return false;
      latestTelemetry.lowBlinkRate = msg.isLowBlinkRate;
      latestTelemetry.trackingStatus = msg.trackingStatus;
      broadcastToTabs(
        {
          type: 'BLINK_ALERT_UPDATE',
          isLowBlinkRate: msg.isLowBlinkRate,
          rate: msg.rate,
          trackingStatus: msg.trackingStatus,
          message: msg.message
        },
        false
      );
      return false;
    }

    case 'BLINK_REMINDER': {
      if (!settings.monitoringActive) return false;
      broadcastToTabs({ type: 'BLINK_REMINDER', message: msg.message }, false);
      return false;
    }

    case 'BREAK_REMINDER': {
      if (!settings.monitoringActive) return false;
      triggerBreakReminder();
      return false;
    }

    case 'DISMISS_BREAK_REMINDER': {
      dismissBreakReminder();
      sendResponse?.({ success: true });
      return false;
    }

    case 'SNOOZE_BREAK_REMINDER': {
      snoozeBreakReminder(msg.snoozeMinutes ?? 5);
      sendResponse?.({ success: true });
      return false;
    }

    case 'POSTURE_RESTORED': {
      isAlertActive = false;
      latestTelemetry.alertLevel = 0;
      latestTelemetry.blurPx = 0;
      broadcastToTabs({ type: 'POSTURE_RESTORED' }, false);
      return false;
    }

    default:
      return false;
  }
});

// Tab Activated: Maintain consistent intervention state when user switches tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!settings.monitoringActive) return;

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab || isRestrictedUrl(tab.url)) return;

    // 1. Posture blur state
    if (isAlertActive && settings.blurEnabled && (latestTelemetry.blurPx ?? 0) > 0) {
      try {
        await chrome.tabs.sendMessage(activeInfo.tabId, {
          type: 'APPLY_PROGRESSIVE_BLUR',
          alertLevel: latestTelemetry.alertLevel ?? 1,
          blurPx: latestTelemetry.blurPx ?? 3,
          message: latestTelemetry.alertMessage || 'Please adjust your posture to unblur.',
          status: latestTelemetry.status,
          soundEnabled: false,
          isRecovering: false
        });
      } catch {
        if (chrome.scripting && activeInfo.tabId) {
          await chrome.scripting.executeScript({
            target: { tabId: activeInfo.tabId },
            files: ['content.js']
          });
          await chrome.scripting.insertCSS({
            target: { tabId: activeInfo.tabId },
            files: ['content.css']
          });
          await chrome.tabs.sendMessage(activeInfo.tabId, {
            type: 'APPLY_PROGRESSIVE_BLUR',
            alertLevel: latestTelemetry.alertLevel ?? 1,
            blurPx: latestTelemetry.blurPx ?? 3,
            message: latestTelemetry.alertMessage || 'Please adjust your posture to unblur.',
            status: latestTelemetry.status,
            soundEnabled: false,
            isRecovering: false
          });
        }
      }
    }

    // 2. Active Low Blink Rate Alert
    if (latestTelemetry.lowBlinkRate) {
      try {
        await chrome.tabs.sendMessage(activeInfo.tabId, {
          type: 'BLINK_ALERT_UPDATE',
          isLowBlinkRate: true,
          rate: latestTelemetry.blinksPerMinute,
          trackingStatus: latestTelemetry.trackingStatus ?? 'reliable',
          message: 'Low blink rate detected! Remember to blink naturally, relax your eyes, and take a moment to look away from the screen.'
        });
      } catch {}
    }

    // 3. Active Screen Break Reminder
    if (isBreakActive) {
      try {
        await chrome.tabs.sendMessage(activeInfo.tabId, {
          type: 'BREAK_REMINDER',
          message: "You've been looking at a screen for a while. Take a short break, look into the distance, stretch, and relax your eyes.",
          intervalMinutes: settings.breakIntervalMin || 30
        });
      } catch {}
    }
  } catch {
    // Safe ignore
  }
});

// Tab Updated: Ensure blur and active cards are applied when a tab finishes reloading or navigating
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !settings.monitoringActive) return;
  if (!tab || isRestrictedUrl(tab.url)) return;

  if (isAlertActive && settings.blurEnabled && (latestTelemetry.blurPx ?? 0) > 0) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'APPLY_PROGRESSIVE_BLUR',
        alertLevel: latestTelemetry.alertLevel ?? 1,
        blurPx: latestTelemetry.blurPx ?? 3,
        message: latestTelemetry.alertMessage || 'Please adjust your posture to unblur.',
        status: latestTelemetry.status,
        soundEnabled: false,
        isRecovering: false
      });
    } catch {
      try {
        if (chrome.scripting && tabId) {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          });
          await chrome.scripting.insertCSS({
            target: { tabId },
            files: ['content.css']
          });
          await chrome.tabs.sendMessage(tabId, {
            type: 'APPLY_PROGRESSIVE_BLUR',
            alertLevel: latestTelemetry.alertLevel ?? 1,
            blurPx: latestTelemetry.blurPx ?? 3,
            message: latestTelemetry.alertMessage || 'Please adjust your posture to unblur.',
            status: latestTelemetry.status,
            soundEnabled: false,
            isRecovering: false
          });
        }
      } catch {}
    }
  }

  if (latestTelemetry.lowBlinkRate) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'BLINK_ALERT_UPDATE',
        isLowBlinkRate: true,
        rate: latestTelemetry.blinksPerMinute,
        trackingStatus: latestTelemetry.trackingStatus ?? 'reliable',
        message: 'Low blink rate detected! Remember to blink naturally, relax your eyes, and take a moment to look away from the screen.'
      });
    } catch {}
  }

  if (isBreakActive) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'BREAK_REMINDER',
        message: "You've been looking at a screen for a while. Take a short break, look into the distance, stretch, and relax your eyes.",
        intervalMinutes: settings.breakIntervalMin || 30
      });
    } catch {}
  }
});
