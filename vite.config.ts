import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleSgsAction } from './api/lib/sgsHelper';

function sgsBridgePlugin() {
  return {
    name: 'sgs-bridge-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || '';
        if (url.startsWith('/api/sgs')) {
          const action = url.replace(/^\/api\/sgs\/?/, '').split('?')[0] || '';
          return handleSgsAction(action, req, res);
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), sgsBridgePlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
