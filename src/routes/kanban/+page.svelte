<script lang="ts">
	import { GridPattern, Badge } from '$lib/components';
	import { Plus, Bug, Sparkles, ListTodo, Zap, X } from 'lucide-svelte';

	let { data } = $props();

	// Local state for issues (updates after creation)
	let todoIssues = $state<typeof data.todo>([]);
	let inProgressIssues = $state<typeof data.inProgress>([]);
	let doneIssues = $state<typeof data.done>([]);

	// Sync with server data
	$effect(() => {
		todoIssues = [...data.todo];
		inProgressIssues = [...data.inProgress];
		doneIssues = [...data.done];
	});

	// Modal state
	let showCreateModal = $state(false);
	let issueTitle = $state('');
	let issueType = $state('task');
	let issuePriority = $state(2);
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	const issueTypes = [
		{ value: 'task', label: 'Task', icon: ListTodo },
		{ value: 'bug', label: 'Bug', icon: Bug },
		{ value: 'feature', label: 'Feature', icon: Sparkles },
		{ value: 'epic', label: 'Epic', icon: Zap }
	];

	const priorities = [
		{ value: 0, label: 'P0', color: 'bg-red-500' },
		{ value: 1, label: 'P1', color: 'bg-orange-500' },
		{ value: 2, label: 'P2', color: 'bg-yellow-500' },
		{ value: 3, label: 'P3', color: 'bg-blue-500' },
		{ value: 4, label: 'P4', color: 'bg-gray-500' }
	];

	function getTypeIcon(type: string) {
		const found = issueTypes.find(t => t.value === type);
		return found?.icon || ListTodo;
	}

	function getPriorityBadge(priority: number) {
		return priorities.find(p => p.value === priority) || priorities[2];
	}

	function openCreateModal() {
		showCreateModal = true;
		errorMessage = null;
		successMessage = null;
	}

	function closeCreateModal() {
		showCreateModal = false;
		issueTitle = '';
		issueType = 'task';
		issuePriority = 2;
		errorMessage = null;
		successMessage = null;
	}

	async function handleCreateIssue(e: Event) {
		e.preventDefault();
		isSubmitting = true;
		errorMessage = null;
		successMessage = null;

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

			// Add to todo column
			todoIssues = [result, ...todoIssues];
			successMessage = `Created: ${result.id}`;

			// Reset form but keep modal open briefly to show success
			issueTitle = '';
			setTimeout(() => {
				closeCreateModal();
			}, 1000);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to create issue';
		} finally {
			isSubmitting = false;
		}
	}

	function navigateToIssue(id: string) {
		window.location.href = `/issues/${id}`;
	}
</script>

