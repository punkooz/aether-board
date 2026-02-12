import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = await buildApp({ dataDir: process.env.DATA_DIR });

app.listen({ port, host }).then(() => {
  // eslint-disable-next-line no-console
  console.log(`AetherBoard backend listening on http://${host}:${port}`);
});
