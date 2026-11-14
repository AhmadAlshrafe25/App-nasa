import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Orbit, X } from 'lucide-react';

const samples = [
  { id: 'home', sender: 'Family at home', title: 'A little encouragement', text: 'Hi from Earth! We are thinking of you today. Take a slow breath, enjoy the view, and remember that we are cheering you on. We cannot wait to hear about your day.' },
  { id: 'friend', sender: 'A friend on Earth', title: 'Your daily check-in', text: 'Hey, space explorer! Sending you a little encouragement from home. Remember your rest, your workout, and a moment for yourself. You have got this.' },
];

export function AstroDemo({ onClose, privateInbox }: { onClose: () => void; privateInbox: () => ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showPrivate, setShowPrivate] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (showPrivate) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [showPrivate]);

  function play(text: string) {
    if (!('speechSynthesis' in window)) {
      setStatus('Voice playback is unavailable in this browser. Read the transcript below.');
      return;
    }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.rate = 0.9;
    speech.onend = () => setStatus('Sample finished.');
    speech.onerror = () => setStatus('Voice playback stopped or unavailable. The transcript is available below.');
    setStatus('Playing computer-generated sample voice…');
    window.speechSynthesis.speak(speech);
  }

  if (showPrivate) return privateInbox();

  return <dialog ref={dialogRef} className="astro-dialog" aria-labelledby="astro-demo-title" aria-describedby="astro-demo-disclosure"
    data-testid="dialog-astro-demo" onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="astro-dialog-content">
      <div className="astro-dialog-heading">
        <span className="astro-mark" aria-hidden="true"><Orbit size={20} /></span>
        <div><span className="astro-kicker">FROM EARTH</span><h2 id="astro-demo-title">Astro</h2></div>
        <button type="button" className="astro-close" onClick={onClose} aria-label="Close Astro"><X size={19} /></button>
      </div>
      <p className="astro-disclosure" id="astro-demo-disclosure">Sample messages with a computer voice—not real family recordings.</p>
      <div className="astro-message-list">
        {samples.map(sample => <article className="astro-message" key={sample.id}>
          <div className="astro-message-heading"><div><strong>{sample.title}</strong><span>{sample.sender} · Sample</span></div></div>
          <p>{sample.text}</p>
          <button type="button" className="btn" onClick={() => play(sample.text)}>Play</button>
        </article>)}
      </div>
      <p role="status" aria-live="polite">{status}</p>
      <button type="button" className="btn outline" onClick={() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setStatus('Playback stopped.'); }}>Stop</button>
      <details className="astro-invite-panel"><summary>Family recordings</summary><p>Invitation required.</p><button type="button" className="btn outline" onClick={() => setShowPrivate(true)}>Open private inbox</button></details>
    </div>
  </dialog>;
}
