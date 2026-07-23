import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@modules': resolve(__dirname, 'src/modules'),
      '@infrastructure': resolve(__dirname, 'src/infrastructure'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@types': resolve(__dirname, 'src/types')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
      thresholds: {
        'src/modules/prism/**': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        'src/modules/deteccion/**': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        'src/modules/documento/**': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 60000
  }
});
