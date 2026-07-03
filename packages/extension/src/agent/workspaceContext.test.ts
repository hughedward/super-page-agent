import { describe, expect, it } from 'vitest'

import { composeAnnotationsContext, type PageAnnotation } from './annotations'
import { composeSkillsContext, type BrowserSkill } from './skills'

describe('workspace context isolation', () => {
	it('keeps skill instructions scoped to the active workspace', () => {
		const skills: BrowserSkill[] = [
			{
				id: 'skill-a',
				workspaceId: 'workspace-a',
				name: 'A Skill',
				enabled: true,
				matchPatterns: ['*'],
				content: 'Use A rules.',
				updatedAt: 1,
			},
			{
				id: 'skill-b',
				workspaceId: 'workspace-b',
				name: 'B Skill',
				enabled: true,
				matchPatterns: ['*'],
				content: 'Use B rules.',
				updatedAt: 1,
			},
		]

		const context = composeSkillsContext(skills, 'https://example.com', 'workspace-a')

		expect(context).toContain('Use A rules')
		expect(context).not.toContain('Use B rules')
	})

	it('keeps annotations scoped to the active workspace', () => {
		const annotations: PageAnnotation[] = [
			{
				id: 'annotation-a',
				workspaceId: 'workspace-a',
				label: 'Search button',
				note: 'Use the visible search action.',
				urlPattern: 'example.com',
				createdAt: 1,
				updatedAt: 1,
			},
			{
				id: 'annotation-b',
				workspaceId: 'workspace-b',
				label: 'Other workspace',
				note: 'Do not leak this note.',
				urlPattern: 'example.com',
				createdAt: 1,
				updatedAt: 1,
			},
		]

		const context = composeAnnotationsContext(annotations, 'https://example.com', 'workspace-a')

		expect(context).toContain('Search button')
		expect(context).not.toContain('Do not leak this note')
	})
})
