import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import dotenv from 'dotenv';
import { marked } from 'marked';

// ============================================================================
// 1. CONFIGURAZIONE & SETUP
// ============================================================================

dotenv.config({ quiet: true });

const CONFIG = {
  reportsDir: 'reports',
  clientName: getClientName(),
};

// Formato cartella run: yyyy-MM-dd_hh:mm:ss
const RUN_DIR_RE = /^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2}$/;

function getClientName() {
  const raw = process.env.CLIENT_NAME?.trim();
  return !raw || raw.startsWith('$(') ? '' : raw;
}

function normalizePath(pathStr) {
  return pathStr.replace(/\\/g, '/');
}

// ============================================================================
// 2. LETTURA METADATA & RAGGRUPPAMENTO DATI
// ============================================================================

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`[build] JSON non valido in ${path}: ${err.message}`);
    return null;
  }
}

function loadSessionMetadata(sessionDir) {
  const data = readJson(join(sessionDir, 'metadata.json'));
  return Array.isArray(data?.tests) ? data : null;
}

function loadRunMetadata(runDir) {
  return readJson(join(runDir, 'metadata.json'));
}

function buildStats(metadata) {
  const tests = metadata.tests ?? [];
  const pass = tests.filter((t) => t.status === 'PASS').length;
  const fail = tests.filter((t) => t.status === 'FAIL').length;
  const total = pass + fail;
  const bugs = metadata.bugs ?? {};

  return {
    pass,
    fail,
    total,
    passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
    high: Number(bugs.high) || 0,
    medium: Number(bugs.medium) || 0,
    low: Number(bugs.low) || 0,
    duration: metadata.duration ?? '',
  };
}

