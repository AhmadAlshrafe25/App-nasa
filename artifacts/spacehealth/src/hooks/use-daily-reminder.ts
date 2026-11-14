import { useCallback, useEffect, useState } from 'react';
import {
  defaultReminder, hasLogForDay, localDay, logChangedEvent, readEntries,
  readReminder, reminderDue, reminderMessage, reminderStorageKey, logDayMarkerKey, type DailyReminder,
} from '@/lib/daily-log';

export function useDailyReminder() {
  const [settings, setSettings] = useState<DailyReminder>(defaultReminder);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState('');
  const [today, setToday] = useState(localDay());
  const [voiceStatus, setVoiceStatus] = useState('');
  const [notificationStatus, setNotificationStatus] = useState('');

  const speak = useCallback(() => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setVoiceStatus('No device voice available. The visual reminder still works.');
      return;
    }
    const voices = window.speechSynthesis.getVoices().filter(voice => voice.localService);
    const voice = voices.find(voice => voice.lang.startsWith('en')) || voices[0];
    if (!voice) {
      setVoiceStatus('No offline voice available. The visual reminder still works.');
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(reminderMessage);
      speech.voice = voice;
      speech.lang = voice.lang;
      speech.rate = .9;
      speech.onstart = () => setVoiceStatus('Device voice started. Check your volume.');
      speech.onerror = () => setVoiceStatus('Voice was blocked. Tap Test voice and check device audio.');
      setVoiceStatus('Voice requested. If silent, tap Test voice and check device audio.');
      window.speechSynthesis.speak(speech);
    } catch {
      setVoiceStatus('Voice could not start. The visual reminder still works.');
    }
  }, []);

  const check = useCallback(() => {
    const run = () => {
      try {
        const now = new Date(), day = localDay(now);
        let config = readReminder(localStorage);
        const logged = localStorage.getItem(logDayMarkerKey) === day || hasLogForDay(readEntries(localStorage), day);
        if (reminderDue(config, now, logged)) {
          config = { ...config, lastFired: day, dismissedOn: '' };
          // Save the daily claim before audio/notification, including across reloads.
          localStorage.setItem(reminderStorageKey, JSON.stringify(config));
          if (config.voiceEnabled) speak();
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const notification = new Notification('Daily health log', {
                body: 'Time to record your daily data.', tag: `spacehealth-log-${day}`,
              });
              notification.onclick = () => { window.focus(); window.location.assign('/log'); notification.close(); };
            } catch {
              setNotificationStatus('Device notifications unavailable. The in-app reminder still works.');
            }
          }
        }
        setToday(day);
        setSettings(config);
        setNotice(config.enabled && config.lastFired === day && config.dismissedOn !== day && !logged);
        setError('');
      } catch {
        setNotice(false);
        setError('Reminders paused: on-device logs or settings could not be read.');
      }
    };
    // One reminder claim per day across tabs when the browser supports Web Locks.
    if (navigator.locks) void navigator.locks.request('spacehealth-daily-log-reminder', run).catch(() => setError('Reminder could not be scheduled.'));
    else run();
  }, [speak]);

  useEffect(() => {
    check();
    const timer = window.setInterval(check, 15_000);
    window.addEventListener('focus', check);
    window.addEventListener('storage', check);
    window.addEventListener(logChangedEvent, check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('storage', check);
      window.removeEventListener(logChangedEvent, check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [check]);

  const update = (patch: Partial<DailyReminder>) => {
    if (patch.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.time)) {
      setError('Choose a valid reminder time.');
      return;
    }
    try {
      const next = { ...readReminder(localStorage), ...patch };
      localStorage.setItem(reminderStorageKey, JSON.stringify(next));
      setSettings(next);
      setError('');
      if (patch.enabled === false || patch.voiceEnabled === false) window.speechSynthesis?.cancel();
      check();
    } catch {
      setError('Reminder not saved. Check on-device storage access.');
    }
  };
  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationStatus('Device notifications unavailable. The in-app reminder still works.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission === 'granted' ? 'Device notifications allowed while the app runs.' : 'Device notifications not allowed. The in-app reminder still works.');
    } catch {
      setNotificationStatus('Device notifications blocked here. The in-app reminder still works.');
    }
  };
  return {
    settings, update, today, notice, error, speak, voiceStatus, notificationStatus,
    requestNotifications, dismiss: () => update({ dismissedOn: localDay() }),
  };
}
export type DailyReminderControls = ReturnType<typeof useDailyReminder>;
