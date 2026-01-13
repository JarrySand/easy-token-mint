import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'out', 'contracts', 'test'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'out',
        'contracts',
        'test',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/vitest.*.ts',
      ],
    },
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10000,
    environmentMatchGlobs: [
      // Use node environment for main process tests
      ['src/main/**/*.test.ts', 'node'],
      // Use jsdom for renderer tests
      ['src/renderer/**/*.test.tsx', 'jsdom'],
      ['src/renderer/**/*.test.ts', 'jsdom'],
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
