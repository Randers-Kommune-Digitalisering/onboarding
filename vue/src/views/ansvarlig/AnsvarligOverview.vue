<script setup>
	import { computed, onMounted, ref } from 'vue'
	import { useRoute } from 'vue-router'

	import { getUserInfo } from '@/services/keycloakService.js'
	import { getOpgaverByAnsvarligEmail } from '@/services/opgaveService.js'
	import { hasNoDates, sortTasks } from '@/utils/taskSections.js'

	import PageHeader from '@/components/PageHeader.vue'
	import TaskCard from '@/components/TaskCard.vue'

	const route = useRoute()
	const userInfo = ref(null)
	const tasks = ref([])
	const isLoading = ref(true)
	const loadFailed = ref(false)

	const scrollToItem = computed(() => {
		const parsed = parseInt(route.query.item, 10)
		return Number.isNaN(parsed) ? null : parsed
	})

	const openCount = computed(() => tasks.value.filter(task => !task.result).length)

	// Open tasks first (by deadline), completed tasks last
	const orderTasks = (items) => {
		const relative = items.filter(hasNoDates)
		const dated = items.filter(task => !hasNoDates(task))
		const open = sortTasks(dated.filter(task => !task.result), { isPreparation: false })
		const done = sortTasks(dated.filter(task => task.result), { isPreparation: false })
		return [...open, ...sortTasks(relative, { isPreparation: true }), ...done]
	}

	const courseGroups = computed(() => {
		const groups = new Map()
		for (const task of tasks.value) {
			const key = task.ForløbID != null ? `f-${task.ForløbID}` : `t-${task.ForløbsskabelonID}`
			if (!groups.has(key))
				groups.set(key, {
					key,
					name: task.name || (task.ForløbID != null ? 'Forløb uden titel' : 'Skabelon'),
					link: task.ForløbID != null ? `/forloeb-overview?id=${task.ForløbID}` : `/forloeb-overview?tid=${task.ForløbsskabelonID}`,
					courseId: task.ForløbID ?? task.ForløbsskabelonID,
					isTemplate: task.ForløbID == null,
					items: [],
				})
			groups.get(key).items.push(task)
		}
		return [...groups.values()]
			.map(group => ({ ...group, items: orderTasks(group.items), open: group.items.filter(task => !task.result).length }))
			.sort((a, b) => a.name.localeCompare(b.name, 'da'))
	})

	const fetchTasks = async () => {
		isLoading.value = true
		loadFailed.value = false
		try {
			userInfo.value ??= await getUserInfo()
			const response = await getOpgaverByAnsvarligEmail({ headers: { usermail: userInfo.value.email } })
			tasks.value = [response?.data ?? []].flat()
		} catch (error) {
			console.error('Error fetching tasks:', error)
			loadFailed.value = true
		}
		isLoading.value = false
	}

	const handleResultChange = ({ id, result }) => {
		const task = tasks.value.find(item => item.OpgaveID === id)
		if (task)
			task.result = result
	}

	onMounted(fetchTasks)
</script>

<template>
	<PageHeader eyebrow="MINE ANSVAR" title="Opgaver, du er ansvarlig for" lead="Her finder du de opgaver, hvor du skal hjælpe en ny medarbejder. Markér opgaven som gennemført, når I er færdige." />

	<div class="page-content shell-width">
		<div v-if="isLoading" class="loading-block" aria-hidden="true"></div>
		<div v-else-if="loadFailed" class="alert alert-error" role="alert">
			<i class="fas fa-exclamation-circle" aria-hidden="true"></i>
			<span>Dine opgaver kunne ikke hentes. Prøv igen senere.</span>
		</div>
		<template v-else>
			<div class="content-intro">
				<div>
					<span class="eyebrow">OPGAVER</span>
					<h2>Fordelt på forløb</h2>
				</div>
				<span class="intro-meta">{{ openCount }} {{ openCount === 1 ? 'åben opgave' : 'åbne opgaver' }} · {{ tasks.length }} i alt</span>
			</div>

			<div v-if="courseGroups.length" class="task-groups">
				<div v-for="group in courseGroups" :key="group.key" class="task-group">
					<div class="group-heading">
						<i class="far fa-folder-open" aria-hidden="true"></i>
						<router-link :to="group.link" title="Åbn forløbet">{{ group.name }}</router-link>
						<span class="group-count">{{ group.open }} åbne · {{ group.items.length }} i alt</span>
					</div>
					<div class="task-list">
						<TaskCard v-for="task in group.items"
								  :key="task.OpgaveID"
								  :task="task"
								  :userInfo="userInfo"
								  :courseId="group.courseId"
								  :courseIsTemplate="group.isTemplate"
								  :isPreparation="hasNoDates(task)"
								  :highlight="scrollToItem === task.OpgaveID"
								  @result-change="handleResultChange"
								  @changed="fetchTasks" />
					</div>
				</div>
			</div>
			<div v-else class="empty-section"><i class="far fa-smile" aria-hidden="true"></i> Du er ikke ansvarlig for nogen opgaver lige nu.</div>
		</template>
	</div>
</template>
