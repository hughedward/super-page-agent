/**
 * Anthropic Messages API client implementation.
 */
import * as z from 'zod/v4'

import { InvokeError, InvokeErrorTypes } from './errors'
import type { InvokeOptions, InvokeResult, LLMClient, LLMConfig, Message, Tool } from './types'

export class AnthropicClient implements LLMClient {
	config: Required<LLMConfig>
	private fetch: typeof globalThis.fetch

	constructor(config: Required<LLMConfig>) {
		this.config = config
		this.fetch = config.customFetch
	}

	async invoke(
		messages: Message[],
		tools: Record<string, Tool>,
		abortSignal?: AbortSignal,
		options?: InvokeOptions
	): Promise<InvokeResult> {
		abortSignal?.throwIfAborted()

		const requestBody = this.buildRequestBody(messages, tools, options)

		let response: Response
		try {
			response = await this.fetch(`${this.config.baseURL}/v1/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'anthropic-version': '2023-06-01',
					...(this.config.apiKey && { 'x-api-key': this.config.apiKey }),
				},
				body: JSON.stringify(requestBody),
				signal: abortSignal,
			})
		} catch (error: unknown) {
			if ((error as any)?.name === 'AbortError') throw error
			throw new InvokeError(InvokeErrorTypes.NETWORK_ERROR, 'Network request failed', error)
		}

		if (!response.ok) {
			await throwHttpError(response)
		}

		let data: any
		try {
			data = await response.json()
		} catch (error) {
			if ((error as any)?.name === 'AbortError') throw error
			throw new InvokeError(
				InvokeErrorTypes.INVALID_RESPONSE,
				'Response body is not valid JSON',
				error
			)
		}

		const toolUse = data.content?.find((item: any) => item?.type === 'tool_use')
		if (!toolUse?.name) {
			throw new InvokeError(
				InvokeErrorTypes.NO_TOOL_CALL,
				'No tool_use found in response',
				undefined,
				data
			)
		}

		const tool = tools[toolUse.name]
		if (!tool) {
			throw new InvokeError(
				InvokeErrorTypes.UNKNOWN,
				`Tool "${toolUse.name}" not found in tools`,
				undefined,
				data
			)
		}

		const validation = tool.inputSchema.safeParse(toolUse.input)
		if (!validation.success) {
			throw new InvokeError(
				InvokeErrorTypes.INVALID_TOOL_ARGS,
				'Tool input validation failed',
				validation.error,
				data
			)
		}

		let toolResult: unknown
		try {
			toolResult = await tool.execute(validation.data)
		} catch (error: unknown) {
			if ((error as any)?.name === 'AbortError') throw error
			throw new InvokeError(
				InvokeErrorTypes.TOOL_EXECUTION_ERROR,
				`Tool execution failed: ${(error as Error)?.message}`,
				error,
				data
			)
		}

		const promptTokens = data.usage?.input_tokens ?? 0
		const completionTokens = data.usage?.output_tokens ?? 0

		return {
			toolCall: {
				name: toolUse.name,
				args: validation.data,
			},
			toolResult,
			usage: {
				promptTokens,
				completionTokens,
				totalTokens: promptTokens + completionTokens,
				cachedTokens: data.usage?.cache_read_input_tokens,
				reasoningTokens: undefined,
			},
			rawResponse: data,
			rawRequest: requestBody,
		}
	}

	private buildRequestBody(
		messages: Message[],
		tools: Record<string, Tool>,
		options?: InvokeOptions
	): Record<string, unknown> {
		const system = messages
			.filter((message) => message.role === 'system' && message.content)
			.map((message) => message.content)
			.join('\n\n')

		let toolChoice: unknown = { type: 'any' }
		if (options?.toolChoiceName && !this.config.disableNamedToolChoice) {
			toolChoice = { type: 'tool', name: options.toolChoiceName }
		}

		const body: Record<string, unknown> = {
			model: this.config.model,
			max_tokens: this.config.maxTokens,
			messages: messages
				.filter((message) => message.role !== 'system')
				.map((message) => ({
					role: message.role === 'assistant' ? 'assistant' : 'user',
					content: message.content ?? '',
				})),
			tools: Object.entries(tools).map(([name, tool]) => ({
				name,
				description: tool.description,
				input_schema: z.toJSONSchema(tool.inputSchema, { target: 'openapi-3.0' }),
			})),
			tool_choice: toolChoice,
		}

		if (system) body.system = system
		if (typeof this.config.temperature === 'number') body.temperature = this.config.temperature

		let transformedBody: Record<string, unknown> | undefined
		try {
			transformedBody = this.config.transformRequestBody(body)
		} catch (error) {
			throw new InvokeError(
				InvokeErrorTypes.CONFIG_ERROR,
				`transformRequestBody failed: ${(error as Error).message}`,
				error
			)
		}

		return transformedBody ?? body
	}
}

async function throwHttpError(response: Response): Promise<never> {
	let errorData: any
	try {
		errorData = await response.json()
	} catch {
		// ignore parse failure and fall back to statusText
	}

	const errorMessage = errorData?.error?.message || response.statusText
	if (response.status === 401 || response.status === 403) {
		throw new InvokeError(
			InvokeErrorTypes.AUTH_ERROR,
			`Authentication failed: ${errorMessage}`,
			errorData
		)
	}
	if (response.status === 429) {
		throw new InvokeError(
			InvokeErrorTypes.RATE_LIMIT,
			`Rate limit exceeded: ${errorMessage}`,
			errorData
		)
	}
	if (response.status >= 500) {
		throw new InvokeError(InvokeErrorTypes.SERVER_ERROR, `Server error: ${errorMessage}`, errorData)
	}
	throw new InvokeError(InvokeErrorTypes.UNKNOWN, `HTTP ${response.status}: ${errorMessage}`, errorData)
}
