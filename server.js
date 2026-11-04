import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '12mb' }));
app.get('/api/status', (_req, res) => res.json({ configured: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || 'gpt-4o-mini', webSearch: false }));
app.post('/api/chat', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'No AI provider is connected yet. This recreation stores your workspace locally. To enable live replies, set OPENAI_API_KEY on the server and restart it. See the setup guide in README.md.' });
  const { messages, systemPrompt } = req.body;
  if (!Array.isArray(messages) || !messages.length || messages.length > 100 || messages.some(m => !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 100000) || (systemPrompt && (typeof systemPrompt !== 'string' || systemPrompt.length > 20000))) return res.status(400).json({ error: 'Invalid conversation.' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  res.on('close', () => controller.abort());
  try {
    const upstream = await fetch(`${(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', stream: true, messages: [{ role: 'system', content: 'You are RedMind, a precise security learning assistant. Help with authorized security research, defensive engineering, labs, and CTFs. Do not claim to browse the web or expose private chain-of-thought. Offer concise explanations and verifiable steps.' + (systemPrompt ? `\nUser preferences: ${systemPrompt}` : '') }, ...messages] })
    });
    if (!upstream.ok) return res.status(502).json({ error: `The AI provider returned an error (${upstream.status}). Check the server credentials, model, or quota and try again.` });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  } catch (error) {
    if (!res.headersSent) res.status(502).json({ error: error.name === 'AbortError' ? 'The request timed out. Please try again.' : 'Could not reach the AI provider. Check the server connection and try again.' });
    else res.end();
  } finally { clearTimeout(timeout); }
});
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large. Remove some attachments and try again.' });
  if (error instanceof SyntaxError) return res.status(400).json({ error: 'Invalid JSON request.' });
  console.error('Request failed:', error.message);
  res.status(500).json({ error: 'The server could not process this request.' });
});
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true, allowedHosts: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => console.log('RedMind is running on port ' + (process.env.PORT || 3000)));
