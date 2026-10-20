import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errors.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  // Render/Vercel sit behind proxies; needed for secure cookies and per-visitor rate limits.
  if (env.isProd) app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  // CSP takes effect once Express serves the React build (guide §12). frame-src allows YouTube/Vimeo
  // embeds on portfolio pieces; img/media allow hosted (https) media.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'blob:', 'https:'],
          'frame-src': ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
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
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
