import { defineConfig } from 'vite';
import { atlasPreview } from './atlas/preview.mjs';
// The preview serves the Atlas client. Archived HTML is not a dependency entry.
export default defineConfig({server:{host:'0.0.0.0',allowedHosts:['terminal.local'],hmr:false},optimizeDeps:{entries:['atlas/app.js']},plugins:[atlasPreview()]});
