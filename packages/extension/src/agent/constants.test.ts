import { afterEach, describe, expect, it, vi } from 'vitest'

describe('extension default LLM config', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.resetModules()
	})

	it('prefers DeepSeek when a DeepSeek API key is available', async () => {
		vi.stubGlobal('__ROUTING_URL__', 'http://127.0.0.1:15721')
		vi.stubGlobal('__DEEPSEEK_API_KEY__', 'test-deepseek-key')

		const constants = await import('./constants')

		expect(constants.DEMO_CONFIG).toMatchObject({
			provider: 'openai',
			baseURL: 'https://api.deepseek.com',
			model: 'deepseek-chat',
			apiKey: 'test-deepseek-key',
		})
	})
})
