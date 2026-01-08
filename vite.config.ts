import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
	plugins: [
		sveltekit(),
		// Bundle analyzer - run with: ANALYZE=true bun run build
		process.env.ANALYZE === 'true' &&
			visualizer({
				filename: 'bundle-stats.html',
				open: true,
				gzipSize: true,
				brotliSize: true
			})
	].filter(Boolean),
	// Allow external network access for development
	server: {
		host: '0.0.0.0', // Listen on all network interfaces
		port: 5173,
		strictPort: false,
		watch: {
			ignored: ['**/.beads/**', '**/node_modules/**']
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/tests/setup.ts'],
		alias: {
			$lib: '/src/lib',
			// Force Svelte to use browser build in tests
			svelte: 'svelte'
		},
		// Use the svelte plugin for tests to properly compile components
		deps: {
			optimizer: {
				web: {
					include: ['svelte']
				}
			}
		}
	},
	resolve: {
		conditions: ['browser']
	}
});
