import type {
  ExtensionMessage,
  MonitoringStatus,
  PostureSettings,
  PostureTelemetryPayload,
  SuspensionReason
} from './types';
import { DEFAULT_SETTINGS } from './types';

const SETTINGS_KEY = 'posturesync_settings';
const CALIBRATION_KEY = 'posturesync_calibrated_baseline';

let settings: PostureSettings = { ...DEFAULT_SETTINGS };
let isAlertActive: boolean = false;
let isBreakActive: boolean = false;
let breakTimerId: ReturnType<typeof setTimeout> | null = null;
let breakDueTimestamp: number | null = null;
let isEdgeAppFocused: boolean = true;
let isSuspendedDueToFocus: boolean = false;
let currentSuspensionReason: SuspensionReason = null;
let isInitializing: boolean = false;
let sequenceNumber: number = Date.now();
let focusDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

let latestTelemetry: PostureTelemetryPayload = {
  status: 'good',
  severity: 0,
  intensity: 0,
  debouncerState: 'idle',
  accumulatingMs: 0,
  holdMs: 10000,
  timestamp: Date.now(),
  sequenceNumber: 1,
  monitoringStatus: 'stopped',
  suspensionReason: null,
  alertLevel: 0,
  blurPx: 0,
  alertMessage: '',
  blinkCount: 0,
  blinksPerMinute: null,
  blinkRateStatus: 'collecting',
  lowBlinkRate: false,
  faceDetected: false,
  poseDetected: false,
  personCount: 0,
  observationProgress: 0,
  trackingStatus: 'lost'
};

const TELEMETRY_CACHE_KEY = 'posturesync_latest_telemetry';
const STATE_CACHE_KEY = 'posturesync_runtime_state';

async function persistTelemetrySnapshot(): Promise<void> {
  try {
    const storageArea = chrome.storage.session || chrome.storage.local;
    await storageArea.set({
      [TELEMETRY_CACHE_KEY]: latestTelemetry,
      [STATE_CACHE_KEY]: {
        isAlertActive,
        isBreakActive,
        breakDueTimestamp,
        sequenceNumber,
        isSuspendedDueToFocus,
        isInitializing
      }
    });
  } catch {}
}

async function restoreTelemetrySnapshot(): Promise<void> {
  try {
    const storageArea = chrome.storage.session || chrome.storage.local;
    const data = await storageArea.get([TELEMETRY_CACHE_KEY, STATE_CACHE_KEY]);
    if (data?.[TELEMETRY_CACHE_KEY]) {
      latestTelemetry = { ...latestTelemetry, ...data[TELEMETRY_CACHE_KEY] };
      if (typeof latestTelemetry.sequenceNumber === 'number') {
        sequenceNumber = Math.max(sequenceNumber, latestTelemetry.sequenceNumber);
      }
    }
    if (data?.[STATE_CACHE_KEY]) {
      const s = data[STATE_CACHE_KEY] as any;
      if (typeof s.isAlertActive === 'boolean') isAlertActive = s.isAlertActive;
      if (typeof s.isBreakActive === 'boolean') isBreakActive = s.isBreakActive;
      if (typeof s.breakDueTimestamp === 'number') breakDueTimestamp = s.breakDueTimestamp;
      if (typeof s.sequenceNumber === 'number') sequenceNumber = Math.max(sequenceNumber, s.sequenceNumber);
      if (typeof s.isSuspendedDueToFocus === 'boolean') isSuspendedDueToFocus = s.isSuspendedDueToFocus;
      if (typeof s.isInitializing === 'boolean') isInitializing = s.isInitializing;
    }
  } catch {}
}

async function initSettings(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    if (data && data[SETTINGS_KEY]) {
      settings = { ...DEFAULT_SETTINGS, ...data[SETTINGS_KEY] };
    }
    await restoreTelemetrySnapshot();
  } catch (err) {
    console.warn('PostureSync background: failed to load settings:', err);
  }
}
const initSettingsPromise = initSettings();

function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('extension://') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:') ||
    url.startsWith('data:') ||
    url.startsWith('javascript:') ||
    url.includes('microsoftedge.microsoft.com') ||
    url.includes('chromewebstore.google.com') ||
    url.includes('chrome.google.com')
  );
}

// Track tabs where content scripts have been verified/injected to avoid duplicate injection loops
const injectedTabs = new Set<number>();

