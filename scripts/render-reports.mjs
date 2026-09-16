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

// Per-file heading state, reset before each parse.
let usedIds = new Set();
let toc = [];

marked.use({
  breaks: true,
  renderer: {
    heading({ tokens, depth, text }) {
      const id = uniqueId(slugify(text));
      if (depth === 2) toc.push({ id, text: this.parser.parseInline(tokens) });
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
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
  const meta = parseReportName(basename(mdPath, '.md'));
  const indexHref = relative(join(htmlPath, '..'), join(reportsDir, 'index.html')).replace(/\\/g, '/') || 'index.html';

  usedIds = new Set();
  toc = [];
  const body = wrapTables(marked.parse(readFileSync(mdPath, 'utf8')));

  writeFileSync(htmlPath, reportPage(meta, body, toc, indexHref), 'utf8');
  console.log(`Wrote ${htmlPath}`);
  return { ...meta, href: relative(reportsDir, htmlPath).replace(/\\/g, '/') };
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

// "quickbuy-cart-validation_2026-08-20_09-33" -> readable name + date
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

  return layout(
    meta.label,
    `<div class="shell">
  <aside class="rail">
    <a class="back" href="${escapeAttr(indexHref)}">Tutti i report</a>
    <div class="run">
      <p class="run-name">${escapeHtml(meta.label)}</p>
      ${meta.date ? `<p class="run-date">${escapeHtml(meta.date)}, ore ${escapeHtml(meta.time)}</p>` : ''}
    </div>
    ${nav}
  </aside>
  <main class="doc">
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
  return layout(
    'Report E2E',
    `<main class="index-page">
  ${clientName ? `<p class="brand">${escapeHtml(clientName)}</p>` : ''}
  <h1>Report E2E</h1>
  <p class="lede">Ogni run della pipeline lascia qui il suo report, con bug trovati e screenshot. I più recenti sono in cima.</p>
  <ol class="runs" id="runs">
${sorted
  .map(
    (item) => `    <li><a href="${escapeAttr(item.href)}">
      <span class="runs-name">${escapeHtml(item.label)}</span>
      <span class="runs-date">${item.date ? `${escapeHtml(item.date)}, ${escapeHtml(item.time)}` : escapeHtml(item.name)}</span>
    </a></li>`,
  )
  .join('\n')}
  </ol>
  ${paged ? '<nav class="pager" aria-label="Pagine dei report" hidden></nav>' : ''}
</main>
${paged ? pagerScript() : ''}`,
  );
}

// Client-side pagination: all rows are in the HTML, the script shows one page at a time.
// Current page lives in the hash (#pagina-2) so back/forward and shared links keep it.
function pagerScript() {
  return `<script>
  (() => {
    const pageSize = ${pageSize};
    const rows = [...document.querySelectorAll('#runs > li')];
    const pager = document.querySelector('.pager');
    const pages = Math.ceil(rows.length / pageSize);

    const pageFromHash = () => {
      const n = Number(/^#pagina-(\\d+)$/.exec(location.hash)?.[1] || 1);
      return Math.min(Math.max(n, 1), pages);
    };

    // First, last, and a window around the current page; gaps become ellipses.
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
        document.getElementById('runs').scrollIntoView({ block: 'start' });
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
      --canvas: #f4f4f3;
      --paper: #ffffff;
      --ink: #171717;
      --graphite: #606060;
      --rule: #deddda;
      --wash: #ebebea;
      --shadow: 0 1px 2px rgb(0 0 0 / 5%), 0 18px 40px -20px rgb(0 0 0 / 22%);
      --display: "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif;
      --text: "Instrument Sans", "Helvetica Neue", Arial, sans-serif;
      --mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
      color-scheme: light dark;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --canvas: #141414;
        --paper: #1c1c1c;
        --ink: #ececea;
        --graphite: #9d9d9a;
        --rule: #2f2f2e;
        --wash: #242423;
        --shadow: 0 1px 2px rgb(0 0 0 / 40%), 0 18px 40px -20px rgb(0 0 0 / 70%);
      }
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; scroll-padding-top: 24px; }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
    body {
      margin: 0;
      background: var(--canvas);
      color: var(--ink);
      font: 400 1.03rem/1.65 var(--text);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    a { color: inherit; text-decoration-color: var(--rule); text-underline-offset: 3px; text-decoration-thickness: 1px; }
    a:hover { text-decoration-color: currentColor; }
    :focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; border-radius: 3px; }

    /* Report layout: sticky rail + document */
    .shell {
      display: grid;
      grid-template-columns: 250px minmax(0, 1fr);
      gap: clamp(32px, 5vw, 80px);
      max-width: 1200px;
      margin: 0 auto;
      padding-inline: 24px;
    }
    .rail {
      position: sticky;
      top: 0;
      align-self: start;
      max-height: 100vh;
      overflow-y: auto;
      padding-block: 48px;
      font-size: 0.9rem;
    }
    .back { display: inline-flex; align-items: center; gap: 8px; color: var(--graphite); text-decoration: none; }
    .back::before { content: ""; width: 7px; height: 7px; border-left: 1.5px solid; border-bottom: 1.5px solid; transform: rotate(45deg); }
    .back:hover { color: var(--ink); }
    .run { margin: 40px 0 28px; padding-bottom: 24px; border-bottom: 1px solid var(--rule); }
    .run-name { margin: 0; font: 600 1.3rem/1.15 var(--display); letter-spacing: -0.02em; }
    .run-date { margin: 6px 0 0; color: var(--graphite); font-variant-numeric: tabular-nums; }
    .toc { margin-left: -16px; }
    .toc ol { list-style: none; margin: 0; padding: 0; }
    .toc a {
      display: block;
      padding: 6px 0 6px 14px;
      border-left: 2px solid transparent;
      color: var(--graphite);
      text-decoration: none;
      line-height: 1.35;
      transition: color 0.15s, border-color 0.15s;
    }
    .toc a:hover { color: var(--ink); }
    .toc a[aria-current] { color: var(--ink); border-left-color: var(--ink); font-weight: 600; }

    .doc {
      min-width: 0;
      max-width: 820px;
      padding-block: 56px 120px;
    }
    .doc > p, .doc > ul, .doc > ol, .doc > blockquote { max-width: 68ch; }

    /* Type scale */
    h1, h2, h3, h4 { font-family: var(--display); color: var(--ink); text-wrap: balance; }
    h1 {
      margin: 0 0 40px;
      font-size: clamp(2.3rem, 3.2vw + 1.2rem, 3.9rem);
      font-weight: 650;
      line-height: 1.02;
      letter-spacing: -0.035em;
      font-variation-settings: "opsz" 96;
    }
    h2 {
      margin: 72px 0 20px;
      font-size: 1.85rem;
      font-weight: 600;
      line-height: 1.15;
      letter-spacing: -0.025em;
    }
    h3 {
      margin: 48px 0 14px;
      padding-top: 24px;
      border-top: 1px solid var(--rule);
      font-size: 1.22rem;
      font-weight: 600;
      line-height: 1.3;
      letter-spacing: -0.01em;
    }
    h2 + h3, hr + h3 { margin-top: 28px; padding-top: 0; border-top: 0; }
    h4 { margin: 32px 0 10px; font-size: 1.02rem; font-weight: 600; }
    hr { border: 0; border-top: 1px solid var(--rule); margin: 56px 0; }
    hr + h2 { margin-top: 0; }
    p { margin: 0 0 16px; }
    strong { font-weight: 600; }
    ul, ol { padding-left: 1.3em; margin: 0 0 20px; }
    li { margin: 6px 0; }
    li::marker { color: var(--graphite); }
    li:has(> input[type=checkbox]) { list-style: none; margin-left: -1.3em; }
    input[type=checkbox] { accent-color: var(--ink); margin: 0 8px 0 0; vertical-align: -1px; }
    blockquote { margin: 24px 0; padding: 2px 0 2px 20px; border-left: 2px solid var(--ink); color: var(--graphite); }

    /* Code and price breakdowns */
    code { font: 500 0.86em var(--mono); background: var(--wash); padding: 2px 6px; border-radius: 5px; overflow-wrap: anywhere; }
    pre {
      margin: 24px 0;
      padding: 20px 22px;
      background: var(--paper);
      border: 1px solid var(--rule);
      border-radius: 10px;
      overflow-x: auto;
      line-height: 1.6;
    }
    pre code { background: none; padding: 0; font-size: 0.84rem; font-weight: 400; overflow-wrap: normal; }

    /* Tables */
    .table-wrap {
      margin: 24px 0 28px;
      overflow-x: auto;
      background: var(--paper);
      border: 1px solid var(--rule);
      border-radius: 10px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
    th, td { padding: 11px 16px; text-align: left; vertical-align: top; }
    th { font-weight: 600; color: var(--graphite); border-bottom: 1px solid var(--rule); white-space: nowrap; }
    td { border-bottom: 1px solid var(--rule); }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr:hover td { background: var(--wash); }

    /* Screenshots */
    img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 20px 0 28px;
      border-radius: 10px;
      border: 1px solid var(--rule);
      box-shadow: var(--shadow);
    }

    /* Index page */
    .index-page { max-width: 820px; margin: 0 auto; padding: 88px 24px 120px; }
    .brand { margin: 0 0 18px; color: var(--graphite); font-size: 0.95rem; }
    .index-page h1 { margin-bottom: 20px; font-size: clamp(3rem, 7vw + 1rem, 6rem); }
    .lede { max-width: 52ch; margin: 0 0 56px; color: var(--graphite); font-size: 1.12rem; }
    .runs { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--ink); }
    .runs li { margin: 0; border-bottom: 1px solid var(--rule); }
    .runs a {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 4px 24px;
      padding: 22px 4px;
      text-decoration: none;
      transition: padding 0.2s ease;
    }
    .runs a:hover { padding-left: 14px; }
    .runs-name { font: 600 1.45rem/1.2 var(--display); letter-spacing: -0.02em; }
    .runs-date { color: var(--graphite); font-variant-numeric: tabular-nums; }
    .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px 24px; margin-top: 32px; }
    .pager-count { margin: 0; color: var(--graphite); font-variant-numeric: tabular-nums; }
    .pager-links { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
    .pager a, .pager span { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; height: 40px; padding: 0 12px; border-radius: 999px; font-variant-numeric: tabular-nums; text-decoration: none; }
    .pager a { color: var(--ink); }
    .pager a:hover { background: var(--wash); }
    .pager a[aria-current] { background: var(--ink); color: var(--canvas); font-weight: 600; }
    .pager-gap { color: var(--graphite); padding: 0 4px; min-width: 0; }
    .pager-step[aria-disabled] { color: var(--rule); }
    @media (prefers-reduced-motion: reduce) { .runs a, .toc a { transition: none; } }

    @media (max-width: 860px) {
      .shell { display: block; }
      .rail { position: static; max-height: none; padding-block: 28px 0; }
      .run { margin: 24px 0 16px; }
      .toc { margin-left: 0; padding-bottom: 12px; border-bottom: 1px solid var(--rule); }
      .toc ol { display: flex; flex-wrap: wrap; gap: 4px 16px; }
      .toc a { padding: 4px 0; border-left: 0; }
      .doc { padding-top: 40px; }
      h2 { margin-top: 56px; font-size: 1.55rem; }
      .index-page { padding-top: 56px; }
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
