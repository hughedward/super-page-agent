export const DEFAULT_WORKSPACE_ID = 'default-workspace'
export const GLOBAL_WORKSPACE_ID = '__global__'

const WORKSPACE_STATE_STORAGE_KEY = 'workspaceState'

export interface Workspace {
	id: string
	name: string
	description?: string
	isDefault: boolean
	createdAt: number
	updatedAt: number
}

export interface WorkspaceState {
	workspaces: Workspace[]
	activeWorkspaceId: string
}

export async function loadWorkspaceState(): Promise<WorkspaceState> {
	const result = await chrome.storage.local.get(WORKSPACE_STATE_STORAGE_KEY)
	const normalized = normalizeWorkspaceState(result[WORKSPACE_STATE_STORAGE_KEY])
	await chrome.storage.local.set({ [WORKSPACE_STATE_STORAGE_KEY]: normalized })
	return normalized
}

export async function saveWorkspaceState(state: WorkspaceState): Promise<WorkspaceState> {
	const normalized = normalizeWorkspaceState(state)
	await chrome.storage.local.set({ [WORKSPACE_STATE_STORAGE_KEY]: normalized })
	return normalized
}

export async function setActiveWorkspaceId(workspaceId: string): Promise<WorkspaceState> {
	const state = await loadWorkspaceState()
	const activeWorkspaceId = state.workspaces.some((workspace) => workspace.id === workspaceId)
		? workspaceId
		: DEFAULT_WORKSPACE_ID
	return saveWorkspaceState({ ...state, activeWorkspaceId })
}

export async function createWorkspace(name: string): Promise<Workspace> {
	const state = await loadWorkspaceState()
	const now = Date.now()
	const workspace: Workspace = {
		id: `workspace-${crypto.randomUUID()}`,
		name: name.trim() || 'Untitled Workspace',
		isDefault: false,
		createdAt: now,
		updatedAt: now,
	}
	await saveWorkspaceState({
		workspaces: [...state.workspaces, workspace],
		activeWorkspaceId: workspace.id,
	})
	return workspace
}

export async function renameWorkspace(workspaceId: string, name: string): Promise<WorkspaceState> {
	const state = await loadWorkspaceState()
	const nextName = name.trim() || 'Untitled Workspace'
	return saveWorkspaceState({
		...state,
		workspaces: state.workspaces.map((workspace) =>
			workspace.id === workspaceId && !workspace.isDefault
				? { ...workspace, name: nextName, updatedAt: Date.now() }
				: workspace
		),
	})
}

export async function deleteWorkspace(workspaceId: string): Promise<WorkspaceState> {
	const state = await loadWorkspaceState()
	const target = state.workspaces.find((workspace) => workspace.id === workspaceId)
	if (!target || target.isDefault) return state

	const workspaces = state.workspaces.filter((workspace) => workspace.id !== workspaceId)
	return saveWorkspaceState({
		workspaces,
		activeWorkspaceId:
			state.activeWorkspaceId === workspaceId ? DEFAULT_WORKSPACE_ID : state.activeWorkspaceId,
	})
}

function normalizeWorkspaceState(value: unknown): WorkspaceState {
	const raw = value && typeof value === 'object' ? (value as Partial<WorkspaceState>) : {}
	const workspaces = Array.isArray(raw.workspaces) ? normalizeWorkspaces(raw.workspaces) : []
	if (!workspaces.some((workspace) => workspace.id === DEFAULT_WORKSPACE_ID)) {
		workspaces.unshift(createDefaultWorkspace())
	}

	const activeWorkspaceId =
		typeof raw.activeWorkspaceId === 'string' &&
		workspaces.some((workspace) => workspace.id === raw.activeWorkspaceId)
			? raw.activeWorkspaceId
			: DEFAULT_WORKSPACE_ID

	return {
		workspaces,
		activeWorkspaceId,
	}
}

function normalizeWorkspaces(value: unknown[]): Workspace[] {
	return value
		.map((item): Workspace | null => {
			if (!item || typeof item !== 'object') return null
			const raw = item as Partial<Workspace>
			if (!raw.id || !raw.name) return null
			return {
				id: String(raw.id),
				name: String(raw.name),
				description: raw.description ? String(raw.description) : undefined,
				isDefault: raw.id === DEFAULT_WORKSPACE_ID || raw.isDefault === true,
				createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
				updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
			}
		})
		.filter((workspace): workspace is Workspace => workspace !== null)
}

function createDefaultWorkspace(): Workspace {
	return {
		id: DEFAULT_WORKSPACE_ID,
		name: 'Default Workspace',
		isDefault: true,
		createdAt: 0,
		updatedAt: 0,
	}
}
