<script setup>
    import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
    import { useRoute, useRouter } from 'vue-router'

    import { getForloebByAdmin, getForloebByEmail } from '@/services/forløbService.js'
    import { getForloebsskabeloner } from '@/services/forløbsskabelonService.js'
    import { getOpgaverByAnsvarligEmail } from '@/services/opgaveService.js'
    import { openCourses, MAX_OPEN_COURSES, courseLocation, isCourseRoute, isCourseSubRoute } from '@/stores/openCourses.js'

    const props = defineProps({
        userInfo: {
            type: Object,
            required: true
        }
    })

    const route = useRoute()
    const router = useRouter()

    const pickerOpen = ref(false)
    const pickerRef = ref(null)
    const filterInput = ref(null)
    const filterText = ref('')
    const isLoading = ref(false)
    const loadFailed = ref(false)
    const courses = ref([])
    const templates = ref([])

    const tabs = computed(() => openCourses.state.tabs)
    const onCourseRoute = computed(() => isCourseRoute(route))
    const isFull = computed(() => tabs.value.length >= MAX_OPEN_COURSES)

    const tabLabel = (tab) => tab.title || `${tab.isTemplate ? 'Skabelon' : 'Forløb'} ${tab.id}`
    const isActive = (tab) => onCourseRoute.value && openCourses.state.activeKey === tab.key

    const toEntry = (id, isTemplate, name, detail, isPreparation = false) => ({
        id,
        isTemplate,
        key: `${isTemplate ? 't' : 'f'}:${id}`,
        name: name || (isTemplate ? 'Skabelon uden titel' : 'Forløb uden titel'),
        detail: detail || '',
        isPreparation,
    })

    const byName = (a, b) => a.name.localeCompare(b.name, 'da')

    const loadPickerData = async () => {
        isLoading.value = true
        loadFailed.value = false
        const headers = props.userInfo.isAdmin ? { adminmail: props.userInfo.email } : { usermail: props.userInfo.email }
        try {
            if (props.userInfo.isAdmin) {
                const [courseResponse, templateResponse] = await Promise.all([
                    getForloebByAdmin({ headers }),
                    getForloebsskabeloner(),
                ])
                courses.value = [courseResponse?.data ?? []].flat()
                    .map(course => toEntry(course.ForløbID, false, course.name, course.userdq || course.usermail, course.isPreparation))
                    .sort(byName)
                templates.value = [templateResponse?.data ?? []].flat()
                    .map(template => toEntry(template.ForløbsskabelonID, true, template.name, `${template.varighed ?? 0} dage`))
                    .sort(byName)
            } else {
                const [ownResponse, taskResponse] = await Promise.all([
                    getForloebByEmail({ headers }).catch(() => null),
                    getOpgaverByAnsvarligEmail({ headers }),
                ])
                const entries = new Map()
                const own = ownResponse?.data
                if (own?.ForløbID != null)
                    entries.set(own.ForløbID, toEntry(own.ForløbID, false, own.name, 'Mit forløb', own.isPreparation))
                for (const task of [taskResponse?.data ?? []].flat())
                    if (task.ForløbID != null && !entries.has(task.ForløbID))
                        entries.set(task.ForløbID, toEntry(task.ForløbID, false, task.name, 'Du er ansvarlig for opgaver'))
                courses.value = [...entries.values()].sort(byName)
                templates.value = []
            }
        } catch (error) {
            console.error('Error fetching courses for picker:', error)
            loadFailed.value = true
        }
        isLoading.value = false
    }

    const matchesFilter = (entry) => {
        const query = filterText.value.trim().toLowerCase()
        return !query || entry.name.toLowerCase().includes(query) || entry.detail.toLowerCase().includes(query)
    }

    const filteredCourses = computed(() => courses.value.filter(matchesFilter))
    const filteredTemplates = computed(() => templates.value.filter(matchesFilter))

    const isOpen = (entry) => openCourses.find(entry.key) != null

    const togglePicker = async () => {
        pickerOpen.value = !pickerOpen.value
        if (!pickerOpen.value)
            return
        filterText.value = ''
        loadPickerData()
        await nextTick()
        filterInput.value?.focus()
    }

    const openEntry = (entry) => {
        const tab = openCourses.find(entry.key)
        if (!tab && isFull.value)
            return
        pickerOpen.value = false
        router.push(tab ? tab.route.fullPath : courseLocation(entry))
    }

    const activateTab = (tab) => {
        if (route.fullPath !== tab.route.fullPath)
            router.push(tab.route.fullPath)
    }

    const homePath = () => props.userInfo.isAdmin ? '/admin-overview' : '/ansvarlig-overview'

    const closeTab = (tab) => {
        if (isCourseSubRoute(tab.route) && !confirm('Vil du lukke forløbet? Ændringer, der ikke er gemt, går tabt.'))
            return

        const wasActive = isActive(tab)
        const index = tabs.value.findIndex(item => item.key === tab.key)
        openCourses.remove(tab.key)

        if (!wasActive)
            return
        const next = tabs.value[Math.min(index, tabs.value.length - 1)]
        router.push(next ? next.route.fullPath : homePath())
    }

    const onDocumentPointerDown = (event) => {
        if (pickerOpen.value && pickerRef.value && !pickerRef.value.contains(event.target))
            pickerOpen.value = false
    }

    onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
    onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
