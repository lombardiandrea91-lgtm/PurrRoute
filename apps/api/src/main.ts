import { AuthService, DevelopmentMailSink } from './auth/auth-service.ts';
import { PostgresAuthRepository } from './auth/postgres-auth-repository.ts';
import { createPostgresDatabase } from './db/postgres-database.ts';
import { LocationIqAdapter } from './maps/locationiq-adapter.ts';
import { buildServer, type BuildServerOptions } from './server.ts';

const environment = process.env;
const production = environment.NODE_ENV === 'production';
if (production) {
  throw new Error('Production email delivery is not configured; refusing to start account endpoints');
}

const connectionString = environment.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const webOrigin = environment.WEB_ORIGIN ?? 'http://localhost:5173';
const parsedOrigin = new URL(webOrigin);
if (parsedOrigin.origin !== webOrigin) throw new Error('WEB_ORIGIN must contain only the origin');

const port = Number(environment.API_PORT ?? '3000');
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be a valid TCP port');
}

const database = createPostgresDatabase(connectionString);
const repository = new PostgresAuthRepository(database);
const mailSink = new DevelopmentMailSink();
const auth = new AuthService(repository, mailSink);
const options: BuildServerOptions = { auth, mailSink, production };
if (environment.WEB_ORIGIN) options.webOrigin = webOrigin;
const enableLocationIq = environment.MAP_LOCATIONIQ_ENABLED === 'true';
if (enableLocationIq && !environment.LOCATIONIQ_API_KEY) {
  throw new Error('LOCATIONIQ_API_KEY is required when MAP_LOCATIONIQ_ENABLED=true');
}
if (enableLocationIq && environment.LOCATIONIQ_API_KEY) {
  options.maps = new LocationIqAdapter({ apiKey: environment.LOCATIONIQ_API_KEY });
}

const app = buildServer(options);
app.addHook('onClose', () => database.close());

try {
  await database.query('SELECT 1 AS ready');
  await app.listen({ port, host: environment.API_HOST ?? '127.0.0.1' });
} catch (error) {
  await app.close().catch(() => undefined);
  throw error;
}