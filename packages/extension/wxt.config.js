import tailwindcss from '@tailwindcss/vite'
import { config as loadDotenv } from 'dotenv'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'wxt'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: resolve(__dirname, '../../.env') })

const chromeProfile = '.wxt/chrome-data'
mkdirSync(chromeProfile, { recursive: true })

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const routingUrl = process.env.ROUTING_URL || ''
const deepseekApiKey = process.env.DEEPSEEK_API_KEY || ''

// See https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: 'src',
	modules: ['@wxt-dev/module-react'],
	webExt: {
		chromiumProfile: chromeProfile,
		keepProfileChanges: true,
		chromiumArgs: ['--hide-crash-restore-bubble'],
	},
	vite: () => ({
		plugins: [tailwindcss()],
		define: {
			__VERSION__: JSON.stringify(pkg.version),
			__ROUTING_URL__: JSON.stringify(routingUrl),
			__DEEPSEEK_API_KEY__: JSON.stringify(deepseekApiKey),
		},
		optimizeDeps: {
			force: true,
		},
		build: {
			minify: false,
			chunkSizeWarningLimit: 2000,
			cssCodeSplit: true,
			rollupOptions: {
				onwarn: function (message, handler) {
					if (message.code === 'EVAL') return
					handler(message)
				},
			},
		},
	}),
	zip: {
		artifactTemplate: 'super-page-agent-{{version}}-{{browser}}.zip',
	},
	manifest: {
		key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn7jBOSRD+dmbuWG+DCOqWEXQJO+i1GutWmYdbfwjVswixGZO/MoIOiuwLqX/mM9OyPzZlXzUhgGFP+nSTP5IijqiC9ekaD7B6WTqPreayuHQ/7zcQzejp8r0WAnXI7ABCQXxquZTKDtiYpcDFxcVyQQ2Tx9sZ6ZtbZOBo7NHpMT9reuIt1aoSTN+E6m4yiJbl1DXPpGqYMBOcvAdNyepNkQ3X4+kqNz6F70ncv+sCT6rwVW60jf5Vf82o6316HI4Bdwbt+IxPAQSE7NkE4VWXvbPMvoLe7LpeC2n+MoHdyp0BD7MCgRS+NJB5W1/lKuaVuCIiagllKtk451wNB6d1QIDAQAB',
		default_locale: 'en',
		name: '__MSG_extName__',
		description: '__MSG_extDescription__',
		homepage_url: 'https://alibaba.github.io/page-agent/',
		permissions: ['tabs', 'tabGroups', 'sidePanel', 'storage'],
		host_permissions: ['<all_urls>'],
		icons: {
			16: 'assets/super-page-agent-16.png',
			32: 'assets/super-page-agent-32.png',
			48: 'assets/super-page-agent-48.png',
			64: 'assets/super-page-agent-64.png',
			128: 'assets/super-page-agent-128.png',
		},
		action: {
			default_title: '__MSG_extActionTitle__',
			default_icon: {
				16: 'assets/super-page-agent-16.png',
				32: 'assets/super-page-agent-32.png',
				48: 'assets/super-page-agent-48.png',
				128: 'assets/super-page-agent-128.png',
			},
		},
		web_accessible_resources: [
			{
				resources: ['main-world.js'],
				matches: ['*://*/*'],
			},
		],
		side_panel: {
			default_path: 'sidepanel/index.html',
		},
		externally_connectable: {
			matches: ['http://localhost/*'],
		},
	},
})