</script>

<template>
    <div class="workspace-bar" @keydown.esc="pickerOpen = false">
        <div class="workspace-inner shell-width">
            <span class="workspace-label">ÅBNE FORLØB</span>

            <nav class="workspace-tabs" aria-label="Åbne forløb">
                <div v-for="tab in tabs" :key="tab.key" class="workspace-tab" :class="{ 'is-active': isActive(tab) }">
                    <a :href="tab.route.fullPath"
                       :aria-current="isActive(tab) ? 'page' : undefined"
                       :title="tabLabel(tab)"
                       @click.prevent="activateTab(tab)">
                        <i :class="tab.isTemplate ? 'far fa-copy' : 'far fa-folder-open'" aria-hidden="true"></i>
                        <span>{{ tabLabel(tab) }}</span>
                    </a>
                    <button type="button" :aria-label="`Luk ${tabLabel(tab)}`" :title="`Luk ${tabLabel(tab)}`" @click="closeTab(tab)">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </div>
                <span v-if="tabs.length === 0" class="workspace-empty">Ingen åbne forløb</span>
            </nav>

            <span v-if="openCourses.state.notice" class="workspace-notice" role="status">
                <i class="fas fa-info-circle" aria-hidden="true"></i> {{ openCourses.state.notice }}
                <button type="button" aria-label="Luk besked" @click="openCourses.dismissNotice()"><i class="fas fa-times" aria-hidden="true"></i></button>
            </span>

            <div ref="pickerRef" class="picker-anchor">
                <button class="open-course-button"
                        type="button"
                        title="Åbn forløb"
                        aria-label="Åbn forløb"
                        :aria-expanded="pickerOpen"
                        aria-controls="course-picker"
                        @click="togglePicker">
                    <i class="fas fa-plus" aria-hidden="true"></i>
                </button>

                <div v-if="pickerOpen" id="course-picker" class="course-picker">
                    <input ref="filterInput"
                           v-model="filterText"
                           type="search"
                           class="picker-filter"
                           placeholder="Søg efter forløb ..."
                           aria-label="Søg efter forløb">

                    <p v-if="isFull" class="picker-note">
                        Du har {{ MAX_OPEN_COURSES }} forløb åbne. Luk et forløb for at åbne et nyt.
                    </p>

                    <div class="picker-list">
                        <p v-if="loadFailed" class="picker-note">Forløbene kunne ikke hentes.</p>
                        <p v-else-if="isLoading && courses.length === 0 && templates.length === 0" class="picker-note">Henter forløb ...</p>

                        <template v-else>
                            <span class="picker-heading">FORLØB</span>
                            <button v-for="entry in filteredCourses"
                                    :key="entry.key"
                                    type="button"
                                    :disabled="isFull && !isOpen(entry)"
                                    @click="openEntry(entry)">
                                <i class="far fa-folder" aria-hidden="true"></i>
                                <span class="picker-text">
                                    <span class="picker-name">{{ entry.name }}</span>
                                    <span class="picker-detail">{{ entry.isPreparation ? 'Under forberedelse · ' : '' }}{{ entry.detail }}</span>
                                </span>
                                <i v-if="isOpen(entry)" class="fas fa-check picker-check" aria-hidden="true"></i>
                            </button>
                            <p v-if="filteredCourses.length === 0" class="picker-note">Ingen forløb fundet.</p>

                            <template v-if="userInfo.isAdmin">
                                <span class="picker-heading">SKABELONER</span>
                                <button v-for="entry in filteredTemplates"
                                        :key="entry.key"
                                        type="button"
                                        :disabled="isFull && !isOpen(entry)"
                                        @click="openEntry(entry)">
                                    <i class="far fa-copy" aria-hidden="true"></i>
                                    <span class="picker-text">
                                        <span class="picker-name">{{ entry.name }}</span>
                                        <span class="picker-detail">{{ entry.detail }}</span>
                                    </span>
                                    <i v-if="isOpen(entry)" class="fas fa-check picker-check" aria-hidden="true"></i>
                                </button>
                                <p v-if="filteredTemplates.length === 0" class="picker-note">Ingen skabeloner fundet.</p>
                            </template>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .workspace-bar { background: #edf3ee; border-bottom: 1px solid #cbdcd0; }
    .workspace-inner { position: relative; display: flex; align-items: center; gap: 12px; height: 44px; min-width: 0; }
    .workspace-label { flex: none; padding-top: 10px; color: var(--muted); font-size: 9px; font-weight: 700; letter-spacing: .07em; }
    .workspace-tabs { display: flex; align-self: stretch; gap: 4px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
    .workspace-tabs::-webkit-scrollbar { display: none; }
    .workspace-empty { align-self: center; padding-top: 8px; color: var(--muted); font-size: 11px; }
    .workspace-tab { display: flex; align-items: center; flex: none; align-self: end; max-width: 230px; height: 35px; border: 1px solid transparent; border-bottom: 0; border-radius: 3px 3px 0 0; color: #526b60; }
    .workspace-tab.is-active { border-color: #cbdcd0; background: #fff; color: var(--ink); }
    .workspace-tab > a { display: flex; align-items: center; gap: 8px; min-width: 0; height: 100%; padding: 0 8px 0 12px; color: inherit; font-size: 11px; font-weight: 600; }
    .workspace-tab > a span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .workspace-tab > a i { color: var(--green); }
    .workspace-tab > button, .open-course-button { display: grid; place-items: center; flex: none; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--muted); font-size: 10px; cursor: pointer; }
    .workspace-tab > button { margin-right: 3px; }
    .workspace-tab:hover:not(.is-active), .workspace-tab > button:hover, .open-course-button:hover { background: #dfece2; color: var(--green); }
    .picker-anchor { flex: none; margin-left: auto; }
    .workspace-notice { display: inline-flex; align-items: center; gap: 8px; flex: 0 1 auto; min-width: 0; margin-left: auto; padding: 4px 4px 4px 10px; border: 1px solid #e7d8ab; border-radius: 3px; background: #fbf6e9; color: #654e26; font-size: 11px; }
    .workspace-notice + .picker-anchor { margin-left: 0; }
    .workspace-notice button { display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: inherit; cursor: pointer; }
    .workspace-notice button:hover { background: #f3e7c6; }
    .course-picker { position: absolute; top: 100%; right: 0; z-index: 25; display: flex; flex-direction: column; gap: 6px; width: min(320px, calc(100vw - 32px)); padding: 8px; border: 1px solid var(--line); background: #fff; box-shadow: var(--shadow-pop); }
    .picker-list { display: flex; flex-direction: column; max-height: min(420px, 60vh); overflow-y: auto; scrollbar-width: thin; }
    .picker-heading { display: block; padding: 9px 9px 5px; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .05em; }
    .picker-note { padding: 7px 9px; color: var(--muted); font-size: 11px; line-height: 1.5; }
    .course-picker button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 7px 10px; border: 0; border-radius: 3px; background: transparent; color: var(--ink); text-align: left; cursor: pointer; }
    .course-picker button:hover:not(:disabled) { background: var(--wash); }
    .course-picker button:disabled { opacity: .45; cursor: not-allowed; }
    .course-picker button > i:first-child { color: var(--green); }
    .picker-text { display: flex; flex-direction: column; min-width: 0; }
    .picker-name { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .picker-detail { overflow: hidden; color: var(--muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
    .picker-check { margin-left: auto; color: var(--green); }
    a:focus-visible, button:focus-visible { outline: 2px solid var(--green); outline-offset: -2px; }

    @media (max-width: 760px) {
        .workspace-label { display: none; }
        .workspace-tabs { flex: 1; }
        .workspace-notice { position: absolute; top: calc(100% + 6px); right: 16px; left: 16px; z-index: 24; }
    }
</style>
