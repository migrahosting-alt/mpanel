import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: {
    port: 3001
  },
  plugins: [react()]
});

await server.listen();
server.printUrls();
