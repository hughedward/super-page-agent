import { describe, expect, it, vi } from 'vitest'
import * as z from 'zod/v4'

import { AnthropicClient } from './AnthropicClient'
import { parseLLMConfig } from './index'
import type { LLMConfig, Tool } from './types'

function makeClient(overrides: Partial<LLMConfig> = {}) {
	const fetchMock = vi.fn<typeof fetch>()
	const config = parseLLMConfig({
		baseURL: 'http://test.local',
		model: 'glm-5.2',
		apiKey: '123456',
		customFetch: fetchMock,
		provider: 'anthropic',
		...overrides,
	})
	const client = new AnthropicClient(config)
	return { client, fetchMock }
}

function makeTool(): Tool<{ text: string }, string> {
	return {
		description: 'say text',
		inputSchema: z.object({ text: z.string() }),
		execute: vi.fn(async (args) => `said ${args.text}`),
	}
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	})
}

function getSentBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
	const init = fetchMock.mock.calls[0][1] as RequestInit
	return JSON.parse(init.body as string)
}

const signal = new AbortController().signal

describe('AnthropicClient.invoke', () => {
	it('posts to /v1/messages with Anthropic headers and executes tool_use', async () => {
		const { client, fetchMock } = makeClient()
		const tool = makeTool()
		fetchMock.mockResolvedValue(
			jsonResponse({
				id: 'msg_1',
				stop_reason: 'tool_use',
				content: [
					{
						type: 'tool_use',
						id: 'toolu_1',
						name: 'say',
						input: { text: 'OK' },
					},
				],
				usage: { input_tokens: 8, output_tokens: 4 },
			})
		)

		const result = await client.invoke([], { say: tool }, signal, { toolChoiceName: 'say' })

		expect(fetchMock.mock.calls[0][0]).toBe('http://test.local/v1/messages')
		const init = fetchMock.mock.calls[0][1]!
		expect((init.headers as Record<string, string>)['x-api-key']).toBe('123456')
		expect((init.headers as Record<string, string>)['anthropic-version']).toBe('2023-06-01')
		expect(getSentBody(fetchMock).tool_choice).toEqual({ type: 'tool', name: 'say' })
		expect(result.toolCall).toEqual({ name: 'say', args: { text: 'OK' } })
		expect(result.toolResult).toBe('said OK')
		expect(result.usage).toEqual({
			promptTokens: 8,
			completionTokens: 4,
			totalTokens: 12,
			cachedTokens: undefined,
			reasoningTokens: undefined,
		})
	})
})
