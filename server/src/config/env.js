const isTest = process.env.NODE_ENV === 'test';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!value && !isTest) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest,
  port: Number(process.env.PORT) || 5000,
  // Number of proxies in front of the API (Render = 1; Vercel rewrite + Render = 2).
  trustProxy: Number(process.env.TRUST_PROXY) || 1,
  mongoUri: process.env.MONGODB_URI,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  jwtSecret: required('JWT_SECRET', isTest ? 'test-secret' : undefined),
  cookieName: process.env.COOKIE_NAME || 'unio_session',
  // AI Brief Builder. Optional: without a key the endpoint returns a labelled template draft.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  briefModel: process.env.BRIEF_AI_MODEL || 'claude-opus-5-5',
  // Alternative provider: used only when ANTHROPIC_API_KEY is not set.
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-opus-5.5',
  // Comma-separated DNS servers used when the OS resolver cannot answer SRV lookups (common on Windows).
  dnsServers: (process.env.DNS_SERVERS || '').split(',').map((s) => s.trim()).filter(Boolean),
};
