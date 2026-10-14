import type { RunningRun, RunSummary } from '@/lib/services';

/** Chiavi di cache React Query centralizzate. */
export const queryKeys = {
  runs: ['reports', 'runs'] as const,
  runningBuilds: ['azure-pipeline', 'running'] as const,
};

export type RunningBuild = RunningRun;

/** Fetcher per l'elenco delle run completate: GET /api/reports */
export async function fetchRuns(): Promise<RunSummary[]> {
  const res = await fetch('/api/reports', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Errore HTTP ${res.status}`);
  const data = await res.json();
  return data.runs ?? [];
}

/** Fetcher per le pipeline in corso: GET /api/azure-pipeline */
export async function fetchRunningBuilds(): Promise<RunningBuild[]> {
  const res = await fetch('/api/azure-pipeline', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Errore HTTP ${res.status}`);
  const data = await res.json();
  return data.running ?? [];
}
