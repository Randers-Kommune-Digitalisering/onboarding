export const preparationCategories = [
    { id: 'before', title: 'Før opstart', label: 'Forberedelse', icon: 'fa-hourglass-start' },
    { id: 'during', title: 'Under forløbet', label: 'Forløb', icon: 'fa-circle' },
    { id: 'after', title: 'Efter forløbet', label: 'Opfølgning', icon: 'fa-flag-checkered' },
]

export const activeCategories = [
    { id: 'current', title: 'Aktuelle opgaver', label: 'I gang', icon: 'fa-circle' },
    { id: 'completed', title: 'Gennemførte opgaver', label: 'Afsluttet', icon: 'fa-check' },
    { id: 'upcoming', title: 'Kommende opgaver', label: 'Senere', icon: 'fa-clock' },
]

const DAY_MS = 86400000

// Parse as a local calendar day so UTC offsets don't shift the date
export function toDay(value) {
    if (!value)
        return null
    const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
    if (!year || !month || !day)
        return null
    return new Date(year, month - 1, day).getTime()
}

const today = () => new Date().setHours(0, 0, 0, 0)

export function daysFromToday(value) {
    const day = toDay(value)
    if (day === null)
        return null
    // Round to absorb DST hour shifts
    return Math.round((day - today()) / DAY_MS)
}

export const formatDays = (days) => days === 1 || days === -1 ? `${days} dag` : `${days} dage`

export function hasNoDates(task) {
    return !task.startdato && !task.slutdato
}

export function getCategoryId(task, { isPreparation, varighed }) {
    if (isPreparation) {
        if (task.relativ_startdag < 0)
            return 'before'
        return varighed == null || task.relativ_startdag <= varighed ? 'during' : 'after'
    }
    if (task.result)
        return 'completed'
    const start = toDay(task.startdato) ?? toDay(task.slutdato)
    return start !== null && start > today() ? 'upcoming' : 'current'
}

export function getTaskTiming(task, { isPreparation }) {
    if (isPreparation) {
        const day = task.relativ_startdag ?? 0
        if (day < 0)
            return `${formatDays(Math.abs(day))} før start`
        return day === 0 ? 'Ved opstart' : `Dag ${day}`
    }
    if (task.result)
        return 'Gennemført'
    const startDays = daysFromToday(task.startdato)
    if (startDays !== null && startDays > 0)
        return startDays === 1 ? 'Starter i morgen' : `Starter om ${formatDays(startDays)}`
    const days = daysFromToday(task.slutdato)
    if (days === null)
        return 'Ingen deadline'
    if (days < 0)
        return `Deadline overskredet med ${formatDays(-days)}`
    if (days === 0)
        return 'Deadline i dag'
    return days === 1 ? 'Deadline i morgen' : `Deadline om ${formatDays(days)}`
}

export function isTaskOverdue(task, { isPreparation }) {
    if (isPreparation || task.result)
        return false
    const days = daysFromToday(task.slutdato)
    return days !== null && days < 0
}

const byRelativeDay = (a, b) => (a.relativ_startdag ?? 0) - (b.relativ_startdag ?? 0) || (a.relativ_slutdag ?? 0) - (b.relativ_slutdag ?? 0)
const byDate = (key) => (a, b) => (toDay(a[key]) ?? Infinity) - (toDay(b[key]) ?? Infinity)

export function sortTasks(tasks, { isPreparation }) {
    return [...tasks].sort(isPreparation ? byRelativeDay : byDate('slutdato'))
}

export function groupTasks(tasks) {
    const groups = new Map()
    for (const task of tasks) {
        const key = task.gruppe?.OpgaveGruppeID ?? ''
        if (!groups.has(key))
            groups.set(key, { key, name: task.gruppe?.name ?? '', items: [] })
        groups.get(key).items.push(task)
    }
    return [...groups.values()]
}

export function buildSections(tasks, { isPreparation, varighed }) {
    const categories = isPreparation ? preparationCategories : activeCategories
    const sorted = sortTasks(tasks, { isPreparation })

    return categories.map((category) => {
        let items = sorted.filter(task => getCategoryId(task, { isPreparation, varighed }) === category.id)
        if (category.id === 'upcoming')
            items = [...items].sort(byDate('startdato'))
        return { ...category, tasks: items, groups: groupTasks(items) }
    })
}

export function completionPercentage(tasks) {
    const visible = tasks.filter(task => task?.hidden !== true)
    if (visible.length === 0)
        return 0
    return Math.round(visible.filter(task => task.result).length / visible.length * 100)
}
