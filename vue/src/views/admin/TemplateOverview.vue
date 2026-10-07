<script setup>
	import { computed, onMounted, ref, watch } from 'vue'
	import { useRoute, useRouter } from 'vue-router'

	import { getUserInfo } from '@/services/keycloakService.js'
	import { getForloebsskabeloner } from '@/services/forløbsskabelonService.js'
	import { getOpgaveskabeloner } from '@/services/opgaveskabelonService.js'

	import CourseList from '@/components/CourseList.vue'
	import PageHeader from '@/components/PageHeader.vue'
	import TaskCard from '@/components/TaskCard.vue'

	const route = useRoute()
	const router = useRouter()

	const TemplateType = {
		Forloebsskabelon: 0,
		Opgaveskabelon: 1
	}

	const userInfo = ref(null)
	const isLoading = ref(true)
	const forloebTemplates = ref([])
	const opgaveTemplates = ref([])
	const selectedType = ref(route.query.view == '1' ? TemplateType.Opgaveskabelon : TemplateType.Forloebsskabelon)

	const scrollToItem = computed(() => {
		const parsed = parseInt(route.query.item, 10)
		return Number.isNaN(parsed) ? null : parsed
	})

	const selectTemplateType = (type) => {
		selectedType.value = type
		router.replace({ query: { view: type } })
	}

	const fetchTemplates = async () => {
		isLoading.value = true
		try {
			userInfo.value ??= await getUserInfo()
			if (selectedType.value === TemplateType.Forloebsskabelon)
				forloebTemplates.value = [(await getForloebsskabeloner())?.data ?? []].flat()
			else
				opgaveTemplates.value = [(await getOpgaveskabeloner())?.data ?? []].flat()
		} catch (error) {
			console.error('Error fetching templates:', error)
		}
		isLoading.value = false
	}

	onMounted(fetchTemplates)
	watch(selectedType, fetchTemplates)
</script>

<template>
	<PageHeader eyebrow="ADMINISTRATION" title="Skabeloner" lead="Genbrug forløb og opgaver på tværs af flere medarbejdere.">
		<template #actions>
			<router-link v-if="selectedType == TemplateType.Forloebsskabelon" class="action action-primary" to="/create-forloebsskabelon">
				<i class="fas fa-plus" aria-hidden="true"></i> Opret forløbsskabelon
			</router-link>
			<router-link v-else class="action action-primary" to="/create-opgave?template=true">
				<i class="fas fa-plus" aria-hidden="true"></i> Opret opgaveskabelon
			</router-link>
		</template>
	</PageHeader>

	<div class="page-content shell-width">
		<div class="template-layout">
			<div class="template-main">
				<div class="segmented" role="tablist" aria-label="Skabelontype">
					<button type="button" role="tab" :aria-selected="selectedType == TemplateType.Forloebsskabelon" :class="{ 'is-selected': selectedType == TemplateType.Forloebsskabelon }" @click="selectTemplateType(TemplateType.Forloebsskabelon)">
						<i class="far fa-folder" aria-hidden="true"></i> Forløbsskabeloner
					</button>
					<button type="button" role="tab" :aria-selected="selectedType == TemplateType.Opgaveskabelon" :class="{ 'is-selected': selectedType == TemplateType.Opgaveskabelon }" @click="selectTemplateType(TemplateType.Opgaveskabelon)">
						<i class="fas fa-list-ul" aria-hidden="true"></i> Opgaveskabeloner
					</button>
				</div>

				<div v-if="isLoading" class="loading-block" aria-hidden="true"></div>
				<CourseList v-else-if="selectedType == TemplateType.Forloebsskabelon"
							:courses="forloebTemplates"
							emptyText="Der er ingen forløbsskabeloner endnu." />
				<template v-else>
					<div v-if="opgaveTemplates.length" class="task-group is-ungrouped">
						<div class="task-list">
							<TaskCard v-for="task in opgaveTemplates"
									  :key="task.OpgaveskabelonID"
									  :task="task"
									  :userInfo="userInfo"
									  :highlight="scrollToItem === task.OpgaveskabelonID"
									  @changed="fetchTemplates" />
						</div>
					</div>
					<div v-else class="empty-section">Der er ingen opgaveskabeloner endnu.</div>
				</template>
			</div>

			<aside class="helper-text template-help">
				<div class="header-small">Forløbsskabeloner</div>
				<span>En forløbsskabelon er et helt forløb med flere opgaver, som du kan genbruge til flere medarbejdere.</span>
				<span>Når du opretter et nyt forløb, kan du basere det på en forløbsskabelon. Opgaverne kopieres ind i det nye forløb – inkl. deres planlagte start- og sluttidspunkter.</span>
				<div class="header-small help-spacer">Opgaveskabeloner</div>
				<span>En opgaveskabelon er en enkelt opgave, som kan genbruges på tværs af flere forløb og forløbsskabeloner.</span>
				<span>Når du opretter en ny opgave, kan du tage udgangspunkt i en opgaveskabelon. Oplysningerne fra skabelonen kopieres til den nye opgave.</span>
			</aside>
		</div>
	</div>
</template>

<style scoped>
	.template-layout { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 40px; align-items: start; }
	.template-main { min-width: 0; }
	.template-help { position: sticky; top: calc(var(--site-shell-height) + 24px); }
	.help-spacer { margin-top: 16px; }
	.segmented { display: inline-flex; margin-bottom: 24px; border: 1px solid var(--line); border-radius: 3px; background: #fff; }
	.segmented button { display: inline-flex; align-items: center; gap: 8px; min-height: 38px; padding: 8px 16px; border: 0; background: transparent; color: var(--ink-soft); font-size: 12px; font-weight: 600; cursor: pointer; }
	.segmented button + button { border-left: 1px solid var(--line); }
	.segmented button i { color: var(--green); }
	.segmented button:hover { background: var(--wash2); color: var(--green); }
	.segmented button.is-selected { background: var(--green); color: #fff; }
	.segmented button.is-selected i { color: #fff; }
	.segmented button:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }

	@media (max-width: 900px) {
		.template-layout { grid-template-columns: minmax(0, 1fr); }
		.template-help { position: static; order: -1; }
	}
</style>
