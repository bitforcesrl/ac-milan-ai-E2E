import {
  AI_MODEL_LIST,
  BROWSER_LIST,
  E2E_TEST_LIST,
  MAX_PARALLEL_SESSIONS_CONFIG,
  VIEWPORT_LIST,
} from '@/lib/e2e-tests';
import { parseRunConfig, RunConfigValidationError } from '@/lib/run-config-schema';
import { getService } from '@/lib/services';
import { NextResponse } from 'next/server';

/**
 * API per le run E2E: stato delle run in corso (GET) e avvio di una nuova run
 * (POST). Il backend è scelto dalla factory getService() (Strategy pattern):
 * - AzureService: trigger della pipeline su Azure DevOps via REST (default)
 * - LocalService: esecuzione locale di scripts/run-e2e.mjs (npm run dev:local)
 *
 * POST body: run config della run selezionata dal form in home page (stesso
 * schema dei file configs/*.config.json). Viene validata con Zod contro il
 * catalogo in configs/index.ts e passata al servizio (template parameter
 * e2eRunConfig per Azure, file temporaneo per la modalità locale).
 */

// Catalogo per la validazione della run config (da configs/index.ts via e2e-tests.ts)
const RUN_CONFIG_CATALOG = {
  E2E_TESTS: E2E_TEST_LIST,
  BROWSERS: BROWSER_LIST,
  VIEWPORTS: VIEWPORT_LIST,
  AI_MODELS: AI_MODEL_LIST,
  MAX_PARALLEL_SESSIONS: MAX_PARALLEL_SESSIONS_CONFIG,
};

/**
 * GET: restituisce le run attualmente in corso (o in coda).
 * Usato dalla home page per impedire l'avvio di run parallele.
 */
export async function GET() {
  const { running, error, details, httpStatus } = await getService().getRunning();
  if (error) {
    return NextResponse.json({ error, details }, { status: httpStatus ?? 500 });
  }
  return NextResponse.json({ running });
}

export async function POST(request: Request) {
  // Run config dal form in home page: validata con Zod contro il catalogo
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Body mancante o non JSON: inviare una run config valida.' },
      { status: 400 },
    );
  }

  let runConfigJson: string;
  try {
    const runConfig = parseRunConfig(body, RUN_CONFIG_CATALOG);
    runConfigJson = JSON.stringify(runConfig);
  } catch (err) {
    if (err instanceof RunConfigValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const result = await getService().triggerRun(runConfigJson);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, details: result.details, running: result.running },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json(result);
}
