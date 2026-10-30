// Explicit storage-import mode: no database connection, models, app routes or jobs.
// The scanner and Python/model preflight still run through the production entrypoint.
import http from 'node:http';
import fs from 'node:fs/promises';
import { scanBuffer } from '../backend/src/modules/documents/clamav.js';

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' || req.url !== '/health') {
    res.writeHead(503);
    return res.end(JSON.stringify({ error: 'Storage maintenance: application is unavailable' }));
  }
  try {
    await fs.access(process.env.UPLOAD_DIR, fs.constants.W_OK);
    await scanBuffer(Buffer.from('ApprovalTrack maintenance readiness'), { timeoutMs: 1000 });
    res.end(JSON.stringify({ status: 'storage-maintenance', applicationReady: false }));
  } catch {
    res.writeHead(503);
    res.end(JSON.stringify({ status: 'maintenance-degraded', applicationReady: false }));
  }
});
server.listen(Number(process.env.PORT || 10000), '0.0.0.0');
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close(() => process.exit(0)));
