import { describe, expect, it, vi } from 'vitest'

describe('provider presets', () => {
	it('includes a DeepSeek preset that can use the local env key', async () => {
		vi.resetModules()
		vi.stubGlobal('__ROUTING_URL__', 'http://127.0.0.1:15721')
		vi.stubGlobal('__DEEPSEEK_API_KEY__', 'test-deepseek-key')

		const { getProviderPresets } = await import('./providerPresets')

		expect(getProviderPresets().find((preset) => preset.id === 'deepseek')).toMatchObject({
			provider: 'openai',
			baseURL: 'https://api.deepseek.com',
			model: 'deepseek-chat',
			apiKey: 'test-deepseek-key',
			requiresApiKey: true,
		})
	})

	it('applies a preset while preserving unrelated advanced config', async () => {
		vi.resetModules()
		vi.stubGlobal('__ROUTING_URL__', 'http://127.0.0.1:15721')
		vi.stubGlobal('__DEEPSEEK_API_KEY__', '')

		const { applyProviderPreset, getProviderPresets } = await import('./providerPresets')
		const preset = getProviderPresets().find((candidate) => candidate.id === 'lm-studio')

		expect(applyProviderPreset({ baseURL: 'old', model: 'old', maxSteps: 12 }, preset!)).toMatchObject({
			provider: 'openai',
			baseURL: 'http://localhost:1234/v1',
			model: 'local-model',
			maxSteps: 12,
		})
	})
})
