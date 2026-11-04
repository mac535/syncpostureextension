import React, { useEffect, useState, useRef } from 'react';
import type { PostureStatus } from '../lib/posture/postureClassifier';
import type { DebouncerState } from '../lib/posture/temporalDebounce';
import type { MonitoringStatus, PostureSettings } from '../extension/types';
import { DEFAULT_SETTINGS } from '../extension/types';
import { loadBaseline, clearBaseline, type PostureBaseline } from '../lib/posture/calibration';
import { playPostureChime } from '../lib/audio/chime';
import {
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Sliders,
  ShieldCheck,
  Camera,
  CheckCircle2,
  ExternalLink,
  Play,
  Square,
  Sparkles,
  Info,
  Coffee
} from 'lucide-react';

export const Popup: React.FC = () => {
  const [monitoringActive, setMonitoringActive] = useState<boolean>(false);
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus>('stopped');
  const [status, setStatus] = useState<PostureStatus>('good');
  const [intensity, setIntensity] = useState<number>(0);
  const [debouncerState, setDebouncerState] = useState<DebouncerState>('idle');
  const [accumulatingMs, setAccumulatingMs] = useState<number>(0);
  const [holdMs, setHoldMs] = useState<number>(10000);
  const [isAlertActive, setIsAlertActive] = useState<boolean>(false);
  const [settings, setSettings] = useState<PostureSettings>(DEFAULT_SETTINGS);
  const [baseline, setBaseline] = useState<PostureBaseline | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Progressive Blur & Real-Time Blink Tracking State
  const [alertLevel, setAlertLevel] = useState<number>(0);
  const [blurPx, setBlurPx] = useState<number>(0);
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [blinkCount, setBlinkCount] = useState<number>(0);
  const [blinksPerMinute, setBlinksPerMinute] = useState<number | null>(null);
  const [blinkRateStatus, setBlinkRateStatus] = useState<'collecting' | 'normal' | 'low'>('collecting');
  const [poseDetected, setPoseDetected] = useState<boolean>(false);
  const [observationProgress, setObservationProgress] = useState<number>(0);
  const [trackingStatus, setTrackingStatus] = useState<'reliable' | 'unreliable' | 'lost'>('lost');
  const [breakRemainingMs, setBreakRemainingMs] = useState<number>(0);
  const [isBreakActive, setIsBreakActive] = useState<boolean>(false);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [isSuspended, setIsSuspended] = useState<boolean>(false);

  // Freshness and monotonic sequence guards to reject out-of-order messages
  const latestSequenceRef = useRef<number>(0);
  const latestTimestampRef = useRef<number>(0);

  // Event-driven state updates with relaxed bounded refresh (2500ms fallback)
  useEffect(() => {
    function applyStatusResponse(res: any) {
      if (!res || res.type !== 'STATUS_RESPONSE') return;

      // Reject out-of-order status responses
      if (typeof res.sequenceNumber === 'number' && res.sequenceNumber < latestSequenceRef.current) return;
      if (typeof res.timestamp === 'number' && res.timestamp < latestTimestampRef.current) return;
      if (typeof res.sequenceNumber === 'number') latestSequenceRef.current = res.sequenceNumber;
      if (typeof res.timestamp === 'number') latestTimestampRef.current = res.timestamp;

      if (typeof res.monitoringActive === 'boolean') setMonitoringActive(res.monitoringActive);

      const isSuspendedVal = Boolean(res.isSuspended || res.monitoringStatus === 'suspended');
      setIsSuspended(isSuspendedVal);

      const mStatus: MonitoringStatus =
        res.monitoringStatus ||
        (isSuspendedVal ? 'suspended' : res.monitoringActive ? 'running' : 'stopped');
      setMonitoringStatus(mStatus);

      if (res.status) setStatus(res.status);
      if (typeof res.intensity === 'number') setIntensity(res.intensity);
      if (res.debouncerState) setDebouncerState(res.debouncerState);
      if (typeof res.accumulatingMs === 'number') setAccumulatingMs(res.accumulatingMs);
      if (typeof res.holdMs === 'number') setHoldMs(res.holdMs);
      if (typeof res.isAlertActive === 'boolean') setIsAlertActive(res.isAlertActive);
      if (res.settings) setSettings(res.settings);
      if (res.alertLevel !== undefined) setAlertLevel(res.alertLevel);
      if (res.blurPx !== undefined) setBlurPx(res.blurPx);
      if (res.alertMessage !== undefined) setAlertMessage(res.alertMessage);
      if (res.blinkCount !== undefined) setBlinkCount(res.blinkCount);
      if (res.blinksPerMinute !== undefined) setBlinksPerMinute(res.blinksPerMinute);
      if (res.blinkRateStatus) setBlinkRateStatus(res.blinkRateStatus);
      if (res.poseDetected !== undefined) setPoseDetected(res.poseDetected);
      if (res.observationProgress !== undefined) setObservationProgress(res.observationProgress);
      if (res.trackingStatus !== undefined) setTrackingStatus(res.trackingStatus);
      if (res.breakRemainingMs !== undefined) setBreakRemainingMs(res.breakRemainingMs);
      if (res.isBreakActive !== undefined) setIsBreakActive(res.isBreakActive);
    }

    async function fetchStatus() {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
            if (chrome.runtime.lastError) return;
            applyStatusResponse(res);
          });
        } catch {
          // Ignore polling errors
        }
      }
    }

    // 1. Initial snapshot fetch on popup open
    fetchStatus();

    // 2. Load baseline calibration
    loadBaseline().then((b) => {
      if (b.isCalibrated) setBaseline(b);
    });

    // 3. Event-driven message listener for push updates
    const handleRuntimeMessage = (message: any) => {
      if (!message || !message.type) return;

      switch (message.type) {
        case 'POSTURE_TELEMETRY': {
          const payload = message.payload || message;
          if (typeof payload.sequenceNumber === 'number' && payload.sequenceNumber < latestSequenceRef.current) return;
          if (typeof payload.timestamp === 'number' && payload.timestamp < latestTimestampRef.current) return;
          if (typeof payload.sequenceNumber === 'number') latestSequenceRef.current = payload.sequenceNumber;
          if (typeof payload.timestamp === 'number') latestTimestampRef.current = payload.timestamp;

          const mStatus: MonitoringStatus =
            payload.monitoringStatus || (payload.isSuspended ? 'suspended' : 'running');
          setMonitoringStatus(mStatus);
          setIsSuspended(mStatus === 'suspended');
          setMonitoringActive(mStatus !== 'stopped');

          if (payload.status) setStatus(payload.status);
          if (typeof payload.intensity === 'number') setIntensity(payload.intensity);
          if (typeof payload.poseDetected === 'boolean') setPoseDetected(payload.poseDetected);
          if (payload.debouncerState) setDebouncerState(payload.debouncerState);
          if (typeof payload.accumulatingMs === 'number') {
            setAccumulatingMs(payload.accumulatingMs);
          }
          if (typeof payload.holdMs === 'number') {
            setHoldMs(payload.holdMs);
          }
          if (typeof payload.alertLevel === 'number') {
            setAlertLevel(payload.alertLevel);
            setIsAlertActive(payload.alertLevel > 0);
          }
          if (typeof payload.blurPx === 'number') setBlurPx(payload.blurPx);
          if (typeof payload.alertMessage === 'string') setAlertMessage(payload.alertMessage);

          if (typeof payload.blinkCount === 'number') {
            setBlinkCount(payload.blinkCount);
          }
          if (payload.blinksPerMinute !== undefined) {
            setBlinksPerMinute(payload.blinksPerMinute);
          }
          if (payload.blinkRateStatus) {
            setBlinkRateStatus(payload.blinkRateStatus);
          }
          if (typeof payload.observationProgress === 'number') {
            setObservationProgress(payload.observationProgress);
          }
          if (payload.trackingStatus) {
            setTrackingStatus(payload.trackingStatus);
          }
          break;
        }

        case 'PROGRESSIVE_ALERT_UPDATE':
          if (typeof message.level === 'number') setAlertLevel(message.level);
          if (typeof message.blurPx === 'number') setBlurPx(message.blurPx);
          if (typeof message.message === 'string') setAlertMessage(message.message);
          setIsAlertActive(message.level > 0);
          break;

        case 'POSTURE_RESTORED':
          setAlertLevel(0);
          setBlurPx(0);
          setAlertMessage('');
          setIsAlertActive(false);
          setStatus('good');
          break;

        case 'MONITORING_STARTED':
          setMonitoringActive(true);
          setMonitoringStatus('initializing');
          setIsSuspended(false);
          break;

        case 'MONITORING_STOPPED':
          setMonitoringActive(false);
          setMonitoringStatus('stopped');
          setIsSuspended(false);
          break;

        case 'BREAK_REMINDER':
          setIsBreakActive(true);
          break;

        case 'BREAK_REMINDER_CLEARED':
          setIsBreakActive(false);
          break;

        case 'APPLICATION_FOCUS_LIFECYCLE': {
          if (typeof message.sequenceNumber === 'number' && message.sequenceNumber < latestSequenceRef.current) return;
          if (typeof message.timestamp === 'number' && message.timestamp < latestTimestampRef.current) return;
          if (typeof message.sequenceNumber === 'number') latestSequenceRef.current = message.sequenceNumber;
          if (typeof message.timestamp === 'number') latestTimestampRef.current = message.timestamp;

          if (message.action === 'SUSPEND') {
            setIsSuspended(true);
            setMonitoringStatus('suspended');
            setBlinksPerMinute(null);
            setIntensity(0);
            setAlertLevel(0);
            setBlurPx(0);
            setAlertMessage('');
            setIsAlertActive(false);
          } else if (message.action === 'RESUME') {
            setIsSuspended(false);
            setMonitoringStatus('initializing');
          } else if (message.action === 'STOP') {
            setIsSuspended(false);
            setMonitoringActive(false);
            setMonitoringStatus('stopped');
          }
          break;
        }

        case 'UPDATE_SETTINGS':
          if (message.settings) {
            setSettings((prev) => ({ ...prev, ...message.settings }));
          }
          break;

        case 'CALIBRATION_COMPLETED':
          loadBaseline().then((b) => {
            if (b.isCalibrated) setBaseline(b);
          });
          break;
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    }

    // 4. Bounded fallback refresh every 2500ms
    const fallbackInterval = setInterval(fetchStatus, 2500);

    return () => {
      clearInterval(fallbackInterval);
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      }
    };
  }, []);

  const handleToggleMonitoring = () => {
    const nextState = !monitoringActive;
    setMonitoringActive(nextState);
    if (!nextState) {
      setMonitoringStatus('stopped');
      setIsSuspended(false);
    } else {
      setMonitoringStatus('initializing');
      setIsSuspended(false);
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: nextState ? 'START_MONITORING' : 'STOP_MONITORING'
      });
    }
  };

  const handleOpenMonitor = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_MONITOR_PAGE' });
    } else {
      window.open('/monitor.html', '_blank');
    }
  };

  const handleTriggerQuickCalibrate = () => {
    setIsCalibrating(true);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'TRIGGER_CALIBRATION_FROM_POPUP' });
      setTimeout(() => {
        setIsCalibrating(false);
        loadBaseline().then((b) => {
          if (b.isCalibrated) {
            setBaseline(b);
            setMessage('Upright posture calibrated successfully!');
            setTimeout(() => setMessage(null), 3000);
          }
        });
      }, 1000);
    }
  };

  const handleUpdateDuration = (sec: number) => {
    const updated = { ...settings, holdDurationSec: sec };
    setSettings(updated);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { holdDurationSec: sec }
      });
    }
  };

  const handleToggleBlur = () => {
    const updated = { ...settings, blurEnabled: !settings.blurEnabled };
    setSettings(updated);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { blurEnabled: updated.blurEnabled }
      });
    }
  };

  const handleToggleSound = () => {
    const updated = { ...settings, soundEnabled: !settings.soundEnabled };
    setSettings(updated);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { soundEnabled: updated.soundEnabled }
      });
    }
    if (updated.soundEnabled) {
      playPostureChime(0.12);
    }
  };

  const handleResetCalibration = async () => {
    await clearBaseline();
    setBaseline(null);
    setMessage('Baseline reset to default reference');
    setTimeout(() => setMessage(null), 2500);
  };

  const handleUpdateBreakInterval = (min: number) => {
    const updated = { ...settings, breakIntervalMin: min };
    setSettings(updated);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { breakIntervalMin: min }
      });
    }
    setMessage(`Break interval set to ${min} minute${min > 1 ? 's' : ''}`);
    setTimeout(() => setMessage(null), 2500);
  };

  const handleUpdateBlinkObservation = (sec: number) => {
    const updated = { ...settings, blinkObservationPeriodSec: sec };
    setSettings(updated);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { blinkObservationPeriodSec: sec }
      });
    }
    setMessage(`Blink observation window set to ${sec}s`);
    setTimeout(() => setMessage(null), 2500);
  };

  const handleDismissBreak = () => {
    setIsBreakActive(false);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'DISMISS_BREAK_REMINDER' });
    }
  };

  const handleSnoozeBreak = (snoozeMin: number = 5) => {
    setIsBreakActive(false);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'SNOOZE_BREAK_REMINDER', snoozeMin });
    }
    setMessage(`Break reminder snoozed for ${snoozeMin}m`);
    setTimeout(() => setMessage(null), 2500);
  };

  const formatRemainingTime = (ms: number) => {
    if (ms <= 0) return '00:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}m ${sec < 10 ? '0' : ''}${sec}s`;
  };

  // Status badge details
  const getStatusBadge = () => {
    if (monitoringStatus === 'stopped' || !monitoringActive) {
      return {
        label: 'MONITORING PAUSED',
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.1)',
        border: 'rgba(148, 163, 184, 0.25)'
      };
    }
    if (monitoringStatus === 'suspended' || isSuspended) {
      return {
        label: 'SUSPENDED (EDGE UNFOCUSED)',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.15)',
        border: 'rgba(56, 189, 248, 0.35)'
      };
    }
    if (monitoringStatus === 'initializing') {
      return {
        label: 'INITIALIZING SENSORS...',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.15)',
        border: 'rgba(56, 189, 248, 0.35)'
      };
    }
    const isLean = status === 'leaning';
    if (alertLevel === 3 || (isAlertActive && alertLevel === 0)) {
      return {
        label: isLean ? 'PERSISTENT LEAN (11px BLUR)' : 'PERSISTENT SLOUCH (11px BLUR)',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.2)',
        border: 'rgba(239, 68, 68, 0.5)'
      };
    }
    if (alertLevel === 2) {
      return {
        label: isLean ? 'CONTINUED LEAN (6px BLUR)' : 'CONTINUED SLOUCH (6px BLUR)',
        color: '#f97316',
        bg: 'rgba(249, 115, 22, 0.2)',
        border: 'rgba(249, 115, 22, 0.45)'
      };
    }
    if (alertLevel === 1) {
      return {
        label: isLean ? 'INITIAL LEAN (3px BLUR)' : 'INITIAL SLOUCH (3px BLUR)',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.18)',
        border: 'rgba(245, 158, 11, 0.4)'
      };
    }
    if (debouncerState === 'accumulating') {
      const sec = (accumulatingMs / 1000).toFixed(1);
      const totalSec = (holdMs / 1000).toFixed(0);
      return {
        label: `DEVIATION DETECTED (${sec}s / ${totalSec}s)`,
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.12)',
        border: 'rgba(251, 191, 36, 0.35)'
      };
    }
    if (debouncerState === 'recovering') {
      return {
        label: 'RECOVERING POSTURE',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.12)',
        border: 'rgba(56, 189, 248, 0.35)'
      };
    }
    return {
      label: poseDetected ? 'GOOD POSTURE' : 'READY — SEARCHING SKELETON',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.35)'
    };
  };

  const badge = getStatusBadge();
  const isLiveMonitoring = monitoringStatus === 'running' && !isSuspended;
  const deviationPercent = isLiveMonitoring ? Math.min(100, Math.round(intensity * 100)) : 0;

  return (
    <div
      style={{
        width: '390px',
        backgroundColor: '#0a0f1d',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '16px',
        boxSizing: 'border-box',
        userSelect: 'none'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '12px',
          marginBottom: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: isLiveMonitoring ? '#10b981' : monitoringStatus === 'suspended' ? '#38bdf8' : '#64748b',
              boxShadow: isLiveMonitoring ? '0 0 10px #10b981' : monitoringStatus === 'suspended' ? '0 0 8px #38bdf8' : 'none'
            }}
          />
          <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0, letterSpacing: '0.02em' }}>
            PostureSync
          </h1>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              fontWeight: 600
            }}
          >
            v1.0 MV3
          </span>
        </div>

        <button
          onClick={handleOpenMonitor}
          title="Open Camera & Live Skeleton Monitor"
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#94a3b8',
            borderRadius: '6px',
            padding: '5px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f8fafc';
            e.currentTarget.style.borderColor = '#38bdf8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
        >
          <Camera size={13} />
          <span>Monitor</span>
          <ExternalLink size={11} />
        </button>
      </div>

      {/* Main Monitoring Action Card */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Posture Status
            </div>
            <div
              style={{
                display: 'inline-block',
                marginTop: '4px',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                color: badge.color,
                backgroundColor: badge.bg,
                border: `1px solid ${badge.border}`
              }}
            >
              {badge.label}
            </div>
            {alertMessage && alertLevel > 0 && isLiveMonitoring && (
              <div style={{ fontSize: '10px', color: '#fca5a5', marginTop: '4px', maxWidth: '210px', lineHeight: 1.3 }}>
                {alertMessage}
              </div>
            )}
          </div>

          <button
            onClick={handleToggleMonitoring}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              color: '#ffffff',
              backgroundColor: monitoringActive ? '#e11d48' : '#0284c7',
              boxShadow: monitoringActive ? '0 0 15px rgba(225, 29, 72, 0.35)' : '0 0 15px rgba(2, 132, 199, 0.35)',
              transition: 'background 0.2s ease'
            }}
          >
            {monitoringActive ? (
              <>
                <Square size={13} fill="#fff" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play size={13} fill="#fff" />
                <span>Start</span>
              </>
            )}
          </button>
        </div>

        {/* Live Deviation Score Meter */}
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            <span>Posture Deviation</span>
            <span style={{ fontWeight: 600, color: !isLiveMonitoring ? '#94a3b8' : deviationPercent > 30 ? '#f43f5e' : '#10b981' }}>
              {monitoringStatus === 'suspended'
                ? '―% (Paused)'
                : monitoringStatus === 'initializing'
                ? '―% (Initializing)'
                : monitoringStatus === 'stopped'
                ? '0%'
                : `${deviationPercent}%`}
            </span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                width: isLiveMonitoring ? `${deviationPercent}%` : '0%',
                height: '100%',
                backgroundColor: deviationPercent > 40 ? '#f43f5e' : deviationPercent > 20 ? '#fbbf24' : '#10b981',
                transition: 'width 0.3s ease, background-color 0.3s ease'
              }}
            />
          </div>
        </div>
      </div>

      {/* Real-Time Blink Tracking Card */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={14} color="#38bdf8" />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Eye & Blink Tracking</span>
          </div>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              padding: '2px 6px',
              borderRadius: '4px',
              background:
                monitoringStatus === 'suspended'
                  ? 'rgba(56, 189, 248, 0.15)'
                  : monitoringStatus === 'initializing'
                  ? 'rgba(56, 189, 248, 0.15)'
                  : monitoringStatus === 'stopped'
                  ? 'rgba(148, 163, 184, 0.15)'
                  : trackingStatus === 'reliable'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : trackingStatus === 'unreliable'
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(148, 163, 184, 0.15)',
              color:
                monitoringStatus === 'suspended'
                  ? '#38bdf8'
                  : monitoringStatus === 'initializing'
                  ? '#38bdf8'
                  : monitoringStatus === 'stopped'
                  ? '#94a3b8'
                  : trackingStatus === 'reliable'
                  ? '#10b981'
                  : trackingStatus === 'unreliable'
                  ? '#f59e0b'
                  : '#94a3b8',
              fontWeight: 600
            }}
          >
            {monitoringStatus === 'suspended'
              ? 'Paused (App Inactive)'
              : monitoringStatus === 'initializing'
              ? 'Initializing Sensors...'
              : monitoringStatus === 'stopped'
              ? 'Sensor Offline'
              : trackingStatus === 'reliable'
              ? 'Reliable Tracking'
              : trackingStatus === 'unreliable'
              ? 'Poor Lighting/Angle'
              : 'Searching Face...'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
          <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Blink Rate</div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color:
                  !isLiveMonitoring
                    ? '#94a3b8'
                    : blinksPerMinute !== null && blinksPerMinute < (settings.lowBlinkRateThreshold || 10)
                    ? '#ef4444'
                    : '#38bdf8',
                marginTop: '2px'
              }}
            >
              {monitoringStatus === 'suspended'
                ? '― bpm'
                : monitoringStatus === 'initializing'
                ? '― bpm'
                : monitoringStatus === 'stopped'
                ? '― bpm'
                : blinksPerMinute !== null
                ? `${blinksPerMinute} bpm`
                : `${Math.round(observationProgress * 100)}% sampled`}
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
              {monitoringStatus === 'suspended'
                ? 'Unavailable (Suspended)'
                : monitoringStatus === 'initializing'
                ? 'Initializing sensor...'
                : monitoringStatus === 'stopped'
                ? 'Monitoring paused'
                : blinksPerMinute !== null
                ? blinkRateStatus === 'low'
                  ? `Low rate (<${settings.lowBlinkRateThreshold || 10} bpm)`
                  : 'Normal rate (12-20 bpm)'
                : 'Collecting observations'}
            </div>
          </div>

          <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Blinks Counted</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
              {blinkCount} <span style={{ fontSize: '10px', fontWeight: 400, color: '#94a3b8' }}>blinks</span>
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
              {monitoringStatus === 'suspended'
                ? 'Paused Session Total'
                : monitoringStatus === 'initializing'
                ? 'Session Total'
                : monitoringStatus === 'stopped'
                ? 'Historical Session Total'
                : 'Real EAR Open-Close Cycle'}
            </div>
          </div>
        </div>

        {/* Observation Progress Bar (during initial window or paused display) */}
        {isLiveMonitoring && blinkRateStatus === 'collecting' && (
          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: '#94a3b8',
                marginBottom: '3px'
              }}
            >
              <span>Observation Period ({settings.blinkObservationPeriodSec || 120}s)</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                {Math.round(observationProgress * 100)}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '4px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${Math.round(observationProgress * 100)}%`,
                  height: '100%',
                  backgroundColor: '#38bdf8',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        )}
        {monitoringStatus === 'suspended' && (
          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: '#94a3b8',
                marginBottom: '3px'
              }}
            >
              <span>Observation Window ({settings.blinkObservationPeriodSec || 120}s)</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>Paused (Edge Unfocused)</span>
            </div>
          </div>
        )}

        {/* Blink Observation Duration Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>Observation Window</span>
          <div style={{ display: 'flex', gap: '3px' }}>
            {[
              { sec: 15, label: '15s (Test)' },
              { sec: 60, label: '60s' },
              { sec: 120, label: '2m (Def)' }
            ].map(({ sec, label }) => (
              <button
                key={sec}
                onClick={() => handleUpdateBlinkObservation(sec)}
                style={{
                  background:
                    (settings.blinkObservationPeriodSec || 120) === sec
                      ? '#0284c7'
                      : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${
                    (settings.blinkObservationPeriodSec || 120) === sec
                      ? '#38bdf8'
                      : 'rgba(255, 255, 255, 0.1)'
                  }`,
                  color: (settings.blinkObservationPeriodSec || 120) === sec ? '#fff' : '#94a3b8',
                  borderRadius: '3px',
                  padding: '2px 5px',
                  fontSize: '9.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Screen Session Break Reminder Card */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Coffee size={14} color="#f59e0b" />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Screen Session Break</span>
          </div>
          <span
            style={{
              fontSize: '10.5px',
              fontFamily: 'monospace',
              padding: '2px 6px',
              borderRadius: '4px',
              background: isBreakActive
                ? 'rgba(239, 68, 68, 0.25)'
                : monitoringStatus === 'suspended'
                ? 'rgba(56, 189, 248, 0.15)'
                : isLiveMonitoring
                ? 'rgba(56, 189, 248, 0.15)'
                : 'rgba(148, 163, 184, 0.15)',
              color: isBreakActive
                ? '#ef4444'
                : monitoringStatus === 'suspended'
                ? '#38bdf8'
                : isLiveMonitoring
                ? '#38bdf8'
                : '#94a3b8',
              fontWeight: 700
            }}
          >
            {isBreakActive
              ? 'BREAK DUE!'
              : monitoringStatus === 'suspended'
              ? `${formatRemainingTime(breakRemainingMs)} (Paused)`
              : monitoringStatus === 'initializing'
              ? `${formatRemainingTime(breakRemainingMs)} (Resuming)`
              : isLiveMonitoring
              ? formatRemainingTime(breakRemainingMs)
              : 'Timer Inactive'}
          </span>
        </div>

        {isBreakActive && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '6px',
              padding: '8px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px'
            }}
          >
            <span style={{ fontSize: '10.5px', color: '#fca5a5' }}>
              Break alert active on active tabs!
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={handleDismissBreak}
                style={{
                  background: '#10b981',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
              <button
                onClick={() => handleSnoozeBreak(5)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#cbd5e1',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                Snooze 5m
              </button>
            </div>
          </div>
        )}

        {/* Break Interval Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Break Interval</span>
          <div style={{ display: 'flex', gap: '3px' }}>
            {[
              { min: 1, label: '1m (Test)' },
              { min: 15, label: '15m' },
              { min: 30, label: '30m (Def)' },
              { min: 60, label: '60m' }
            ].map(({ min, label }) => (
              <button
                key={min}
                onClick={() => handleUpdateBreakInterval(min)}
                style={{
                  background:
                    (settings.breakIntervalMin || 30) === min
                      ? '#0284c7'
                      : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${
                    (settings.breakIntervalMin || 30) === min
                      ? '#38bdf8'
                      : 'rgba(255, 255, 255, 0.1)'
                  }`,
                  color: (settings.breakIntervalMin || 30) === min ? '#fff' : '#94a3b8',
                  borderRadius: '4px',
                  padding: '3px 6px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progressive Blur & Escalation Status */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="#f59e0b" />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Progressive Webpage Blur</span>
          </div>
          <span
            style={{
              fontSize: '10.5px',
              fontFamily: 'monospace',
              padding: '2px 6px',
              borderRadius: '4px',
              background:
                monitoringStatus === 'suspended'
                  ? 'rgba(56, 189, 248, 0.15)'
                  : isLiveMonitoring && blurPx > 0
                  ? 'rgba(244, 63, 94, 0.2)'
                  : 'rgba(16, 185, 129, 0.15)',
              color:
                monitoringStatus === 'suspended'
                  ? '#38bdf8'
                  : isLiveMonitoring && blurPx > 0
                  ? '#f43f5e'
                  : '#10b981',
              fontWeight: 700
            }}
          >
            {monitoringStatus === 'suspended'
              ? '0px (Suspended)'
              : !isLiveMonitoring
              ? '0px (Clear)'
              : blurPx > 0
              ? `${blurPx}px Active`
              : '0px (Clear)'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
          <div style={{ flex: 1, padding: '5px', borderRadius: '4px', background: isLiveMonitoring && alertLevel >= 1 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.04)', border: `1px solid ${isLiveMonitoring && alertLevel >= 1 ? '#f59e0b' : 'transparent'}`, textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#94a3b8' }}>Level 1</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: isLiveMonitoring && alertLevel >= 1 ? '#f59e0b' : '#64748b' }}>3px</div>
          </div>
          <div style={{ flex: 1, padding: '5px', borderRadius: '4px', background: isLiveMonitoring && alertLevel >= 2 ? 'rgba(249, 115, 22, 0.25)' : 'rgba(255, 255, 255, 0.04)', border: `1px solid ${isLiveMonitoring && alertLevel >= 2 ? '#f97316' : 'transparent'}`, textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#94a3b8' }}>Level 2</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: isLiveMonitoring && alertLevel >= 2 ? '#f97316' : '#64748b' }}>6px</div>
          </div>
          <div style={{ flex: 1, padding: '5px', borderRadius: '4px', background: isLiveMonitoring && alertLevel >= 3 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.04)', border: `1px solid ${isLiveMonitoring && alertLevel >= 3 ? '#ef4444' : 'transparent'}`, textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#94a3b8' }}>Level 3</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: isLiveMonitoring && alertLevel >= 3 ? '#ef4444' : '#64748b' }}>11px</div>
          </div>
        </div>
      </div>

      {/* Posture Calibration Section */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {baseline ? <CheckCircle2 size={14} color="#10b981" /> : <Sliders size={14} color="#38bdf8" />}
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Ergonomic Calibration</span>
          </div>
          <span style={{ fontSize: '10px', color: baseline ? '#10b981' : '#94a3b8' }}>
            {baseline ? 'Calibrated' : 'Default Model'}
          </span>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '6px 0 10px', lineHeight: 1.4 }}>
          {baseline
            ? `Baseline active. Posture deviations measured relative to your calibrated upright spine.`
            : `Sit upright comfortably and click below to calibrate your baseline.`}
        </p>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleTriggerQuickCalibrate}
            disabled={isCalibrating}
            style={{
              flex: 1,
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              borderRadius: '5px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isCalibrating ? 'wait' : 'pointer'
            }}
          >
            {isCalibrating ? 'Calibrating...' : 'Calibrate Upright Posture'}
          </button>
          {baseline && (
            <button
              onClick={handleResetCalibration}
              title="Reset to default baseline"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                borderRadius: '5px',
                padding: '6px 10px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Intervention Controls */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '12px'
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>Intervention Controls</div>

        {/* Sustained Hold Threshold */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Sustained Alert Delay</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[5, 10, 15, 20].map((sec) => (
              <button
                key={sec}
                onClick={() => handleUpdateDuration(sec)}
                style={{
                  background: settings.holdDurationSec === sec ? '#0284c7' : 'rgba(255, 255, 255, 0.06)',
                  border: `1px solid ${settings.holdDurationSec === sec ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: settings.holdDurationSec === sec ? '#fff' : '#94a3b8',
                  borderRadius: '4px',
                  padding: '3px 7px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Tab Blur Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {settings.blurEnabled ? <Eye size={13} color="#38bdf8" /> : <EyeOff size={13} color="#64748b" />}
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Progressive Tab Blur</span>
          </div>
          <button
            onClick={handleToggleBlur}
            style={{
              width: '36px',
              height: '20px',
              borderRadius: '10px',
              background: settings.blurEnabled ? '#0284c7' : 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s ease',
              padding: '2px'
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                transform: settings.blurEnabled ? 'translateX(16px)' : 'translateX(0)',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>
        </div>

        {/* Audio Chime Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {settings.soundEnabled ? <Volume2 size={13} color="#38bdf8" /> : <VolumeX size={13} color="#64748b" />}
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Gentle Audio Chime</span>
          </div>
          <button
            onClick={handleToggleSound}
            style={{
              width: '36px',
              height: '20px',
              borderRadius: '10px',
              background: settings.soundEnabled ? '#0284c7' : 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s ease',
              padding: '2px'
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                transform: settings.soundEnabled ? 'translateX(16px)' : 'translateX(0)',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>
        </div>
      </div>

      {/* Temporary status message */}
      {message && (
        <div
          style={{
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid #38bdf8',
            color: '#38bdf8',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '11px',
            textAlign: 'center',
            marginBottom: '10px'
          }}
        >
          {message}
        </div>
      )}

      {/* Website Support Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 10px',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '6px',
          fontSize: '10.5px',
          color: '#7dd3fc',
          lineHeight: 1.3,
          marginBottom: '8px'
        }}
      >
        <Info size={14} style={{ flexShrink: 0 }} />
        <span>Works across regular websites (HTTP & HTTPS). Browser security restricts extension injection on chrome:// and edge:// system pages.</span>
      </div>

      {/* Privacy Notice Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 10px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '6px',
          fontSize: '10.5px',
          color: '#6ee7b7',
          lineHeight: 1.3
        }}
      >
        <ShieldCheck size={14} style={{ flexShrink: 0 }} />
        <span>100% on-device AI. Video frames are never recorded, uploaded, or transmitted.</span>
      </div>
    </div>
  );
};
