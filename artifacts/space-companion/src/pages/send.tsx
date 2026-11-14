import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getGetEarthMessageSessionQueryKey,
  getListEarthMessagesQueryKey,
  useAcceptEarthMessageInvite,
  useCreateEarthMessage,
  useGetEarthMessageSession,
  useListEarthMessages,
  useRequestEarthMessageUpload,
  type EarthFamilyMessage,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowUpRight, Check, CircleAlert, FileAudio2, FileVideo2, HeartHandshake, LockKeyhole, Radio, Upload, UsersRound } from 'lucide-react';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const inviteSchema = z.object({
  token: z.string().min(16, 'Invitation tokens contain at least 16 characters.'),
  displayName: z.string().trim().min(2, 'Enter your name.').max(100),
  relationship: z.string().trim().min(2, 'Tell us how you know the astronaut.').max(80),
});
const messageSchema = z.object({
  title: z.string().trim().min(1, 'Give your recording a title.').max(120),
  note: z.string().max(600, 'Keep your note under 600 characters.'),
});
type InviteFields = z.infer<typeof inviteSchema>;
type MessageFields = z.infer<typeof messageSchema>;
const MAX_BYTES = 100 * 1024 * 1024;

function humanSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function messageDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : format(date, 'MMM d, yyyy · h:mm a');
}

