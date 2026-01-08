<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let showModal = false;
	let newIssue = {
		title: '',
		type: 'task',
		priority: 2
	};

	async function createIssue() {
		try {
			const response = await fetch('/api/gastown/work/issues', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newIssue)
			});

			if (response.ok) {
				showModal = false;
				newIssue = { title: '', type: 'task', priority: 2 };
				// Refresh the page data
				window.location.reload();
			}
		} catch (error) {
			console.error('Failed to create issue:', error);
		}
	}
</script>

<div class="container">
	<header class="header">
		<h1>Kanban Board</h1>
		<button class="btn-primary" on:click={() => (showModal = true)}>+ Create Work</button>
	</header>

	<div class="board">
		<div class="column">
			<h2>Todo</h2>
			<div class="cards">
				{#each data.todo as item}
					<div class="card">
						<span class="id">{item.id}</span>
						<span class="title">{item.title}</span>
						<span class="meta">{item.type} · P{item.priority}</span>
					</div>
				{/each}
				{#if data.todo.length === 0}
					<p class="empty">No ready items</p>
				{/if}
			</div>
		</div>

		<div class="column">
			<h2>In Progress</h2>
			<div class="cards">
				{#each data.inProgress as item}
					<div class="card">
						<span class="id">{item.id}</span>
						<span class="title">{item.title}</span>
						<span class="meta">{item.type} · P{item.priority}</span>
					</div>
				{/each}
				{#if data.inProgress.length === 0}
					<p class="empty">No items in progress</p>
				{/if}
			</div>
		</div>
	</div>
</div>

{#if showModal}
	<div class="modal-backdrop" on:click={(e) => e.target === e.currentTarget && (showModal = false)}>
		<div class="modal">
			<h2>Create New Work Item</h2>
			<form on:submit|preventDefault={createIssue}>
				<div class="form-group">
					<label for="title">Title</label>
					<input
						id="title"
						type="text"
						bind:value={newIssue.title}
						placeholder="Enter task title..."
						required
					/>
				</div>

				<div class="form-group">
					<label for="type">Type</label>
					<select id="type" bind:value={newIssue.type}>
						<option value="task">Task</option>
						<option value="bug">Bug</option>
						<option value="feature">Feature</option>
						<option value="epic">Epic</option>
					</select>
				</div>

				<div class="form-group">
					<label for="priority">Priority</label>
					<select id="priority" bind:value={newIssue.priority}>
						<option value={0}>P0 - Critical</option>
						<option value={1}>P1 - High</option>
						<option value={2}>P2 - Medium</option>
						<option value={3}>P3 - Low</option>
						<option value={4}>P4 - Lowest</option>
					</select>
				</div>

				<div class="form-actions">
					<button type="button" on:click={() => (showModal = false)}>Cancel</button>
					<button type="submit" class="btn-primary">Create</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.container {
		padding: 2rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.header h1 {
		margin: 0;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		cursor: pointer;
		font-weight: 500;
	}

	.btn-primary:hover {
		background: #2563eb;
	}

	.board {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.column {
		background: #f9fafb;
		border-radius: 0.5rem;
		padding: 1rem;
		min-height: 400px;
	}

	.column h2 {
		margin-top: 0;
		margin-bottom: 1rem;
		font-size: 1.125rem;
		color: #374151;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.card .id {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.card .title {
		font-weight: 500;
		color: #111827;
	}

	.card .meta {
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.empty {
		color: #9ca3af;
		font-style: italic;
		text-align: center;
		padding: 1rem;
	}

	/* Modal styles */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		border-radius: 0.5rem;
		padding: 1.5rem;
		width: 100%;
		max-width: 400px;
	}

	.modal h2 {
		margin-top: 0;
		margin-bottom: 1rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.25rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group input,
	.form-group select {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	.form-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		margin-top: 1rem;
	}

	.form-actions button {
		padding: 0.5rem 1rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		cursor: pointer;
		background: white;
	}

	.form-actions .btn-primary {
		background: #3b82f6;
		color: white;
		border-color: #3b82f6;
	}
</style>