function buildTestLinks(metadata) {
  return (metadata.tests ?? []).map((t) => {
    const mdPath = typeof t.report === 'string' && t.report ? t.report.replace(/^reports\//, '') : '';
    const htmlPath = mdPath ? mdPath.replace(/\.md$/i, '.html') : '';
    const exists = mdPath && existsSync(join(CONFIG.reportsDir, mdPath));
    const label = (typeof t.name === 'string' && t.name ? t.name : basename(mdPath || '', '.md')).replace(/\.md$/i, '');

    return {
      label: label || 'Test',
      href: exists ? htmlPath : '',
      status: t.status === 'FAIL' ? 'FAIL' : t.status === 'PASS' ? 'PASS' : '',
    };
  });
}

function findTestEntry(metadata, mdRelPath) {
  const target = `reports/${normalizePath(mdRelPath)}`;
  return (metadata?.tests ?? []).find((t) => normalizePath(String(t.report ?? '')) === target) ?? null;
}

function buildSessionViewModel(session) {
  const { browser, viewport: folderViewport, metadata, runMeta, sessionDir } = session;
  const stats = buildStats(metadata);
  const testLinks = buildTestLinks(metadata);

  const viewport =
    typeof metadata.viewport === 'string' && metadata.viewport ? metadata.viewport : folderViewport;
  const browserName =
    (typeof metadata.browser === 'string' && metadata.browser ? metadata.browser : browser) ||
    'sconosciuto';

  const summaryMdPath = join(sessionDir, 'summary.md');
  const summaryHref = existsSync(summaryMdPath)
    ? normalizePath(relative(CONFIG.reportsDir, summaryMdPath.replace(/\.md$/i, '.html')))
    : '';

  const screenshots = (Array.isArray(metadata.screenshotPaths) ? metadata.screenshotPaths : [])
    .map((p) => normalizePath(String(p).replace(/^reports\//, '')))
    .filter((p) => p && existsSync(join(CONFIG.reportsDir, p)));

  return {
    name: browser,
    label: browserName,
    date: typeof runMeta.date === 'string' ? runMeta.date : '',
    time: typeof runMeta.time === 'string' ? runMeta.time : '',
    status: metadata.status === 'FAIL' ? 'FAIL' : metadata.status === 'PASS' ? 'PASS' : '',
    stats,
    testLinks,
    href: summaryHref,
    browser: browserName,
    viewport,
    model: typeof metadata.model === 'string' ? metadata.model : '',
    duration: typeof metadata.duration === 'string' ? metadata.duration : '',
    screenshots,
    sessionDir,
  };
}

function buildRunViewModel(sessions) {
  const items = sessions.map(buildSessionViewModel);
  const runMeta = sessions[0].runMeta ?? {};

  const pass = items.reduce((sum, v) => sum + (v.stats?.pass ?? 0), 0);
  const fail = items.reduce((sum, v) => sum + (v.stats?.fail ?? 0), 0);
  const total = pass + fail;
  const bugs = items.reduce(
    (acc, v) => ({
      high: acc.high + (v.stats?.high ?? 0),
      medium: acc.medium + (v.stats?.medium ?? 0),
      low: acc.low + (v.stats?.low ?? 0),
    }),
    { high: 0, medium: 0, low: 0 },
  );

  const rawStatus = typeof runMeta.status === 'string' ? runMeta.status : '';
  const status =
    rawStatus === 'PASS' || rawStatus === 'FAIL' ? rawStatus : fail > 0 ? 'FAIL' : total > 0 ? 'PASS' : '';

  const environments = [];
  for (const v of items) {
    if (!environments.some((e) => e.browser === v.browser && e.viewport === v.viewport)) {
      environments.push({ browser: v.browser, viewport: v.viewport });
    }
  }

  const durations = items.map((v) => v.duration).filter(Boolean);

  return {
    name: sessions[0].run,
    label: runMeta.date ? `${runMeta.date} — ore ${runMeta.time ?? ''}`.trim() : sessions[0].run,
    date: typeof runMeta.date === 'string' ? runMeta.date : '',
    time: typeof runMeta.time === 'string' ? runMeta.time : '',
    status,
    pass,
    fail,
    total,
    passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
    bugs,
    duration: durations[0] ?? '',
    environments,
    items,
    detailHref: `${sessions[0].run}/run-detail.html`,
  };
}

function groupByRun(sessions) {
  const runMap = new Map();

  for (const session of sessions) {
    const key = session.run;
    if (!runMap.has(key)) runMap.set(key, []);
    runMap.get(key).push(session);
  }

  const keys = [...runMap.keys()].sort((a, b) => b.localeCompare(a));

  return keys.map((key) => buildRunViewModel(runMap.get(key)));
}

// ============================================================================
// 3. ENGINE MARKDOWN
// ============================================================================

class RenderContext {
  constructor(htmlDir) {
    this.usedIds = new Set();
    this.toc = [];
    this.currentDir = htmlDir;
  }

  getUniqueId(base) {
    let id = base;
    for (let n = 2; this.usedIds.has(id); n += 1) {
      id = `${base}-${n}`;
    }
    this.usedIds.add(id);
    return id;
  }

  resolveAsset(value) {
    const match = /^(?:\.\/)?(?:reports\/)?([\w\-.:]+(?:\/[\w\-.:]+)*?\.(?:png|jpe?g|webp|gif))$/i.exec(String(value).trim());
    if (!match) return '';

    const file = match[1];
    if (!existsSync(join(CONFIG.reportsDir, file))) return '';

    const href = normalizePath(relative(this.currentDir, join(CONFIG.reportsDir, file)));
    return `<img src="${escapeAttr(href)}" alt="${escapeAttr(file)}" loading="lazy">`;
  }
}

function configureMarked() {
  let currentContext = null;

  marked.use({
    breaks: true,
    renderer: {
      heading({ tokens, depth, text }) {
        const baseSlug = slugify(text);
        const id = currentContext ? currentContext.getUniqueId(baseSlug) : baseSlug;
        if (depth === 2 && currentContext) {
          currentContext.toc.push({ id, text: this.parser.parseInline(tokens) });
        }
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      code({ text }) {
        return currentContext?.resolveAsset(text) || `<code>${escapeHtml(text)}</code>`;
      },
      codespan({ text }) {
        return currentContext?.resolveAsset(text) || `<code>${escapeHtml(text)}</code>`;
      },
      link({ href, title, tokens }) {
        const img = currentContext?.resolveAsset(href);
        if (img) return img;
        const label = this.parser.parseInline(tokens);
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
        return `<a href="${escapeAttr(href)}"${titleAttr}>${label}</a>`;
      },
      image({ href, title, text }) {
        const img = currentContext?.resolveAsset(href);
        if (img) return img;
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
        return `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}"${titleAttr} loading="lazy">`;
      },
    },
  });

  return (rawMarkdown, ctx) => {
    currentContext = ctx;
    const html = marked.parse(rawMarkdown);
    currentContext = null;
    return wrapTables(html);
  };
}

const renderMarkdown = configureMarked();

// ============================================================================
// 4. UNICA SEZIONE TEMPLATE HTML, COMPONENTI & STILI CSS
// ============================================================================

// --- 4.1 CSS BASE ---
const CSS_STYLES = `
  :root {
    --canvas: #f6f7f9;
    --paper: #ffffff;
    --ink: #0f172a;
    --graphite: #64748b;
    --rule: #e2e8f0;
    --wash: #f1f5f9;
    --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
    --display: "Bricolage Grotesque", sans-serif;
    --text: "Instrument Sans", sans-serif;
    --mono: "JetBrains Mono", monospace;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --canvas: #0b0f17;
      --paper: #151d2a;
      --ink: #f8fafc;
      --graphite: #94a3b8;
      --rule: #1e293b;
      --wash: #1e293b;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
    }
  }

  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-padding-top: 24px; }
  body {
    margin: 0;
    background: var(--canvas);
    color: var(--ink);
    font: 400 1rem/1.6 var(--text);
    -webkit-font-smoothing: antialiased;
  }
  a { color: inherit; text-decoration-color: var(--rule); text-underline-offset: 3px; }
  a:hover { text-decoration-color: currentColor; }

  .shell {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 48px;
    max-width: 1280px;
    margin: 0 auto;
    padding-inline: 24px;
  }
  .rail {
    position: sticky;
    top: 0;
    align-self: start;
    max-height: 100vh;
    overflow-y: auto;
    padding-block: 40px;
    font-size: 0.9rem;
  }
  .back { display: inline-flex; align-items: center; gap: 8px; color: var(--graphite); text-decoration: none; font-weight: 500; }
  .back:hover { color: var(--ink); }

  .run { margin: 24px 0 20px; padding-bottom: 20px; border-bottom: 1px solid var(--rule); }
  .run-name { margin: 0; font: 600 1.25rem/1.2 var(--display); }
  .run-date { margin: 4px 0 0; color: var(--graphite); font-size: 0.85rem; }

  .toc ol { list-style: none; margin: 0; padding: 0; }
  .toc a { display: block; padding: 5px 0 5px 12px; border-left: 2px solid transparent; color: var(--graphite); text-decoration: none; }
  .toc a:hover { color: var(--ink); }
  .toc a[aria-current] { color: var(--ink); border-left-color: var(--ink); font-weight: 600; }

  .doc { min-width: 0; max-width: 840px; padding-block: 40px 100px; }

  h1 { margin: 0 0 24px; font-size: clamp(2.2rem, 3vw + 1rem, 3.5rem); font-weight: 700; letter-spacing: -0.02em; }
  h2 { margin: 48px 0 16px; font-size: 1.6rem; font-weight: 600; }
  h3 { margin: 32px 0 12px; font-size: 1.2rem; font-weight: 600; }

  .table-wrap { margin: 20px 0; overflow-x: auto; background: var(--paper); border: 1px solid var(--rule); border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--rule); }
  th { font-weight: 600; color: var(--graphite); background: var(--wash); }

  .status-badge { display: inline-block; margin-top: 12px; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; }
  .status-badge.pass { background: #dcfce7; color: #15803d; }
  .status-badge.fail { background: #fee2e2; color: #b91c1c; }

  .status-banner { padding: 14px 18px; border-radius: 8px; font-weight: 600; margin-bottom: 28px; }
  .status-banner.pass { background: #dcfce7; color: #15803d; border-left: 4px solid #22c55e; }
  .status-banner.fail { background: #fee2e2; color: #b91c1c; border-left: 4px solid #ef4444; }

  @media (prefers-color-scheme: dark) {
    .status-badge.pass { background: #064e3b; color: #6ee7b7; }
    .status-badge.fail { background: #7f1d1d; color: #fca5a5; }
    .status-banner.pass { background: #064e3b; color: #6ee7b7; border-left-color: #10b981; }
    .status-banner.fail { background: #7f1d1d; color: #fca5a5; border-left-color: #f43f5e; }
  }

  .chip { display: inline-block; padding: 2px 8px; border-radius: 4px; font: 700 0.65rem var(--text); letter-spacing: 0.05em; }
  .chip.pass { background: #dcfce7; color: #15803d; }
  .chip.fail { background: #fee2e2; color: #b91c1c; }
  @media (prefers-color-scheme: dark) {
    .chip.pass { background: #064e3b; color: #6ee7b7; }
    .chip.fail { background: #7f1d1d; color: #fca5a5; }
  }

  .run-tests { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--rule); }
  .run-tests-title { margin: 0 0 10px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--graphite); }
  .run-tests ol { list-style: none; padding: 0; margin: 0; }
  .rail-test-link { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; text-decoration: none; font-size: 0.85rem; }
  .rail-test-link:hover { color: var(--ink); }

  .meta-bit {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin: 6px 0;
    font-size: 0.85rem;
  }
  .meta-bit span { color: var(--graphite); flex-shrink: 0; }
  .meta-bit b { font: 600 0.78rem var(--mono); text-align: right; overflow-wrap: anywhere; }

  .index-page { max-width: 1280px; margin: 0 auto; padding: 40px 24px 100px; }
  .brand { color: var(--graphite); font-weight: 600; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.05em; }
  .lede { color: var(--graphite); font-size: 1.1rem; margin-bottom: 40px; }

  .run-summary {
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: 12px;
    padding: 24px;
    margin-top: 20px;
    box-shadow: var(--shadow);
  }
  .run-summary.pass { border-top: 4px solid #22c55e; }
  .run-summary.fail { border-top: 4px solid #ef4444; }

  .run-summary-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .run-summary-name { margin: 0; font: 600 1.25rem var(--display); }
  .run-summary-name a { text-decoration: none; }
  .run-summary-date { margin: 4px 0 0; color: var(--graphite); font-size: 0.85rem; }
  .duration-badge { font-size: 0.8rem; background: var(--wash); padding: 4px 8px; border-radius: 6px; font-weight: 500; }

  .progress-container { margin-top: 18px; display: flex; align-items: center; gap: 12px; }
  .progress-bar { flex: 1; height: 8px; background: var(--wash); border-radius: 999px; overflow: hidden; }
  .progress-fill { height: 100%; background: #22c55e; border-radius: 999px; }
  .run-summary.fail .progress-fill { background: #ef4444; }
  .progress-label { font-size: 0.8rem; font-weight: 600; color: var(--graphite); white-space: nowrap; }

  .run-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; margin: 20px 0 0; padding-top: 16px; border-top: 1px solid var(--rule); }
  .stat dt { font-size: 0.7rem; text-transform: uppercase; color: var(--graphite); font-weight: 600; letter-spacing: 0.05em; }
  .stat dd { margin: 2px 0 0; font: 700 1.2rem var(--display); }
  .stat dd.ok { color: #16a34a; }
  .stat dd.ko { color: #dc2626; }
  .stat dd.warn { color: #d97706; }

  .summary-tests-preview { margin-top: 20px; padding: 12px 16px; background: var(--wash); border-radius: 8px; }
  .summary-tests-title { margin: 0 0 8px; font-size: 0.8rem; font-weight: 600; color: var(--graphite); }
  .summary-tests-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .summary-tests-list a { display: flex; justify-content: space-between; align-items: center; text-decoration: none; font-size: 0.88rem; font-weight: 500; }
  .summary-tests-list a:hover { text-decoration: underline; }

  .run-summary-link { margin: 18px 0 0; text-align: right; font-size: 0.9rem; font-weight: 600; }
  .group-title { margin: 40px 0 12px; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--graphite); border-bottom: 1px solid var(--rule); padding-bottom: 8px; }
  .subgroup-title { margin: 24px 0 12px; font-size: 0.9rem; text-transform: uppercase; color: var(--graphite); }

  .runs { list-style: none; padding: 0; margin: 0; background: var(--paper); border: 1px solid var(--rule); border-radius: 8px; }
  .runs li { border-bottom: 1px solid var(--rule); }
  .runs li:last-child { border-bottom: 0; }
  .runs a { display: flex; justify-content: space-between; padding: 12px 16px; text-decoration: none; }
  .runs-name { font-weight: 500; }
  .runs-date { color: var(--graphite); font-size: 0.85rem; }

  @media (max-width: 860px) {
    .shell { display: block; }
    .rail { position: static; max-height: none; padding-block: 20px 0; }
    .doc { padding-top: 20px; }
  }

  /* --- 4.6 INDEX STILE AZURE PIPELINES & DETTAGLIO RUN --- */
  .runs-table-wrap { margin-top: 8px; border-radius: 10px; }
  .runs-table { font-size: 0.88rem; }
  .runs-table th { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .runs-table td { vertical-align: middle; }
  .run-row { cursor: pointer; transition: background 0.15s ease; }
  .run-row:hover, .run-row:focus-visible { background: var(--wash); outline: none; }
  .run-cell-name { display: block; font-weight: 600; }
  .run-cell-sub { display: block; color: var(--graphite); font-size: 0.75rem; font-family: var(--mono); }

  .outcome { font-weight: 700; white-space: nowrap; }
  .outcome.ok { color: #16a34a; }
  .outcome.ko { color: #dc2626; }
  .runs-table .progress-bar { margin-top: 6px; height: 6px; max-width: 160px; }
  .progress-fill.ok { background: #22c55e; }
  .progress-fill.ko { background: #ef4444; }

  .env-chip {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--wash);
    border: 1px solid var(--rule);
    font: 500 0.72rem var(--mono);
    white-space: nowrap;
  }
  .chip.unknown { background: var(--wash); color: var(--graphite); }
  .muted { color: var(--graphite); }

  .bug-bit {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    background: var(--wash);
    font: 700 0.68rem var(--text);
    letter-spacing: 0.04em;
  }
  .bug-bit.ko { background: #fee2e2; color: #b91c1c; }
  .bug-bit.warn { background: #fef3c7; color: #b45309; }

  .detail-page .back { margin-bottom: 24px; display: inline-block; }
  .detail-page .run-stats { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }

  .detail-session {
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 20px;
    box-shadow: var(--shadow);
  }
  .detail-session h3 { margin: 0 0 4px; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .detail-session h4 { margin: 18px 0 8px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--graphite); }
  .detail-meta { margin: 0; color: var(--graphite); font-size: 0.85rem; }
  .detail-tests { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .detail-test-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: var(--wash);
    border: 1px solid var(--rule);
    border-radius: 8px;
  }
  .detail-test-name { font-size: 0.9rem; font-weight: 600; overflow-wrap: anywhere; }
  .detail-test-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .test-detail-link { font-size: 0.8rem; font-weight: 600; text-decoration: none; white-space: nowrap; }
  .test-detail-link:hover { text-decoration: underline; }

  .detail-shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
  .detail-shots a { display: block; border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; background: var(--wash); }
  .detail-shots img { display: block; width: 100%; height: 120px; object-fit: cover; }

  .status-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-icon .icon { display: block; }
  .status-icon.pass { color: #15803d; background: #dcfce7; }
  .status-icon.fail { color: #b91c1c; background: #fee2e2; }
  .status-icon.unknown { color: var(--graphite); background: var(--wash); }
  .status-cell { width: 48px; text-align: center; }
  .status-cell .status-icon { margin: 0 auto; }

  .env-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .env-chip { margin: 0; }


  .detail-session-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .summary-link { margin: 12px 0 2px; font-size: 0.9rem; }
  .summary-link a { font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
  .summary-link a:hover { color: var(--ink); }

  @media (prefers-color-scheme: dark) {
    .outcome.ok { color: #4ade80; }
    .outcome.ko { color: #f87171; }
    .progress-fill.ok { background: #22c55e; }
    .progress-fill.ko { background: #ef4444; }
    .bug-bit.ko { background: #7f1d1d; color: #fca5a5; }
    .bug-bit.warn { background: #78350f; color: #fcd34d; }
    .status-icon.pass { color: #6ee7b7; background: #064e3b; }
    .status-icon.fail { color: #fca5a5; background: #7f1d1d; }
  }
`;

// --- 4.2 LAYOUT BASE HTML ---
function layout(title, content) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400;500&display=swap">
  <style>
${CSS_STYLES}
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

// --- 4.3 PAGINE HTML (REPORT & INDEX) ---
function reportPage(meta, body, sections, backHref, backLabel) {
  const nav = sections.length
    ? `<nav class="toc" aria-label="Sezioni del report"><ol>${sections
        .map((s) => `<li><a href="#${escapeAttr(s.id)}">${s.text}</a></li>`)
        .join('')}</ol></nav>`
    : '';

  const statusBadge = meta.status
    ? `<p class="status-badge ${meta.status === 'PASS' ? 'pass' : 'fail'}">${
        meta.status === 'PASS' ? iconSvg('pass') : iconSvg('fail')
      } ${meta.status === 'PASS' ? 'PASS' : 'FAIL'}</p>`
    : '';

  const banner = meta.status
    ? `<p class="status-banner ${meta.status === 'PASS' ? 'pass' : 'fail'}">${
        meta.status === 'PASS'
          ? `${iconSvg('pass')} Run superato con successo`
          : `${iconSvg('fail')} Run fallito - Verificare gli errori`
      }</p>`
    : '';

  const metaBits = [
    meta.browser ? `<p class="meta-bit"><span>Browser</span><b>${escapeHtml(meta.browser)}</b></p>` : '',
    meta.viewport ? `<p class="meta-bit"><span>Viewport</span><b>${escapeHtml(meta.viewport)}</b></p>` : '',
    meta.model ? `<p class="meta-bit"><span>Modello AI</span><b>${escapeHtml(meta.model)}</b></p>` : '',
  ]
    .filter(Boolean)
    .join('');

  const runTests = meta.isSummary && meta.testLinks.length
    ? `<div class="run-tests">
        <p class="run-tests-title">Test Eseguiti (${meta.testLinks.length})</p>
        <ol>${meta.testLinks.map((t) => `<li>${testLinkHtml(t, 'rail-test-link')}</li>`).join('')}</ol>
       </div>`
    : '';

  const content = `<div class="shell">
  <aside class="rail">
    <a class="back" href="${escapeAttr(backHref)}">${escapeHtml(backLabel)}</a>
    <div class="run">
      <p class="run-name">${escapeHtml(meta.label)}</p>
      ${meta.date ? `<p class="run-date">${escapeHtml(meta.date)}, ore ${escapeHtml(meta.time)}</p>` : ''}
      ${statusBadge}
      ${metaBits}
    </div>
    ${nav}
    ${runTests}
  </aside>
  <main class="doc">
    ${banner}
    ${body}
  </main>
</div>
<script>
  (() => {
    const links = [...document.querySelectorAll('.toc a')];
    if (!links.length || !('IntersectionObserver' in window)) return;
    const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) => a.removeAttribute('aria-current'));
        byId.get(entry.target.id)?.setAttribute('aria-current', 'true');
      }
    }, { rootMargin: '0px 0px -70% 0px' });
    document.querySelectorAll('.doc h2[id]').forEach((h) => observer.observe(h));
  })();
</script>`;

  return layout(meta.label, content);
}

function indexPage(runs) {
  const rows = runs.map(runRowHtml).join('\n');

  const content = `<main class="index-page">
  ${CONFIG.clientName ? `<p class="brand">${escapeHtml(CONFIG.clientName)}</p>` : ''}
  <h1>Report E2E</h1>
  <p class="lede">Resoconto esecuzioni della pipeline, dettaglio test eseguiti, bug riscontrati e screenshot</p>
  ${
    runs.length
      ? `<div class="table-wrap runs-table-wrap"><table class="runs-table">
  <thead>
    <tr>
      <th>Risultato</th>
      <th>Esecuzione</th>
      <th>Test superati</th>
      <th>Browser</th>
      <th>Viewport</th>
      <th>Durata</th>
      <th>Bug</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table></div>`
      : '<p class="lede">Nessuna esecuzione disponibile.</p>'
  }
</main>
<script>
  (() => {
    document.querySelectorAll('.run-row').forEach((row) => {
      const open = () => {
        const href = row.dataset.href;
        if (href) window.location.href = href;
      };
      row.addEventListener('click', open);
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  })();
</script>`;

  return layout('Report E2E', content);
}

// --- 4.4 COMPONENTI HTML RIPETIBILI ---
function runRowHtml(run) {
  const statusKind = run.status === 'PASS' ? 'pass' : run.status === 'FAIL' ? 'fail' : 'unknown';
  const statusText = run.status === 'PASS' ? 'Successo' : run.status === 'FAIL' ? 'Fallito' : 'Sconosciuto';
  const outcomeClass = run.total > 0 && run.fail === 0 ? 'ok' : run.fail > 0 ? 'ko' : '';

  const browsers = [...new Set(run.environments.map((e) => e.browser))];
  const viewports = [...new Set(run.environments.map((e) => e.viewport).filter(Boolean))];

  const browserChips = browsers.length
    ? `<div class="env-chips">${browsers.map((b) => `<span class="env-chip">${escapeHtml(b)}</span>`).join('')}</div>`
    : '<span class="muted">—</span>';

  const viewportChips = viewports.length
    ? `<div class="env-chips">${viewports.map((v) => `<span class="env-chip">${escapeHtml(v)}</span>`).join('')}</div>`
    : '<span class="muted">—</span>';

  const bugsBits =
    [
      run.bugs.high ? `<span class="bug-bit ko">HIGH ${run.bugs.high}</span>` : '',
      run.bugs.medium ? `<span class="bug-bit warn">MED ${run.bugs.medium}</span>` : '',
      run.bugs.low ? `<span class="bug-bit">LOW ${run.bugs.low}</span>` : '',
    ]
      .filter(Boolean)
      .join(' ') || '<span class="muted">0</span>';

  return `<tr class="run-row" data-href="${escapeAttr(run.detailHref)}" tabindex="0" role="link" aria-label="Apri dettaglio run ${escapeAttr(run.name)}">
    <td class="status-cell"><span class="status-icon ${statusKind}" title="${statusText}" aria-label="${statusText}">${iconSvg(statusKind)}</span></td>
    <td>
      <span class="run-cell-name">${escapeHtml(run.date ? `${run.date}${run.time ? `, ore ${run.time}` : ''}` : run.name)}</span>
      <span class="run-cell-sub">${escapeHtml(run.name)}</span>
    </td>
    <td>
      <div class="outcome ${outcomeClass}">${run.total > 0 ? `${run.pass} / ${run.total} con successo` : 'Nessun test'}</div>
      ${run.total > 0 ? `<div class="progress-bar"><div class="progress-fill ${outcomeClass}" style="width:${run.passRate}%"></div></div>` : ''}
    </td>
    <td>${browserChips}</td>
    <td>${viewportChips}</td>
    <td>${run.duration ? escapeHtml(run.duration) : '<span class="muted">—</span>'}</td>
    <td>${bugsBits}</td>
  </tr>`;
}

// --- 4.4b PAGINA DI DETTAGLIO RUN ---

// Riscrive un path relativo a reports/ come path relativo alla cartella del run
function relFromRun(path, runName) {
  const prefix = `${runName}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function runDetailPage(run) {
  const stats = `<dl class="run-stats">
        <div class="stat"><dt>Test Superati</dt><dd class="ok">${run.pass}</dd></div>
        <div class="stat"><dt>Test Falliti</dt><dd class="${run.fail ? 'ko' : ''}">${run.fail}</dd></div>
        <div class="stat"><dt>Bug HIGH</dt><dd class="${run.bugs.high ? 'ko' : ''}">${run.bugs.high}</dd></div>
        <div class="stat"><dt>Bug MEDIUM</dt><dd class="${run.bugs.medium ? 'warn' : ''}">${run.bugs.medium}</dd></div>
        <div class="stat"><dt>Bug LOW</dt><dd>${run.bugs.low}</dd></div>
        ${run.duration ? `<div class="stat"><dt>Durata</dt><dd>${escapeHtml(run.duration)}</dd></div>` : ''}
      </dl>`;

  const sessionsHtml = run.items.map((vm) => sessionDetailHtml(vm, run.name)).join('\n');

  const content = `<main class="index-page detail-page">
  <a class="back" href="../index.html">← Tutte le esecuzioni</a>
  <h1>${escapeHtml(run.label)}</h1>
  <p class="lede">${run.date ? `${escapeHtml(run.date)}${run.time ? `, ore ${escapeHtml(run.time)}` : ''}` : escapeHtml(run.name)}</p>
  ${stats}
  <h2>Ambienti di test</h2>
  ${sessionsHtml || '<p class="muted">Nessuna sessione disponibile per questo run.</p>'}
</main>`;

  return layout(`Dettaglio run ${run.name}`, content);
}

function sessionDetailHtml(vm, runName) {
  const statusChipHtml = vm.status
    ? statusChip(vm.status)
    : ' <span class="chip unknown" aria-label="Stato non disponibile">N/D</span>';

  const tests = vm.testLinks.length
    ? `<ul class="detail-tests">${vm.testLinks
        .map((t) => {
          const href = t.href ? relFromRun(t.href, runName) : '';
          const chip = t.status ? statusChip(t.status) : ' <span class="chip unknown">N/D</span>';
          const detailLink = href
            ? `<a class="test-detail-link" href="${escapeAttr(href)}">Vai al dettaglio →</a>`
            : '';
          return `<li class="detail-test-row">
            <span class="detail-test-name">${escapeHtml(t.label)}</span>
            <span class="detail-test-actions">${chip}${detailLink}</span>
          </li>`;
        })
        .join('')}</ul>`
    : '<p class="muted">Nessun test registrato per questa sessione.</p>';

  const screenshots = vm.screenshots.length
    ? `<div class="detail-shots">${vm.screenshots
        .map((p) => {
          const href = relFromRun(p, runName);
          const fileName = p.split('/').pop() ?? p;
          return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener"><img src="${escapeAttr(href)}" alt="${escapeAttr(fileName)}" loading="lazy"></a>`;
        })
        .join('')}</div>`
    : '<p class="muted">Nessuno screenshot disponibile.</p>';

  const metaBits = [
    vm.model ? `Modello AI: ${escapeHtml(vm.model)}` : '',
    vm.duration ? `Durata: ${escapeHtml(vm.duration)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const statusKind = vm.status === 'PASS' ? 'pass' : vm.status === 'FAIL' ? 'fail' : 'unknown';
  const statusTitle = vm.status === 'PASS' ? 'Sessione superata' : vm.status === 'FAIL' ? 'Sessione fallita' : 'Stato non disponibile';

  return `<section class="detail-session">
    <header class="detail-session-head">
      <h3>${escapeHtml(vm.label)}${vm.viewport ? ` <span class="env-chip">${escapeHtml(vm.viewport)}</span>` : ''}</h3>
      <span class="status-icon ${statusKind}" title="${statusTitle}" aria-label="${statusTitle}">${iconSvg(statusKind)}</span>
    </header>
    <p class="detail-meta">${metaBits || '<span class="muted">Metadati non disponibili</span>'}</p>
    ${
      vm.href
        ? `<p class="summary-link"><a href="${escapeAttr(relFromRun(vm.href, runName))}">Visualizza resoconto della sessione →</a></p>`
        : ''
    }
    <h4>Dettaglio test</h4>
    ${tests}
    <h4>Screenshot</h4>
    ${screenshots}
  </section>`;
}

function testLinkHtml(test, className) {
  const chip = statusChip(test.status);
  const label = `<span>${escapeHtml(test.label)}</span>${chip}`;
  if (!test.href) return `<div class="${className}">${label}</div>`;
  return `<a href="${escapeAttr(test.href)}" class="${className}">${label}</a>`;
}

function statusChip(status) {
  if (!status) return '';
  return status === 'PASS'
    ? ' <span class="chip pass" aria-label="Superato">PASS</span>'
    : ' <span class="chip fail" aria-label="Fallito">FAIL</span>';
}

// Icone SVG inline (nessuna emoji nella UI)
function iconSvg(kind) {
  if (kind === 'pass') {
    return '<svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15"/><path d="M4.6 8.4l2.4 2.4 4.4-5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (kind === 'fail') {
    return '<svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  if (kind === 'doc') {
    return '<svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5V14.5H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 7h4.5M6 9.5h4.5M6 12h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  }
  return '<svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15"/><path d="M6.2 6.2a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.8.6-.8 1.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.4" r="0.9" fill="currentColor"/></svg>';
}

// Rimuove la sezione "Path Report" (percorsi file) dal markdown dei summary
function stripPathsSection(markdown) {
  const lines = String(markdown).split('\n');
  const out = [];
  let skipping = false;

  for (const line of lines) {
    if (!skipping && /^##\s+Path Report\s*$/i.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && (/^##\s/.test(line) || /^---\s*$/.test(line))) {
      skipping = false;
      if (/^---\s*$/.test(line)) continue; // evita doppi separatori
    }
    if (!skipping) out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n---\s*\n---/g, '\n---');
}

// --- 4.5 HELPER DI SANITIZZAZIONE E STRINGE ---
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}

function slugify(value) {
  return (
    String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'sezione'
  );
}

function wrapTables(html) {
  return html.replaceAll('<table>', '<div class="table-wrap"><table>').replaceAll('</table>', '</table></div>');
}

// ============================================================================
// 5. FILE SYSTEM UTILS
// ============================================================================

function listMarkdownFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listMarkdownFiles(full));
    } else if (entry.endsWith('.md')) {
      files.push(full);
    }
  }
  return files.sort();
}

// ============================================================================
// 6. MAIN BUILD PROCESS
// ============================================================================

function collectSessions() {
  const sessions = [];

  if (!existsSync(CONFIG.reportsDir)) return sessions;

  for (const runDir of readdirSync(CONFIG.reportsDir).sort()) {
    const runPath = join(CONFIG.reportsDir, runDir);
    if (!statSync(runPath).isDirectory() || !RUN_DIR_RE.test(runDir)) continue;

    const runMeta = loadRunMetadata(runPath);
    if (!runMeta) {
      console.warn(`[build] metadata.json di run mancante in ${runPath} — run ignorata.`);
      continue;
    }

    for (const browserDirName of readdirSync(runPath).sort()) {
      const browserDir = join(runPath, browserDirName);
      if (!statSync(browserDir).isDirectory()) continue;

      for (const viewportDirName of readdirSync(browserDir).sort()) {
        const sessionDir = join(browserDir, viewportDirName);
        if (!statSync(sessionDir).isDirectory()) continue;

        const metadata = loadSessionMetadata(sessionDir);
        if (!metadata) {
          console.warn(`[build] metadata.json mancante o invalido in ${sessionDir} — sessione ignorata.`);
          continue;
        }

        sessions.push({
          run: runDir,
          browser: browserDirName,
          viewport: viewportDirName,
          runMeta,
          metadata,
          sessionDir,
        });
      }
    }
  }

  return sessions;
}

function buildHtmlReports() {
  if (!existsSync(CONFIG.reportsDir)) {
    console.log('[build] Nessuna cartella reports/ trovata — skip render HTML.');
    process.exit(0);
  }

  const sessions = collectSessions();
  if (!sessions.length) {
    console.log('[build] Nessuna sessione con metadata.json trovata — skip render HTML.');
    process.exit(0);
  }

  for (const session of sessions) {
    renderSession(session);
  }

  const runs = groupByRun(sessions);

  for (const run of runs) {
    const detailPath = join(CONFIG.reportsDir, run.name, 'run-detail.html');
    writeFileSync(detailPath, runDetailPage(run), 'utf8');
    console.log(`[build] Generato: ${detailPath}`);
  }

  const indexPath = join(CONFIG.reportsDir, 'index.html');
  writeFileSync(indexPath, indexPage(runs), 'utf8');
  console.log(`[build] Generato: ${indexPath} (${sessions.length} sessioni elaborate, ${runs.length} run)`);
}

function renderSession(session) {
  const { browser, metadata, runMeta, sessionDir, run } = session;
  const browserName = (typeof metadata.browser === 'string' && metadata.browser ? metadata.browser : browser) || browser;
  const backHref = normalizePath(relative(sessionDir, join(CONFIG.reportsDir, run, 'run-detail.html'))) || '../run-detail.html';
  const backLabel = '← Torna indietro';
  const testLinks = buildTestLinks(metadata);

  // Pagina summary
  const summaryMd = join(sessionDir, 'summary.md');
  if (existsSync(summaryMd)) {
    const summaryCtx = new RenderContext(sessionDir);
    const summaryBody = renderMarkdown(stripPathsSection(readFileSync(summaryMd, 'utf8')), summaryCtx);
    const summaryHtmlPath = summaryMd.replace(/\.md$/i, '.html');

    writeFileSync(
      summaryHtmlPath,
      reportPage(
        {
          label: browserName,
          date: runMeta.date ?? '',
          time: runMeta.time ?? '',
          status: metadata.status ?? '',
          browser: browserName,
          viewport: metadata.viewport ?? session.viewport ?? '',
          model: metadata.model ?? '',
          isSummary: true,
          testLinks,
        },
        summaryBody,
        summaryCtx.toc,
        backHref,
        backLabel,
      ),
      'utf8',
    );
    console.log(`[build] Generato: ${summaryHtmlPath}`);
  } else {
    console.warn(`[build] summary.md mancante in ${sessionDir}`);
  }

  // Pagine dei test
  for (const link of testLinks) {
    const mdRel = link.href ? link.href.replace(/\.html$/i, '.md') : '';
    const testMdPath = mdRel ? join(CONFIG.reportsDir, mdRel) : '';
    if (!mdRel || !existsSync(testMdPath)) continue;

    const testDir = join(testMdPath, '..');
    const testCtx = new RenderContext(testDir);
    const testBody = renderMarkdown(readFileSync(testMdPath, 'utf8'), testCtx);
    const testHtmlPath = testMdPath.replace(/\.md$/i, '.html');
    const entry = findTestEntry(metadata, mdRel);

    writeFileSync(
      testHtmlPath,
      reportPage(
        {
          label: link.label,
          date: runMeta.date ?? '',
          time: runMeta.time ?? '',
          status: entry?.status ?? '',
          browser: browserName,
          viewport: metadata.viewport ?? session.viewport ?? '',
          model: metadata.model ?? '',
          isSummary: false,
          testLinks: [],
        },
        testBody,
        testCtx.toc,
        backHref,
        backLabel,
      ),
      'utf8',
    );
    console.log(`[build] Generato: ${testHtmlPath}`);
  }
}

// Avvio esecuzione
buildHtmlReports();