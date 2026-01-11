<script lang="ts">
	import { GridPattern, ErrorState, EmptyState, KanbanColumn, KanbanCard } from '$lib/components';
	import { Columns3, RotateCcw } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { hapticSuccess, hapticError, hapticMedium } from '$lib/utils/haptics';
	import { apiClient, isApiError } from '$lib/api/client';

	let { data } = $props();

	// Local state
	let issues = $state<typeof data.issues>([]);
	let draggedIssueId = $state<string | null>(null);
	let dragOverColumn = $state<string | null>(null);
	let updating = $state(false);
	let updateMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	// Column definitions - using actual bd status values
	const columns = [
		{ id: 'open', title: 'To Do', description: 'Not started' },
		{ id: 'hooked', title: 'Hooked', description: 'Assigned & pending start' },
		{ id: 'in_progress', title: 'In Progress', description: 'Actively working' }
	];

	// Sync with server data
	$effect(() => {
		issues = [...data.issues];
	});

	// Get issues by column
	function getIssuesByStatus(status: string) {
		return issues.filter((i) => i.status === status);
	}

	// Drag handlers
	function handleDragStart(event: DragEvent, issueId: string) {
		draggedIssueId = issueId;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', issueId);
		}
	}

	function handleDragEnd(event: DragEvent) {
		draggedIssueId = null;
		dragOverColumn = null;
	}

	function handleDragOver(event: DragEvent, columnStatus: string) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		dragOverColumn = columnStatus;
	}

	function handleDragLeave(event: DragEvent) {
		// Only clear if leaving the column, not entering a child element
		const target = event.currentTarget as HTMLElement;
		if (!target.contains(event.relatedTarget as Node)) {
			dragOverColumn = null;
		}
	}

	async function handleDrop(event: DragEvent, targetStatus: string) {
		event.preventDefault();
		dragOverColumn = null;

		if (!draggedIssueId) return;

		const issue = issues.find((i) => i.id === draggedIssueId);
		if (!issue || issue.status === targetStatus) return;

		// Optimistic update
		const oldStatus = issue.status;
		const oldIssues = [...issues];
		issue.status = targetStatus;

		updating = true;
		hapticMedium();

		try {
			const response = await apiClient.put<{ message?: string }>(
				`/api/gastown/work/issues/${draggedIssueId}`,
				{ status: targetStatus }
			);

			hapticSuccess();
			updateMessage = { type: 'success', text: response.data.message || 'Status updated' };
		} catch (error) {
			// Rollback on error
			hapticError();
			issues = oldIssues;
			const message = isApiError(error) ? error.message : 'Failed to update status';
			updateMessage = { type: 'error', text: message };
		} finally {
			updating = false;
			draggedIssueId = null;
		}
	}

	function dismissMessage() {
		updateMessage = null;
	}
</script>

<div class="relative min-h-screen bg-background">
	<GridPattern variant="dots" opacity={0.03} />

	<div class="relative z-10">
		<header class="sticky top-0 z-50 panel-glass px-4 h-[72px] relative">
			<div class="container h-full flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="w-1.5 h-8 bg-primary rounded-sm shadow-glow shrink-0" aria-hidden="true"></div>
					<div>
						<h1 class="text-2xl font-display font-semibold text-foreground">Kanban Board</h1>
						<p class="text-sm text-muted-foreground">Drag and drop to update task status</p>
					</div>
				</div>
				{#if updateMessage}
					<div
						class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm {updateMessage.type === 'success'
							? 'bg-status-online/10 text-status-online'
							: 'bg-status-offline/10 text-status-offline'}"
					>
						{updateMessage.text}
						<button
							onclick={dismissMessage}
							class="ml-2 hover:opacity-70"
							aria-label="Dismiss message"
						>
							<RotateCcw class="w-3 h-3" />
						</button>
					</div>
				{/if}
			</div>
			<div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden="true"></div>
		</header>

		<main class="container py-6">
			{#if data.issuesError}
				<ErrorState
					title="Failed to load issues"
					message={data.issuesError}
					onRetry={() => window.location.reload()}
					showRetryButton={true}
				/>
			{:else if issues.length === 0}
				<EmptyState
					title="No issues"
					description="Create issues in the Work Management page to see them here"
					actionLabel="Go to Work Management"
					onaction={() => (window.location.href = '/work')}
					size="lg"
					icon={Columns3}
				/>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 xl:gap-6">
					{#each columns as column}
						{@const columnIssues = getIssuesByStatus(column.id)}
						<KanbanColumn
							title={column.title}
							count={columnIssues.length}
							status={column.id}
							dragOver={dragOverColumn === column.id}
							ondragover={(e) => handleDragOver(e, column.id)}
							ondrop={(e) => handleDrop(e, column.id)}
							ondragleave={handleDragLeave}
						>
							{#if columnIssues.length === 0}
								<div class="text-center py-8 text-muted-foreground">
									<p class="text-sm">No issues</p>
								</div>
							{:else}
								{#each columnIssues as issue (issue.id)}
									<KanbanCard
										id={issue.id}
										title={issue.title}
										type={issue.type}
										priority={issue.priority}
										dragging={draggedIssueId === issue.id}
										ondragstart={(e) => handleDragStart(e, issue.id)}
										ondragend={handleDragEnd}
									/>
								{/each}
							{/if}
						</KanbanColumn>
					{/each}
				</div>
			{/if}
		</main>
	</div>
</div>
