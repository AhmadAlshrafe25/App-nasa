import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompanionProvider } from './integration/provider';
import { createSampleProvider } from './integration/sample-provider';
import type { FamilyMessage, WellbeingSnapshot } from './types';

const Ctx = createContext<CompanionProvider | null>(null);

export function CompanionContextProvider({ provider, children }: { provider?: CompanionProvider; children: ReactNode }) {
  const value = useMemo(() => provider ?? createSampleProvider(), [provider]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompanion() {
  const p = useContext(Ctx);
  if (!p) throw new Error('useCompanion must be used inside CompanionContextProvider');
  return p;
}

export const useMessages = () => { const p = useCompanion(); return useQuery({ queryKey: ['messages'], queryFn: () => p.getMessages() }); };
export const useSnapshot = () => { const p = useCompanion(); return useQuery({ queryKey: ['snapshot'], queryFn: () => p.getWellbeingSnapshot() }); };
export const useMission = () => { const p = useCompanion(); return useQuery({ queryKey: ['mission'], queryFn: () => p.getMissionContext() }); };
export const useCheckIns = () => { const p = useCompanion(); return useQuery({ queryKey: ['checkins'], queryFn: () => p.listCheckIns() }); };
export const useReflections = () => { const p = useCompanion(); return useQuery({ queryKey: ['reflections'], queryFn: () => p.listReflections() }); };
export const useListens = () => { const p = useCompanion(); return useQuery({ queryKey: ['listens'], queryFn: () => p.listListenEvents() }); };

export function useRecommendations(snapshot?: WellbeingSnapshot, messages?: FamilyMessage[]) {
  const p = useCompanion();
  return useQuery({
    queryKey: ['recs', snapshot, messages?.map((m) => m.id)],
    queryFn: () => p.getRecommendations(snapshot!, messages!),
    enabled: !!snapshot && !!messages,
  });
}

export function useSaveCheckIn() {
  const p = useCompanion(); const qc = useQueryClient();
  return useMutation({ mutationFn: p.saveCheckIn, onSuccess: () => qc.invalidateQueries({ queryKey: ['checkins'] }) });
}
export function useSaveReflection() {
  const p = useCompanion(); const qc = useQueryClient();
  return useMutation({ mutationFn: p.saveReflection, onSuccess: () => qc.invalidateQueries({ queryKey: ['reflections'] }) });
}
export function useLogListen() {
  const p = useCompanion(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => p.logListen(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['listens'] }); qc.invalidateQueries({ queryKey: ['recs'] }); },
  });
}
