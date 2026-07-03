export function matchesUrlPattern(pattern: string, url: string): boolean {
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

export function normalizeMatchPatterns(value: unknown): string[] {
	if (!Array.isArray(value)) return ['*']
	const patterns = value.map(String).map((pattern) => pattern.trim()).filter(Boolean)
	return patterns.length ? patterns : ['*']
}

function escapeRegExp(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}
