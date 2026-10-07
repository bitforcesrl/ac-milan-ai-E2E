// Postinstall: prepara la cartella configs/ e installa i browser Playwright.
// I browser servono SOLO per eseguire i test E2E (locale / pipeline Azure).
// Su Vercel (build della dashboard Next.js) vengono saltati: l'ambiente non
// ha apt-get e i browser non servono.
import { execSync } from 'node:child_process';

// 1. Copia configs.template/ -> configs/ (solo se assente, non distruttivo)
execSync('test -d configs || cp -R configs.template configs', { stdio: 'inherit' });

// 2. Browser Playwright: salta su Vercel
if (process.env.VERCEL) {
    console.log('[postinstall] Ambiente Vercel rilevato: salto installazione browser Playwright.');
} else {
    execSync('playwright install --with-deps chromium firefox webkit', { stdio: 'inherit' });
}
