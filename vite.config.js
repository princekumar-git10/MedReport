import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import fs from 'fs'
import path from 'path'

// Vite plugin to run /api/* Vercel serverless functions in local dev
function vercelApiDevPlugin() {
  return {
    name: 'vercel-api-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url.startsWith('/api/chat') || req.url.startsWith('/api/translate'))) {
          try {
            // Ensure process.env has keys from .env.local
            const env = loadEnv('development', process.cwd(), '');
            Object.assign(process.env, env);

            const urlPath = req.url.split('?')[0];
            const file = urlPath === '/api/chat' ? './api/chat.js' : './api/translate.js';
            const { default: handler } = await import(file);

            // Collect JSON body if present
            let body = {};
            if (req.method === 'POST') {
              const buffers = [];
              for await (const chunk of req) {
                buffers.push(chunk);
              }
              const data = Buffer.concat(buffers).toString();
              if (data) {
                try {
                  body = JSON.parse(data);
                } catch {
                  body = {};
                }
              }
            }

            // Create Express/Vercel-like res helper methods if missing
            req.body = body;
            if (!res.status) {
              res.status = (code) => {
                res.statusCode = code;
                return res;
              };
            }
            if (!res.json) {
              res.json = (obj) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(obj));
                return res;
              };
            }

            await handler(req, res);
            return;
          } catch (err) {
            console.error('Local API dev server error:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Populate process.env in node environment
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), vercelApiDevPlugin()],
  };
});
