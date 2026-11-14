import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import HomePage from '@/pages/home';
import MessagesPage from '@/pages/messages';
import CheckInPage from '@/pages/check-in';
import HistoryPage from '@/pages/history';
import HazardsPage from '@/pages/hazards';
import { Layout } from '@/components/layout';
import { CompanionContextProvider } from '@/lib/companion-context';
import { PlayerProvider } from '@/lib/player-context';
import SendPage from '@/pages/send';
import { ClerkProvider, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { useQueryClient } from '@tanstack/react-query';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#9bcbe3',
    colorForeground: '#eaf0f4',
    colorMutedForeground: '#a8bac7',
    colorDanger: '#ef9b8d',
    colorBackground: '#152231',
    colorInput: '#101b29',
    colorInputForeground: '#eaf0f4',
    colorNeutral: '#eaf0f4',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#152231] border border-[#304354] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#edf3f6] font-medium tracking-tight',
    headerSubtitle: 'text-[#a8bac7]',
    socialButtonsBlockButtonText: 'text-[#eaf0f4]',
    formFieldLabel: 'text-[#dce6ec]',
    footerActionLink: 'text-[#a9d5e7] hover:text-[#d7edf5]',
    footerActionText: 'text-[#a8bac7]',
    dividerText: 'text-[#a8bac7]',
    identityPreviewEditButton: 'text-[#a9d5e7]',
    formFieldSuccessText: 'text-[#a9d5e7]',
    alertText: 'text-[#f3c1b9]',
    logoBox: 'mb-2',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#40576a] bg-[#1a2b3a] hover:bg-[#203647]',
    formButtonPrimary: 'bg-[#9bcbe3] text-[#152231] hover:bg-[#b7dbea]',
    formFieldInput: 'bg-[#101b29] border-[#40576a] text-[#eaf0f4]',
    footerAction: 'border-t border-[#304354]',
    dividerLine: 'bg-[#40576a]',
    alert: 'border-[#845a55] bg-[#352624]',
    otpCodeFieldInput: 'bg-[#101b29] border-[#40576a] text-[#eaf0f4]',
    formFieldRow: 'mb-4',
    main: 'text-[#eaf0f4]',
  },
};

function SignInPage() {
  const requestedRedirect = new URLSearchParams(window.location.search).get('redirect_url');
  const forceRedirectUrl = requestedRedirect?.startsWith(`${window.location.origin}${basePath}/send`)
    ? requestedRedirect
    : `${basePath}/send`;
  return (
    <div className="auth-page">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={forceRedirectUrl} />
    </div>
  );
}

function SignUpPage() {
  const requestedRedirect = new URLSearchParams(window.location.search).get('redirect_url');
  const forceRedirectUrl = requestedRedirect?.startsWith(`${window.location.origin}${basePath}/send`)
    ? requestedRedirect
    : `${basePath}/send`;
  return (
    <div className="auth-page">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={forceRedirectUrl} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        cache.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, cache]);

  return null;
}

function Router() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to reach your private family channel.' } },
        signUp: { start: { title: 'Stay close, from anywhere', subtitle: 'Create an account to accept your invitation.' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route>
          <Layout>
            <RoutedErrorBoundary>
              <Switch>
                <Route path="/" component={HomePage} />
                <Route path="/messages" component={MessagesPage} />
                <Route path="/send" component={SendPage} />
                <Route path="/check-in" component={CheckInPage} />
                <Route path="/history" component={HistoryPage} />
                <Route path="/hazards" component={HazardsPage} />
                <Route component={NotFound} />
              </Switch>
            </RoutedErrorBoundary>
          </Layout>
        </Route>
      </Switch>
    </ClerkProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <CompanionContextProvider>
            <PlayerProvider>
              <Router />
            </PlayerProvider>
          </CompanionContextProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
