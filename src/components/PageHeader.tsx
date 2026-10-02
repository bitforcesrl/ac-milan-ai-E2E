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

/**
 * Azioni a destra: contenitore flessibile che applica ai figli lo stesso
 * stile pill del back-button (bordo hairline, hover, focus ring).
 */
const ACTIONS_CLASS =
    "flex shrink-0 items-center gap-2 sm:gap-3 [&>*]:inline-flex [&>*]:h-9 [&>*]:items-center [&>*]:gap-1.5 [&>*]:rounded-full [&>*]:border [&>*]:border-black/10 [&>*]:bg-white [&>*]:px-3.5 [&>*]:text-sm [&>*]:font-medium [&>*]:text-dark-grey [&>*]:transition-all [&>*]:duration-200 [&>*]:hover:border-black/25 [&>*]:hover:text-black [&>*]:hover:shadow-card [&>*]:focus-visible:outline-none [&>*]:focus-visible:ring-2 [&>*]:focus-visible:ring-primary/50 [&>*]:focus-visible:ring-offset-2 [&>*]:active:scale-[0.98] [&>*]:disabled:pointer-events-none [&>*]:disabled:opacity-50";

type PageHeaderProps = {
    /** Titolo della pagina (heading semantico). */
    title: string;
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
 * Header di pagina compatto su un solo livello: barra utility sticky
 * (back · logo · titolo) con azioni allineate a destra.
 * Il logo è sempre presente: sulla home precede il titolo, nelle
 * sotto-pagine segue il pulsante back.
 * Separazione dal contenuto: bordo inferiore sottile + ombra leggera.
 * Tema unico chiaro (nessuna variante dark).
 */
export default function PageHeader({
    title,
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
            {/* ── Barra utility sticky: back · logo · titolo · azioni ─────── */}
            <div className="sticky top-0 z-30 border-b border-black/5 bg-grey/90 backdrop-blur-sm">
                <div
                    className={`${CONTAINER_CLASS} flex h-14 items-center gap-3 sm:gap-4 animate-fade-in`}
                >
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

                    {/* Logo — sempre presente; nelle sotto-pagine segue il back */}
                    <Link
                        href="/"
                        className={LOGO_CLASS}
                        aria-label={`${logoText} — Torna alla home`}
                    >
                        {logo ?? <span className={LOGO_TEXT_CLASS}>{logoText}</span>}
                    </Link>

                    {/* Separatore editoriale tra logo e titolo */}
                    <span aria-hidden="true" className="shrink-0 text-xs font-bold text-primary/40">
                        —
                    </span>

                    {/* Titolo pagina */}
                    <div className="min-w-0 flex-1">
                        <Heading
                            className="truncate text-xs font-bold uppercase leading-tight tracking-[0.2em] text-primary"
                            title={title}
                        >
                            {title}
                        </Heading>
                    </div>

                    {/* Slot azioni a destra — primarie/secondarie/icon buttons */}
                    {actions && <div className={ACTIONS_CLASS}>{actions}</div>}
                </div>
            </div>
        </header>
    );
}
