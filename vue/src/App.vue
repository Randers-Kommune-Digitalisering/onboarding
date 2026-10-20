<script setup>
    import { computed, ref } from 'vue'
    import { useRoute } from 'vue-router'

    import SiteHeader from './components/SiteHeader.vue'
    import OpenCoursesBar from './components/OpenCoursesBar.vue'
    import { getUserInfo } from './services/keycloakService.js'
    import { isCourseRoute, isExternalRoute, openCourses } from './stores/openCourses.js'

    const route = useRoute()
    const userInfo = ref(null)

    getUserInfo().then(info => {
        userInfo.value = info
    }).catch(error => {
        console.error('Error fetching user info:', error)
    })

    const hideChrome = computed(() => route.meta.hideNavbar === true || isExternalRoute(route))
    const onCourseRoute = computed(() => isCourseRoute(route))
    const canUseTabs = computed(() => userInfo.value?.isAdmin === true || userInfo.value?.isMedarbejder === true)
</script>

<template>
    <div v-if="hideChrome" class="app-root is-bare">
        <router-view />
    </div>

    <div v-else class="app-root">
        <div class="site-shell">
            <SiteHeader :userInfo="userInfo" />
            <OpenCoursesBar v-if="canUseTabs" :userInfo="userInfo" />
        </div>

        <main v-if="!onCourseRoute" class="page-main" :class="{ 'page-content shell-width': route.meta.formPage }">
            <router-view />
        </main>

        <!-- Every open course stays mounted so switching tabs keeps unsaved sub-view input -->
        <template v-if="canUseTabs">
            <div v-for="tab in openCourses.state.tabs"
                 v-show="onCourseRoute && tab.key === openCourses.state.activeKey"
                 :key="tab.key"
                 class="course-pane">
                <router-view :route="tab.route" />
            </div>
        </template>
    </div>
</template>

<style scoped>
    .app-root { --site-shell-height: 105px; min-height: 100vh; }
    .app-root.is-bare { --site-shell-height: 0px; }
    .site-shell { position: sticky; top: 0; z-index: 20; }
</style>
