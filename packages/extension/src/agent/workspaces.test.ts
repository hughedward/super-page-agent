import { afterEach, describe, expect, it, vi } from 'vitest'

describe('workspaces', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.resetModules()
	})

	it('creates a default workspace and active workspace when storage is empty', async () => {
		const store = installChromeStorage()
		const { DEFAULT_WORKSPACE_ID, loadWorkspaceState } = await import('./workspaces')

		const state = await loadWorkspaceState()

		expect(state.activeWorkspaceId).toBe(DEFAULT_WORKSPACE_ID)
		expect(state.workspaces).toEqual([
			expect.objectContaining({
				id: DEFAULT_WORKSPACE_ID,
				name: 'Default Workspace',
				isDefault: true,
			}),
		])
		expect(store.workspaceState).toEqual(state)
	})

	it('keeps the active workspace valid after deleting a custom workspace', async () => {
		installChromeStorage()
		const {
			DEFAULT_WORKSPACE_ID,
			createWorkspace,
			deleteWorkspace,
			loadWorkspaceState,
			setActiveWorkspaceId,
		} = await import('./workspaces')

		const created = await createWorkspace('小红书运营')
		await setActiveWorkspaceId(created.id)
		await deleteWorkspace(created.id)

		const state = await loadWorkspaceState()
		expect(state.activeWorkspaceId).toBe(DEFAULT_WORKSPACE_ID)
		expect(state.workspaces.map((workspace) => workspace.id)).toEqual([DEFAULT_WORKSPACE_ID])
	})
})

function installChromeStorage(initial: Record<string, unknown> = {}) {
	const store: Record<string, unknown> = { ...initial }
	vi.stubGlobal('chrome', {
		storage: {
			local: {
				get: vi.fn(async (keys?: string | string[]) => {
					if (!keys) return { ...store }
					if (typeof keys === 'string') return { [keys]: store[keys] }
					return Object.fromEntries(keys.map((key) => [key, store[key]]))
				}),
				set: vi.fn(async (values: Record<string, unknown>) => {
					Object.assign(store, values)
				}),
				remove: vi.fn(async (keys: string | string[]) => {
					for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key]
				}),
				onChanged: {
					addListener: vi.fn(),
					removeListener: vi.fn(),
				},
			},
		},
	})
	return store
}
