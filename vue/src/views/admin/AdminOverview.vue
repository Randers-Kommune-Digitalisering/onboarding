<script setup>
	import { ref, onMounted } from 'vue'

	import { getUserInfo } from '@/services/keycloakService.js'
	import { getForloebByAdmin } from '@/services/forløbService.js'
	import CourseList from '@/components/CourseList.vue'
	import PageHeader from '@/components/PageHeader.vue'

	const isLoading = ref(true)
	const forloeb_ongoing = ref([])
	const forloeb_future = ref([])
	const forloeb_completed = ref([])
	const forloeb_preparation = ref([])

	onMounted( () => {	
		getUserInfo().then(userInfo => {
			const loggedInAdmin = userInfo.email || 'No mail'

			if(!loggedInAdmin) {
					console.error("No admin mail found")
					return
				}

				const headers =  { adminmail: loggedInAdmin }
				getForloebByAdmin({headers}).then( response => {
					if (response.data == null)
						return

					if (!Array.isArray(response.data))
						response.data = [response.data]

					for (const item of response.data) {
						if (item.isPreparation)
							forloeb_preparation.value.push(item)
						else
						if (new Date(item.startdate) > new Date())
							forloeb_future.value.push(item)
						else
						if (new Date(item.enddate) < new Date())
							forloeb_completed.value.push(item)
						else 
							forloeb_ongoing.value.push(item)
					}

					// Sort and limit the number of completed courses
					forloeb_completed.value.sort((a, b) => new Date(b.enddate) - new Date(a.enddate))
					forloeb_completed.value = forloeb_completed.value.slice(0, 15)
				}).finally(() => {
					isLoading.value = false
				})

		}).catch(error => {
			isLoading.value = false
			console.error('Error fetching user info:', error)
		})
	})
</script>

<template>
	<PageHeader eyebrow="ADMINISTRATION" title="Overblik" lead="Følg de onboardingforløb, du er ansvarlig for. Åbn et forløb for at se og redigere opgaverne.">
		<template #actions>
			<router-link class="action action-primary" to="/create-forloeb"><i class="fas fa-plus" aria-hidden="true"></i> Opret forløb</router-link>
		</template>
	</PageHeader>

	<div class="page-content shell-width">
		<div v-if="isLoading" class="loading-block" aria-hidden="true"></div>
		<template v-else>
			<CourseList v-if="forloeb_preparation.length > 0" :courses="forloeb_preparation" title="Under forberedelse" />
			<CourseList :courses="forloeb_ongoing" title="Aktuelle forløb" />
			<CourseList :courses="forloeb_future" title="Kommende forløb" />
			<CourseList :courses="forloeb_completed" title="Afsluttede forløb" emptyText="Ingen afsluttede forløb." />
		</template>
	</div>
</template>