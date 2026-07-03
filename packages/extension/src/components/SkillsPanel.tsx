import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { type BrowserSkill, loadSkills, saveSkills } from '@/agent/skills'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

interface SkillsPanelProps {
	onBack: () => void
	workspaceId: string
}

type EditableSkill = BrowserSkill & {
	matchPatternsText: string
}

export function SkillsPanel({ onBack, workspaceId }: SkillsPanelProps) {
	const [skills, setSkills] = useState<BrowserSkill[]>([])
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [draft, setDraft] = useState<EditableSkill | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)

	const visibleSkills = useMemo(
		() =>
			skills.filter(
				(skill) => skill.workspaceId === workspaceId || skill.workspaceId === GLOBAL_WORKSPACE_ID
			),
		[skills, workspaceId]
	)

	const selectedSkill = useMemo(
		() => visibleSkills.find((skill) => skill.id === selectedId) ?? null,
		[visibleSkills, selectedId]
	)

	const refresh = useCallback(async () => {
		try {
			const loaded = await loadSkills()
			setSkills(loaded)
			setSelectedId(
				(current) =>
					current ??
					loaded.find(
						(skill) => skill.workspaceId === workspaceId || skill.workspaceId === GLOBAL_WORKSPACE_ID
					)?.id ??
					null
			)
		} finally {
			setLoading(false)
		}
	}, [workspaceId])

	useEffect(() => {
		refresh().catch(console.error)
	}, [refresh])

	useEffect(() => {
		if (!selectedSkill) {
			setDraft(null)
			return
		}
		setDraft({
			...selectedSkill,
			matchPatternsText: selectedSkill.matchPatterns.join('\n'),
		})
	}, [selectedSkill])

	useEffect(() => {
		if (!selectedId || visibleSkills.some((skill) => skill.id === selectedId)) return
		setSelectedId(visibleSkills[0]?.id ?? null)
	}, [selectedId, visibleSkills])

	const updateDraft = <K extends keyof EditableSkill>(key: K, value: EditableSkill[K]) => {
		setDraft((current) => (current ? { ...current, [key]: value } : current))
	}

	const createSkill = () => {
		const now = Date.now()
		const skill: BrowserSkill = {
			id: `skill-${now}`,
			workspaceId,
			name: 'New Skill',
			description: '',
			enabled: true,
			matchPatterns: ['*'],
			content: '',
			updatedAt: now,
		}
		setSkills((current) => [...current, skill])
		setSelectedId(skill.id)
	}

	const persistDraft = async () => {
		if (!draft) return
		setSaving(true)
		try {
			const nextSkill: BrowserSkill = {
				id: draft.id,
				workspaceId: draft.workspaceId,
				name: draft.name.trim() || 'Untitled Skill',
				description: draft.description?.trim() || undefined,
				enabled: draft.enabled,
				matchPatterns: draft.matchPatternsText
					.split(/[\n,]/)
					.map((pattern) => pattern.trim())
					.filter(Boolean),
				content: draft.content,
				updatedAt: Date.now(),
			}
			if (!nextSkill.matchPatterns.length) nextSkill.matchPatterns = ['*']

			const nextSkills = skills.map((skill) => (skill.id === draft.id ? nextSkill : skill))
			await saveSkills(nextSkills)
			setSkills(nextSkills)
		} finally {
			setSaving(false)
		}
	}

	const deleteSelected = async () => {
		if (!draft) return
		const nextSkills = skills.filter((skill) => skill.id !== draft.id)
		await saveSkills(nextSkills)
		setSkills(nextSkills)
		setSelectedId(nextSkills[0]?.id ?? null)
	}

	return (
		<div className="flex flex-col h-screen bg-background">
			<header className="flex items-center gap-2 border-b px-3 py-2">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onBack}
					className="cursor-pointer"
					aria-label="Back"
					title="Back"
				>
					<ArrowLeft className="size-3.5" />
				</Button>
				<span className="text-sm font-medium flex-1">Skills</span>
				<Button
					variant="ghost"
					size="sm"
					onClick={createSkill}
					className="text-[10px] h-6 px-2 cursor-pointer"
				>
					<Plus className="size-3 mr-1" />
					New
				</Button>
			</header>

			<div className="grid grid-cols-[112px_1fr] min-h-0 flex-1">
				<aside className="border-r overflow-y-auto">
					{loading && <div className="p-3 text-xs text-muted-foreground">Loading...</div>}
					{visibleSkills.map((skill) => (
						<button
							key={skill.id}
							type="button"
							onClick={() => setSelectedId(skill.id)}
							className={`w-full text-left px-3 py-2 border-b text-xs cursor-pointer transition-colors ${
								selectedId === skill.id ? 'bg-muted' : 'hover:bg-muted/50'
							}`}
						>
							<div className="font-medium truncate">{skill.name}</div>
							<div className="text-[10px] text-muted-foreground truncate">
							{skill.workspaceId === GLOBAL_WORKSPACE_ID
								? 'Global'
								: skill.enabled
									? 'Enabled'
									: 'Disabled'}
							</div>
						</button>
					))}
				</aside>

				<main className="min-w-0 overflow-y-auto p-3">
					{draft ? (
						<div className="flex flex-col gap-3">
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
									onClick={deleteSelected}
									className="cursor-pointer text-muted-foreground hover:text-destructive"
									aria-label="Delete skill"
									title="Delete skill"
								>
									<Trash2 className="size-3.5" />
								</Button>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs text-muted-foreground">Name</label>
								<Input
									value={draft.name}
									onChange={(event) => updateDraft('name', event.target.value)}
									className="h-8 text-xs"
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs text-muted-foreground">Match domains</label>
								<Textarea
									value={draft.matchPatternsText}
									onChange={(event) => updateDraft('matchPatternsText', event.target.value)}
									placeholder={'*\n*.xiaohongshu.com\nbilibili.com'}
									rows={3}
									className="text-xs min-h-20"
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs text-muted-foreground">Description</label>
								<Input
									value={draft.description ?? ''}
									onChange={(event) => updateDraft('description', event.target.value)}
									className="h-8 text-xs"
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-xs text-muted-foreground">Instructions</label>
								<Textarea
									value={draft.content}
									onChange={(event) => updateDraft('content', event.target.value)}
									placeholder="Write reusable guidance for this website or workflow..."
									rows={9}
									className="text-xs min-h-44"
								/>
							</div>

							<Button onClick={persistDraft} disabled={saving} className="h-8 text-xs cursor-pointer">
								<Save className="size-3 mr-1" />
								{saving ? 'Saving...' : 'Save Skill'}
							</Button>
						</div>
					) : (
						<div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
							No skill selected
						</div>
					)}
				</main>
			</div>
		</div>
	)
}
import { GLOBAL_WORKSPACE_ID } from '@/agent/workspaces'
