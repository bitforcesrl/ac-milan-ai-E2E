import { existsSync, renameSync } from 'node:fs';
import { Agent, CursorAgentError } from '@cursor/sdk';

const apiKey = process.env.CURSOR_API_KEY?.trim();
if (!apiKey || apiKey.startsWith('$(')) {
  console.error('CURSOR_API_KEY is missing. Add it to the Azure variable group acmilan-e2e-secrets.');
  process.exit(1);
}

const browsers = (process.env.BROWSERS || 'chromium,firefox,webkit')
  .split(',')
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

if (!browsers.length) {
  console.error('BROWSERS is empty.');
  process.exit(1);
}

await main();

async function main() {
  let failed = false;

  for (const browser of browsers) {
    console.log(`\n========== E2E on ${browser} ==========\n`);
    const code = await runForBrowser(browser);
    if (code !== 0) {
      failed = true;
      process.exitCode = Math.max(process.exitCode || 0, code);
    }
  }

  if (failed) {
    console.error('One or more browsers failed.');
  }
}

async function runForBrowser(browser) {
  let agent;
  try {
    agent = await Agent.create({
      apiKey,
      model: { id: 'composer-2.5' },
      local: { cwd: process.cwd() },
      mcpServers: {
        playwright: {
          type: 'stdio',
          command: 'npx',
          args: [
            '-y',
            '@playwright/mcp@latest',
            '--headless',
            '--isolated',
            '--browser',
            browser,
          ],
          cwd: process.cwd(),
          env: {
            PLAYWRIGHT_MCP_BROWSER: browser,
            PLAYWRIGHT_MCP_ISOLATED: 'true',
          },
        },
      },
    });

    const run = await agent.send(buildPrompt(browser));
    console.log(`browser=${browser} agentId=${agent.agentId} runId=${run.id} requestId=${run.requestId ?? ''}`);

    for await (const event of run.stream()) {
      if (event.type === 'assistant') {
        for (const block of event.message.content) {
          if (block.type === 'text') process.stdout.write(block.text);
        }
      } else if (event.type === 'tool_call') {
        console.log(`[tool] ${event.name}: ${event.status}`);
      } else if (event.type === 'status') {
        console.log(`[status] ${event.status}${event.message ? ` ${event.message}` : ''}`);
      }
    }

    const result = await run.wait();
    const text = result.result ?? '';
    console.log(`\n--- ${browser} finished ---`);
    console.log(`status=${result.status} durationMs=${result.durationMs ?? 'n/a'}`);
    if (result.usage) {
      console.log(`tokens total=${result.usage.totalTokens} in=${result.usage.inputTokens} out=${result.usage.outputTokens}`);
    }

    archiveSummary(browser);

    if (result.status === 'error') {
      console.error(`${browser} run failed:`, result.error?.message ?? result.id);
      return 2;
    }

    if (result.status === 'cancelled') {
      console.error(`${browser} run cancelled:`, result.id);
      return 2;
    }

    if (!text.includes('CI_STATUS=PASS')) {
      console.error(`${browser}: CI_STATUS is not PASS.`);
      return 2;
    }

    return 0;
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error(`${browser} startup failed: ${err.message} retryable=${err.isRetryable}`);
      return 1;
    }
    throw err;
  } finally {
    if (agent?.[Symbol.asyncDispose]) {
      await agent[Symbol.asyncDispose]();
    }
  }
}

function buildPrompt(browser) {
  return `Sei in CI Azure, senza operatore umano. Esegui i test E2E di questo repository.

Browser obbligatorio per questa run: ${browser}

Regole:
1. Leggi .roo/rules/instruction.md e rispettane tutte le regole (report, screenshot solo sui bug, italiano, cleanup).
2. Usa SOLO launcher-ci.yaml (ignora launcher.yaml).
3. Esegui i test con action: run. Salta quelli con skip. Se un test ha action: only, esegui solo quello.
4. Usa Playwright MCP per il browser ${browser}: profilo isolato, headless, viewport da config.viewport del launcher.
5. Chiudi cookie banner / popup / overlay upsell come da istruzioni.
6. Scrivi i report in reports/ con la struttura richiesta dalle istruzioni. Nel report indica chiaramente il browser: ${browser}.
7. Alla fine crea reports/ci-summary.md con: browser (${browser}), data, test eseguiti, esito, path dei report, conteggio bug HIGH/MEDIUM/LOW.
8. Non chiedere conferma. Non committare. Non modificare i file di test.

Quando hai finito, l'ultima riga della tua risposta deve essere esattamente una di queste:
CI_STATUS=PASS
CI_STATUS=FAIL

Usa FAIL se almeno un bug HIGH e' stato trovato, oppure se un test non e' completabile.`;
}

function archiveSummary(browser) {
  const source = 'reports/ci-summary.md';
  const target = `reports/ci-summary-${browser}.md`;
  if (existsSync(source)) {
    renameSync(source, target);
    console.log(`Saved ${target}`);
  }
}
