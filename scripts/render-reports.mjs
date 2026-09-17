import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import dotenv from 'dotenv';
import { marked } from 'marked';

// Local .env for dev runs; never overrides variables already set (e.g. by the pipeline).
dotenv.config({ quiet: true });

const reportsDir = 'reports';
const pageSize = 30;
// Azure leaves "$(VAR)" unexpanded when the pipeline variable is not defined.
const clientName = !process.env.CLIENT_NAME?.trim() || process.env.CLIENT_NAME.startsWith('$(') ? '' : process.env.CLIENT_NAME.trim();

// Per-file state, reset before each parse.
let usedIds = new Set();
let toc = [];
let currentDir = ''; // directory of the HTML being rendered, to rewrite asset paths

marked.use({
  breaks: true,
  renderer: {
    heading({ tokens, depth, text }) {
      const id = uniqueId(slugify(text));
      if (depth === 2) toc.push({ id, text: this.parser.parseInline(tokens) });
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
    code({ text }) {
      return imageFromAsset(text) || `<code>${escapeHtml(text)}</code>`;
    },
    codespan({ text }) {
      return imageFromAsset(text) || `<code>${escapeHtml(text)}</code>`;
    },
    link({ href, title, tokens }) {
      const img = imageFromAsset(href);
      if (img) return img;
      const label = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
      return `<a href="${escapeAttr(href)}"${titleAttr}>${label}</a>`;
    },
    image({ href, title, text }) {
      const img = imageFromAsset(href);
      if (img) return img;
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
      return `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}"${titleAttr} loading="lazy">`;
    },
  },
});

if (!existsSync(reportsDir)) {
  console.log('No reports/ folder — skip HTML render.');
  process.exit(0);
}

const markdownFiles = listMarkdown(reportsDir);
if (!markdownFiles.length) {
  console.log('No markdown reports found — skip HTML render.');
  process.exit(0);
}

const rendered = markdownFiles.map((mdPath) => {
  const htmlPath = mdPath.replace(/\.md$/i, '.html');
  const fileName = basename(mdPath, '.md');
  const meta = parseReportName(fileName);
  const htmlDir = join(htmlPath, '..');
  const indexHref = relative(htmlDir, join(reportsDir, 'index.html')).replace(/\\/g, '/') || 'index.html';

  usedIds = new Set();
  toc = [];
  const raw = readFileSync(mdPath, 'utf8');
  const isSummary = /^ci-summary-/.test(fileName);
  // Dati strutturati scritti dalla pipeline (ci-data-<browser>.json); fallback: parsing del markdown.
  const ciData = isSummary ? loadCiData(fileName) : null;
  const info = {
    ...meta,
    href: relative(reportsDir, htmlPath).replace(/\\/g, '/'),
    isSummary,
    status: ciData?.status || detectStatus(raw),
    browser: ciData?.browser || detectBrowser(raw, fileName),
    model: ciData?.model || detectModel(raw),
    testLinks: ciData ? ciTestLinks(ciData) : collectTestLinks(raw),
    stats: ciData ? ciStats(ciData) : isSummary ? parseStats(raw) : null,
    screenshots: isSummary ? [] : listScreenshots(htmlDir),
  };

  currentDir = htmlDir;
  const body = wrapTables(marked.parse(raw));

  writeFileSync(htmlPath, reportPage(info, body, toc, indexHref), 'utf8');
  console.log(`Wrote ${htmlPath}`);
  return info;
});

writeFileSync(join(reportsDir, 'index.html'), indexPage(rendered), 'utf8');
console.log(`Wrote ${join(reportsDir, 'index.html')} (${rendered.length} report)`);

function listMarkdown(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listMarkdown(full));
    } else if (entry.endsWith('.md')) {
      files.push(full);
    }
  }
  return files.sort();
}

function parseReportName(name) {
  const match = /^(.+)_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})$/.exec(name);
  if (!match) return { name, label: name, date: '', time: '', sortKey: '' };
  const [, test, y, m, d, hh, mm] = match;
  const words = test.replace(/[-_]+/g, ' ');
  const date = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))),
  );
  return {
    name,
    label: words.length <= 4 ? words.toUpperCase() : words.charAt(0).toUpperCase() + words.slice(1),
    date,
    time: `${hh}:${mm}`,
    sortKey: `${y}${m}${d}${hh}${mm}`,
  };
}