if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    injectedTabs.delete(tabId);
    if (settings.monitoringActive) {
      const monitorUrl = chrome.runtime.getURL('monitor.html');
      try {
        const tabs = await chrome.tabs.query({});
        const hasMonitor = tabs.some((t) => t.id !== tabId && t.url && t.url.startsWith(monitorUrl));
        if (!hasMonitor) {
          settings.monitoringActive = false;
          isSuspendedDueToFocus = false;
          isInitializing = false;
          sequenceNumber = Math.max(Date.now(), sequenceNumber + 1);
          latestTelemetry.monitoringStatus = 'stopped';
          latestTelemetry.suspensionReason = null;
          latestTelemetry.alertLevel = 0;
          latestTelemetry.blurPx = 0;
          latestTelemetry.sequenceNumber = sequenceNumber;
          latestTelemetry.timestamp = Date.now();
          stopBreakTimer();
          persistTelemetrySnapshot();
          broadcastToTabs({ type: 'MONITORING_STOPPED' }, false);
          chrome.runtime.sendMessage({ type: 'MONITORING_STOPPED' }).catch(() => {});
        }
      } catch {}
    }
  });
}

function notifyMonitorLifecycle(action: 'SUSPEND' | 'RESUME' | 'STOP'): void {
  const monitorUrl = chrome.runtime.getURL('monitor.html');
  const targetMonitoringStatus: MonitoringStatus =
    action === 'SUSPEND' ? 'suspended' : action === 'RESUME' ? 'initializing' : 'stopped';

  const lifecycleMsg = {
    type: 'APPLICATION_FOCUS_LIFECYCLE',
    action,
    isAppFocused: action === 'RESUME',
    monitoringStatus: targetMonitoringStatus,
    sequenceNumber,
    timestamp: Date.now()
  };

  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id && tab.url && tab.url.startsWith(monitorUrl)) {
          chrome.tabs.sendMessage(tab.id, lifecycleMsg).catch(() => {});
        }
      });
    });
  }

  // Also broadcast to popup or other open extension pages
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage(lifecycleMsg).catch(() => {});
  }
}

// Edge Application Focus Detection:
// Window focus is monitored via chrome.windows.onFocusChanged.
// When windowId === WINDOW_ID_NONE, Microsoft Edge has lost foreground OS application focus.
if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.onFocusChanged) {
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (focusDebounceTimeout !== null) {
      clearTimeout(focusDebounceTimeout);
      focusDebounceTimeout = null;
    }

    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Edge has lost foreground application focus (user switched to another desktop application).
      // A 500 ms debounce is used instead of a shorter value because opening or closing the
      // extension popup creates a transient browser window whose open/close cycle briefly
      // emits WINDOW_ID_NONE before the original Edge window re-registers as focused. On most
      // machines this round-trip takes 150–300 ms; 500 ms absorbs it safely while still
      // responding quickly to genuine Alt-Tab application switches.
      focusDebounceTimeout = setTimeout(() => {
        isEdgeAppFocused = false;
        if (settings.monitoringActive) {
          isSuspendedDueToFocus = true;
          currentSuspensionReason = 'edge_unfocused';
          isInitializing = false;
          sequenceNumber = Math.max(Date.now(), sequenceNumber + 1);

          // Clear active webpage blur so tabs are not frozen in a blurred state while user is away
          if (isAlertActive) {
            broadcastToTabs(
              {
                type: 'APPLY_PROGRESSIVE_BLUR',
                alertLevel: 0,
                blurPx: 0,
                message: '',
                status: 'good',
                soundEnabled: false,
                isRecovering: true
              },
              false
            );
            isAlertActive = false;
          }

          latestTelemetry = {
            ...latestTelemetry,
            status: 'good',
            severity: 0,
            intensity: 0,
            debouncerState: 'idle',
            accumulatingMs: 0,
            alertLevel: 0,
            blurPx: 0,
            alertMessage: '',
            blinksPerMinute: null, // live rate marked unavailable during suspension
            trackingStatus: 'lost',
            monitoringStatus: 'suspended',
            suspensionReason: 'edge_unfocused',
            sequenceNumber,
            timestamp: Date.now()
          };

          notifyMonitorLifecycle('SUSPEND');
          persistTelemetrySnapshot();
        }
      }, 500); // 500 ms: safely longer than the popup open/close OS focus transition
    } else {
      // A browser window gained focus. Before treating this as a genuine application-level RESUME,
      // check whether the window is the extension popup (window.type === 'popup'). If so, do NOT
      // clear the debounce timer and do NOT trigger a RESUME — the popup opening/closing is not
      // an application switch; it is still Edge in the foreground.
      chrome.windows.get(windowId, (win) => {
        if (chrome.runtime.lastError) {
          // Window was already closed before inspection; treat as a normal window conservatively.
        }
        if (win && win.type === 'popup') {
          // Extension popup window took focus: not an OS application switch.
          // Leave any pending WINDOW_ID_NONE debounce timer running so that if the
          // popup is the *only* thing focused (unlikely but possible) we still suspend.
          return;
        }

        // A normal browser (tab) window is now the foreground application.
        isEdgeAppFocused = true;
        if (settings.monitoringActive && isSuspendedDueToFocus) {
          isSuspendedDueToFocus = false;
          currentSuspensionReason = null;
          isInitializing = true;
          sequenceNumber = Math.max(Date.now(), sequenceNumber + 1);

          latestTelemetry.monitoringStatus = 'initializing';
          latestTelemetry.suspensionReason = null;
          latestTelemetry.sequenceNumber = sequenceNumber;
          latestTelemetry.timestamp = Date.now();

          notifyMonitorLifecycle('RESUME');
          persistTelemetrySnapshot();
        }
      });
    }
  });
}

