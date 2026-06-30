import type { LLMConfig } from '@page-agent/llms'

// Demo LLM for testing
export const ROUTING_BASE_URL = normalizeBaseUrl(__ROUTING_URL__)
export const DEEPSEEK_API_KEY = __DEEPSEEK_API_KEY__.trim()
const TESTING_BASE_URL = 'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run'
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

export const DEMO_MODEL = DEEPSEEK_API_KEY
	? 'deepseek-chat'
	: ROUTING_BASE_URL
		? 'glm-5.2'
		: 'qwen3.5-plus'
export const DEMO_BASE_URL = DEEPSEEK_API_KEY
	? DEEPSEEK_BASE_URL
	: ROUTING_BASE_URL || TESTING_BASE_URL

export const DEMO_CONFIG: LLMConfig = {
	baseURL: DEMO_BASE_URL,
	model: DEMO_MODEL,
	provider: DEEPSEEK_API_KEY ? 'openai' : ROUTING_BASE_URL ? 'anthropic' : 'openai',
	...(DEEPSEEK_API_KEY && { apiKey: DEEPSEEK_API_KEY }),
}

/** Legacy testing endpoints that should be auto-migrated to DEMO_BASE_URL */
export const LEGACY_TESTING_ENDPOINTS = [
	'https://hwcxiuzfylggtcktqgij.supabase.co/functions/v1/llm-testing-proxy',
]

export function isTestingEndpoint(url: string): boolean {
	const normalized = url.replace(/\/+$/, '')
	return normalized === TESTING_BASE_URL || LEGACY_TESTING_ENDPOINTS.some((ep) => normalized === ep)
}

export function migrateLegacyEndpoint(config: LLMConfig): LLMConfig {
	const normalized = config.baseURL.replace(/\/+$/, '')
	if (LEGACY_TESTING_ENDPOINTS.some((ep) => normalized === ep)) {
		return { ...DEMO_CONFIG }
	}
	return config
}

function normalizeBaseUrl(url: string): string {
	return url.trim().replace(/\/+$/, '')
}
