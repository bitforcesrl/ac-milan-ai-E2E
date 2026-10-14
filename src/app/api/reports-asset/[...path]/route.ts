import { PATHS_CONFIG } from '@/lib/e2e-tests';
import { NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

/**
 * Serve gli asset dei report (screenshot, ecc.) dal filesystem locale in
 * modalita' locale della dashboard (npm run dev:local -> E2E_LOCAL_MODE=1).
 * Equivale funzionalmente agli URL SAS di Azure Blob usati in modalita' standard.
 *
 * GET /api/reports-asset/<stamp>/<browser>/<viewport>/screenshots/<file>.png
 */

const REPORTS_DIR = PATHS_CONFIG.reports;

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  // Path sanitizzato: solo segmenti semplici, niente '..' o assoluti
  if (!segments?.length || segments.some((s) => !s || s.includes('/') || s.includes('\\') || s === '..')) {
    return NextResponse.json({ error: 'Path non valido.' }, { status: 400 });
  }

  const root = path.resolve(REPORTS_DIR);
  const filePath = path.resolve(root, ...segments);
  if (!filePath.startsWith(root + path.sep)) {
    return NextResponse.json({ error: 'Path non valido.' }, { status: 400 });
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return NextResponse.json({ error: 'Asset non trovato.' }, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
  const stream = Readable.toWeb(createReadStream(filePath)) as WebReadableStream<Uint8Array>;

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'no-store',
    },
  });
}
