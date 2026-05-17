import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const iceAnalysisApiUrl = env.VITE_ICE_ANALYSIS_API_URL || env.ICE_ANALYSIS_API_URL;
  const proxy: Record<string, any> = {
    '/api/sea-route': {
      target: 'https://usvmz35vpfuf3qaympixjlbfbe0dqian.lambda-url.eu-north-1.on.aws',
      changeOrigin: true,
      rewrite: () => '/route',
    },
  };

  if (iceAnalysisApiUrl) {
    const target = new URL(iceAnalysisApiUrl);
    proxy['/api/ice-class-analysis'] = {
      target: target.origin,
      changeOrigin: true,
      rewrite: () => `${target.pathname}${target.search}` || '/ice-class-analysis',
    };
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy,
    },
  };
});