function detectStatus(raw) {
  if (/❌|\bFAIL\b/.test(raw)) return 'FAIL';
  if (/✅|\bPASS\b/.test(raw)) return 'PASS';
  return '';
}

function parseStats(raw) {
  const sev = (name) => {
    const m = new RegExp(`\\|\\s*(?:[\u{1F534}\u{1F7E1}\u{1F7E2}]\\s*)?${name}\\s*\\|\\s*(\\d+)`, 'u').exec(raw);
    return m ? Number(m[1]) : 0;
  };
  const rows = raw.split('\n').filter((l) => /^\|.*\|\s*$/.test(l));
  const countRows = (re) => rows.filter((l) => re.test(l)).length;
  const time = /\*\*(?:Orario|Durata):\*\*\s*([^\n*]+)/.exec(raw);

  const pass = countRows(/(?:✅\s*)?PASS\s*\|?\s*$/);
  const fail = countRows(/(?:❌\s*)?FAIL\s*\|?\s*$/);
  const total = pass + fail;
  const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;

  return {
    pass,
    fail,
    total,
    passRate,
    high: sev('HIGH'),
    medium: sev('MEDIUM'),
    low: sev('LOW'),
    duration: time ? time[1].trim() : '',
  };
}

function loadCiData(fileName) {
  const browser = /^ci-summary-(.+)\.md$/i.exec(fileName)?.[1];
  if (!browser) return null;
  const jsonPath = join(reportsDir, `ci-data-${browser}.json`);
  if (!existsSync(jsonPath)) return null;
  try {
    const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
    if (!Array.isArray(data.tests)) return null;
    return data;
  } catch (err) {
    console.error(`Invalid ${jsonPath}: ${err.message} — fallback a parsing markdown.`);
    return null;
  }
}

function ciStats(data) {
  const pass = data.tests.filter((t) => t.status === 'PASS').length;
  const fail = data.tests.filter((t) => t.status === 'FAIL').length;
  const total = pass + fail;
  const bugs = data.bugs ?? {};
  return {
    pass,
    fail,
    total,
    passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
    high: Number(bugs.high) || 0,
    medium: Number(bugs.medium) || 0,
    low: Number(bugs.low) || 0,
    duration: data.duration ?? '',
  };
}

function ciTestLinks(data) {
  return data.tests.map((t) => {
    const mdPath = typeof t.report === 'string' && t.report ? t.report.replace(/^reports\//, '') : '';
    const htmlPath = mdPath ? mdPath.replace(/\.md$/i, '.html') : '';
    const exists = htmlPath && existsSync(join(reportsDir, htmlPath));
    const parsed = parseReportName(basename(mdPath || t.name || '', '.md'));
    return {
      label: parsed.label || t.name || 'Test',
      href: exists ? htmlPath : '',
      status: t.status === 'FAIL' ? 'FAIL' : t.status === 'PASS' ? 'PASS' : '',
    };
  });
}

function listScreenshots(htmlDir) {
  try {
    const folder = relative(reportsDir, htmlDir).replaceAll('\\', '/');
    return readdirSync(htmlDir)
      .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))
      .sort()
      .slice(0, 4)
      .map((f) => (folder ? `${folder}/${f}` : f));
  } catch {
    return [];
  }
}

function detectBrowser(raw, fileName) {
  const fromName = /^ci-summary-([a-z0-9_-]+)\.md$/i.exec(fileName);
  if (fromName) return fromName[1];
  const fromBody = /\*\*Browser:\*\*\s*([A-Za-z0-9]+)/.exec(raw);
  return fromBody ? fromBody[1] : '';
}

function detectModel(raw) {
  const match = /\*\*Modello AI:\*\*\s*([^\n*]+)/.exec(raw);
  return match ? match[1].trim() : '';
}