function MessageCard({ message }: { message: EarthFamilyMessage }) {
  const isAudio = message.mediaType === 'audio';
  const MediaIcon = isAudio ? FileAudio2 : FileVideo2;
  return (
    <article className="message-row" data-testid={`card-family-message-${message.id}`}>
      <div className="message-mark" aria-hidden="true"><MediaIcon className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-1">
          <div>
            <h3 className="text-base font-semibold text-foreground" data-testid={`text-message-title-${message.id}`}>{message.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{messageDate(message.createdAt)}</p>
          </div>
          <span className="message-kind">{isAudio ? 'Audio recording' : 'Video recording'} · {humanSize(message.fileSize)}</span>
        </div>
        {message.note && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{message.note}</p>}
        <div className="mt-4 rounded-xl border border-border/70 bg-background/45 p-3">
          {isAudio ? (
            <audio controls preload="none" className="w-full" src={message.mediaUrl} aria-label={`Play ${message.title}`} data-testid={`player-audio-${message.id}`}>
              Your browser does not support audio playback.
            </audio>
          ) : (
            <video controls preload="none" playsInline className="max-h-[420px] w-full rounded-lg" src={message.mediaUrl} aria-label={`Play ${message.title}`} data-testid={`player-video-${message.id}`}>
              Your browser does not support video playback.
            </video>
          )}
        </div>
      </div>
    </article>
  );
}

export default function SendPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const inviteAccept = useAcceptEarthMessageInvite();
  const sessionQuery = useGetEarthMessageSession({
    query: {
      enabled: isLoaded && !!isSignedIn,
      queryKey: getGetEarthMessageSessionQueryKey(),
    },
  });
  const session = sessionQuery.data;
  const isFamily = session?.role === 'family';
  const messagesQuery = useListEarthMessages({
    query: {
      enabled: isLoaded && !!isSignedIn && isFamily,
      queryKey: getListEarthMessagesQueryKey(),
    },
  });
  const uploadRequest = useRequestEarthMessageUpload();
  const createMessage = useCreateEarthMessage();
  const [inviteDone, setInviteDone] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const authRedirect = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  const authLink = (path: string) => `${path}?redirect_url=${encodeURIComponent(authRedirect)}`;

  const inviteForm = useForm<InviteFields>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      token: new URLSearchParams(window.location.search).get('invite')
        ?? new URLSearchParams(window.location.search).get('token')
        ?? '',
      displayName: '',
      relationship: '',
    },
  });
  const messageForm = useForm<MessageFields>({
    resolver: zodResolver(messageSchema),
    defaultValues: { title: '', note: '' },
  });

  useEffect(() => {
    if (inviteAccept.isSuccess) setInviteDone(true);
  }, [inviteAccept.isSuccess]);

  async function acceptInvite(values: InviteFields) {
    setInviteDone(false);
    try {
      const accepted = await inviteAccept.mutateAsync({ data: values });
      queryClient.setQueryData(getGetEarthMessageSessionQueryKey(), accepted);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetEarthMessageSessionQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListEarthMessagesQueryKey() }),
      ]);
      setInviteDone(true);
    } catch {
      setInviteDone(false);
    }
  }

  async function sendMessage(values: MessageFields) {
    setUploadError('');
    setUploadSuccess(false);
    if (!selectedFile) {
      setUploadError('Choose an audio or video recording before sending.');
      return;
    }
    if (!selectedFile.type.startsWith('audio/') && !selectedFile.type.startsWith('video/')) {
      setUploadError('Choose a supported audio or video file.');
      return;
    }
    if (selectedFile.size < 1 || selectedFile.size > MAX_BYTES) {
      setUploadError('Recordings must be smaller than 100 MB.');
      return;
    }
    try {
      const upload = await uploadRequest.mutateAsync({
        data: { contentType: selectedFile.type, size: selectedFile.size },
      });
      if (selectedFile.size > upload.maxBytes) {
        setUploadError('This recording is larger than the upload limit.');
        return;
      }
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
      });
      if (!response.ok) throw new Error('The recording could not be uploaded. Please try again.');
      await createMessage.mutateAsync({
        data: {
          objectPath: upload.objectPath,
          title: values.title,
          ...(values.note.trim() ? { note: values.note.trim() } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListEarthMessagesQueryKey() });
      setSelectedFile(null);
      setUploadSuccess(true);
      messageForm.reset({ title: '', note: '' });
      const fileInput = document.getElementById('family-recording') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Your recording was not sent. Please try again.');
    }
  }

  const busy = uploadRequest.isPending || createMessage.isPending;

  return (
    <div className="send-page rise">
      <section className="send-intro" aria-labelledby="send-heading">
        <div className="eyebrow"><span className="eyebrow-orbit" aria-hidden="true" />PRIVATE FAMILY CHANNEL</div>
        <h1 id="send-heading" className="font-display text-5xl leading-[.98] sm:text-6xl" data-testid="heading-family-portal">
          A little closer,<br /><em>across the distance.</em>
        </h1>
        <p className="send-lede">A private place to share your voice with the person you love, wherever their mission takes them.</p>
        <div className="privacy-note"><LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Only invited family can send and hear recordings in this channel.</span></div>
      </section>

      {!isLoaded && (
        <div className="portal-skeleton" role="status" aria-label="Loading sign-in status" data-testid="skeleton-auth-status">
          <div className="skeleton-line w-1/3" /><div className="skeleton-line w-2/3" /><div className="skeleton-block" />
        </div>
      )}

      {isLoaded && !isSignedIn && (
        <Card className="portal-card max-w-2xl" data-testid="panel-signed-out">
          <CardHeader className="pb-3">
            <div className="panel-icon"><UsersRound className="h-5 w-5" aria-hidden="true" /></div>
            <CardTitle className="font-display text-3xl font-normal">First, let’s make this yours.</CardTitle>
            <p className="max-w-lg text-sm leading-6 text-muted-foreground">Sign in with the account connected to your invitation. If you’re new here, create an account with the email where you received it.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button asChild data-testid="link-sign-in"><Link href={authLink('/sign-in')}>Sign in <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button variant="outline" asChild data-testid="link-sign-up"><Link href={authLink('/sign-up')}>Create an account</Link></Button>
          </CardContent>
        </Card>
      )}

      {isLoaded && isSignedIn && sessionQuery.isLoading && (
        <div className="portal-skeleton" role="status" aria-label="Loading family access" data-testid="skeleton-family-access">
          <div className="skeleton-line w-1/4" /><div className="skeleton-line w-1/2" /><div className="skeleton-block" />
        </div>
      )}

      {isLoaded && isSignedIn && sessionQuery.isError && (
        <div className="portal-alert portal-alert-error" role="alert" data-testid="status-session-error">
          <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div><strong>We couldn’t check your invitation.</strong><p className="mt-1 text-sm">Your message history remains private. Try again when your connection is ready.</p>
            <Button className="mt-3" variant="outline" onClick={() => sessionQuery.refetch()} data-testid="button-retry-session">Try again</Button>
          </div>
        </div>
      )}

      {isLoaded && isSignedIn && session?.role === 'unlinked' && (
        <Card className="portal-card invite-card" data-testid="panel-accept-invitation">
          <CardHeader>
            <div className="panel-icon"><HeartHandshake className="h-5 w-5" aria-hidden="true" /></div>
            <p className="eyebrow mt-5">YOUR INVITATION</p>
            <CardTitle className="font-display text-3xl font-normal">Connect to your person.</CardTitle>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">Enter the one-time code from your invitation, then tell us your name and relationship. This links your account to a private channel.</p>
          </CardHeader>
          <CardContent>
            <Form {...inviteForm}>
              <form onSubmit={inviteForm.handleSubmit(acceptInvite)} className="space-y-5" data-testid="form-accept-invitation">
                <FormField control={inviteForm.control} name="token" render={({ field }) => (
                  <FormItem><FormLabel>Invitation code</FormLabel><FormControl><Input autoComplete="off" placeholder="Paste your private invitation code" {...field} data-testid="input-invitation-token" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField control={inviteForm.control} name="displayName" render={({ field }) => (
                    <FormItem><FormLabel>Your name</FormLabel><FormControl><Input autoComplete="name" placeholder="Name your astronaut knows" {...field} data-testid="input-display-name" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={inviteForm.control} name="relationship" render={({ field }) => (
                    <FormItem><FormLabel>Your relationship</FormLabel><FormControl><Input placeholder="Partner, parent, friend…" {...field} data-testid="input-relationship" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                {inviteAccept.isError && <p className="form-error" role="alert" data-testid="status-invitation-error">That invitation couldn’t be accepted. Check the code and try again, or ask your astronaut for a new invitation.</p>}
                {inviteDone && <p className="form-success" role="status" data-testid="status-invitation-success"><Check className="mr-2 inline h-4 w-4" />Invitation accepted. Your private channel is ready.</p>}
                <Button type="submit" disabled={inviteAccept.isPending} data-testid="button-accept-invitation">
                  {inviteAccept.isPending ? 'Connecting…' : 'Accept invitation'} <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {isLoaded && isSignedIn && session && session.role !== 'family' && session.role !== 'unlinked' && (
        <div className="portal-alert" role="status" data-testid="panel-not-family">
          <LockKeyhole className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div><strong>This is a family sender channel.</strong><p className="mt-1 text-sm">Your account isn’t linked as a family sender. Ask your astronaut to send you a private invitation.</p></div>
        </div>
      )}

      {isLoaded && isSignedIn && isFamily && (
        <div className="family-workspace">
          <div className="family-greeting" data-testid="text-family-greeting">
            <div><p className="eyebrow">CONNECTED AS {session.displayName?.toUpperCase() || 'FAMILY'}</p><h2 className="font-display text-3xl font-normal">Your voice travels well.</h2></div>
            <span className="relationship-tag">{session.relationship || 'Family'}</span>
          </div>
          <Card className="portal-card composer-card" data-testid="panel-send-message">
            <CardHeader>
              <div className="panel-icon"><Radio className="h-5 w-5" aria-hidden="true" /></div>
              <p className="eyebrow mt-5">SEND A RECORDING</p>
              <CardTitle className="font-display text-3xl font-normal">Make a moment they can keep.</CardTitle>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">Choose a real audio or video recording from your device. Nothing here is pre-recorded or a sample.</p>
            </CardHeader>
            <CardContent>
              <Form {...messageForm}>
                <form onSubmit={messageForm.handleSubmit(sendMessage)} className="space-y-5" data-testid="form-send-message">
                  <FormField control={messageForm.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel>Recording title</FormLabel><FormControl><Input placeholder="A note from home" maxLength={120} {...field} data-testid="input-message-title" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={messageForm.control} name="note" render={({ field }) => (
                    <FormItem><FormLabel>Optional note</FormLabel><FormControl><Textarea rows={3} placeholder="Add a little context before they press play…" maxLength={600} {...field} data-testid="input-message-note" /></FormControl><FormMessage /><p className="text-right text-xs text-muted-foreground">{field.value.length}/600</p></FormItem>
                  )} />
                  <div>
                    <label htmlFor="family-recording" className="mb-2 block text-sm font-medium">Audio or video file</label>
                    <div className="file-picker">
                      <Upload className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{selectedFile?.name || 'Choose a recording'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{selectedFile ? `${humanSize(selectedFile.size)} · ${selectedFile.type || 'unknown format'}` : 'Audio or video · up to 100 MB'}</p>
                      </div>
                      <span className="file-picker-action">Browse</span>
                      <input id="family-recording" type="file" accept="audio/*,video/*" onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        setSelectedFile(file);
                        setUploadError('');
                        setUploadSuccess(false);
                      }} aria-label="Choose an audio or video recording" data-testid="input-family-recording" />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">This uploads the file you select. Please don’t include anything you wouldn’t want shared privately with your astronaut.</p>
                  </div>
                  {uploadError && <p className="form-error" role="alert" data-testid="status-send-error">{uploadError}</p>}
                  {uploadSuccess && <p className="form-success" role="status" data-testid="status-send-success"><Check className="mr-2 inline h-4 w-4" />Recording sent. It’s now in your private message history.</p>}
                  <Button type="submit" disabled={busy} data-testid="button-send-message">
                    {busy ? 'Sending recording…' : 'Send recording'} <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <section className="message-history" aria-labelledby="history-heading">
            <div className="history-heading"><div><p className="eyebrow">YOUR PRIVATE CHANNEL</p><h2 id="history-heading" className="font-display text-3xl font-normal">Sent from Earth</h2></div><span className="history-count" data-testid="text-message-count">{messagesQuery.data?.length ?? 0} {messagesQuery.data?.length === 1 ? 'recording' : 'recordings'}</span></div>
            {messagesQuery.isLoading && <div className="portal-skeleton" role="status" aria-label="Loading recordings" data-testid="skeleton-message-history"><div className="skeleton-line w-1/3" /><div className="skeleton-line w-2/3" /><div className="skeleton-block" /></div>}
            {messagesQuery.isError && <div className="portal-alert portal-alert-error" role="alert" data-testid="status-messages-error"><CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" /><div><strong>Recordings didn’t load.</strong><p className="mt-1 text-sm">Your messages are still private. Try again in a moment.</p><Button className="mt-3" variant="outline" onClick={() => messagesQuery.refetch()} data-testid="button-retry-messages">Retry</Button></div></div>}
            {messagesQuery.isSuccess && messagesQuery.data?.length === 0 && <div className="empty-messages" data-testid="panel-empty-messages"><div className="empty-orbit" aria-hidden="true"><HeartHandshake className="h-6 w-6" /></div><h3 className="font-display text-2xl">The first hello is yours.</h3><p>When you send a recording, it will appear here. You can come back to listen to it any time.</p></div>}
            {messagesQuery.isSuccess && messagesQuery.data && messagesQuery.data.length > 0 && <div className="message-list">{messagesQuery.data.map((message) => <MessageCard key={message.id} message={message} />)}</div>}
          </section>
          <p className="portal-footnote"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />Private to your invitation · Recordings stream securely from their original location.</p>
        </div>
      )}
    </div>
  );
}
