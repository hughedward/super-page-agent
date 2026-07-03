import {
	ArrowLeft,
	Brain,
	Database,
	Download,
	MapPinned,
	Pencil,
	Plus,
	Save,
	Sparkles,
	Trash2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { type PageAnnotation, loadAnnotations, saveAnnotations } from '@/agent/annotations'
import {
	type WorkspaceMemory,
	loadMemories,
	saveMemories,
} from '@/agent/memories'
import { type BrowserSkill, loadSkills, saveSkills } from '@/agent/skills'
import {
	type WorkspaceState,
	createWorkspace,
	deleteWorkspace,
	renameWorkspace,
	setActiveWorkspaceId,
} from '@/agent/workspaces'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

interface WorkspacePanelProps {
	workspaceState: WorkspaceState
	onBack: () => void
	onWorkspaceStateChange: (state: WorkspaceState) => void
}

type EditableMemory = WorkspaceMemory & {
	matchPatternsText: string
}

export function WorkspacePanel({
	workspaceState,
	onBack,
	onWorkspaceStateChange,
}: WorkspacePanelProps) {
	const [skills, setSkills] = useState<BrowserSkill[]>([])
	const [annotations, setAnnotations] = useState<PageAnnotation[]>([])
	const [memories, setMemories] = useState<WorkspaceMemory[]>([])
	const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null)
	const [draft, setDraft] = useState<EditableMemory | null>(null)
	const [saving, setSaving] = useState(false)

	const activeWorkspace =
		workspaceState.workspaces.find(
			(workspace) => workspace.id === workspaceState.activeWorkspaceId
		) ?? workspaceState.workspaces[0]

	const workspaceSkills = useMemo(
		() => skills.filter((skill) => skill.workspaceId === activeWorkspace?.id),
		[activeWorkspace?.id, skills]
	)
	const workspaceAnnotations = useMemo(
		() =>
			annotations.filter((annotation) => annotation.workspaceId === activeWorkspace?.id),
		[activeWorkspace?.id, annotations]
	)
	const workspaceMemories = useMemo(
		() => memories.filter((memory) => memory.workspaceId === activeWorkspace?.id),
		[activeWorkspace?.id, memories]
	)
	const recentAssets = useMemo(
		() =>
			[
				...workspaceSkills.map((skill) => ({
					id: skill.id,
					type: 'Skill',
					title: skill.name,
					updatedAt: skill.updatedAt,
				})),
				...workspaceMemories.map((memory) => ({
					id: memory.id,
					type: 'Memory',
					title: memory.title,
					updatedAt: memory.updatedAt,
				})),
				...workspaceAnnotations.map((annotation) => ({
					id: annotation.id,
					type: 'Annotation',
					title: annotation.label,
					updatedAt: annotation.updatedAt,
				})),
			]
				.sort((a, b) => b.updatedAt - a.updatedAt)
				.slice(0, 6),
		[workspaceAnnotations, workspaceMemories, workspaceSkills]
	)

	useEffect(() => {
		Promise.all([loadSkills(), loadAnnotations(), loadMemories()])
			.then(([loadedSkills, loadedAnnotations, loadedMemories]) => {
				setSkills(loadedSkills)
				setAnnotations(loadedAnnotations)
				setMemories(loadedMemories)
				setSelectedMemoryId((current) => current ?? loadedMemories[0]?.id ?? null)
			})
			.catch(console.error)
	}, [])

	useEffect(() => {
		const selected = workspaceMemories.find((memory) => memory.id === selectedMemoryId)
		if (!selected) {
			setDraft(null)
			setSelectedMemoryId(workspaceMemories[0]?.id ?? null)
			return
		}
		setDraft({
			...selected,
			matchPatternsText: selected.matchPatterns.join('\n'),
		})
	}, [selectedMemoryId, workspaceMemories])

	const createNewWorkspace = async () => {
		const name = window.prompt('Workspace name')
		if (!name?.trim()) return
		const created = await createWorkspace(name)
		const state = await setActiveWorkspaceId(created.id)
		onWorkspaceStateChange(state)
	}

	const renameActiveWorkspace = async () => {
		if (!activeWorkspace || activeWorkspace.isDefault) return
		const name = window.prompt('Workspace name', activeWorkspace.name)
		if (!name?.trim()) return
		const state = await renameWorkspace(activeWorkspace.id, name)
		onWorkspaceStateChange(state)
	}

	const deleteActiveWorkspace = async () => {
		if (!activeWorkspace || activeWorkspace.isDefault) return
		if (!window.confirm(`Delete workspace "${activeWorkspace.name}" and its assets?`)) return
		const nextSkills = skills.filter((skill) => skill.workspaceId !== activeWorkspace.id)
		const nextAnnotations = annotations.filter(
			(annotation) => annotation.workspaceId !== activeWorkspace.id
		)
		const nextMemories = memories.filter((memory) => memory.workspaceId !== activeWorkspace.id)
		await Promise.all([
			saveSkills(nextSkills),
			saveAnnotations(nextAnnotations),
			saveMemories(nextMemories),
		])
		setSkills(nextSkills)
		setAnnotations(nextAnnotations)
		setMemories(nextMemories)
		const state = await deleteWorkspace(activeWorkspace.id)
		onWorkspaceStateChange(state)
	}

	const createMemory = () => {
		if (!activeWorkspace) return
		const now = Date.now()
		const memory: WorkspaceMemory = {
			id: `memory-${now}`,
			workspaceId: activeWorkspace.id,
			title: 'New Memory',
			content: '',
			enabled: true,
			matchPatterns: ['*'],
			createdAt: now,
			updatedAt: now,
		}
		setMemories((current) => [...current, memory])
		setSelectedMemoryId(memory.id)
	}

	const updateDraft = <K extends keyof EditableMemory>(key: K, value: EditableMemory[K]) => {
		setDraft((current) => (current ? { ...current, [key]: value } : current))
	}

	const saveDraft = async () => {
		if (!draft) return
		setSaving(true)
		try {
			const nextMemory: WorkspaceMemory = {
				id: draft.id,
				workspaceId: draft.workspaceId,
				title: draft.title.trim() || 'Untitled Memory',
				content: draft.content,
				enabled: draft.enabled,
				matchPatterns: draft.matchPatternsText
					.split(/[\n,]/)
					.map((pattern) => pattern.trim())
					.filter(Boolean),
				createdAt: draft.createdAt,
				updatedAt: Date.now(),
			}
			if (!nextMemory.matchPatterns.length) nextMemory.matchPatterns = ['*']
			const nextMemories = memories.map((memory) =>
				memory.id === draft.id ? nextMemory : memory
			)
			await saveMemories(nextMemories)
			setMemories(nextMemories)
		} finally {
			setSaving(false)
		}
	}

	const deleteSelectedMemory = async () => {
		if (!draft) return
		const nextMemories = memories.filter((memory) => memory.id !== draft.id)
		await saveMemories(nextMemories)
		setMemories(nextMemories)
		setSelectedMemoryId(
			nextMemories.find((memory) => memory.workspaceId === activeWorkspace?.id)?.id ?? null
		)
	}

	const exportWorkspace = () => {
		if (!activeWorkspace) return
		const payload = {
			version: 1,
			exportedAt: new Date().toISOString(),
			workspace: activeWorkspace,
			skills: workspaceSkills,
			memories: workspaceMemories,
			annotations: workspaceAnnotations,
		}
		const blob = new Blob([JSON.stringify(payload, null, 2)], {
			type: 'application/json',
		})
		const url = URL.createObjectURL(blob)
		const anchor = document.createElement('a')
		anchor.href = url
		anchor.download = `${activeWorkspace.name.replace(/[^\w.-]+/g, '-') || 'workspace'}.json`
		anchor.click()
		URL.revokeObjectURL(url)
	}

	return (
		<div className="flex flex-col h-screen bg-background">
			<header className="flex items-center gap-2 border-b px-3 py-2">
				<Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back" title="Back">
					<ArrowLeft className="size-3.5" />
				</Button>
				<span className="text-sm font-medium flex-1 truncate">Workspace</span>
				<Button variant="ghost" size="icon-sm" onClick={exportWorkspace} aria-label="Export">
					<Download className="size-3.5" />
				</Button>
			</header>

			<main className="flex-1 overflow-y-auto p-3 space-y-4">
				<section className="space-y-2">
					<div className="flex items-center gap-2">
						<select
							value={workspaceState.activeWorkspaceId}
							onChange={(event) =>
								setActiveWorkspaceId(event.target.value).then(onWorkspaceStateChange)
							}
							className="h-8 min-w-0 flex-1 text-xs rounded-md border border-input bg-background px-2 cursor-pointer"
						>
							{workspaceState.workspaces.map((workspace) => (
								<option key={workspace.id} value={workspace.id}>
									{workspace.name}
								</option>
							))}
						</select>
						<Button variant="outline" size="icon-sm" onClick={createNewWorkspace} aria-label="New">
							<Plus className="size-3.5" />
						</Button>
						<Button
							variant="outline"
							size="icon-sm"
							onClick={renameActiveWorkspace}
							disabled={!activeWorkspace || activeWorkspace.isDefault}
							aria-label="Rename"
						>
							<Pencil className="size-3.5" />
						</Button>
						<Button
							variant="outline"
							size="icon-sm"
							onClick={deleteActiveWorkspace}
							disabled={!activeWorkspace || activeWorkspace.isDefault}
							aria-label="Delete workspace"
						>
							<Trash2 className="size-3.5" />
						</Button>
					</div>
				</section>

				<section className="grid grid-cols-2 gap-2">
					<AssetMetric icon={<Sparkles className="size-3.5" />} label="Skills" value={workspaceSkills.length} />
					<AssetMetric icon={<Brain className="size-3.5" />} label="Memories" value={workspaceMemories.length} />
					<AssetMetric
						icon={<MapPinned className="size-3.5" />}
						label="Annotations"
						value={workspaceAnnotations.length}
					/>
					<AssetMetric icon={<Database className="size-3.5" />} label="Data" value={0} />
				</section>

				<section className="space-y-2">
					<div className="text-xs font-medium">Recent Assets</div>
					<div className="rounded-md border overflow-hidden">
						{recentAssets.length ? (
							recentAssets.map((asset) => (
								<div key={`${asset.type}-${asset.id}`} className="px-3 py-2 border-b last:border-b-0">
									<div className="text-xs font-medium truncate">{asset.title}</div>
									<div className="text-[10px] text-muted-foreground">{asset.type}</div>
								</div>
							))
						) : (
							<div className="px-3 py-6 text-xs text-muted-foreground text-center">
								No workspace assets yet
							</div>
						)}
					</div>
				</section>

				<section className="space-y-2">
					<div className="flex items-center justify-between">
						<div className="text-xs font-medium">Memories</div>
						<Button variant="outline" size="sm" onClick={createMemory} className="h-7 text-[10px] px-2">
							<Plus className="size-3 mr-1" />
							New
						</Button>
					</div>

					<div className="grid grid-cols-[116px_1fr] rounded-md border min-h-72 overflow-hidden">
						<aside className="border-r overflow-y-auto">
							{workspaceMemories.map((memory) => (
								<button
									key={memory.id}
									type="button"
									onClick={() => setSelectedMemoryId(memory.id)}
									className={`w-full text-left px-3 py-2 border-b text-xs cursor-pointer transition-colors ${
										selectedMemoryId === memory.id ? 'bg-muted' : 'hover:bg-muted/50'
									}`}
								>
									<div className="font-medium truncate">{memory.title}</div>
									<div className="text-[10px] text-muted-foreground">
										{memory.enabled ? 'Enabled' : 'Disabled'}
									</div>
								</button>
							))}
							{!workspaceMemories.length && (
								<div className="p-3 text-xs text-muted-foreground">No memories</div>
							)}
						</aside>

						<div className="min-w-0 p-3">
							{draft ? (
								<div className="space-y-3">
									<div className="flex items-center justify-between gap-2">
										<label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
											<Switch
												checked={draft.enabled}
												onCheckedChange={(checked) => updateDraft('enabled', checked)}
											/>
											Enabled
										</label>
										<Button
											variant="ghost"
											size="icon-sm"
											onClick={deleteSelectedMemory}
											className="text-muted-foreground hover:text-destructive"
											aria-label="Delete memory"
										>
											<Trash2 className="size-3.5" />
										</Button>
									</div>
									<div className="space-y-1.5">
										<label className="text-xs text-muted-foreground">Title</label>
										<Input
											value={draft.title}
											onChange={(event) => updateDraft('title', event.target.value)}
											className="h-8 text-xs"
										/>
									</div>
									<div className="space-y-1.5">
										<label className="text-xs text-muted-foreground">Match domains</label>
										<Textarea
											value={draft.matchPatternsText}
											onChange={(event) =>
												updateDraft('matchPatternsText', event.target.value)
											}
											placeholder={'*\n*.xiaohongshu.com'}
											rows={3}
											className="text-xs min-h-20"
										/>
									</div>
									<div className="space-y-1.5">
										<label className="text-xs text-muted-foreground">Memory</label>
										<Textarea
											value={draft.content}
											onChange={(event) => updateDraft('content', event.target.value)}
											placeholder="Rules, preferences, field notes, or workflow context..."
											rows={7}
											className="text-xs min-h-36"
										/>
									</div>
									<Button onClick={saveDraft} disabled={saving} className="h-8 text-xs w-full">
										<Save className="size-3 mr-1" />
										{saving ? 'Saving...' : 'Save Memory'}
									</Button>
								</div>
							) : (
								<div className="h-full min-h-64 flex items-center justify-center text-xs text-muted-foreground">
									No memory selected
								</div>
							)}
						</div>
					</div>
				</section>
			</main>
		</div>
	)
}

function AssetMetric({
	icon,
	label,
	value,
}: {
	icon: ReactNode
	label: string
	value: number
}) {
	return (
		<div className="rounded-md border p-3">
			<div className="flex items-center justify-between text-muted-foreground">
				<span className="text-[10px] uppercase tracking-wide">{label}</span>
				{icon}
			</div>
			<div className="mt-2 text-lg font-semibold tabular-nums">{value}</div>
		</div>
	)
}