// ---------- Screen-Session Break Reminder Engine ----------
function startBreakTimer(intervalMs?: number): void {
  stopBreakTimer();
  const duration = intervalMs ?? (settings.breakIntervalMin || 30) * 60 * 1000;
  breakDueTimestamp = Date.now() + duration;
  breakTimerId = setTimeout(() => {
    triggerBreakReminder();
  }, duration);
  persistTelemetrySnapshot();
}

function stopBreakTimer(): void {
  if (breakTimerId !== null) {
    clearTimeout(breakTimerId);
    breakTimerId = null;
  }
  breakDueTimestamp = null;
  isBreakActive = false;
  persistTelemetrySnapshot();
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
  persistTelemetrySnapshot();
}

function dismissBreakReminder(): void {
  isBreakActive = false;
  broadcastToTabs({ type: 'BREAK_REMINDER_CLEARED' });
  if (settings.monitoringActive) {
    startBreakTimer(); // Start next cycle
  }
  persistTelemetrySnapshot();
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
  persistTelemetrySnapshot();
}

/**
 * Broadcast an intervention or notification message to all eligible tabs across all windows concurrently.
 * Dispatches via Promise.allSettled and deduplicates dynamic script injections.
 */
async function broadcastToTabs(message: unknown, activeOnly: boolean = false): Promise<void> {
  try {
    const queryOptions = activeOnly ? { active: true } : {};
    const tabs = await chrome.tabs.query(queryOptions);

    await Promise.allSettled(
      tabs.map(async (tab) => {
        if (!tab.id || isRestrictedUrl(tab.url)) return;

        try {
          await chrome.tabs.sendMessage(tab.id, message);
          injectedTabs.add(tab.id);
        } catch {
          // If message delivery fails, attempt injection once per tab lifecycle
          if (!injectedTabs.has(tab.id) && chrome.scripting) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
              });
              await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['content.css']
              });
              injectedTabs.add(tab.id);
              await chrome.tabs.sendMessage(tab.id, message);
            } catch {
              // Safe ignore on restricted, unloaded, or navigating tabs
            }
          }
        }
      })
    );
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
        await initSettingsPromise;
        let isCalibrated = false;
        try {
          const calData = await chrome.storage.local.get(CALIBRATION_KEY);
          isCalibrated = Boolean((calData?.[CALIBRATION_KEY] as { isCalibrated?: boolean } | undefined)?.isCalibrated);
        } catch {}

        // Verify if monitor tab actually exists
        const monitorUrl = chrome.runtime.getURL('monitor.html');
        let hasMonitorTab = false;
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
          try {
            const tabs = await chrome.tabs.query({});
            hasMonitorTab = tabs.some((t) => t.url && t.url.startsWith(monitorUrl));
          } catch {}
        }

        if (settings.monitoringActive && !hasMonitorTab) {
          settings.monitoringActive = false;
          isSuspendedDueToFocus = false;
          isInitializing = false;
          sequenceNumber = Math.max(Date.now(), sequenceNumber + 1);
          latestTelemetry.monitoringStatus = 'stopped';
          latestTelemetry.suspensionReason = null;
          latestTelemetry.alertLevel = 0;
          latestTelemetry.blurPx = 0;
          latestTelemetry.sequenceNumber = sequenceNumber;
          latestTelemetry.timestamp = Date.now();
          stopBreakTimer();
          persistTelemetrySnapshot();
        }

        const monitoringStatus: MonitoringStatus = !settings.monitoringActive
          ? 'stopped'
          : isSuspendedDueToFocus
          ? 'suspended'
          : isInitializing
          ? 'initializing'
          : 'running';

        const remainingMs = breakDueTimestamp !== null ? Math.max(0, breakDueTimestamp - Date.now()) : 0;
        const isCurrentlySuspended = monitoringStatus === 'suspended';

        sendResponse({
          type: 'STATUS_RESPONSE',
          monitoringActive: settings.monitoringActive,
          monitoringStatus,
          suspensionReason: isCurrentlySuspended ? (currentSuspensionReason ?? 'edge_unfocused') : null,
          isSuspended: isSuspendedDueToFocus,
          isEdgeAppFocused,
          sequenceNumber,
          timestamp: Date.now(),
          status: isCurrentlySuspended ? 'good' : latestTelemetry.status,
          severity: isCurrentlySuspended ? 0 : latestTelemetry.severity,
          intensity: isCurrentlySuspended ? 0 : latestTelemetry.intensity,
          debouncerState: isCurrentlySuspended ? 'idle' : latestTelemetry.debouncerState,
          accumulatingMs: isCurrentlySuspended ? 0 : latestTelemetry.accumulatingMs,
          holdMs: latestTelemetry.holdMs || settings.holdDurationSec * 1000,
          isAlertActive: isCurrentlySuspended ? false : isAlertActive,
          settings,
          isCalibrated,
          alertLevel: isCurrentlySuspended ? 0 : (latestTelemetry.alertLevel ?? 0),
          blurPx: isCurrentlySuspended ? 0 : (latestTelemetry.blurPx ?? 0),
          alertMessage: isCurrentlySuspended ? '' : (latestTelemetry.alertMessage ?? ''),
          blinkCount: latestTelemetry.blinkCount ?? 0,
          blinksPerMinute: isCurrentlySuspended ? null : (latestTelemetry.blinksPerMinute ?? null),
          blinkRateStatus: isCurrentlySuspended ? 'collecting' : (latestTelemetry.blinkRateStatus ?? 'collecting'),
          lowBlinkRate: isCurrentlySuspended ? false : (latestTelemetry.lowBlinkRate ?? false),
          faceDetected: isCurrentlySuspended ? false : (latestTelemetry.faceDetected ?? false),
          poseDetected: isCurrentlySuspended ? false : (latestTelemetry.poseDetected ?? false),
          personCount: isCurrentlySuspended ? 0 : (latestTelemetry.personCount ?? 0),
          observationProgress: isCurrentlySuspended ? 0 : (latestTelemetry.observationProgress ?? 0),
          trackingStatus: isCurrentlySuspended ? 'lost' : (latestTelemetry.trackingStatus ?? 'lost'),
          breakRemainingMs: remainingMs,
          isBreakActive: isCurrentlySuspended ? false : isBreakActive
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
      isSuspendedDueToFocus = false;
      isInitializing = true;
      sequenceNumber = Math.max(Date.now(), sequenceNumber + 1);
      latestTelemetry.monitoringStatus = 'initializing';
      latestTelemetry.suspensionReason = null;
      latestTelemetry.sequenceNumber = sequenceNumber;
      latestTelemetry.timestamp = Date.now();
      chrome.storage.local.set({ [SETTINGS_KEY]: settings }).catch(() => {});
      startBreakTimer();
      openOrFocusMonitorTab();
      broadcastToTabs({ type: 'MONITORING_STARTED' });
      sendResponse({ success: true, monitoringActive: true, monitoringStatus: 'initializing' });
      return false;
    }

    case 'STOP_MONITORING': {
      settings.monitoringActive = false;
      isSuspendedDueToFocus = false;
      currentSuspensionReason = null;
      isInitializing = false;
      sequenceNumber = Math.max(Date.now(), sequenceNumber + 1);
      if (focusDebounceTimeout !== null) {
        clearTimeout(focusDebounceTimeout);
        focusDebounceTimeout = null;
      }
      isAlertActive = false;
      latestTelemetry.monitoringStatus = 'stopped';
      latestTelemetry.suspensionReason = null;
      latestTelemetry.alertLevel = 0;
      latestTelemetry.blurPx = 0;
      latestTelemetry.alertMessage = '';
      latestTelemetry.lowBlinkRate = false;
      latestTelemetry.sequenceNumber = sequenceNumber;
      latestTelemetry.timestamp = Date.now();
      stopBreakTimer();
      chrome.storage.local.set({ [SETTINGS_KEY]: settings }).catch(() => {});
      broadcastToTabs({ type: 'MONITORING_STOPPED' }, false);
      notifyMonitorLifecycle('STOP');
      sendResponse({ success: true, monitoringActive: false, monitoringStatus: 'stopped' });
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

      // Forward settings update to monitor tab(s)
      const monitorUrl = chrome.runtime.getURL('monitor.html');
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id && tab.url && tab.url.startsWith(monitorUrl)) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'UPDATE_SETTINGS',
                settings: msg.settings
              }).catch(() => {});
            }
          });
        });
      }

      // If break interval changed while monitoring active, reschedule break timer
      if (settings.monitoringActive && msg.settings.breakIntervalMin && msg.settings.breakIntervalMin !== wasInterval) {
        startBreakTimer(settings.breakIntervalMin * 60 * 1000);
      }

      sendResponse({ success: true, settings });
      return false;
    }

    case 'POSTURE_TELEMETRY': {
      // Guard 1: Reject telemetry if monitoring was stopped by user
      if (!settings.monitoringActive) {
        return false;
      }
      // Guard 2: Reject live telemetry if monitoring is currently suspended due to Edge focus loss
      if (isSuspendedDueToFocus) {
        return false;
      }

      if (msg.payload) {
        if (msg.payload.timestamp && msg.payload.timestamp < latestTelemetry.timestamp) {
          return false;
        }
        if (msg.payload.sequenceNumber !== undefined && msg.payload.sequenceNumber < sequenceNumber) {
          return false;
        }

        sequenceNumber = Math.max(Date.now(), sequenceNumber + 1, (msg.payload.sequenceNumber ?? 0) + 1);
        isInitializing = false;

        latestTelemetry = {
          ...latestTelemetry,
          ...msg.payload,
          monitoringStatus: 'running',
          suspensionReason: null,
          sequenceNumber
        };
        persistTelemetrySnapshot();
      }
      return false;
    }

    case 'PROGRESSIVE_ALERT_UPDATE': {
      if (!settings.monitoringActive) return false;
      isAlertActive = msg.alertLevel > 0;
      latestTelemetry.alertLevel = msg.alertLevel;
      latestTelemetry.blurPx = msg.blurPx;
      latestTelemetry.alertMessage = msg.message;
      persistTelemetrySnapshot();

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
      persistTelemetrySnapshot();
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
      persistTelemetrySnapshot();
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
      persistTelemetrySnapshot();
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
        injectedTabs.add(activeInfo.tabId);
      } catch {
        if (chrome.scripting && activeInfo.tabId && !injectedTabs.has(activeInfo.tabId)) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeInfo.tabId },
              files: ['content.js']
            });
            await chrome.scripting.insertCSS({
              target: { tabId: activeInfo.tabId },
              files: ['content.css']
            });
            injectedTabs.add(activeInfo.tabId);
            await chrome.tabs.sendMessage(activeInfo.tabId, {
              type: 'APPLY_PROGRESSIVE_BLUR',
              alertLevel: latestTelemetry.alertLevel ?? 1,
              blurPx: latestTelemetry.blurPx ?? 3,
              message: latestTelemetry.alertMessage || 'Please adjust your posture to unblur.',
              status: latestTelemetry.status,
              soundEnabled: false,
              isRecovering: false
            });
          } catch {}
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
        injectedTabs.add(activeInfo.tabId);
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
        injectedTabs.add(activeInfo.tabId);
      } catch {}
    }
  } catch {
    // Safe ignore
  }
});

// Tab Updated: Ensure blur and active cards are applied when a tab finishes reloading or navigating
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    injectedTabs.delete(tabId);
    return;
  }
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
      injectedTabs.add(tabId);
    } catch {
      if (chrome.scripting && tabId && !injectedTabs.has(tabId)) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          });
          await chrome.scripting.insertCSS({
            target: { tabId },
            files: ['content.css']
          });
          injectedTabs.add(tabId);
          await chrome.tabs.sendMessage(tabId, {
            type: 'APPLY_PROGRESSIVE_BLUR',
            alertLevel: latestTelemetry.alertLevel ?? 1,
            blurPx: latestTelemetry.blurPx ?? 3,
            message: latestTelemetry.alertMessage || 'Please adjust your posture to unblur.',
            status: latestTelemetry.status,
            soundEnabled: false,
            isRecovering: false
          });
        } catch {}
      }
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
      injectedTabs.add(tabId);
    } catch {}
  }

  if (isBreakActive) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'BREAK_REMINDER',
        message: "You've been looking at a screen for a while. Take a short break, look into the distance, stretch, and relax your eyes.",
        intervalMinutes: settings.breakIntervalMin || 30
      });
      injectedTabs.add(tabId);
    } catch {}
  }
});