function collectTestLinks(raw) {
  const links = new Map();
  const re = /reports\/([\w\-.]+(?:\/[\w\-.]+)*?)\/([\w\-.]+)\.md/g;
  let match;
  while ((match = re.exec(raw))) {
    const folder = match[1];
    if (/^ci-summary/i.test(folder)) continue;
    const name = `${folder}/${match[2]}`;
    if (links.has(name)) continue;

    const mdFile = join(reportsDir, folder, `${match[2]}.md`);
    const htmlFile = join(reportsDir, folder, `${match[2]}.html`);
    if (!existsSync(htmlFile)) continue;

    let status = '';
    if (existsSync(mdFile)) {
      status = detectStatus(readFileSync(mdFile, 'utf8'));
    }

    const parsed = parseReportName(match[2]);
    links.set(name, {
      label: parsed.label,
      href: relative(reportsDir, htmlFile).replace(/\\/g, '/'),
      status,
    });
  }
  return [...links.values()];
}

function imageFromAsset(value) {
  const m = /^(?:\.\/)?(?:reports\/)?([\w\-.]+(?:\/[\w\-.]+)*?\.(?:png|jpe?g|webp|gif))$/i.exec(String(value).trim());
  if (!m) return '';
  const file = m[1];
  if (!existsSync(join(reportsDir, file))) return '';
  const href = relative(currentDir, join(reportsDir, file)).replaceAll('\\', '/');
  return `<img src="${escapeAttr(href)}" alt="${escapeAttr(file)}" loading="lazy">`;
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

function uniqueId(base) {
  let id = base;
  for (let n = 2; usedIds.has(id); n += 1) id = `${base}-${n}`;
  usedIds.add(id);
  return id;
}

function wrapTables(html) {
  return html.replaceAll('<table>', '<div class="table-wrap"><table>').replaceAll('</table>', '</table></div>');
}

function reportPage(meta, body, sections, indexHref) {
  const nav = sections.length
    ? `<nav class="toc" aria-label="Sezioni del report"><ol>${sections
        .map((s) => `<li><a href="#${escapeAttr(s.id)}">${s.text}</a></li>`)
        .join('')}</ol></nav>`
    : '';

  const status = meta.status
    ? `<p class="status-badge ${meta.status === 'PASS' ? 'pass' : 'fail'}">${meta.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}</p>`
    : '';
  const banner = meta.status
    ? `<p class="status-banner ${meta.status === 'PASS' ? 'pass' : 'fail'}">${
        meta.status === 'PASS' ? '✅ Run superato con successo' : '❌ Run fallito - Verificare gli errori'
      }</p>`
    : '';
  const metaBits = [
    meta.browser ? `<p class="meta-bit"><span>Browser</span><b>${escapeHtml(meta.browser)}</b></p>` : '',
    meta.model ? `<p class="meta-bit"><span>Modello AI</span><b>${escapeHtml(meta.model)}</b></p>` : '',
  ]
    .filter(Boolean)
    .join('');

  const runTests = meta.isSummary && meta.testLinks.length
    ? `<div class="run-tests">
        <p class="run-tests-title">Test Eseguiti (${meta.testLinks.length})</p>
        <ol>${meta.testLinks
          .map((t) => `<li>${testLinkHtml(t, 'rail-test-link')}</li>`)
          .join('')}</ol>
       </div>`
    : '';

  return layout(
    meta.label,
    `<div class="shell">
  <aside class="rail">
    <a class="back" href="${escapeAttr(indexHref)}">Tutti i report</a>
    <div class="run">
      <p class="run-name">${escapeHtml(meta.label)}</p>
      ${meta.date ? `<p class="run-date">${escapeHtml(meta.date)}, ore ${escapeHtml(meta.time)}</p>` : ''}
      ${status}
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
</script>`,
  );
}

function indexPage(items) {
  const sorted = [...items].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const paged = sorted.length > pageSize;
  const groups = groupByBrowser(sorted);
  return layout(
    'Report E2E',
    `<main class="index-page">
  ${clientName ? `<p class="brand">${escapeHtml(clientName)}</p>` : ''}
  <h1>Report E2E</h1>
  <p class="lede">Resoconto esecuzioni della pipeline, dettaglio test eseguiti, bug riscontrati e screenshot</p>
${groups.map((group) => browserGroupHtml(group)).join('\n')}
  ${paged ? '<nav class="pager" aria-label="Pagine dei report" hidden></nav>' : ''}
</main>
${paged ? pagerScript() : ''}`,
  );
}

function browserGroupHtml(group) {
  const summary = group.items.find((i) => i.isSummary);
  const tests = group.items.filter((i) => !i.isSummary);
  return `  <section class="browser-group">
    <h2 class="group-title" data-browser="${escapeAttr(group.name)}">${escapeHtml(group.label)}</h2>
    ${summary ? summaryCardHtml(summary) : ''}
${tests.length ? `    <div class="standalone-tests">
      <h3 class="subgroup-title">Report Singoli</h3>
      <ol class="runs">
${tests.map(testRowHtml).join('\n')}
      </ol>
    </div>` : ''}
  </section>`;
}

function summaryCardHtml(item) {
  const s = item.stats ?? {};
  const statusClass = item.status === 'FAIL' ? 'fail' : item.status === 'PASS' ? 'pass' : '';
  const testList = item.testLinks || [];

  return `    <article class="run-summary ${statusClass}">
      <header class="run-summary-head">
        <div>
          <h3 class="run-summary-name">
            <a href="${escapeAttr(item.href)}">${escapeHtml(item.label)}</a>
            ${statusChip(item.status)}
          </h3>
          <p class="run-summary-date">${item.date ? `${escapeHtml(item.date)}${item.time ? `, ore ${escapeHtml(item.time)}` : ''}` : escapeHtml(item.name)}</p>
        </div>
        ${s.duration ? `<div class="duration-badge">⏱️ ${escapeHtml(s.duration)}</div>` : ''}
      </header>

      ${s.total ? `
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${s.passRate}%;"></div>
        </div>
        <span class="progress-label">${s.passRate}% Superato (${s.pass}/${s.total})</span>
      </div>
      ` : ''}

      <dl class="run-stats">
        <div class="stat"><dt>Test Superati</dt><dd class="ok">${s.pass ?? 0}</dd></div>
        <div class="stat"><dt>Test Falliti</dt><dd class="${s.fail ? 'ko' : ''}">${s.fail ?? 0}</dd></div>
        <div class="stat"><dt>Bug HIGH</dt><dd class="${s.high ? 'ko' : ''}">${s.high ?? 0}</dd></div>
        <div class="stat"><dt>Bug MEDIUM</dt><dd class="${s.medium ? 'warn' : ''}">${s.medium ?? 0}</dd></div>
        <div class="stat"><dt>Bug LOW</dt><dd>${s.low ?? 0}</dd></div>
      </dl>

      ${testList.length ? `
  <div class="summary-tests-preview">
    <p class="summary-tests-title">Dettaglio Test inclusi (${testList.length}):</p>
    <ul class="summary-tests-list">
      ${testList.map((t) => `<li>${testLinkHtml(t, '')}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

      <p class="run-summary-link"><a href="${escapeAttr(item.href)}">Apri il report di summary completo →</a></p>
    </article>`;
}

function testRowHtml(item) {
  return `    <li><a href="${escapeAttr(item.href)}">
      <span class="runs-name">${escapeHtml(item.label)}${statusChip(item.status)}</span>
      <span class="runs-date">${item.date ? `${escapeHtml(item.date)}, ${escapeHtml(item.time)}` : escapeHtml(item.name)}</span>
    </a></li>`;
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

function groupByBrowser(items) {
  const order = ['chromium', 'firefox', 'webkit'];
  const map = new Map();
  for (const item of items) {
    const key = item.browser ? item.browser.toLowerCase() : 'altro';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  const keys = [...map.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
  return keys.map((key) => {
    const groupItems = map.get(key);
    groupItems.sort((a, b) => (Number(b.isSummary) - Number(a.isSummary)) || b.sortKey.localeCompare(a.sortKey));
    return {
      name: key,
      label: key === 'altro' ? 'Altro' : key.charAt(0).toUpperCase() + key.slice(1),
      items: groupItems,
    };
  });
}

function pagerScript() {
  return `<script>
  (() => {
    const pageSize = ${pageSize};
    const rows = [...document.querySelectorAll('.runs > li')];
    const pager = document.querySelector('.pager');
    if (!pager || !rows.length) return;
    const pages = Math.ceil(rows.length / pageSize);

    const pageFromHash = () => {
      const n = Number(/^#pagina-(\\d+)$/.exec(location.hash)?.[1] || 1);
      return Math.min(Math.max(n, 1), pages);
    };

    const visiblePages = (current) => {
      const set = new Set([1, pages, current - 1, current, current + 1]);
      return [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
    };

    const link = (n, label, attrs = '') => '<a href="#pagina-' + n + '" ' + attrs + '>' + label + '</a>';

    const render = (focusPager) => {
      const current = pageFromHash();
      const start = (current - 1) * pageSize;
      rows.forEach((row, i) => { row.hidden = i < start || i >= start + pageSize; });

      let numbers = '';
      let previous = 0;
      for (const n of visiblePages(current)) {
        if (n - previous > 1) numbers += '<span class="pager-gap" aria-hidden="true">…</span>';
        numbers += n === current
          ? link(n, n, 'class="pager-page" aria-current="page"')
          : link(n, n, 'class="pager-page" aria-label="Pagina ' + n + '"');
        previous = n;
      }

      pager.innerHTML =
        '<p class="pager-count">' + (start + 1) + '–' + Math.min(start + pageSize, rows.length) + ' di ' + rows.length + '</p>' +
        '<div class="pager-links">' +
        (current > 1 ? link(current - 1, 'Più recenti', 'class="pager-step" rel="prev"') : '<span class="pager-step" aria-disabled="true">Più recenti</span>') +
        numbers +
        (current < pages ? link(current + 1, 'Meno recenti', 'class="pager-step" rel="next"') : '<span class="pager-step" aria-disabled="true">Meno recenti</span>') +
        '</div>';
      pager.hidden = false;

      if (focusPager) {
        document.querySelector('.browser-group')?.scrollIntoView({ block: 'start' });
        pager.querySelector('[aria-current]')?.focus({ preventScroll: true });
      }
    };

    window.addEventListener('hashchange', () => render(true));
    render(false);
  })();
</script>`;
}

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

    /* Shell Layout */
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

    /* Type Scale & Elements */
    h1 { margin: 0 0 24px; font-size: clamp(2.2rem, 3vw + 1rem, 3.5rem); font-weight: 700; letter-spacing: -0.02em; }
    h2 { margin: 48px 0 16px; font-size: 1.6rem; font-weight: 600; }
    h3 { margin: 32px 0 12px; font-size: 1.2rem; font-weight: 600; }

    .table-wrap { margin: 20px 0; overflow-x: auto; background: var(--paper); border: 1px solid var(--rule); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--rule); }
    th { font-weight: 600; color: var(--graphite); background: var(--wash); }

    /* Status Badges & Chips */
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

    /* Side Rail Test Links */
    .run-tests { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--rule); }
    .run-tests-title { margin: 0 0 10px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--graphite); }
    .run-tests ol { list-style: none; padding: 0; margin: 0; }
    .rail-test-link { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; text-decoration: none; font-size: 0.85rem; }
    .rail-test-link:hover { color: var(--ink); }

    /* Summary Cards in Index */
    .index-page { max-width: 880px; margin: 0 auto; padding: 60px 24px; }
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

    /* Progress bar */
    .progress-container { margin-top: 18px; display: flex; align-items: center; gap: 12px; }
    .progress-bar { flex: 1; height: 8px; background: var(--wash); border-radius: 999px; overflow: hidden; }
    .progress-fill { height: 100%; background: #22c55e; border-radius: 999px; }
    .run-summary.fail .progress-fill { background: #ef4444; }
    .progress-label { font-size: 0.8rem; font-weight: 600; color: var(--graphite); white-space: nowrap; }

    /* Stats Grid */
    .run-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; margin: 20px 0 0; padding-top: 16px; border-top: 1px solid var(--rule); }
    .stat dt { font-size: 0.7rem; text-transform: uppercase; color: var(--graphite); font-weight: 600; letter-spacing: 0.05em; }
    .stat dd { margin: 2px 0 0; font: 700 1.2rem var(--display); }
    .stat dd.ok { color: #16a34a; }
    .stat dd.ko { color: #dc2626; }
    .stat dd.warn { color: #d97706; }

    /* Test List inside Summary Card */
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
  </style>
</head>
<body>
${content}
</body>
</html>
`;
}

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