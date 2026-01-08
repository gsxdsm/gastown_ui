<script lang="ts">
	import { GridPattern } from '$lib/components';
	import { Plus, AlertCircle, Loader2 } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	interface BeadIssue {
		id: string;
		title: string;
		status: string;
		priority: number;
		issue_type: string;
		assignee?: string;
		created_at: string;
		updated_at: string;
		dependency_count?: number;
		dependent_count?: number;
	}

	interface KanbanData {
		todo: BeadIssue[];
		inProgress: BeadIssue[];
	}

	// Data state
	let kanbanData = $state<KanbanData>({ todo: [], inProgress: [] });
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Drag and drop state
	let draggedIssue = $state<BeadIssue | null>(null);
	let draggedFromColumn = $state<'todo' | 'inProgress' | null>(null);
	let dropping = $state(false);

	// Modal state for creating issues
	let showModal = $state(false);
	let issueTitle = $state('');
	let issueType = $state('task');
	let issuePriority = $state(2);
	let submitting = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	const issueTypes = [
		{ value: 'task', label: 'Task' },
		{ value: 'bug', label: 'Bug' },
		{ value: 'feature', label: 'Feature' },
		{ value: 'epic', label: 'Epic' }
	];

	const priorities = [
		{ value: 0, label: 'P0 - Critical' },
		{ value: 1, label: 'P1 - High' },
		{ value: 2, label: 'P2 - Medium' },
		{ value: 3, label: 'P3 - Low' },
		{ value: 4, label: 'P4 - Backlog' }
	];

	// Priority labels for display
	const priorityLabels: Record<number, { label: string; class: string }> = {
		0: { label: 'P0', class: 'text-destructive bg-destructive/10 border-destructive/30' },
		1: { label: 'P1', class: 'text-warning bg-warning/10 border-warning/30' },
		2: { label: 'P2', class: 'text-warning/80 bg-warning/10 border-warning/30' },
		3: { label: 'P3', class: 'text-info bg-info/10 border-info/30' },
		4: { label: 'P4', class: 'text-muted-foreground bg-muted border-border' }
	};

	// Load kanban data
	async function loadKanban() {
		loading = true;
		error = null;
		try {
			const res = await fetch('/api/gastown/work/kanban');
			if (!res.ok) throw new Error('Failed to load kanban data');
			kanbanData = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load kanban data';
		} finally {
			loading = false;
		}
	}

	// Navigate to issue detail
	function navigateToIssue(id: string) {
		goto(`/issues/${id}`);
	}

	// Format assignee for display
	function formatAssignee(assignee?: string): string {
		if (!assignee) return 'Unassigned';
		return assignee.split('/').pop() || assignee;
	}

	// Drag and drop handlers
	function handleDragStart(issue: BeadIssue, column: 'todo' | 'inProgress', e: DragEvent) {
		draggedIssue = issue;
		draggedFromColumn = column;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', issue.id);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDragLeave(e: DragEvent) {
		// Optional: visual feedback when dragging leaves a column
	}

	async function handleDrop(targetColumn: 'todo' | 'inProgress', e: DragEvent) {
		e.preventDefault();
		if (!draggedIssue || !draggedFromColumn || draggedFromColumn === targetColumn) {
			draggedIssue = null;
			draggedFromColumn = null;
			return;
		}

		dropping = true;
		const issue = draggedIssue;
		const fromColumn = draggedFromColumn;

		try {
			// Update status via API - correct path is /status
			const newStatus = targetColumn === 'inProgress' ? 'in_progress' : 'todo';
			const res = await fetch(`/api/gastown/work/issues/${issue.id}/status`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: newStatus })
			});

			if (!res.ok) {
				throw new Error('Failed to update issue status');
			}

			// Move the card in local state
			if (fromColumn === 'todo') {
				kanbanData.todo = kanbanData.todo.filter(i => i.id !== issue.id);
			} else {
				kanbanData.inProgress = kanbanData.inProgress.filter(i => i.id !== issue.id);
			}

			if (targetColumn === 'todo') {
				kanbanData.todo.push({ ...issue, status: 'open' });
			} else {
				kanbanData.inProgress.push({ ...issue, status: 'in_progress', assignee: 'nux' });
			}
		} catch (err) {
			console.error('Failed to move issue:', err);
			// Optionally show error message to user
		} finally {
			draggedIssue = null;
			draggedFromColumn = null;
			dropping = false;
		}
	}

	// Create new issue
	async function handleCreateIssue(e: Event) {
		e.preventDefault();
		submitting = true;
		message = null;

		try {
			const res = await fetch('/api/gastown/work/issues', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: issueTitle,
					type: issueType,
					priority: issuePriority
				})
			});

			const result = await res.json();

			if (!res.ok) {
				throw new Error(result.error || 'Failed to create issue');
			}

			message = { type: 'success', text: `Created issue: ${result.id}` };
			// Add to todo column
			kanbanData.todo.push({
				id: result.id,
				title: result.title || issueTitle,
				status: 'open',
				priority: result.priority || issuePriority,
				issue_type: result.issue_type || issueType,
				assignee: result.assignee,
				created_at: result.created_at || new Date().toISOString(),
				updated_at: result.updated_at || new Date().toISOString()
			});
			// Reset form
			issueTitle = '';
			issueType = 'task';
			issuePriority = 2;
			// Close modal after short delay
			setTimeout(() => {
				showModal = false;
				message = null;
			}, 1000);
		} catch (err) {
			message = { type: 'error', text: err instanceof Error ? err.message : 'Failed to create issue' };
		} finally {
			submitting = false;
		}
	}

	// Load data on mount
	loadKanban();
