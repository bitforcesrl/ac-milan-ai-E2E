"use client";

import { ArrowLeft } from "@deemlol/next-icons";
import type { MouseEvent } from "react";

type BackButtonProps = {
    /** Callback custom per il back (es. router.back() o navigazione custom). */
    onBack: () => void;
    /** Label accessibile e visibile del pulsante. */
    label: string;
    /** Classi Tailwind per lo stile (passate da PageHeader). */
    className?: string;
};

/**
 * Pulsante "indietro" client-side: esegue la callback fornita
 * (tipicamente history back) con gestione tastiera inclusa nel <button>.
 */
export default function BackButton({ onBack, label, className }: BackButtonProps) {

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        onBack();
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className={`group/back ${className ?? ""}`}
            aria-label={label}
        >
            <ArrowLeft
                size={16}
                aria-hidden="true"
                className="transition-transform duration-200 group-hover/back:-translate-x-0.5"
            />
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}