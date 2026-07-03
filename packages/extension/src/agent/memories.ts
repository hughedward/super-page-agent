import { matchesUrlPattern, normalizeMatchPatterns } from './urlPatterns'
import { DEFAULT_WORKSPACE_ID } from './workspaces'

const MEMORIES_STORAGE_KEY = 'workspaceMemories'

export interface WorkspaceMemory {
	id: string
	workspaceId: string
	title: string
	content: string
	enabled: boolean
	matchPatterns: string[]
	createdAt: number
	updatedAt: number
}

export async function loadMemories(): Promise<WorkspaceMemory[]> {
	const result = await chrome.storage.local.get(MEMORIES_STORAGE_KEY)
	const stored = result[MEMORIES_STORAGE_KEY]
	return Array.isArray(stored) ? normalizeMemories(stored) : []
}

export async function saveMemories(memories: WorkspaceMemory[]): Promise<void> {
	await chrome.storage.local.set({ [MEMORIES_STORAGE_KEY]: normalizeMemories(memories) })
}

export function getMatchingMemories(
	memories: WorkspaceMemory[],
	url: string,
	workspaceId: string
): WorkspaceMemory[] {
	return memories.filter((memory) => {
		if (memory.workspaceId !== workspaceId) return false
		if (!memory.enabled) return false
		if (!memory.content.trim()) return false
		return memory.matchPatterns.some((pattern) => matchesUrlPattern(pattern, url))
	})
}

export function composeMemoriesContext(
	memories: WorkspaceMemory[],
	url: string,
	workspaceId: string
): string {
	const matched = getMatchingMemories(memories, url, workspaceId)
	if (!matched.length) return ''

	const sections = matched.map((memory) =>
		[
			`<memory id="${memory.id}" title="${memory.title}">`,
			memory.content.trim(),
			'</memory>',
		].join('\n')
	)

	return `<workspace_memories>\n${sections.join('\n\n')}\n</workspace_memories>`
}

function normalizeMemories(value: unknown[]): WorkspaceMemory[] {
	return value
		.map((item): WorkspaceMemory | null => {
			if (!item || typeof item !== 'object') return null
			const raw = item as Partial<WorkspaceMemory>
			if (!raw.id || !raw.title) return null

			return {
				id: String(raw.id),
				workspaceId: raw.workspaceId ? String(raw.workspaceId) : DEFAULT_WORKSPACE_ID,
				title: String(raw.title),
				content: raw.content ? String(raw.content) : '',
				enabled: raw.enabled !== false,
				matchPatterns: normalizeMatchPatterns(raw.matchPatterns),
				createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
				updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
			}
		})
		.filter((memory): memory is WorkspaceMemory => memory !== null)
}
