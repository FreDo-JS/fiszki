import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`Fiszki API listening on port ${env.port} [${env.nodeEnv}]`);
});
