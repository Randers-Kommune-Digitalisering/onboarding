<script setup>
	import { onMounted, ref } from 'vue'
	import { useRouter } from 'vue-router'

	import { getUserInfo } from '@/services/keycloakService.js'
	import { getForloebByEmail } from '@/services/forløbService.js'
	import PageHeader from '@/components/PageHeader.vue'

	const router = useRouter()
	const status = ref('loading')

	// The employee's own course opens as a regular course tab
	onMounted(async () => {
		try {
			const userInfo = await getUserInfo()
			const response = await getForloebByEmail({ headers: { usermail: userInfo.email } })
			const courseId = response?.data?.ForløbID
			if (courseId == null) {
				status.value = 'missing'
				return
			}
			const failure = await router.replace({ path: '/forloeb-overview', query: { id: courseId } })
			if (failure)
				status.value = 'blocked'
		} catch (error) {
			console.error('Error fetching own course:', error)
			status.value = error?.response?.status === 404 ? 'missing' : 'failed'
		}
	})
</script>

<template>
	<PageHeader eyebrow="MIT FORLØB" title="Mit onboardingforløb" />

	<div class="page-content shell-width">
		<div v-if="status === 'loading'" class="loading-block" aria-hidden="true"></div>
		<div v-else-if="status === 'missing'" class="alert alert-warning" role="status">
			<i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
			<span>Det ser ikke ud til, at du har et onboardingforløb tilknyttet. Kontakt din leder eller administrator, hvis du mener, at dette er en fejl.</span>
		</div>
		<div v-else-if="status === 'blocked'" class="alert alert-warning" role="status">
			<i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
			<span>Du har for mange forløb åbne. Luk et forløb i fanebjælken for at åbne dit eget.</span>
		</div>
		<div v-else class="alert alert-error" role="alert">
			<i class="fas fa-exclamation-circle" aria-hidden="true"></i>
			<span>Dit forløb kunne ikke hentes. Prøv igen senere.</span>
		</div>
	</div>
</template>
