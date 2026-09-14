import express from 'express';
import path from 'node:path';
import { createApp } from './app';
const app = createApp();
if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve('dist');
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
const port = Number(process.env.PORT || 8787);
app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Goutou Studio server: http://localhost:${port}`));
