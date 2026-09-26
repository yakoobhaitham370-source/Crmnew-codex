import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Endpoint: High-speed proxy for Google Apps Script to eliminate browser CORS latency and handle 302 redirects server-to-server
app.post('/api/gas/proxy', async (req, res) => {
  try {
    const { gasUrl, method = 'POST', payload, params } = req.body;
    if (!gasUrl || typeof gasUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing or invalid gasUrl' });
    }

    let targetUrl = gasUrl.trim();
    if (params && typeof params === 'object') {
      const q = new URLSearchParams(params).toString();
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + q;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    if (method === 'GET') {
      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await resp.json();
        return res.json(json);
      }
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.json({ status: 'SUCCESS', raw: text });
      }
    } else {
      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await resp.json();
        return res.json(json);
      }
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.json({ status: 'SUCCESS', raw: text });
      }
    }
  } catch (err: any) {
    console.warn('Server GAS proxy error:', err.message);
    return res.status(502).json({ success: false, error: err.message });
  }
});

// Endpoint: Download Google Apps Script backend code (Code.gs)
app.get('/download/Code.gs', (_req, res) => {
  const gsPath = path.resolve(__dirname, 'google-apps-script.js');
  res.download(gsPath, 'Code.gs');
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`PharmPulse Server running on port ${PORT}`);
  });
}

startServer();
