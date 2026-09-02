import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const reportsDir = 'reports';

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
  const title = relative(reportsDir, mdPath).replace(/\\/g, '/').replace(/\.md$/i, '');
  const indexHref = relative(join(htmlPath, '..'), join(reportsDir, 'index.html')).replace(/\\/g, '/') || 'index.html';
  const html = wrapPage(title, markdownToHtml(readFileSync(mdPath, 'utf8')), indexHref);
  writeFileSync(htmlPath, html, 'utf8');
  console.log(`Wrote ${htmlPath}`);
  return { title, href: relative(reportsDir, htmlPath).replace(/\\/g, '/') };
});

writeFileSync(
  join(reportsDir, 'index.html'),
  wrapPage(
    'AC Milan E2E reports',
    `<p class="lede">Report generati dalla pipeline. Apri una voce per leggere il dettaglio con screenshot.</p>
<ul class="index">
${rendered.map((item) => `<li><a href="${escapeAttr(item.href)}">${escapeHtml(item.title)}</a></li>`).join('\n')}
</ul>`,
    '',
  ),
  'utf8',
);

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

function markdownToHtml(source) {
  const fences = [];
  let text = source.replace(/\r\n/g, '\n').replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const token = `@@FENCE${fences.length}@@`;
    fences.push(`<pre><code class="language-${escapeAttr(lang || 'text')}">${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`);
    return token;
  });

  const blocks = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push('<hr>');
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-+:?/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i]);
        i += 1;
      }
      blocks.push(renderTable(rows));
      continue;
    }

    if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && (ordered ? /^\d+\.\s+/.test(lines[i]) : /^[-*+]\s+/.test(lines[i]))) {
        items.push(lines[i].replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      blocks.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
      continue;
    }

    const para = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^\|/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return blocks.join('\n').replace(/@@FENCE(\d+)@@/g, (_, index) => fences[Number(index)]);
}

function renderTable(rows) {
  const parsed = rows
    .filter((row, index) => index !== 1)
    .map((row) =>
      row
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim()),
    );
  const header = parsed[0] ?? [];
  const body = parsed.slice(1);
  return `<div class="table-wrap"><table>
<thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead>
<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
</table></div>`;
}

function inline(value) {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[(x|X)\]/g, '<span class="check done">[x]</span>')
    .replace(/\[ \]/g, '<span class="check">[ ]</span>');
}

function wrapPage(title, body, indexHref = '') {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --red: #ac141c;
      --ink: #1a1a1a;
      --muted: #5c5c5c;
      --bg: #f6f4f1;
      --card: #fff;
      --line: #e4dfd8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.55;
    }
    header {
      background: var(--red);
      color: #fff;
      padding: 20px 28px;
    }
    header p { margin: 6px 0 0; opacity: .85; font-size: 14px; }
    header a { color: #fff; }
    main {
      max-width: 920px;
      margin: 24px auto 48px;
      background: var(--card);
      padding: 28px 32px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgb(0 0 0 / 6%);
    }
    h1, h2, h3 { line-height: 1.25; }
    h1 { margin-top: 0; }
    h2 { border-bottom: 2px solid var(--red); padding-bottom: 6px; }
    .lede { color: var(--muted); }
    a { color: var(--red); }
    img { max-width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; margin: 12px 0; }
    pre, code { font-family: Consolas, "Courier New", monospace; }
    pre { background: #111; color: #f3f3f3; padding: 14px; border-radius: 8px; overflow: auto; }
    p code, li code { background: #efeae3; padding: 1px 5px; border-radius: 4px; }
    .table-wrap { overflow: auto; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f3ecec; }
    ul.index { padding-left: 18px; font-size: 17px; }
    ul.index li { margin: 10px 0; }
    .check.done { color: #1b7f3a; font-weight: 600; }
    hr { border: 0; border-top: 1px solid var(--line); margin: 28px 0; }
  </style>
</head>
<body>
  <header>
    <strong>AC Milan — AI E2E</strong>
    <p>${escapeHtml(title)}${indexHref ? ` · <a href="${escapeAttr(indexHref)}">Indice</a>` : ''}</p>
  </header>
  <main>
${body}
  </main>
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
