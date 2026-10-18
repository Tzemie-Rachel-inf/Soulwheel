import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Three chunks, all loaded at once, split by how often they change: libraries rarely, the
        // game (engine and wheel content) whenever a wheel is tuned, the app whenever the screen is.
        // A returning player re-downloads only what changed. The game never imports the app, so the
        // chunks never import each other in a circle.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules/, priority: 20 },
            { name: 'game', test: /[\\/]src[\\/](engine|config)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
