import { describe, expect, it } from 'vitest'

import {
	type WorkspaceMemory,
	composeMemoriesContext,
	getMatchingMemories,
} from './memories'

const memories: WorkspaceMemory[] = [
	{
		id: 'memory-current',
		workspaceId: 'workspace-a',
		title: '小红书语气',
		content: '评论要自然，不要像广告。',
		enabled: true,
		matchPatterns: ['*.xiaohongshu.com'],
		createdAt: 1,
		updatedAt: 2,
	},
	{
		id: 'memory-disabled',
		workspaceId: 'workspace-a',
		title: 'Disabled',
		content: 'Do not use this.',
		enabled: false,
		matchPatterns: ['*'],
		createdAt: 1,
		updatedAt: 2,
	},
	{
		id: 'memory-other-workspace',
		workspaceId: 'workspace-b',
		title: '抖音规则',
		content: 'Only for another workspace.',
		enabled: true,
		matchPatterns: ['*'],
		createdAt: 1,
		updatedAt: 2,
	},
]

describe('workspace memories', () => {
	it('matches enabled memories by workspace and url', () => {
		expect(
			getMatchingMemories(memories, 'https://www.xiaohongshu.com/search_result', 'workspace-a').map(
				(memory) => memory.id
			)
		).toEqual(['memory-current'])
	})

	it('composes memory context without leaking other workspaces', () => {
		const context = composeMemoriesContext(
			memories,
			'https://www.xiaohongshu.com/search_result',
			'workspace-a'
		)

		expect(context).toContain('<workspace_memories>')
		expect(context).toContain('小红书语气')
		expect(context).toContain('评论要自然')
		expect(context).not.toContain('抖音规则')
		expect(context).not.toContain('Do not use this')
	})
})
