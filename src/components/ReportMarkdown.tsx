'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Renderizza l'HTML del report Markdown e aggiunge una lightbox: cliccando
 * uno screenshot si apre una modale con l'immagine ingrandita (chiusura con
 * click sull'overlay, tasto X o tasto Esc).
 */
export default function ReportMarkdown({ html }: { html: string }) {
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

    // Delegazione dell'evento: qualunque <img> dentro l'articolo apre la lightbox
    const handleArticleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
        const target = e.target as HTMLElement;
        const img = target.closest('img');
        if (img instanceof HTMLImageElement && img.src) {
            e.preventDefault();
            setLightboxSrc(img.src);
        }
    }, []);

    const close = useCallback(() => setLightboxSrc(null), []);

    useEffect(() => {
        if (!lightboxSrc) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxSrc, close]);

    return (
        <>
            <article
                className="report-markdown min-w-0 [&_img]:cursor-zoom-in"
                onClick={handleArticleClick}
                dangerouslySetInnerHTML={{ __html: html }}
            />

            {lightboxSrc && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Screenshot ingrandito"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
                    onClick={close}
                >
                    <button
                        type="button"
                        aria-label="Chiudi"
                        className="absolute top-4 right-4 rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-black hover:bg-white"
                        onClick={close}
                    >
                        ✕ Chiudi
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={lightboxSrc}
                        alt="Screenshot ingrandito"
                        className="max-h-full max-w-full rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}