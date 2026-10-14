// Postinstall: prepara configs/ e azure-pipelines.yml (via `npm run setup`),
// poi installa i browser Playwright.
// I browser servono SOLO per eseguire i test E2E (locale / pipeline Azure).
// Su Vercel (build della dashboard Next.js) vengono saltati: l'ambiente non
// ha apt-get e i browser non servono.
import { execSync } from 'node:child_process';

// 1. Copia i template (configs.template/ -> configs/, azure-pipelines.template.yml
//    -> azure-pipelines.yml): solo se assenti, non distruttivo
execSync('npm run setup --silent', { stdio: 'inherit' });

// 2. Browser Playwright: salta su Vercel
if (process.env.VERCEL) {
  console.log('[postinstall] Ambiente Vercel rilevato: salto installazione browser Playwright.');
} else {
  execSync('playwright install --with-deps chromium firefox webkit', { stdio: 'inherit' });
}
