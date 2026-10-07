<script setup>
    import { computed, inject, nextTick, onMounted, provide, ref, shallowReactive, watch } from 'vue'
    import { routeLocationKey, routerViewLocationKey, useRoute, useRouter } from 'vue-router'

    import CourseTaskSections from '@/components/CourseTaskSections.vue'
    import { getUserInfo } from '@/services/keycloakService.js'
    import { getExternalUserInfo, requestExternalAccess } from '@/services/externalAccessService.js'
    import { completeForloeb, deleteForloeb, getForloebById, getForloebByIdExternal } from '@/services/forløbService.js'
    import { deleteForloebsskabelon, getForloebsskabelonById } from '@/services/forløbsskabelonService.js'
    import { getOpgaverByForloebID, getOpgaverByForloebIDAdmin, getOpgaverByForloebIDExternal, getOpgaverByForloebsskabelonID } from '@/services/opgaveService.js'
    import { COURSE_PATH, isCourseRoute, isCourseSubRoute, isExternalRoute, openCourses, resolveCourseRef } from '@/stores/openCourses.js'
    import { buildSections, completionPercentage } from '@/utils/taskSections.js'

    const router = useRouter()
    const globalRoute = useRoute()

    // The route this tab displays; hidden tabs keep their last route instead of following the URL
    const viewRoute = inject(routerViewLocationKey)

    // Sub-views call useRoute(); give them this tab's route so hidden tabs don't react to other tabs' URLs
    const tabRoute = {}
    for (const key of ['path', 'name', 'params', 'query', 'hash', 'fullPath', 'matched', 'meta', 'redirectedFrom', 'href'])
        Object.defineProperty(tabRoute, key, { get: () => viewRoute.value[key], enumerable: true })
    provide(routeLocationKey, shallowReactive(tabRoute))

    const courseRef = computed(() => resolveCourseRef(viewRoute.value.query))
    const courseId = computed(() => courseRef.value?.id ?? null)
    const isTemplate = computed(() => courseRef.value?.isTemplate ?? false)
    const isExternal = computed(() => isExternalRoute(viewRoute.value))
    const isSubView = computed(() => isCourseSubRoute(viewRoute.value))
    const isActive = computed(() => isExternal.value
        || (isCourseRoute(globalRoute) && openCourses.state.activeKey === courseRef.value?.key))
    const idPrefix = computed(() => `course-${courseRef.value?.key.replace(':', '-') ?? 'unknown'}`)

    const userInfo = ref(null)
    const course = ref(null)
    const tasks = ref([])
    const isLoading = ref(true)
    const accessDenied = ref(false)
    const externalAccessDenied = ref(false)
    const loadFailed = ref(false)
    const accessKey = ref(null)
    const externalRequestSent = ref(false)

    const isAdmin = computed(() => userInfo.value?.isAdmin === true && !isExternal.value)
    const isPreparationCourse = computed(() => !isTemplate.value && course.value?.isPreparation === true)
    const relativeMode = computed(() => isTemplate.value || isPreparationCourse.value)
    const isCompleted = computed(() => !relativeMode.value && !!course.value?.enddate && new Date(course.value.enddate) <= new Date())
    const isOngoing = computed(() => !relativeMode.value && !!course.value?.startdate && new Date(course.value.startdate) <= new Date())
    const progress = computed(() => completionPercentage(tasks.value))
    const sections = computed(() => buildSections(tasks.value, { isPreparation: relativeMode.value, varighed: course.value?.varighed }))
    const usesPrivateEmail = computed(() => isAdmin.value && isOngoing.value && !!course.value?.usermail && !course.value.usermail.toLowerCase().includes('@randers.dk'))

    const scrollToItem = computed(() => {
        const parsed = parseInt(viewRoute.value.query.item, 10)
        return Number.isNaN(parsed) ? null : parsed
    })

    const startLabel = computed(() => {
        if (!course.value?.startdate || isOngoing.value || relativeMode.value)
            return null
        return new Date(course.value.startdate).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' })
    })

    const footnote = computed(() => {
        if (isTemplate.value)
            return 'Skabelonen bruger relative datoer'
        return isPreparationCourse.value ? 'Forløbet er under forberedelse' : null
    })

    const toArray = (data) => data == null ? [] : [data].flat()
    const validData = (data) => data && !data.error ? data : null

    /* External access */

    const parseAccessKeyFromHash = (hash) => {
        const raw = (hash || '').toString().replace(/^#/, '')
        if (!raw)
            return null
        if (raw.startsWith('accessKey='))
            return raw.substring('accessKey='.length) || null
        return new URLSearchParams(raw).get('accessKey') || raw || null
    }

    const isRefreshRequested = () => String(viewRoute.value.query.refresh || '').toLowerCase() === 'true'

    const syncAccessKey = () => {
        if (!isExternal.value) {
            accessKey.value = null
            return
        }

        const keyFromHash = parseAccessKeyFromHash(viewRoute.value.hash)
        const storageKey = courseId.value ? `externalAccessKey:${courseId.value}` : null
        if (storageKey && isRefreshRequested() && !keyFromHash)
            sessionStorage.removeItem(storageKey)

        const keyFromStorage = storageKey && !isRefreshRequested() ? sessionStorage.getItem(storageKey) : null
        accessKey.value = keyFromHash || keyFromStorage || null

        // Move the key out of the address bar so it is less likely to be copied or screenshotted
        if (storageKey && keyFromHash) {
            sessionStorage.setItem(storageKey, keyFromHash)
            if (viewRoute.value.hash)
                router.replace({ query: viewRoute.value.query, hash: '' })
        }
    }

    const sendExternalAccessEmail = async () => {
        if (!isExternal.value || !courseId.value)
            return

        if (isRefreshRequested()) {
            sessionStorage.removeItem(`externalAccessKey:${courseId.value}`)
            accessKey.value = null
            externalRequestSent.value = false
        }

        if (accessKey.value || externalRequestSent.value)
            return

        try {
            await requestExternalAccess(courseId.value)
            externalRequestSent.value = true
            if (isRefreshRequested()) {
                const { refresh, ...query } = viewRoute.value.query
                router.replace({ query, hash: viewRoute.value.hash })
            }
        } catch (error) {
            console.error('Error requesting external access:', error)
        }
    }

    /* Data */

    const fetchCourse = async () => {
        if (!courseId.value)
            return

        isLoading.value = true
        accessDenied.value = false
        externalAccessDenied.value = false
        loadFailed.value = false

        let nextCourse = null
        let nextTasks = []
        try {
            if (isExternal.value) {
                if (!accessKey.value) {
                    isLoading.value = false
                    return
                }
                const infoResponse = await getExternalUserInfo(courseId.value, accessKey.value)
                userInfo.value = {
                    roles: ['Public'],
                    email: infoResponse?.data?.email || '',
                    isAdmin: false,
                    isMedarbejder: false,
                }
                nextCourse = validData((await getForloebByIdExternal(courseId.value, accessKey.value))?.data)
                nextTasks = nextCourse ? toArray((await getOpgaverByForloebIDExternal(courseId.value, accessKey.value))?.data) : []
            } else {
                userInfo.value ??= await getUserInfo()
                if (isTemplate.value) {
                    nextCourse = validData((await getForloebsskabelonById(courseId.value))?.data)
                    nextTasks = nextCourse ? toArray((await getOpgaverByForloebsskabelonID(courseId.value))?.data) : []
                } else {
                    const headers = { usermail: userInfo.value.email }
                    nextCourse = validData((await getForloebById(courseId.value, { headers }))?.data)
                    const taskResponse = !nextCourse ? null
                        : userInfo.value.isAdmin ? await getOpgaverByForloebIDAdmin(courseId.value)
                        : await getOpgaverByForloebID(courseId.value)
                    nextTasks = toArray(taskResponse?.data)
                }
            }
        } catch (error) {
            console.error('Error fetching course:', error)
            const status = error?.response?.status
            if (isExternal.value && status === 403)
                externalAccessDenied.value = true
            else if (status === 403)
                accessDenied.value = true
            else if (status !== 404)
                loadFailed.value = true
            nextCourse = null
            nextTasks = []
        }

        course.value = nextCourse
        tasks.value = nextTasks
        isLoading.value = false

        if (!isExternal.value && courseRef.value) {
            openCourses.setTitle(courseRef.value.key, course.value?.name || null)
            // Tabs restored from an earlier session may point to courses that are gone or no longer accessible
            if (!course.value && !isActive.value)
                openCourses.remove(courseRef.value.key)
        }
    }

    const handleResultChange = ({ id, result }) => {
        const task = tasks.value.find(item => (item.OpgaveID ?? item.OpgaveskabelonID) === id)
        if (task)
            task.result = result
    }

    /* Admin actions */

    const completeCourse = async () => {
        try {
            await completeForloeb(courseId.value)
            await fetchCourse()
        } catch (error) {
            console.error('Error completing course:', error)
        }
    }

    const deleteCourse = async () => {
        if (!confirm(`Er du sikker på, at du vil slette ${isTemplate.value ? 'denne skabelon' : 'dette forløb'}?`))
            return
        try {
            if (isTemplate.value)
                await deleteForloebsskabelon(courseId.value)
            else
                await deleteForloeb(courseId.value)
            openCourses.remove(courseRef.value.key)
            router.replace(isTemplate.value ? '/template-overview' : '/admin-overview')
        } catch (error) {
            console.error('Error deleting course:', error)
        }
    }

    const returnToOverview = () => {
        const current = viewRoute.value.query
        const query = { [isTemplate.value ? 'tid' : 'id']: courseId.value, refreshTasks: Date.now().toString() }
        // On task editors `id` is the task while forloebId/forloebTid points to the course
        const item = current.item || (current.forloebId != null || current.forloebTid != null ? current.id : null)
        if (item != null)
            query.item = item
        router.replace({ path: COURSE_PATH, query })
    }

    const subViewKey = computed(() => viewRoute.value.fullPath)

    /* Lifecycle */

    watch(() => [viewRoute.value.query.refreshTasks, isSubView.value], ([token, subView], [previousToken, wasSubView]) => {
        if (subView)
            return
        if (wasSubView || token !== previousToken)
            fetchCourse()
    })

    watch(() => viewRoute.value.fullPath, () => {
        if (!isExternal.value)
            return
        syncAccessKey()
        sendExternalAccessEmail()
    })

    watch(accessKey, (key, previous) => {
        if (key && key !== previous)
            fetchCourse()
    })

    let savedScroll = 0
    watch(isActive, async (active, wasActive) => {
        if (wasActive && !active) {
            savedScroll = window.scrollY
            return
        }
        if (active && !wasActive) {
            await nextTick()
            window.scrollTo(0, savedScroll)
        }
    })

    onMounted(async () => {
        if (isExternal.value) {
            syncAccessKey()
            await sendExternalAccessEmail()
            if (accessKey.value)
                return
            isLoading.value = false
            return
        }
        await fetchCourse()
    })
</script>

<template>
    <div class="course-workspace">
        <header v-if="course" class="course-header">
            <div class="header-main shell-width">
                <div class="header-heading">
                    <div>
                        <span class="eyebrow">{{ isTemplate ? 'FORLØBSSKABELON' : 'ONBOARDINGFORLØB' }}</span>
                        <h1>{{ course.name || (isTemplate ? 'Skabelon uden titel' : 'Forløb uden titel') }}</h1>
                        <div class="header-meta">
                            <template v-if="!isTemplate && (course.userdq || course.usermail)">
                                <span class="user-id">{{ course.userdq || course.usermail }}</span>
                                <span class="meta-divider"></span>
                            </template>
                            <span v-if="course.varighed != null" class="course-duration"><i class="far fa-calendar-alt" aria-hidden="true"></i> {{ course.varighed }} dage</span>
                            <span v-if="!relativeMode && tasks.length" class="progress" :title="`${progress}% af opgaverne er gennemført`">
                                <span class="progress-track"><span class="progress-fill" :style="{ width: `${progress}%` }"></span></span>
                                {{ progress }}%
                            </span>
                            <span v-if="isTemplate" class="status-tag is-neutral"><span class="status-dot"></span>Skabelon</span>
                            <span v-else-if="isPreparationCourse" class="status-tag"><span class="status-dot"></span>Under forberedelse</span>
                            <span v-else-if="isCompleted" class="status-tag is-done"><span class="status-dot"></span>Afsluttet</span>
                            <span v-else-if="startLabel" class="status-tag is-neutral"><span class="status-dot"></span>Starter {{ startLabel }}</span>
                        </div>
                    </div>
                    <div class="header-mark" aria-hidden="true">{{ isTemplate ? 'S' : 'F' }}<span>{{ String(courseId).padStart(2, '0') }}</span></div>
                </div>
            </div>

            <div v-if="isAdmin" class="actions-bar">
                <div class="course-header-actions shell-width">
                    <button v-if="isSubView" class="action" type="button" @click="returnToOverview">
                        <i class="fas fa-chevron-left" aria-hidden="true"></i> Tilbage til oversigt
                    </button>
                    <template v-else>
                        <router-link v-if="isTemplate" class="action action-primary" :to="`${COURSE_PATH}/create-opgave?tid=${courseId}`">
                            <i class="fas fa-plus" aria-hidden="true"></i> Tilføj opgave
                        </router-link>
                        <router-link v-else-if="!isCompleted" class="action action-primary" :to="`${COURSE_PATH}/create-opgave?id=${courseId}&prep=${isPreparationCourse}`">
                            <i class="fas fa-plus" aria-hidden="true"></i> Tilføj opgave
                        </router-link>

                        <router-link v-if="isTemplate" class="action" :to="`${COURSE_PATH}/create-forloebsskabelon?tid=${courseId}&edit=true`">
                            <i class="far fa-edit" aria-hidden="true"></i> Redigér skabelon
                        </router-link>
                        <router-link v-else class="action" :to="`${COURSE_PATH}/edit-forloeb?id=${courseId}`">
                            <i class="far fa-edit" aria-hidden="true"></i> Redigér{{ isCompleted ? ' / genoptag' : '' }} forløb
                        </router-link>

                        <router-link v-if="!isTemplate && !isPreparationCourse" class="action" :to="`${COURSE_PATH}/send-velkomst?id=${courseId}`">
                            <i class="far fa-envelope" aria-hidden="true"></i> Send velkomstmail
                        </router-link>
                        <router-link v-if="isPreparationCourse" class="action" :to="`${COURSE_PATH}/start-forloeb?id=${courseId}`">
                            <i class="fas fa-play" aria-hidden="true"></i> Start forløb
                        </router-link>
                        <button v-if="!isTemplate && isOngoing && !isCompleted" class="action" type="button" @click="completeCourse">
                            <i class="fas fa-flag-checkered" aria-hidden="true"></i> Afslut forløb
                        </button>

                        <button v-if="isTemplate || isCompleted || !isOngoing" class="action action-danger" type="button" @click="deleteCourse">
                            <i class="far fa-trash-alt" aria-hidden="true"></i> Slet {{ isTemplate ? 'skabelon' : 'forløb' }}
                        </button>
                    </template>
                </div>
            </div>
        </header>
        <header v-else-if="isLoading" class="course-header" aria-busy="true">
            <div class="header-main shell-width">
                <span class="eyebrow">ONBOARDINGFORLØB</span>
                <h1 class="header-loading">Henter forløb ...</h1>
            </div>
        </header>

        <main class="course-content shell-width">
            <div v-if="(isExternal && !accessKey && !isLoading) || externalAccessDenied || accessDenied || loadFailed || usesPrivateEmail || (!course && !isLoading && !isExternal)" class="alerts">
                <div v-if="isExternal && !accessKey && !isLoading" class="alert" role="status">
                    <i class="fas fa-envelope" aria-hidden="true"></i>
                    <span>Tjek din email for et link til at åbne forløbet.</span>
                </div>
                <div v-if="externalAccessDenied" class="alert alert-error" role="alert">
                    <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
                    <span>Linket er ugyldigt eller udløbet. <router-link :to="`${COURSE_PATH}?id=${courseId}&external=true&refresh=true`">Anmod om et nyt link</router-link>.</span>
                </div>
                <div v-else-if="accessDenied" class="alert alert-error" role="alert">
                    <i class="fas fa-lock" aria-hidden="true"></i>
                    <span>Du har ikke adgang til dette forløb. Kontakt din leder eller administrator, hvis du mener, at dette er en fejl.</span>
                </div>
                <div v-else-if="loadFailed" class="alert alert-error" role="alert">
                    <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
                    <span>Forløbet kunne ikke hentes. Prøv igen senere.</span>
                </div>
                <div v-else-if="!course && !isLoading && !isExternal" class="alert alert-warning" role="status">
                    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    <span>{{ isTemplate ? 'Skabelonen' : 'Forløbet' }} blev ikke fundet. {{ isTemplate ? 'Den' : 'Det' }} kan være slettet.</span>
                </div>
                <div v-if="usesPrivateEmail" class="alert alert-warning" role="status">
                    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    <span>Forløbet er oprettet med medarbejderens private mailadresse. Husk at opdatere til medarbejderens nye Randers-mail, når medarbejderen er startet i kommunen.</span>
                </div>
            </div>

            <router-view v-if="isSubView" v-slot="{ Component }">
                <component :is="Component" :key="subViewKey" />
            </router-view>

            <template v-else-if="course">
                <div class="content-intro">
                    <div>
                        <span class="eyebrow">{{ isTemplate ? 'SKABELONOVERBLIK' : 'FORLØBSOVERBLIK' }}</span>
                        <h2>Opgaver i {{ isTemplate ? 'skabelonen' : 'forløbet' }}</h2>
                    </div>
                    <span class="intro-meta">{{ tasks.length }} {{ tasks.length === 1 ? 'opgave' : 'opgaver' }} i alt</span>
                </div>

                <CourseTaskSections :sections="sections"
                                    :idPrefix="idPrefix"
                                    :active="isActive"
                                    :isPreparation="relativeMode"
                                    :userInfo="userInfo"
                                    :courseId="courseId"
                                    :courseIsTemplate="isTemplate"
                                    :courseUsermail="course.usermail"
                                    :external="isExternal"
                                    :accessKey="accessKey"
                                    :scrollToItem="scrollToItem"
                                    :footnote="footnote"
                                    @result-change="handleResultChange"
                                    @changed="fetchCourse" />
            </template>

            <div v-else-if="isLoading && (!isExternal || accessKey)" class="loading-block" aria-hidden="true"></div>
        </main>
    </div>
</template>

<style scoped>
    .course-header { background: #fff; border-bottom: 1px solid var(--line); }
    .header-main { padding-block: 36px 32px; }
    .header-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
    .header-heading h1 { margin-top: 7px; overflow-wrap: anywhere; }
    .header-loading { color: var(--muted); }
    .header-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; min-height: 1.8rem; margin-top: 14px; color: var(--muted); font-size: 12px; }
    .user-id { color: #49665b; font-weight: 700; }
    .meta-divider { height: 14px; border-left: 1px solid var(--line); }
    .course-duration { display: inline-flex; align-items: center; gap: 7px; }
    .header-mark { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: none; width: 60px; height: 60px; background: var(--green); color: #fff; font: 700 22px/1 var(--font); }
    .header-mark span { margin-top: 4px; font-size: 9px; letter-spacing: .08em; }
    .actions-bar { border-top: 1px solid var(--line); }
    .course-header-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding-block: 10px; }
    .course-header-actions .action-primary { margin-right: 8px; }
    .course-header-actions .action-danger { margin-left: auto; }
    .course-content { padding-block: 40px 35vh; }
    .course-content:has(> .alerts) { padding-top: 20px; }

    @media (max-width: 520px) {
        .header-main { padding-block: 27px; }
        .header-mark { display: none; }
        .course-header-actions { gap: 2px; }
        .course-header-actions .action { padding-inline: 8px; font-size: 11px; }
        .course-header-actions .action-danger { margin-left: 0; }
        .course-content { padding-top: 28px; }
    }
</style>
