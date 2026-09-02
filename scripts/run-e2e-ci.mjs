import { Agent, CursorAgentError } from '@cursor/sdk';

const apiKey = process.env.CURSOR_API_KEY?.trim();
if (!apiKey || apiKey.startsWith('$(')) {
  console.error('CURSOR_API_KEY is missing. Add it to the Azure variable group acmilan-e2e-secrets.');
  process.exit(1);
}

const prompt = `Sei in CI Azure, senza operatore umano. Esegui i test E2E di questo repository.

Regole:
1. Leggi .roo/rules/instruction.md e rispettane tutte le regole (report, screenshot solo sui bug, italiano, cleanup).
2. Usa SOLO launcher-ci.yaml (ignora launcher.yaml).
3. Esegui i test con action: run. Salta quelli con skip. Se un test ha action: only, esegui solo quello.
4. Usa Playwright MCP per il browser: profilo isolato, headless, viewport da config.viewport del launcher.
5. Chiudi cookie banner / popup / overlay upsell come da istruzioni.
6. Scrivi i report in reports/ con la struttura richiesta dalle istruzioni.
7. Alla fine crea reports/ci-summary.md con: data, test eseguiti, esito, path dei report, conteggio bug HIGH/MEDIUM/LOW.
8. Non chiedere conferma. Non committare. Non modificare i file di test.

Quando hai finito, l'ultima riga della tua risposta deve essere esattamente una di queste:
CI_STATUS=PASS
CI_STATUS=FAIL

Usa FAIL se almeno un bug HIGH e' stato trovato, oppure se un test non e' completabile.`;

await main();

async function main() {
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
            'chromium',
          ],
          cwd: process.cwd(),
          env: {
            PLAYWRIGHT_MCP_BROWSER: 'chromium',
            PLAYWRIGHT_MCP_ISOLATED: 'true',
          },
        },
      },
    });

    const run = await agent.send(prompt);
    console.log(`agentId=${agent.agentId} runId=${run.id} requestId=${run.requestId ?? ''}`);

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
    console.log('\n--- run finished ---');
    console.log(`status=${result.status} durationMs=${result.durationMs ?? 'n/a'}`);
    if (result.usage) {
      console.log(`tokens total=${result.usage.totalTokens} in=${result.usage.inputTokens} out=${result.usage.outputTokens}`);
    }

    if (result.status === 'error') {
      console.error('run failed:', result.error?.message ?? result.id);
      process.exitCode = 2;
      return;
    }

    if (result.status === 'cancelled') {
      console.error('run cancelled:', result.id);
      process.exitCode = 2;
      return;
    }

    if (!text.includes('CI_STATUS=PASS')) {
      console.error('CI_STATUS is not PASS.');
      process.exitCode = 2;
    }
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error(`startup failed: ${err.message} retryable=${err.isRetryable}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  } finally {
    if (agent?.[Symbol.asyncDispose]) {
      await agent[Symbol.asyncDispose]();
    }
  }
}
