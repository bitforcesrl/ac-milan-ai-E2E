// Risolve UNA sola volta il flusso di esecuzione della pipeline E2E e stampa
// le variabili di output per Azure DevOps (comandi ##vso[task.setvariable]).
// Chiamato dal job "resolve_flow" in azure-pipelines.yml: le variabili vengono
// propagate ai job successivi via dependencies.*.outputs.
//
// Flussi:
// - pull-request -> PR su main: config configs/pr.config.json, destinatario =
//                   autore della PR (Build.RequestedForEmail), invio solo su FAIL
// - app          -> run triggerata dall'app Next.js (template parameter
//                   e2eRunConfig passato da /api/azure-pipeline, esposto come
//                   env E2E_RUN_CONFIG nel job): destinatari = emailRecipients
//                   nel JSON, invio SEMPRE (pass o fail)
// - pipeline     -> lancio manuale/schedule su main: configs/pipeline.config.json,
//                   destinatari = EMAIL_SCHEDULED_RECIPIENTS, invio solo su FAIL
//
// Output variables:
// - RUN_MODE:         pull-request | app | pipeline
// - E2E_CONFIG_FILE:  path del file di config per run-e2e.mjs
// - EMAIL_RECIPIENTS: destinatari email (virgola-separati, formato SendGrid)
// - EMAIL_SEND_POLICY: always | on-fail

const EMAIL_REGEX = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function getCleanEnv(key) {
  const val = process.env[key]?.trim();
  if (!val || val.startsWith('$(')) return '';
  return val;
}

// Estrae emailRecipients dalla run config inline (JSON) senza esporre il JSON
// alla shell: node -e legge l'argomento via process.argv.
function extractRunConfigRecipients(runConfigJson) {
  try {
    const config = JSON.parse(runConfigJson);
    if (!Array.isArray(config.emailRecipients)) return '';
    return config.emailRecipients
      .map((e) => String(e).trim().toLowerCase())
      .filter((e) => EMAIL_REGEX.test(e))
      .join(',');
  } catch (err) {
    console.error(`[flow] Run config inline non valida: ${err.message}`);
    return '';
  }
}

function resolveFlow() {
  const buildReason = getCleanEnv('BUILD_REASON');
  const requestedForEmail = getCleanEnv('BUILD_REQUESTED_FOR_EMAIL');
  const runConfigJson = getCleanEnv('E2E_RUN_CONFIG');
  const emailTo = getCleanEnv('EMAIL_SCHEDULED_RECIPIENTS');

  if (buildReason === 'PullRequest') {
    return {
      runMode: 'pull-request',
      config: 'configs/pr.config.json',
      recipients: requestedForEmail,
      policy: 'on-fail',
      warn: requestedForEmail
        ? null
        : "BUILD_REQUESTED_FOR_EMAIL non valorizzata: impossibile determinare l'autore della PR.",
    };
  }

  if (runConfigJson) {
    return {
      runMode: 'app',
      config: `${process.env.AGENT_TEMPDIRECTORY || '/tmp'}/run-config.json`,
      recipients: extractRunConfigRecipients(runConfigJson),
      policy: 'always',
      warn: null,
    };
  }

  return {
    runMode: 'pipeline',
    config: 'configs/pipeline.config.json',
    recipients: emailTo,
    policy: 'on-fail',
    warn: emailTo
      ? null
      : 'EMAIL_SCHEDULED_RECIPIENTS non configurata: nessun destinatario per run trigger/schedule.',
  };
}

// ============================================================================
// MAIN
// ============================================================================

const flow = resolveFlow();

// Per il flusso "app" materializza la run config inline su file temporaneo:
// run-e2e.mjs la legge via --config senza che il JSON passi dalla shell.
if (flow.runMode === 'app') {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  try {
    mkdirSync(dirname(flow.config), { recursive: true });
    writeFileSync(flow.config, getCleanEnv('E2E_RUN_CONFIG'), 'utf8');
    console.log(`[flow] Run config inline materializzata su ${flow.config}`);
  } catch (err) {
    console.error(`[flow ERROR] Impossibile scrivere ${flow.config}: ${err.message}`);
    process.exit(1);
  }
}

// Variabili di output per Azure DevOps (lette dai job successivi via
// dependencies.resolve_flow.outputs['resolve_flow.<NOME>'])
const outputs = {
  RUN_MODE: flow.runMode,
  E2E_CONFIG_FILE: flow.config,
  EMAIL_RECIPIENTS: flow.recipients,
  EMAIL_SEND_POLICY: flow.policy,
};

for (const [name, value] of Object.entries(outputs)) {
  console.log(`##vso[task.setvariable variable=${name};isOutput=true]${value}`);
}

console.log(
  `[flow] Flusso risolto: mode=${flow.runMode} config=${flow.config} policy=${flow.policy} destinatari=${flow.recipients || '(nessuno)'}`
);
if (flow.warn) {
  console.warn(`[flow] ${flow.warn}`);
}
