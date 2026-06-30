import type { LLMConfig } from '@page-agent/llms'

import { DEEPSEEK_API_KEY, ROUTING_BASE_URL } from './constants'
import type { ExtConfig } from './useAgent'

export type ProviderPresetId =
	| 'custom'
	| 'deepseek'
	| 'cc-switch-claude'
	| 'openai'
	| 'openrouter'
	| 'qwen'
	| 'ollama'
	| 'lm-studio'

export interface ProviderPreset {
	id: ProviderPresetId
	label: string
	description: string
	provider: NonNullable<LLMConfig['provider']>
	baseURL: string
	model: string
	apiKey?: string
	requiresApiKey: boolean
	disableNamedToolChoice?: boolean
}

export function getProviderPresets(): ProviderPreset[] {
	const ccSwitchUrl = ROUTING_BASE_URL || 'http://127.0.0.1:15721'

	return [
		{
			id: 'deepseek',
			label: 'DeepSeek',
			description: 'Cloud API, OpenAI-compatible, recommended for current development.',
			provider: 'openai',
			baseURL: 'https://api.deepseek.com',
			model: 'deepseek-chat',
			apiKey: DEEPSEEK_API_KEY || undefined,
			requiresApiKey: true,
		},
		{
			id: 'cc-switch-claude',
			label: 'cc-switch Claude',
			description: 'Local cc-switch route, Anthropic-compatible.',
			provider: 'anthropic',
			baseURL: ccSwitchUrl,
			model: 'glm-5.2',
			requiresApiKey: false,
		},
		{
			id: 'openai',
			label: 'OpenAI',
			description: 'Official OpenAI API.',
			provider: 'openai',
			baseURL: 'https://api.openai.com/v1',
			model: 'gpt-5.1',
			requiresApiKey: true,
		},
		{
			id: 'openrouter',
			label: 'OpenRouter',
			description: 'OpenAI-compatible multi-model gateway.',
			provider: 'openai',
			baseURL: 'https://openrouter.ai/api/v1',
			model: 'openai/gpt-5.1',
			requiresApiKey: true,
		},
		{
			id: 'qwen',
			label: 'Qwen / Bailian',
			description: 'Alibaba DashScope OpenAI-compatible mode.',
			provider: 'openai',
			baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
			model: 'qwen-plus',
			requiresApiKey: true,
		},
		{
			id: 'ollama',
			label: 'Ollama',
			description: 'Local OpenAI-compatible Ollama server.',
			provider: 'openai',
			baseURL: 'http://localhost:11434/v1',
			model: 'qwen3:8b',
			apiKey: 'ollama',
			requiresApiKey: false,
		},
		{
			id: 'lm-studio',
			label: 'LM Studio',
			description: 'Local OpenAI-compatible LM Studio server.',
			provider: 'openai',
			baseURL: 'http://localhost:1234/v1',
			model: 'local-model',
			apiKey: 'lm-studio',
			requiresApiKey: false,
		},
	]
}

export function applyProviderPreset(config: ExtConfig, preset: ProviderPreset): ExtConfig {
	return {
		...config,
		provider: preset.provider,
		baseURL: preset.baseURL,
		model: preset.model,
		apiKey: preset.apiKey ?? config.apiKey ?? '',
		disableNamedToolChoice: preset.disableNamedToolChoice ?? config.disableNamedToolChoice,
	}
}

export function detectProviderPresetId(config: Pick<ExtConfig, 'baseURL' | 'model' | 'provider'>): ProviderPresetId {
	const normalizedBaseUrl = normalizeBaseUrl(config.baseURL)
	const matched = getProviderPresets().find(
		(preset) =>
			normalizeBaseUrl(preset.baseURL) === normalizedBaseUrl &&
			preset.provider === config.provider &&
			preset.model === config.model
	)

	return matched?.id ?? 'custom'
}

function normalizeBaseUrl(url: string): string {
	return url.trim().replace(/\/+$/, '')
}
