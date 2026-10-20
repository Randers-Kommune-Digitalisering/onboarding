<script setup>
	import { onMounted, ref, watch } from 'vue'
	import { useRouter } from 'vue-router'

	import { getForloebByLoggedInUser } from '@/services/forløbService.js'
	import { openCourses, courseLocation, resolveCourseRef } from '@/stores/openCourses.js'
	import PageHeader from '@/components/PageHeader.vue'

	const router = useRouter()
	const status = ref('loading')
	const courseRef = ref(null)
	let opening = false

	const openOwnCourse = async () => {
		if (opening || !courseRef.value)
			return
		opening = true
		try {
			const failure = await router.replace(courseLocation(courseRef.value))
			if (failure)
				status.value = 'blocked'
		} finally {
			opening = false
		}
	}

	// Closing a tab doesn't remount this view, so retry as soon as the tab cap allows it
	watch(
		() => status.value === 'blocked' && courseRef.value != null && openCourses.canOpen(courseRef.value.key),
		(canRetry) => {
			if (canRetry)
				openOwnCourse()
		},
	)

	// The employee's own course opens as a regular course tab
	onMounted(async () => {
		try {
			const response = await getForloebByLoggedInUser()
			const courseId = response?.data?.ForløbID
			courseRef.value = courseId == null ? null : resolveCourseRef({ id: courseId })
			if (!courseRef.value) {
				status.value = 'missing'
				return
			}
			await openOwnCourse()
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
			<span>Du har for mange forløb åbne. Luk et forløb i fanebjælken, så åbnes dit eget automatisk.</span>
		</div>
		<div v-else class="alert alert-error" role="alert">
			<i class="fas fa-exclamation-circle" aria-hidden="true"></i>
			<span>Dit forløb kunne ikke hentes. Prøv igen senere.</span>
		</div>
	</div>
</template>
