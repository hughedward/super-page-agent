const SKILLS_STORAGE_KEY = 'browserSkills'

export interface BrowserSkill {
	id: string
	name: string
	description?: string
	enabled: boolean
	matchPatterns: string[]
	content: string
	updatedAt: number
}

export const BUILTIN_SKILLS: BrowserSkill[] = [
	{
		id: 'general-web-assistant',
		name: 'General Web Assistant',
		description: 'Baseline guidance for safe browser task execution.',
		enabled: true,
		matchPatterns: ['*'],
		content: [
			'Prefer reversible, low-risk actions.',
			'Before submitting forms, posting content, deleting data, or changing account settings, ask the user for confirmation.',
			'Use the current page state and visible controls before opening unrelated pages.',
			'When a page has user annotations, treat them as higher-priority page knowledge than your generic assumptions.',
		].join('\n'),
		updatedAt: 0,
	},
]

export async function loadSkills(): Promise<BrowserSkill[]> {
	const result = await chrome.storage.local.get(SKILLS_STORAGE_KEY)
	const stored = result[SKILLS_STORAGE_KEY]
	const skills = Array.isArray(stored) ? normalizeSkills(stored) : []
	return mergeBuiltinSkills(skills)
}

export async function saveSkills(skills: BrowserSkill[]): Promise<void> {
	await chrome.storage.local.set({ [SKILLS_STORAGE_KEY]: normalizeSkills(skills) })
}

export function getMatchingSkills(skills: BrowserSkill[], url: string): BrowserSkill[] {
	return skills.filter((skill) => {
		if (!skill.enabled) return false
		if (!skill.content.trim()) return false
		return skill.matchPatterns.some((pattern) => matchesUrlPattern(pattern, url))
	})
}

export function composeSkillsContext(skills: BrowserSkill[], url: string): string {
	const matched = getMatchingSkills(skills, url)
	if (!matched.length) return ''

	const sections = matched.map((skill) => {
		const description = skill.description ? `\nDescription: ${skill.description}` : ''
		return `<skill id="${skill.id}" name="${skill.name}">${description}\n${skill.content.trim()}\n</skill>`
	})

	return `<matched_skills>\n${sections.join('\n\n')}\n</matched_skills>`
}

function mergeBuiltinSkills(skills: BrowserSkill[]): BrowserSkill[] {
	const byId = new Map(skills.map((skill) => [skill.id, skill]))
	for (const builtin of BUILTIN_SKILLS) {
		if (!byId.has(builtin.id)) {
			byId.set(builtin.id, builtin)
		}
	}
	return Array.from(byId.values())
}

function normalizeSkills(value: unknown[]): BrowserSkill[] {
	return value
		.map((item): BrowserSkill | null => {
			if (!item || typeof item !== 'object') return null
			const raw = item as Partial<BrowserSkill>
			if (!raw.id || !raw.name) return null
			return {
				id: String(raw.id),
				name: String(raw.name),
				description: raw.description ? String(raw.description) : undefined,
				enabled: raw.enabled !== false,
				matchPatterns: Array.isArray(raw.matchPatterns)
					? raw.matchPatterns.map(String).filter(Boolean)
					: ['*'],
				content: raw.content ? String(raw.content) : '',
				updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
			}
		})
		.filter((skill): skill is BrowserSkill => skill !== null)
}

function matchesUrlPattern(pattern: string, url: string): boolean {
	if (pattern === '*') return true
	if (!url) return false

	try {
		const parsedUrl = new URL(url)
		const normalizedPattern = pattern.trim()

		if (normalizedPattern.startsWith('*.')) {
			const domain = normalizedPattern.slice(2)
			return parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
		}

		if (normalizedPattern.includes('://')) {
			return new RegExp(`^${escapeRegExp(normalizedPattern).replaceAll('\\*', '.*')}$`).test(url)
		}

		return parsedUrl.hostname === normalizedPattern || parsedUrl.hostname.endsWith(`.${normalizedPattern}`)
	} catch {
		return false
	}
}

function escapeRegExp(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}
