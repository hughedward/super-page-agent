/**
 * React hook for using AgentController
 */
import type {
	AgentActivity,
	AgentStatus,
	ExecutionResult,
	HistoricalEvent,
	SupportedLanguage,
} from '@page-agent/core'
import type { LLMConfig } from '@page-agent/llms'
import { useCallback, useEffect, useRef, useState } from 'react'

import { MultiPageAgent } from './MultiPageAgent'
import {
	type PageAnnotation,
	composeAnnotationsContext,
	loadAnnotations,
} from './annotations'
import { DEMO_CONFIG, ROUTING_BASE_URL, migrateLegacyEndpoint } from './constants'
import { type BrowserSkill, composeSkillsContext, loadSkills } from './skills'

/** Language preference: undefined means follow system */
export type LanguagePreference = SupportedLanguage | undefined

export interface AdvancedConfig {
	maxSteps?: number
	maxTokens?: number
	systemInstruction?: string
	experimentalLlmsTxt?: boolean
	experimentalIncludeAllTabs?: boolean
	disableNamedToolChoice?: boolean
}

export interface ExtConfig extends LLMConfig, AdvancedConfig {
	language?: LanguagePreference
}

export interface UseAgentResult {
	status: AgentStatus
	history: HistoricalEvent[]
	activity: AgentActivity | null
	currentTask: string
	config: ExtConfig | null
	execute: (task: string) => Promise<ExecutionResult>
	stop: () => void
	configure: (config: ExtConfig) => Promise<void>
}

export function useAgent(): UseAgentResult {
	const agentRef = useRef<MultiPageAgent | null>(null)
	const [status, setStatus] = useState<AgentStatus>('idle')
	const [history, setHistory] = useState<HistoricalEvent[]>([])
	const [activity, setActivity] = useState<AgentActivity | null>(null)
	const [currentTask, setCurrentTask] = useState('')
	const [config, setConfig] = useState<ExtConfig | null>(null)
	const [skills, setSkills] = useState<BrowserSkill[]>([])
	const [annotations, setAnnotations] = useState<PageAnnotation[]>([])

	useEffect(() => {
		Promise.all([
			chrome.storage.local.get(['llmConfig', 'language', 'advancedConfig']),
			loadSkills(),
			loadAnnotations(),
		]).then(([result, loadedSkills, loadedAnnotations]) => {
			let llmConfig = (result.llmConfig as LLMConfig) ?? DEMO_CONFIG
			const language = (result.language as SupportedLanguage) || undefined
			const advancedConfig = (result.advancedConfig as AdvancedConfig) ?? {}

			// Auto-migrate legacy testing endpoints
			const migrated = migrateLegacyEndpoint(llmConfig)
			if (migrated !== llmConfig) {
				llmConfig = migrated
				chrome.storage.local.set({ llmConfig: migrated })
			} else if (!result.llmConfig) {
				chrome.storage.local.set({ llmConfig: DEMO_CONFIG })
			}
			if (
				ROUTING_BASE_URL &&
				llmConfig.baseURL.replace(/\/+$/, '') === ROUTING_BASE_URL &&
				!llmConfig.provider
			) {
				llmConfig = { ...llmConfig, provider: 'anthropic', model: 'glm-5.2' }
				chrome.storage.local.set({ llmConfig })
			}

			setSkills(loadedSkills)
			setAnnotations(loadedAnnotations)
			setConfig({ ...llmConfig, ...advancedConfig, language })
		})
	}, [])

	useEffect(() => {
		const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
			if (changes.browserSkills) {
				loadSkills().then(setSkills).catch(console.error)
			}
			if (changes.pageAnnotations) {
				loadAnnotations().then(setAnnotations).catch(console.error)
			}
		}

		chrome.storage.local.onChanged.addListener(handleStorageChange)
		return () => chrome.storage.local.onChanged.removeListener(handleStorageChange)
	}, [])

	useEffect(() => {
		if (!config) return

		const { systemInstruction, ...agentConfig } = config
		const agent = new MultiPageAgent({
			...agentConfig,
			instructions: {
				system: systemInstruction,
				getPageInstructions: (url) => composePageContext(url, skills, annotations),
			},
		})
		agentRef.current = agent

		const handleStatusChange = (e: Event) => {
			const newStatus = agent.status as AgentStatus
			setStatus(newStatus)
			if (newStatus !== 'running') {
				setActivity(null)
			}
		}

		const handleHistoryChange = (e: Event) => {
			setHistory([...agent.history])
		}

		const handleActivity = (e: Event) => {
			const newActivity = (e as CustomEvent).detail as AgentActivity
			setActivity(newActivity)
		}

		agent.addEventListener('statuschange', handleStatusChange)
		agent.addEventListener('historychange', handleHistoryChange)
		agent.addEventListener('activity', handleActivity)

		return () => {
			agent.removeEventListener('statuschange', handleStatusChange)
			agent.removeEventListener('historychange', handleHistoryChange)
			agent.removeEventListener('activity', handleActivity)
			agent.dispose()
		}
	}, [annotations, config, skills])

	const execute = useCallback(async (task: string) => {
		const agent = agentRef.current
		if (!agent) throw new Error('Agent not initialized')

		setCurrentTask(task)
		setHistory([])
		return agent.execute(task)
	}, [])

	const stop = useCallback(() => {
		agentRef.current?.stop()
	}, [])

	const configure = useCallback(
		async ({
			language,
			maxSteps,
			maxTokens,
			systemInstruction,
			experimentalLlmsTxt,
			experimentalIncludeAllTabs,
			disableNamedToolChoice,
			...llmConfig
		}: ExtConfig) => {
			await chrome.storage.local.set({ llmConfig })
			if (language) {
				await chrome.storage.local.set({ language })
			} else {
				await chrome.storage.local.remove('language')
			}
			const advancedConfig: AdvancedConfig = {
				maxSteps,
				maxTokens,
				systemInstruction,
				experimentalLlmsTxt,
				experimentalIncludeAllTabs,
				disableNamedToolChoice,
			}
			await chrome.storage.local.set({ advancedConfig })
			setConfig({ ...llmConfig, ...advancedConfig, language })
		},
		[]
	)

	return {
		status,
		history,
		activity,
		currentTask,
		config,
		execute,
		stop,
		configure,
	}
}

function composePageContext(
	url: string,
	skills: BrowserSkill[],
	annotations: PageAnnotation[]
): string | undefined {
	const context = [composeSkillsContext(skills, url), composeAnnotationsContext(annotations, url)]
		.filter(Boolean)
		.join('\n\n')

	return context || undefined
}
