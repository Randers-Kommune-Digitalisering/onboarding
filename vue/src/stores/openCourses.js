import { markRaw, reactive, readonly } from 'vue'

export const MAX_OPEN_COURSES = 12
export const COURSE_PATH = '/forloeb-overview'

// Only course keys are persisted; names and other personal data are re-fetched from the API
const STORAGE_KEY = 'onboarding.openCourses'
const NOTICE_TIMEOUT_MS = 6000

const state = reactive({
    tabs: [],
    activeKey: null,
    notice: null,
})

let noticeTimer = 0

const toId = (value) => {
    const id = parseInt(Array.isArray(value) ? value[0] : value, 10)
    return Number.isNaN(id) ? null : id
}

const makeRef = (value, isTemplate) => {
    const id = toId(value)
    if (id == null)
        return null
    return { id, isTemplate, key: `${isTemplate ? 't' : 'f'}:${id}` }
}

const parseKey = (key) => {
    const [type, value] = String(key).split(':')
    if (type !== 'f' && type !== 't')
        return null
    return makeRef(value, type === 't')
}

export const isCourseRoute = (route) => route.path === COURSE_PATH || route.path.startsWith(`${COURSE_PATH}/`)

export const isCourseSubRoute = (route) => route.path.startsWith(`${COURSE_PATH}/`)

export const isExternalRoute = (route) => String(route.query?.external ?? '').toLowerCase() === 'true'

// Sub-views carry the parent course as forloebId/forloebTid, while `id`/`tid` may then refer to a task
export const resolveCourseRef = (query = {}) => {
    if (query.forloebTid != null)
        return makeRef(query.forloebTid, true)
    if (query.forloebId != null)
        return makeRef(query.forloebId, false)
    if (query.tid != null)
        return makeRef(query.tid, true)
    return makeRef(query.id, false)
}

export const courseLocation = (courseRef) => ({
    path: COURSE_PATH,
    query: courseRef.isTemplate ? { tid: courseRef.id } : { id: courseRef.id },
})

const persist = () => {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.tabs.map(tab => tab.key)))
    } catch {
        // Storage can be unavailable (e.g. privacy mode); tabs then simply live in memory
    }
}

const find = (key) => state.tabs.find(tab => tab.key === key) ?? null

const canOpen = (key) => find(key) != null || state.tabs.length < MAX_OPEN_COURSES

const open = (courseRef, route) => {
    const existing = find(courseRef.key)
    if (existing) {
        existing.route = markRaw(route)
    } else {
        if (state.tabs.length >= MAX_OPEN_COURSES)
            return false
        state.tabs.push({
            key: courseRef.key,
            id: courseRef.id,
            isTemplate: courseRef.isTemplate,
            title: null,
            route: markRaw(route),
        })
        persist()
    }
    state.activeKey = courseRef.key
    return true
}

const remove = (key) => {
    const index = state.tabs.findIndex(tab => tab.key === key)
    if (index === -1)
        return
    state.tabs.splice(index, 1)
    if (state.activeKey === key)
        state.activeKey = null
    persist()
}

const setTitle = (key, title) => {
    const tab = find(key)
    if (tab)
        tab.title = title || null
}

const showNotice = (message) => {
    state.notice = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { state.notice = null }, NOTICE_TIMEOUT_MS)
}

const dismissNotice = () => {
    clearTimeout(noticeTimer)
    state.notice = null
}

const restore = (router) => {
    let keys = []
    try {
        keys = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
        keys = []
    }
    if (!Array.isArray(keys))
        return

    for (const key of keys.slice(0, MAX_OPEN_COURSES)) {
        const courseRef = parseKey(key)
        if (courseRef && !find(courseRef.key))
            state.tabs.push({
                key: courseRef.key,
                id: courseRef.id,
                isTemplate: courseRef.isTemplate,
                title: null,
                route: markRaw(router.resolve(courseLocation(courseRef))),
            })
    }
}

export const openCourses = {
    state: readonly(state),
    find,
    canOpen,
    open,
    remove,
    setTitle,
    showNotice,
    dismissNotice,
    restore,
}
