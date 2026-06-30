const ANNOTATIONS_STORAGE_KEY = 'pageAnnotations'

export interface PageAnnotation {
	id: string
	label: string
	note: string
	urlPattern: string
	selectorHint?: string
	textFingerprint?: string
	roleHint?: string
	bounds?: {
		x: number
		y: number
		width: number
		height: number
	}
	createdAt: number
	updatedAt: number
}

export async function loadAnnotations(): Promise<PageAnnotation[]> {
	const result = await chrome.storage.local.get(ANNOTATIONS_STORAGE_KEY)
	const stored = result[ANNOTATIONS_STORAGE_KEY]
	return Array.isArray(stored) ? normalizeAnnotations(stored) : []
}

export async function saveAnnotations(annotations: PageAnnotation[]): Promise<void> {
	await chrome.storage.local.set({
		[ANNOTATIONS_STORAGE_KEY]: normalizeAnnotations(annotations),
	})
}

export function getMatchingAnnotations(
	annotations: PageAnnotation[],
	url: string
): PageAnnotation[] {
	return annotations.filter((annotation) => matchesUrlPattern(annotation.urlPattern, url))
}

export function composeAnnotationsContext(annotations: PageAnnotation[], url: string): string {
	const matched = getMatchingAnnotations(annotations, url)
	if (!matched.length) return ''

	const sections = matched.map((annotation) => {
		const hints = [
			annotation.selectorHint ? `selector: ${annotation.selectorHint}` : '',
			annotation.textFingerprint ? `text: ${annotation.textFingerprint}` : '',
			annotation.roleHint ? `role: ${annotation.roleHint}` : '',
			annotation.bounds ? `bounds: ${JSON.stringify(annotation.bounds)}` : '',
		]
			.filter(Boolean)
			.join('\n')

		return [
			`<annotation id="${annotation.id}" label="${annotation.label}">`,
			annotation.note.trim(),
			hints ? `<hints>\n${hints}\n</hints>` : '',
			'</annotation>',
		]
			.filter(Boolean)
			.join('\n')
	})

	return `<page_annotations>\n${sections.join('\n\n')}\n</page_annotations>`
}

function normalizeAnnotations(value: unknown[]): PageAnnotation[] {
	return value
		.map((item): PageAnnotation | null => {
			if (!item || typeof item !== 'object') return null
			const raw = item as Partial<PageAnnotation>
			if (!raw.id || !raw.label || !raw.urlPattern) return null

			return {
				id: String(raw.id),
				label: String(raw.label),
				note: raw.note ? String(raw.note) : '',
				urlPattern: String(raw.urlPattern),
				selectorHint: raw.selectorHint ? String(raw.selectorHint) : undefined,
				textFingerprint: raw.textFingerprint ? String(raw.textFingerprint) : undefined,
				roleHint: raw.roleHint ? String(raw.roleHint) : undefined,
				bounds: normalizeBounds(raw.bounds),
				createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
				updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
			}
		})
		.filter((annotation): annotation is PageAnnotation => annotation !== null)
}

function normalizeBounds(bounds: PageAnnotation['bounds']): PageAnnotation['bounds'] {
	if (!bounds) return undefined
	const { x, y, width, height } = bounds
	if ([x, y, width, height].some((value) => typeof value !== 'number')) return undefined
	return { x, y, width, height }
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
