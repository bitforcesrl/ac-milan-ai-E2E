// Tipi condivisi dai servizi (Strategy pattern in lib/services/index.ts).

export type RunningRun = {
  id: number | string;
  buildNumber: string;
  status: string;
  queueTime?: string;
  webUrl?: string;
};

export type TriggerRunResult =
  | {
      ok: true;
      local?: boolean;
      buildId?: number;
      buildNumber?: string;
      webUrl?: string;
      status?: string;
      startedAt?: string;
    }
  | {
      ok: false;
      httpStatus: number;
      error: string;
      details?: unknown;
      running?: RunningRun[];
    };

export type RunningResult = {
  running: RunningRun[];
  error?: string;
  details?: unknown;
  httpStatus?: number;
};
