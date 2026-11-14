import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { FamilyMessage } from './types';
import { demoAudioUrl } from './audio';
import { useLogListen } from './companion-context';

interface PlayerState {
  currentId: string | null;
  playing: boolean;
  time: number;
  duration: number;
  lastPlayedId: string | null;
  toggle(m: FamilyMessage): void;
  seek(m: FamilyMessage, t: number): void;
}

const Ctx = createContext<PlayerState | null>(null);

/** One shared <audio> element guarantees only one message plays at a time. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lastPlayedId, setLastPlayedId] = useState<string | null>(() => sessionStorage.getItem('sc:last'));
  const log = useLogListen();
  const logRef = useRef(log.mutate); logRef.current = log.mutate;

  const load = useCallback((m: FamilyMessage) => {
    const a = audio.current!;
    if (currentId !== m.id) {
      a.src = demoAudioUrl(m.audioSrc, m.durationSeconds);
      setCurrentId(m.id); setTime(0); setDuration(m.durationSeconds);
      setLastPlayedId(m.id); sessionStorage.setItem('sc:last', m.id);
      logRef.current(m.id);
    }
    return a;
  }, [currentId]);

  const toggle = useCallback((m: FamilyMessage) => {
    const a = audio.current; if (!a) return;
    if (currentId === m.id && !a.paused) { a.pause(); return; }
    void load(m).play().catch(() => setPlaying(false));
  }, [currentId, load]);

  const seek = useCallback((m: FamilyMessage, t: number) => {
    const a = load(m); a.currentTime = t; setTime(t);
  }, [load]);

  useEffect(() => {
    const a = audio.current!;
    const on = () => setPlaying(true), off = () => setPlaying(false);
    const tu = () => setTime(a.currentTime);
    const md = () => { if (isFinite(a.duration)) setDuration(a.duration); };
    a.addEventListener('play', on); a.addEventListener('pause', off); a.addEventListener('ended', off);
    a.addEventListener('timeupdate', tu); a.addEventListener('loadedmetadata', md);
    return () => { a.removeEventListener('play', on); a.removeEventListener('pause', off); a.removeEventListener('ended', off); a.removeEventListener('timeupdate', tu); a.removeEventListener('loadedmetadata', md); };
  }, []);

  return (
    <Ctx.Provider value={{ currentId, playing, time, duration, lastPlayedId, toggle, seek }}>
      {children}
      <audio ref={audio} preload="metadata" className="hidden" aria-hidden="true" />
    </Ctx.Provider>
  );
}

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlayer must be used inside PlayerProvider');
  return c;
}
