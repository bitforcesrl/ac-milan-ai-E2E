'use client';

import { useSyncExternalStore } from 'react';

// Mostra la data di una run (salvata in UTC ISO, es. 2026-09-22T09:01:03Z)
// nel fuso locale dell'utente. L'ora locale viene applicata solo dopo l'idratazione
// (lato client) per evitare mismatch di hydration con il rendering server.
// Fallback: il runId.

const emptySubscribe = () => () => { };
// false durante SSR/hydration, true dopo l'idratazione
const useMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false);

export function RunDateTime({ date, runId }: { date?: string; runId: string }) {
    const mounted = useMounted();

    const dt = date ? new Date(date) : null;
    const valid = !!dt && !Number.isNaN(dt.getTime());

    if (!valid) return <span>{runId}</span>;

    if (!mounted) {
        // SSR / primo render: UTC ISO deterministico (identico su server e client)
        return <span suppressHydrationWarning title={`${dt!.toISOString()} UTC`}>{dt!.toISOString()}</span>;
    }

    const localDate = dt!.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const localTime = dt!.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return <span suppressHydrationWarning title={`${dt!.toISOString()} UTC`}>{`${localDate}, ore ${localTime}`}</span>;
}
