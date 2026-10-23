import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errors.js';
import routes from './routes/index.js';

/** The React build is copied here by the deploy workflow (guide §12.1). Not committed. */
const DEFAULT_PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp({ publicDir = DEFAULT_PUBLIC_DIR } = {}) {
  const app = express();

  // Azure App Service sits behind one front end. Trust the configured proxy in every deployment
  // environment so express-rate-limit can safely interpret Azure's forwarded client IP header.
  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  // CSP for the React build served below (guide §12.2). frame-src allows YouTube/Vimeo embeds on
  // portfolio pieces; img/media allow hosted (https) media; connect-src allows direct Blob uploads.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'blob:', 'https:'],
          'frame-src': ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
          'connect-src': ["'self'", 'https://*.blob.core.windows.net'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        },
      },
    }),
  );
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin/server-to-server requests (no Origin header) and the configured allowlist only.
        if (!origin || env.clientOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', routes);

  // One App Service serves both the API and the React build (guide §12.1). Hashed assets are immutable;
  // every other non-API GET falls back to index.html so client routes survive a refresh. Without a
  // build (local dev, tests) the fallback passes through to the JSON 404.
  app.use('/assets', express.static(path.join(publicDir, 'assets'), { index: false, maxAge: '1y', immutable: true }));
  app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api(\/|$)).*/,(_req, res, next) => res.sendFile(path.join(publicDir, 'index.html'), (err) => (err ? next() : undefined)));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