</script>

<svelte:head>
	<title>Kanban | Gas Town</title>
</svelte:head>

<div class="relative min-h-screen bg-background">
	<GridPattern variant="dots" opacity={0.15} />

	<div class="relative z-10">
		<!-- Header -->
		<header class="sticky top-0 z-50 panel-glass border-b border-border px-4 py-4">
			<div class="container flex items-center justify-between">
				<div>
					<h1 class="text-xl font-semibold text-foreground">Kanban</h1>
					<p class="text-sm text-muted-foreground">Work board: ready issues and in-progress</p>
				</div>
				<button
					onclick={() => showModal = true}
					class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg
						   hover:bg-primary/90 transition-colors touch-target"
					aria-label="Create new issue"
				>
					<Plus class="w-5 h-5" strokeWidth={2} />
					<span class="hidden sm:inline">Create Work</span>
				</button>
			</div>
		</header>

		<!-- Main Content -->
		<main class="container py-6">
			{#if loading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="w-8 h-8 text-muted-foreground animate-spin" strokeWidth={2} />
				</div>
			{:else if error}
				<div class="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-lg">
					<AlertCircle class="w-5 h-5 flex-shrink-0" strokeWidth={2} />
					<span>{error}</span>
				</div>
			{:else}
				<!-- Kanban Board -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<!-- Todo Column -->
					<section
						class="panel-glass p-4 {dropping && draggedFromColumn !== 'todo' ? 'ring-2 ring-primary' : ''}"
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={(e) => handleDrop('todo', e)}
					>
						<div class="flex items-center justify-between mb-4">
							<h2 class="font-semibold text-foreground flex items-center gap-2">
								<span class="w-3 h-3 rounded-full bg-warning"></span>
								Todo ({kanbanData.todo.length})
							</h2>
						</div>
						{#if kanbanData.todo.length === 0}
							<p class="text-sm text-muted-foreground text-center py-8">No issues ready to work</p>
						{:else}
							<div class="space-y-3">
								{#each kanbanData.todo as issue (issue.id)}
									<div
										draggable="true"
										ondragstart={(e) => handleDragStart(issue, 'todo', e)}
										onclick={() => navigateToIssue(issue.id)}
										class="p-4 bg-muted/30 rounded-lg border border-border hover:border-primary/50
											   cursor-grab active:cursor-grabbing transition-all hover:shadow-md
											   {draggedIssue?.id === issue.id ? 'opacity-50' : ''}"
										role="button"
										tabindex="0"
										onkeydown={(e) => e.key === 'Enter' && navigateToIssue(issue.id)}
									>
										<div class="flex items-start gap-3">
											<span class="font-mono text-xs text-primary flex-shrink-0">{issue.id}</span>
											<div class="flex-1 min-w-0">
												<h3 class="text-sm font-medium text-foreground truncate">{issue.title}</h3>
												<div class="flex items-center gap-2 mt-2 flex-wrap">
													<span class="text-xs px-2 py-0.5 rounded border {priorityLabels[issue.priority].class}">
														{priorityLabels[issue.priority].label}
													</span>
													<span class="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">
														{issue.issue_type}
													</span>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</section>

					<!-- In Progress Column -->
					<section
						class="panel-glass p-4 {dropping && draggedFromColumn !== 'inProgress' ? 'ring-2 ring-primary' : ''}"
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={(e) => handleDrop('inProgress', e)}
					>
						<div class="flex items-center justify-between mb-4">
							<h2 class="font-semibold text-foreground flex items-center gap-2">
								<span class="w-3 h-3 rounded-full bg-info"></span>
								In Progress ({kanbanData.inProgress.length})
							</h2>
						</div>
						{#if kanbanData.inProgress.length === 0}
							<p class="text-sm text-muted-foreground text-center py-8">No issues in progress</p>
						{:else}
							<div class="space-y-3">
								{#each kanbanData.inProgress as issue (issue.id)}
									<div
										draggable="true"
										ondragstart={(e) => handleDragStart(issue, 'inProgress', e)}
										onclick={() => navigateToIssue(issue.id)}
										class="p-4 bg-muted/30 rounded-lg border border-border hover:border-primary/50
											   cursor-grab active:cursor-grabbing transition-all hover:shadow-md
											   {draggedIssue?.id === issue.id ? 'opacity-50' : ''}"
										role="button"
										tabindex="0"
										onkeydown={(e) => e.key === 'Enter' && navigateToIssue(issue.id)}
									>
										<div class="flex items-start gap-3">
											<span class="font-mono text-xs text-primary flex-shrink-0">{issue.id}</span>
											<div class="flex-1 min-w-0">
												<h3 class="text-sm font-medium text-foreground truncate">{issue.title}</h3>
												<div class="flex items-center gap-2 mt-2 flex-wrap">
													<span class="text-xs px-2 py-0.5 rounded border {priorityLabels[issue.priority].class}">
														{priorityLabels[issue.priority].label}
													</span>
													<span class="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">
														{issue.issue_type}
													</span>
													<span class="text-xs px-2 py-0.5 rounded bg-info/10 text-info border border-info/30">
														{formatAssignee(issue.assignee)}
													</span>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				</div>
			{/if}
		</main>
	</div>

	<!-- Create Issue Modal -->
	{#if showModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onclick={(e) => e.target === e.currentTarget && (showModal = false)}>
			<div class="panel-glass p-6 rounded-lg w-full max-w-md">
				<h2 class="text-lg font-semibold text-foreground mb-4">Create New Issue</h2>

				<form onsubmit={handleCreateIssue} class="space-y-4">
					<div>
						<label for="issue-title" class="block text-sm font-medium text-foreground mb-1">
							Title
						</label>
						<input
							id="issue-title"
							type="text"
							bind:value={issueTitle}
							required
							placeholder="Describe the task..."
							class="w-full px-3 py-2 bg-input border border-border rounded-lg
								   text-foreground placeholder:text-muted-foreground
								   focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>

					<div>
						<label for="issue-type" class="block text-sm font-medium text-foreground mb-1">
							Type
						</label>
						<select
							id="issue-type"
							bind:value={issueType}
							class="w-full px-3 py-2 bg-input border border-border rounded-lg
								   text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						>
							{#each issueTypes as type}
								<option value={type.value}>{type.label}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="issue-priority" class="block text-sm font-medium text-foreground mb-1">
							Priority
						</label>
						<select
							id="issue-priority"
							bind:value={issuePriority}
							class="w-full px-3 py-2 bg-input border border-border rounded-lg
								   text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						>
							{#each priorities as p}
								<option value={p.value}>{p.label}</option>
							{/each}
						</select>
					</div>

					{#if message}
						<div
							class="p-3 rounded-lg text-sm {message.type === 'success'
								? 'bg-success/10 text-success'
								: 'bg-destructive/10 text-destructive'}"
						>
							{message.text}
						</div>
					{/if}

					<div class="flex gap-3">
						<button
							type="button"
							onclick={() => showModal = false}
							disabled={submitting}
							class="flex-1 py-2 px-4 bg-muted text-foreground font-medium rounded-lg
								   hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed
								   transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={submitting || !issueTitle.trim()}
							class="flex-1 py-2 px-4 bg-primary text-primary-foreground font-medium rounded-lg
								   hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
								   transition-colors"
						>
							{submitting ? 'Creating...' : 'Create'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
