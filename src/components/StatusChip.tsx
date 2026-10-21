const muted = 'text-dark-grey';

const STYLES: Record<string, string> = {
  PASS: 'bg-green-100 text-green-700',
  FAIL: 'bg-red-100 text-red-700',
  // ERROR: test non giunto a esito (distinto da FAIL, che e' un esito reale)
  ERROR: 'bg-orange-100 text-orange-700',
};

/**
 * Badge dello status di un test: PASS | FAIL | ERROR, N/D per status
 * sconosciuto. `title` mostra il motivo (es. causa dell'ERROR) al passaggio.
 */
export default function StatusChip({ status, title }: { status: string; title?: string }) {
  const style = STYLES[status];
  if (!style) {
    return (
      <span
        className={`bg-grey border-grey inline-block rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide ${muted}`}
      >
        N/D
      </span>
    );
  }
  return (
    <span
      title={title || undefined}
      className={`inline-block rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide ${style}`}
    >
      {status}
    </span>
  );
}