<div class="relative min-h-screen bg-background">
	<GridPattern variant="dots" opacity={0.15} />

	<div class="relative z-10">
		<header class="sticky top-0 z-50 panel-glass border-b border-border px-4 py-4">
			<div class="container flex items-center justify-between">
				<div>
					<h1 class="text-xl font-semibold text-foreground">Kanban Board</h1>
					<p class="text-sm text-muted-foreground">Track and manage work items</p>
				</div>
				<button
					onclick={openCreateModal}
					class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground
					       font-medium rounded-lg hover:bg-primary/90 transition-colors touch-target"
				>
					<Plus class="w-5 h-5" />
					<span class="hidden sm:inline">Create Work</span>
				</button>
			</div>
		</header>

		<main class="container py-6">
			{#if data.error}
				<div class="p-4 rounded-lg bg-status-offline/10 text-status-offline mb-6">
					{data.error}
				</div>
			{/if}

			<!-- Kanban Board -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
				<!-- Todo Column -->
				<div class="panel-glass rounded-lg overflow-hidden">
					<div class="px-4 py-3 border-b border-border bg-muted/30">
						<h2 class="font-semibold text-foreground flex items-center gap-2">
							<span class="w-3 h-3 rounded-full bg-yellow-500"></span>
							Todo
							<span class="ml-auto text-sm text-muted-foreground">{todoIssues.length}</span>
						</h2>
					</div>
					<div class="p-3 space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
						{#if todoIssues.length === 0}
							<p class="text-sm text-muted-foreground text-center py-4">No items</p>
						{:else}
							{#each todoIssues as issue}
								{@const TypeIcon = getTypeIcon(issue.type)}
								<button
									onclick={() => navigateToIssue(issue.id)}
									class="w-full text-left p-3 bg-card rounded-lg border border-border
									       hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
								>
									<div class="flex items-start gap-2 mb-2">
										<TypeIcon class="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
										<span class="text-sm font-medium text-foreground line-clamp-2">{issue.title}</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="font-mono text-xs text-primary">{issue.id}</span>
										<span class="text-xs px-1.5 py-0.5 rounded {getPriorityBadge(issue.priority).color} text-white">
											{getPriorityBadge(issue.priority).label}
										</span>
										{#if issue.assignee}
											<span class="text-xs text-muted-foreground ml-auto truncate max-w-[100px]">
												{issue.assignee}
											</span>
										{/if}
									</div>
								</button>
							{/each}
						{/if}
					</div>
				</div>

				<!-- In Progress Column -->
				<div class="panel-glass rounded-lg overflow-hidden">
					<div class="px-4 py-3 border-b border-border bg-muted/30">
						<h2 class="font-semibold text-foreground flex items-center gap-2">
							<span class="w-3 h-3 rounded-full bg-blue-500"></span>
							In Progress
							<span class="ml-auto text-sm text-muted-foreground">{inProgressIssues.length}</span>
						</h2>
					</div>
					<div class="p-3 space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
						{#if inProgressIssues.length === 0}
							<p class="text-sm text-muted-foreground text-center py-4">No items</p>
						{:else}
							{#each inProgressIssues as issue}
								{@const TypeIcon = getTypeIcon(issue.type)}
								<button
									onclick={() => navigateToIssue(issue.id)}
									class="w-full text-left p-3 bg-card rounded-lg border border-border
									       hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
								>
									<div class="flex items-start gap-2 mb-2">
										<TypeIcon class="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
										<span class="text-sm font-medium text-foreground line-clamp-2">{issue.title}</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="font-mono text-xs text-primary">{issue.id}</span>
										<span class="text-xs px-1.5 py-0.5 rounded {getPriorityBadge(issue.priority).color} text-white">
											{getPriorityBadge(issue.priority).label}
										</span>
										{#if issue.assignee}
											<span class="text-xs text-muted-foreground ml-auto truncate max-w-[100px]">
												{issue.assignee}
											</span>
										{/if}
									</div>
								</button>
							{/each}
						{/if}
					</div>
				</div>

				<!-- Done Column -->
				<div class="panel-glass rounded-lg overflow-hidden">
					<div class="px-4 py-3 border-b border-border bg-muted/30">
						<h2 class="font-semibold text-foreground flex items-center gap-2">
							<span class="w-3 h-3 rounded-full bg-green-500"></span>
							Done
							<span class="ml-auto text-sm text-muted-foreground">{doneIssues.length}</span>
						</h2>
					</div>
					<div class="p-3 space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
						{#if doneIssues.length === 0}
							<p class="text-sm text-muted-foreground text-center py-4">No items</p>
						{:else}
							{#each doneIssues as issue}
								{@const TypeIcon = getTypeIcon(issue.type)}
								<button
									onclick={() => navigateToIssue(issue.id)}
									class="w-full text-left p-3 bg-card rounded-lg border border-border
									       hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer opacity-75"
								>
									<div class="flex items-start gap-2 mb-2">
										<TypeIcon class="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
										<span class="text-sm font-medium text-foreground line-clamp-2 line-through">{issue.title}</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="font-mono text-xs text-primary">{issue.id}</span>
										<span class="text-xs px-1.5 py-0.5 rounded {getPriorityBadge(issue.priority).color} text-white">
											{getPriorityBadge(issue.priority).label}
										</span>
									</div>
								</button>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		</main>
	</div>

	<!-- Create Work Modal -->
	{#if showCreateModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
			onclick={(e) => { if (e.target === e.currentTarget) closeCreateModal(); }}
			onkeydown={(e) => { if (e.key === 'Escape') closeCreateModal(); }}
			role="dialog"
			aria-modal="true"
			aria-labelledby="create-modal-title"
			tabindex="-1"
		>
			<div class="w-full max-w-md panel-glass rounded-xl shadow-xl">
				<div class="flex items-center justify-between px-6 py-4 border-b border-border">
					<h2 id="create-modal-title" class="text-lg font-semibold text-foreground">Create Work Item</h2>
					<button
						onclick={closeCreateModal}
						class="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
						aria-label="Close modal"
					>
						<X class="w-5 h-5" />
					</button>
				</div>

				<form onsubmit={handleCreateIssue} class="p-6 space-y-4">
					<div>
						<label for="issue-title" class="block text-sm font-medium text-foreground mb-1">
							Title
						</label>
						<input
							id="issue-title"
							type="text"
							bind:value={issueTitle}
							required
							placeholder="Describe the work item..."
							class="w-full px-3 py-2 bg-input border border-border rounded-lg
							       text-foreground placeholder:text-muted-foreground
							       focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
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
									<option value={p.value}>{p.label} - {p.value === 0 ? 'Critical' : p.value === 1 ? 'High' : p.value === 2 ? 'Medium' : p.value === 3 ? 'Low' : 'Backlog'}</option>
								{/each}
							</select>
						</div>
					</div>

					{#if errorMessage}
						<div class="p-3 rounded-lg bg-status-offline/10 text-status-offline text-sm">
							{errorMessage}
						</div>
					{/if}

					{#if successMessage}
						<div class="p-3 rounded-lg bg-status-online/10 text-status-online text-sm">
							{successMessage}
						</div>
					{/if}

					<div class="flex gap-3 pt-2">
						<button
							type="button"
							onclick={closeCreateModal}
							class="flex-1 py-2 px-4 bg-muted text-foreground font-medium rounded-lg
							       hover:bg-muted/80 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting || !issueTitle.trim()}
							class="flex-1 py-2 px-4 bg-primary text-primary-foreground font-medium rounded-lg
							       hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
							       transition-colors"
						>
							{isSubmitting ? 'Creating...' : 'Create'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
