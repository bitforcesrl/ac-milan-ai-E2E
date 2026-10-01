import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "@deemlol/next-icons";
import BackButton from "@/components/BackButton";

/** Contenitore condiviso: stessa larghezza e padding di tutte le pagine. */
const CONTAINER_CLASS = "mx-auto w-full max-w-7xl px-4 sm:px-6";

/** Logo: cliccabile verso la home, con hover state e accessibilità. */
const LOGO_CLASS =
    "flex shrink-0 items-center gap-2.5 rounded-sm transition-opacity duration-200 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2";

/** Wordmark del logo: maiuscoletto spaziato, stile editoriale classico. */
const LOGO_TEXT_CLASS =
    "text-xs font-bold uppercase tracking-[0.2em] text-primary";

/** Back-button: pill con bordo hairline, freccia animata in hover. */
const BACK_CLASS =
    "group/back inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 text-sm font-medium text-dark-grey transition-all duration-200 hover:border-black/25 hover:text-black hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

/** Azioni a destra: contenitore flessibile per bottoni primari/secondari/icona. */
const ACTIONS_CLASS = "flex shrink-0 items-center gap-2 sm:gap-3";

type PageHeaderProps = {
    /** Titolo della pagina (heading semantico). */
    title: string;
    /** Sottotitolo/descrizione opzionale mostrato sotto il titolo. */
    description?: string;
    /**
     * Logo custom: se assente viene usato il nome client come wordmark.
     * Passare un ReactNode (es. <Image />) per un logo grafico.
     */
    logo?: ReactNode;
    /** Testo/wordmark del logo (default: NEXT_PUBLIC_CLIENT_NAME). */
    logoText?: string;
    /** Abilita il pulsante "indietro". */
    showBack?: boolean;
    /**
     * Comportamento del back: callback custom (es. router.back())
     * oppure route custom via backHref. Ha precedenza su backHref.
     */
    onBack?: () => void;
    /** Route di destinazione del back-link (se onBack non è fornito). */
    backHref?: string;
    /** Label del pulsante back (default: "Indietro"). */
    backLabel?: string;
    /**
     * Back-link dichiarativo (API legacy, mantenuta per compatibilità):
     * equivalente a showBack + backHref + backLabel.
     */
    backLink?: {
        href: string;
        label: string;
    };
    /** Azioni allineate a destra (bottoni primary/secondary/icon). */
    actions?: ReactNode;
    /** Livello di heading semantico (default: h1; usare h2 nelle sotto-pagine). */
    headingLevel?: "h1" | "h2";
};

/**
 * Header di pagina classico ed elegante, su due livelli:
 *  1. barra utility sticky (logo · back) con bordo hairline;
 *  2. area titolo ampia e ariosa con barra di accento verticale,
 *     tipografia display grande, descrizione opzionale e azioni a destra.
 * Separazione dal contenuto: bordo inferiore sottile + ombra leggera.
 * Tema unico chiaro (nessuna variante dark).
 */
export default function PageHeader({
    title,
    description,
    logo,
    logoText = process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Client",
    showBack = false,
    onBack,
    backHref,
    backLabel = "Indietro",
    backLink,
    actions,
    headingLevel: Heading = "h1",
}: PageHeaderProps) {
    // Compatibilità: backLink dichiarativo → showBack + backHref + backLabel
    const effectiveShowBack = showBack || Boolean(backLink);
    const effectiveBackHref = backHref ?? backLink?.href;
    const effectiveBackLabel = backLink?.label ?? backLabel;

    return (
        <header className="border-b border-black/10 bg-grey shadow-card">
            {/* ── Livello 1: barra utility sticky ─────────────────────────── */}
            <div className="sticky top-0 z-30 border-b border-black/5 bg-grey/90 backdrop-blur-sm">
                <div
                    className={`${CONTAINER_CLASS} flex h-14 items-center gap-3 sm:gap-4 animate-fade-in`}
                >
                    {/* Logo — link alla home, cliccabile e accessibile */}
                    <Link
                        href="/"
                        className={LOGO_CLASS}
                        aria-label={`${logoText} — Torna alla home`}
                    >
                        {logo ?? <span className={LOGO_TEXT_CLASS}>{logoText}</span>}
                    </Link>

                    {/* Area back — pulsante con freccia, history back o route custom */}
                    {effectiveShowBack && (
                        <nav aria-label="Navigazione secondaria">
                            {onBack ? (
                                <BackButton
                                    onBack={onBack}
                                    label={effectiveBackLabel}
                                    className={BACK_CLASS}
                                />
                            ) : effectiveBackHref ? (
                                <Link
                                    href={effectiveBackHref}
                                    className={BACK_CLASS}
                                    aria-label={effectiveBackLabel}
                                >
                                    <ArrowLeft
                                        size={16}
                                        aria-hidden="true"
                                        className="transition-transform duration-200 group-hover/back:-translate-x-0.5"
                                    />
                                    <span className="hidden sm:inline">{effectiveBackLabel}</span>
                                </Link>
                            ) : null}
                        </nav>
                    )}
                </div>
            </div>

            {/* ── Livello 2: titolo display con barra di accento ──────────── */}
            <div className={`${CONTAINER_CLASS} animate-fade-up`}>
                <div className="flex items-start justify-between gap-4 py-7 sm:gap-5 sm:py-9">
                    <div className="flex min-w-0 items-start gap-4 sm:gap-5">

                        <div className="min-w-0">
                            <Heading className="truncate text-2xl font-bold leading-tight tracking-tight text-primary sm:text-4xl sm:leading-[1.15]">
                                {title}
                            </Heading>
                            {description && (
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-dark-grey/80 sm:text-[15px] sm:leading-7">
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Slot azioni a destra — primarie/secondarie/icon buttons,
                        allineate al titolo per massima visibilità */}
                    {actions && <div className={ACTIONS_CLASS}>{actions}</div>}
                </div>
            </div>
        </header>
    );
}
