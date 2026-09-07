import { defineConfig } from 'vite';
import { atlasPreview } from './atlas/preview.mjs';
export default defineConfig({server:{host:'0.0.0.0',allowedHosts:['terminal.local'],hmr:false},plugins:[atlasPreview()]});
