import { type ReactNode } from 'react';
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
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <Layout>
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/messages" component={MessagesPage} />
        <Route path="/check-in" component={CheckInPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/hazards" component={HazardsPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
    </Layout>
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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
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
