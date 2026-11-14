import { useEffect, useRef, useState } from 'react';

type LocalRecognition = {
  processLocally?: boolean;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export function useVoiceLog() {
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState('');
  const [transcript, setTranscript] = useState('');
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState('');
  const mounted = useRef(true);
  const generation = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recognition = useRef<LocalRecognition | null>(null);
  const timer = useRef<number | null>(null);
  const started = useRef(0);
  const busy = useRef(false);

  const release = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    try { recognition.current?.abort(); } catch { /* already stopped */ }
    recognition.current = null;
    if (recorder.current) {
      recorder.current.onstop = null;
      recorder.current.ondataavailable = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
    }
    recorder.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    busy.current = false;
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      release();
    };
  }, []);

  const clear = () => {
    generation.current++;
    release();
    setRecording(false); setPending(false); setProcessing(false);
    setAudio(''); setTranscript(''); setSeconds(0); setCapturedAt(null);
    setStatus('');
  };

  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    try { recognition.current?.stop(); } catch { /* already stopped */ }
    if (!recorder.current || recorder.current.state === 'inactive') {
      // Invalidate an outstanding permission request, including a later grant.
      generation.current++;
      release();
      setPending(false); setRecording(false); setProcessing(false);
      setStatus('Recording cancelled. No audio was saved.');
      return;
    }
    setRecording(false);
    setProcessing(true);
    recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  };

  const start = async () => {
    if (busy.current) return;
    clear();
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setStatus('Audio recording is unavailable in this browser. No recording was created.');
      return;
    }
    busy.current = true;
    setPending(true);
    setStatus('Allow microphone access to record, or cancel.');
    const session = ++generation.current;
    const valid = () => mounted.current && generation.current === session;
    let acquired: MediaStream | null = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!valid()) {
        acquired.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = acquired;
      const capture = new MediaRecorder(acquired);
      recorder.current = capture;
      const chunks: Blob[] = [];
      capture.ondataavailable = event => {
        if (valid() && event.data.size > 0) chunks.push(event.data);
      };
      capture.onerror = () => {
        if (!valid()) return;
        generation.current++;
        release();
        setRecording(false); setPending(false); setProcessing(false);
        setStatus('Microphone recording failed. No audio was saved. Please try again.');
      };
      capture.onstop = () => {
        acquired?.getTracks().forEach(track => track.stop());
        if (!valid()) return;
        if (timer.current !== null) window.clearInterval(timer.current);
        timer.current = null;
        try { recognition.current?.stop(); } catch { /* already stopped */ }
        stream.current = null;
        setRecording(false); setPending(false);
        recorder.current = null;
        busy.current = false;
        const duration = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        const blob = new Blob(chunks, { type: capture.mimeType || 'audio/webm' });
        if (!blob.size) {
          setProcessing(false);
          setStatus('No microphone audio was captured. Please record again.');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (!valid()) return;
          setProcessing(false);
          if (typeof reader.result === 'string') {
            setAudio(reader.result); setSeconds(duration);
            setStatus('Voice recording ready. Choose mood and stress, then save below.');
          }
        };
        reader.onerror = () => {
          if (valid()) {
            setProcessing(false);
            setStatus('Could not prepare the recording. Please record again.');
          }
        };
        reader.readAsDataURL(blob);
      };
      started.current = Date.now();
      setCapturedAt(new Date(started.current));
      capture.start();
      setPending(false); setRecording(true);
      setStatus('Recording your voice. Audio stays in this browser. Maximum 2 minutes.');
      timer.current = window.setInterval(() => {
        if (!valid()) return;
        const elapsed = Math.floor((Date.now() - started.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= 120) stop();
      }, 500);

      // Never use browser recognition that may send the voice to an online service.
      const constructors = window as unknown as Record<string, unknown>;
      const SpeechRec = constructors.SpeechRecognition || constructors.webkitSpeechRecognition;
      if (typeof SpeechRec === 'function') {
        const local = new (SpeechRec as new () => LocalRecognition)();
        if ('processLocally' in local) {
          local.processLocally = true;
          local.continuous = true; local.interimResults = false; local.lang = 'en-US';
          local.onresult = event => {
            if (!valid()) return;
            setTranscript(Array.from(event.results).map(result => result[0]?.transcript || '').join(' ').trim());
          };
          recognition.current = local;
          try { local.start(); } catch { /* audio remains the log when local transcription is unavailable */ }
        }
      }
    } catch {
      acquired?.getTracks().forEach(track => track.stop());
      if (!valid()) return;
      release();
      setPending(false); setRecording(false); setProcessing(false);
      setStatus('Microphone access failed or was denied. No recording was created. Allow access and try again.');
    }
  };

  return { recording, pending, processing, seconds, audio, transcript, capturedAt, status, start, stop, clear };
}
