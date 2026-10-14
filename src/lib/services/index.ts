import { AzureService } from '@/lib/services/azure-service';
import { LocalService } from '@/lib/services/local-service';
import type { RunningResult, RunningRun, TriggerRunResult } from '@/lib/services/types';
import type { RunDetail, RunSummary, TestDetail } from '@/types/reports';

export type { RunningResult, RunningRun, TriggerRunResult } from '@/lib/services/types';
export type { RunDetail, RunSummary, SessionView, TestDetail } from '@/types/reports';
export type { RunIndexEntry } from '@/types/run-index';

/**
 * Servizio completo per le funzionalita' dell'app (Strategy pattern):
 * un'unica interfaccia che copre run (avvio/monitoraggio) e report (lettura).
 * Le implementazioni cambiano backend, non contratto.
 *
 * - AzureService: pipeline Azure DevOps via REST + report su Azure Blob con
 *   URL firmati SAS (default, dashboard su Vercel).
 * - LocalService: esecuzione locale di scripts/run-e2e.mjs con lock su file +
 *   report dal filesystem reports/ (modalita' locale, `npm run dev:local`).
 *
 * La factory `getService()` istanzia l'implementazione giusta in base alla
 * modalita' corrente (E2E_LOCAL_MODE).
 */
export interface AppService {
  // --- Run ---
  /** Run attualmente in corso (o in coda). */
  getRunning(): Promise<RunningResult>;
  /**
   * Run in corso, versione best-effort per la UI (lista pagine report):
   * ritorna [] se il backend non è configurato o irraggiungibile.
   */
  listRunningBuilds(): Promise<RunningRun[]>;
  /**
   * Avvia una run con la run config (JSON gia' validato con parseRunConfig).
   * Ritorna un risultato strutturato: la route lo mappa sulle risposte HTTP.
   */
  triggerRun(runConfigJson: string): Promise<TriggerRunResult>;

  // --- Report ---
  /** Lista tutte le run con statistiche aggregate (vista index). */
  listRuns(): Promise<RunSummary[]>;
  /** Dettaglio di una run: sessioni con test e screenshot. */
  getRun(runId: string): Promise<RunDetail | null>;
  /** Dettaglio di un singolo test (report Markdown + screenshot). */
  getTest(
    runId: string,
    browser: string,
    viewport: string,
    testId: string,
  ): Promise<TestDetail | null>;
}

export function getService(): AppService {
  return isLocalMode() ? new LocalService() : new AzureService();
}

/** true se la dashboard gira in modalità locale (npm run dev:local). */
export function isLocalMode(): boolean {
  return process.env.E2E_LOCAL_MODE === '1';
}
