import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Orbit, RefreshCw, Users } from 'lucide-react';
import type { FamilyMessage, RecommendedFamilyMedia, SupportResponse } from '@workspace/api-client-react';
import { createFamilyMessage, getFamilyMessages, getSupport, markMessageViewed } from '@/lib/space-api';
import {
  OFFLINE_COMPANION, OFFLINE_SAMPLE_MESSAGE, addLocalMessage, markLocalViewed, pickLocalMessage,
  validateNewMessage, type NewMessageInput,
} from '@/lib/space-fallback';

type Mode = 'loading' | 'live' | 'offline' | 'error';
type Support = Pick<SupportResponse, 'summary' | 'relaxation_action'>;

const moods: NewMessageInput['mood_tag'][] = ['general', 'anxious', 'lonely', 'tired'];
const emptyForm: NewMessageInput = { sender_name: '', relationship: '', title: '', message_text: '', mood_tag: 'general' };

export function CompanionPanel() {
  const [mode, setMode] = useState<Mode>('loading');
  const [support, setSupport] = useState<Support | null>(null);
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [recommended, setRecommended] = useState<RecommendedFamilyMedia | null>(null);
  const [localMessages, setLocalMessages] = useState<FamilyMessage[]>([OFFLINE_SAMPLE_MESSAGE]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<NewMessageInput>(emptyForm);

  const showOffline = useCallback((list: FamilyMessage[]) => {
    setMode('offline');
    setSupport(OFFLINE_COMPANION);
    setMessages(list);
    setRecommended(pickLocalMessage(list));
  }, []);

  const load = useCallback(async () => {
    const [supportResult, messagesResult] = await Promise.all([getSupport(), getFamilyMessages()]);
    if (supportResult.status === 'offline' || messagesResult.status === 'offline') {
      setLoadError(null);
      showOffline(localMessages);
      return;
    }
    if (supportResult.status === 'error' || messagesResult.status === 'error') {
      const failed = supportResult.status === 'error' ? supportResult : messagesResult;
      setLoadError(failed.status === 'error' ? failed.message : 'Could not load.');
      setMode(current => (current === 'live' || current === 'offline' ? current : 'error'));
      return;
    }
    setLoadError(null);
    setMode('live');
    setSupport(supportResult.data);
    setMessages(messagesResult.data);
    setRecommended(supportResult.data.recommended_family_media ?? null);
  }, [localMessages, showOffline]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markViewed = async (message: FamilyMessage) => {
    setBusy(true); setActionError(null); setNotice(null);
    if (mode === 'offline') {
      const next = markLocalViewed(localMessages, message.id);
      setLocalMessages(next); showOffline(next); setNotice('Marked viewed for this session only.');
    } else {
      const result = await markMessageViewed(message.id);
      if (result.status === 'ok') { await load(); setNotice('Marked viewed.'); }
      else if (result.status === 'error') setActionError(result.message);
      else { showOffline(localMessages); setNotice('API offline. Showing the offline sample.'); }
    }
    setBusy(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setActionError(null); setNotice(null);
    const problem = validateNewMessage(form);
    if (problem) { setActionError(problem); return; }
    setBusy(true);
    const trimmed = { ...form, sender_name: form.sender_name.trim(), relationship: form.relationship.trim(), title: form.title.trim(), message_text: form.message_text.trim() };
    const result = mode === 'offline' ? ({ status: 'offline' } as const) : await createFamilyMessage(trimmed);
    if (result.status === 'ok') {
      setForm(emptyForm); await load(); setNotice('Message added.');
    } else if (result.status === 'error') {
      setActionError(result.message);
    } else {
      const next = addLocalMessage(localMessages, trimmed);
      setLocalMessages(next); showOffline(next); setForm(emptyForm); setNotice('Added for this session only.');
    }
    setBusy(false);
  };

  const unviewed = messages.filter(m => !m.is_viewed).length;
  const message = recommended?.message ?? null;
  const label = mode === 'offline' ? 'Offline sample' : mode === 'live' ? 'Live backend · demo data' : mode === 'error' ? 'Backend error' : 'Checking backend…';

  return <div className="care-panel" role="group" aria-label="Astro companion and family care" data-testid="status-space-companion" data-mode={mode}>
    <div className="care-head">
      <span className="companion-indicator" aria-hidden="true" />
      <strong>Astro</strong>
      <span className={`care-source care-source-${mode}`} data-testid="text-companion-source">{label}</span>
      {mode === 'offline' && <button type="button" className="care-icon-btn" onClick={() => void load()} aria-label="Retry connection" data-testid="button-companion-retry"><RefreshCw size={15} aria-hidden="true" /></button>}
    </div>

    {mode === 'loading' && !loadError && <p className="care-line" data-testid="text-companion-loading">Loading support…</p>}
    {loadError && <p className="care-error" role="alert" data-testid="text-companion-error">Could not load: {loadError} <button type="button" className="care-link-btn" onClick={() => void load()} data-testid="button-companion-reload">Retry</button></p>}

    {support && <div className="care-block">
      <p className="care-line" data-testid="text-companion-summary">{support.summary}</p>
      <p className="care-line"><strong>Try now:</strong> <span data-testid="text-companion-action">{support.relaxation_action}</span></p>
    </div>}

    {support && <div className="care-block care-family" data-testid="panel-family-care">
      <div className="care-subhead"><Users size={14} aria-hidden="true" /><strong>Family care</strong>
        <span data-testid="text-family-count">{messages.length} {messages.length === 1 ? 'message' : 'messages'} · {unviewed} unviewed</span></div>
      {message ? <article className="care-message" data-testid="card-family-media">
        <div className="care-message-meta">
          <strong data-testid="text-family-sender">{message.sender_name}</strong>
          <span data-testid="text-family-relationship">{message.relationship}</span>
          <span className="care-tag" data-testid="text-family-mood">{message.mood_tag}</span>
        </div>
        <p className="care-message-title" data-testid="text-family-title">{message.title}</p>
        {message.media_type === 'text'
          ? <p className="care-line" data-testid="text-family-body">{message.message_text}</p>
          : <p className="care-line">{message.media_type === 'video' ? 'Video' : 'Audio'} message. Playback is not available in this demo.</p>}
        <p className="care-reason" data-testid="text-family-reason">{recommended?.selection_reason}</p>
        <button type="button" className="care-btn" disabled={busy} onClick={() => void markViewed(message)} data-testid="button-mark-viewed">Mark viewed</button>
      </article> : <p className="care-line" data-testid="text-family-empty">{recommended?.selection_reason ?? 'No messages yet.'}</p>}

      <details className="care-add">
        <summary data-testid="button-add-message-toggle">Add family message</summary>
        <form onSubmit={submit} noValidate data-testid="form-family-message">
          <label>Sender<input value={form.sender_name} maxLength={80} onChange={e => setForm({ ...form, sender_name: e.target.value })} data-testid="input-family-sender" /></label>
          <label>Relationship<input value={form.relationship} maxLength={60} onChange={e => setForm({ ...form, relationship: e.target.value })} data-testid="input-family-relationship" /></label>
          <label>Title<input value={form.title} maxLength={120} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-family-title" /></label>
          <label>Text<textarea rows={3} value={form.message_text} maxLength={4000} onChange={e => setForm({ ...form, message_text: e.target.value })} data-testid="input-family-text" /></label>
          <label>Mood tag<select value={form.mood_tag} onChange={e => setForm({ ...form, mood_tag: e.target.value as NewMessageInput['mood_tag'] })} data-testid="select-family-mood">{moods.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
          <button type="submit" className="care-btn" disabled={busy} data-testid="button-add-message">Add message</button>
        </form>
      </details>
      {actionError && <p className="care-error" role="alert" data-testid="text-family-error">{actionError}</p>}
      {notice && <p className="care-notice" data-testid="text-family-notice">{notice}</p>}
    </div>}
    <p className="care-foot"><Orbit size={12} aria-hidden="true" /> General support, not a diagnosis. Demo data, no live sensors.</p>
  </div>;
}
