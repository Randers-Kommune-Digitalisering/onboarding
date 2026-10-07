<script setup>
    import { computed, nextTick, onMounted, ref, watch } from 'vue'
    import { useRoute, useRouter } from 'vue-router'

    import { updateOpgave, deleteOpgave } from '@/services/opgaveService.js'
    import { deleteOpgaveskabelon } from '@/services/opgaveskabelonService.js'
    import { deleteMail, NEW_TASK_ANSVARLIG, NEW_TASK_USER } from '@/services/mailService.js'
    import { downloadRessourceFile } from '@/services/ressourceService.js'
    import { formatDays, getTaskTiming, isTaskOverdue } from '@/utils/taskSections.js'

    const props = defineProps({
        task: {
            type: Object,
            required: true
        },
        userInfo: {
            type: Object,
            default: null
        },
        // Parent course (or course template) the task belongs to
        courseId: {
            type: Number,
            default: null
        },
        courseIsTemplate: {
            type: Boolean,
            default: false
        },
        courseUsermail: {
            type: String,
            default: null
        },
        isPreparation: {
            type: Boolean,
            default: false
        },
        showCourse: {
            type: Boolean,
            default: false
        },
        external: {
            type: Boolean,
            default: false
        },
        accessKey: {
            type: String,
            default: null
        },
        highlight: {
            type: Boolean,
            default: false
        }
    })

    const emit = defineEmits(['result-change', 'changed'])

    const route = useRoute()
    const router = useRouter()
    const cardRef = ref(null)
    const isUpdating = ref(false)
    const pendingMails = ref(props.task.pending_emails || [])

    const taskId = computed(() => props.task.OpgaveID ?? props.task.OpgaveskabelonID)
    const isTaskTemplate = computed(() => props.task.OpgaveskabelonID != null)
    const relativeTiming = computed(() => props.isPreparation || props.courseIsTemplate || isTaskTemplate.value)

    const email = computed(() => props.userInfo?.email?.toLowerCase() || '')
    const isAdmin = computed(() => props.userInfo?.isAdmin === true)
    const isAnsvarlig = computed(() => !!email.value && email.value === props.task.ansvarligEmail?.toLowerCase())
    const isEmployee = computed(() => !!email.value && email.value === props.courseUsermail?.toLowerCase())

    const canManage = computed(() => isTaskTemplate.value || isAdmin.value)
    const canEditResources = computed(() => canManage.value || isAnsvarlig.value)
    const canComplete = computed(() => !relativeTiming.value
        && (isAdmin.value || isAnsvarlig.value || (isEmployee.value && !props.task.ansvarligEmail)))

    const timing = computed(() => isTaskTemplate.value ? null : getTaskTiming(props.task, { isPreparation: relativeTiming.value }))
    const isOverdue = computed(() => isTaskOverdue(props.task, { isPreparation: relativeTiming.value }))

    const courseLink = computed(() => {
        if (props.task.ForløbID != null)
            return `/forloeb-overview?id=${props.task.ForløbID}`
        if (props.task.ForløbsskabelonID != null)
            return `/forloeb-overview?tid=${props.task.ForløbsskabelonID}`
        return null
    })

    const formatBooking = (value) => {
        const date = new Date(value)
        if (Number.isNaN(date.getTime()))
            return null
        return `${date.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' })} kl. ${date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}`
    }

    const firstAndLastName = (name) => {
        const names = String(name).trim().split(/\s+/)
        return names.length > 1 ? `${names[0]} ${names[names.length - 1]}` : names[0]
    }

    const mailReceiver = (description) => {
        if (description === NEW_TASK_ANSVARLIG)
            return 'ansvarlig'
        if (description === NEW_TASK_USER)
            return 'ny medarbejder'
        return 'modtager'
    }

    // Only plain web links are rendered as anchors; anything else (e.g. javascript:) is shown as text
    const safeUrl = (url) => /^https?:\/\//i.test(url || '') ? url : null

    const resourceAddress = (ressource) => {
        if (ressource.isFile)
            return ressource.filename || ''
        try {
            const parsed = new URL(ressource.url)
            return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '')
        } catch {
            return ressource.url || ''
        }
    }

    const fileIcon = (contentType) => {
        switch (contentType) {
            case 'application/pdf':
                return 'far fa-file-pdf'
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            case 'application/msword':
                return 'far fa-file-word'
            case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            case 'application/vnd.ms-excel':
                return 'far fa-file-excel'
            case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            case 'application/vnd.ms-powerpoint':
                return 'far fa-file-powerpoint'
            default:
                return 'far fa-file-alt'
        }
    }

    const filenameFromHeader = (contentDisposition) => {
        if (typeof contentDisposition !== 'string')
            return null
        const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
        if (encoded?.[1]) {
            const raw = encoded[1].replace(/"/g, '')
            try {
                return decodeURIComponent(raw)
            } catch {
                return raw
            }
        }
        return contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] ?? null
    }

    // Files are served behind authentication, so they are fetched as blobs instead of plain links
    const downloadRessource = async (ressource) => {
        try {
            const response = await downloadRessourceFile(ressource.RessourceID, {
                external: props.external,
                accessKey: props.accessKey,
            })
            const contentType = response?.headers?.['content-type'] || ressource.content_type || 'application/octet-stream'
            const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: contentType }))
            const link = document.createElement('a')
            link.href = blobUrl
            link.download = filenameFromHeader(response?.headers?.['content-disposition']) || ressource.filename || ressource.name || 'download'
            document.body.appendChild(link)
            link.click()
            link.remove()
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000)
        } catch (error) {
            console.error('Error downloading ressource:', error)
        }
    }

    const toggleResult = async () => {
        if (isUpdating.value)
            return
        isUpdating.value = true
        const result = !props.task.result
        try {
            await updateOpgave(taskId.value, { result })
            emit('result-change', { id: taskId.value, result })
        } catch (error) {
            console.error('Error updating task:', error)
        }
        isUpdating.value = false
    }

    const deleteTask = async () => {
        if (!confirm(`Er du sikker på, at du vil slette denne opgave${isTaskTemplate.value ? 'skabelon' : ''}?`))
            return
        try {
            if (isTaskTemplate.value)
                await deleteOpgaveskabelon(taskId.value)
            else
                await deleteOpgave(taskId.value)
            emit('changed')
        } catch (error) {
            console.error('Error deleting task:', error)
        }
    }

    const deletePendingMail = async (id) => {
        if (!confirm('Er du sikker på, at du vil slette denne mail?'))
            return
        try {
            await deleteMail({ id })
            pendingMails.value = pendingMails.value.filter(mail => mail.id !== id)
        } catch (error) {
            console.error('Error deleting mail:', error)
        }
    }

    const parentQuery = () => {
        if (props.courseId == null)
            return {}
        return props.courseIsTemplate ? { forloebTid: props.courseId } : { forloebId: props.courseId }
    }

    // Remember the card in the current URL so returning from the editor scrolls back to it
    const navigateFromCard = async (location) => {
        await router.replace({ query: { ...route.query, item: taskId.value } })
        router.push(location)
    }

    const gotoRessource = (ressourceId = null) => {
        const query = isTaskTemplate.value
            ? { tid: ressourceId ?? taskId.value, template: true }
            : { id: ressourceId ?? taskId.value }
        Object.assign(query, parentQuery())
        if (ressourceId != null)
            query.edit = true

        const path = isTaskTemplate.value && props.courseId == null ? '/create-ressource' : '/forloeb-overview/create-ressource'
        navigateFromCard({ path, query })
    }

    const gotoTask = () => {
        navigateFromCard({
            path: isTaskTemplate.value ? '/create-opgave' : '/forloeb-overview/create-opgave',
            query: {
                id: taskId.value,
                edit: true,
                template: isTaskTemplate.value,
                prep: props.isPreparation,
                ...parentQuery(),
            },
        })
    }

    const scrollIntoView = async () => {
        await nextTick()
        const element = cardRef.value
        if (!element || element.offsetParent === null)
            return
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element.classList.remove('scroll-flash')
        void element.offsetWidth
        element.classList.add('scroll-flash')
        setTimeout(() => element.classList.remove('scroll-flash'), 2600)
    }

    onMounted(() => {
        if (props.highlight)
            scrollIntoView()
    })

    watch(() => props.highlight, (value, previous) => {
        if (value && !previous)
            scrollIntoView()
    })

    watch(() => props.task.pending_emails, (mails) => {
        pendingMails.value = mails || []
    })
</script>

<template>
    <article ref="cardRef" class="course-task" :class="{ 'is-complete': task.result, 'is-hidden': task.hidden }">
        <div class="task-topline">
            <span class="task-id">{{ isTaskTemplate ? 'OPGAVESKABELON' : 'OPGAVE' }} {{ String(taskId).padStart(2, '0') }}</span>
            <span v-if="timing" class="task-timing" :class="{ 'is-done': task.result && !relativeTiming, 'is-overdue': isOverdue }">{{ timing }}</span>
        </div>

        <div class="task-main">
            <div class="task-body">
                <h4 class="task-title">{{ task.title || 'Opgave uden titel' }}</h4>
                <p v-if="task.beskrivelse" class="task-description">{{ task.beskrivelse }}</p>

                <div v-if="task.resourcer?.length" class="ressource-list">
                    <div v-for="ressource in task.resourcer" :key="ressource.RessourceID" class="ressource">
                        <button v-if="ressource.isFile" type="button" class="ressource-item" @click="downloadRessource(ressource)">
                            <i :class="fileIcon(ressource.content_type)" aria-hidden="true"></i>
                            <span class="ressource-title">{{ ressource.name }}</span>
                            <span class="ressource-address">{{ resourceAddress(ressource) }}</span>
                        </button>
                        <a v-else-if="safeUrl(ressource.url)" class="ressource-item" :href="safeUrl(ressource.url)" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-link" aria-hidden="true"></i>
                            <span class="ressource-title">{{ ressource.name }}</span>
                            <span class="ressource-address">{{ resourceAddress(ressource) }}</span>
                        </a>
                        <span v-else class="ressource-item">
                            <i class="fas fa-link" aria-hidden="true"></i>
                            <span class="ressource-title">{{ ressource.name }}</span>
                            <span class="ressource-address">{{ ressource.url }}</span>
                        </span>
                        <button v-if="canEditResources && !external"
                                type="button"
                                class="ressource-edit"
                                :title="`Redigér ${ressource.name}`"
                                :aria-label="`Redigér ressource ${ressource.name}`"
                                @click="gotoRessource(ressource.RessourceID)">
                            <i class="far fa-edit" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>

                <div v-if="task.note" class="task-note">
                    <div class="task-note-label"><i class="far fa-sticky-note" aria-hidden="true"></i> Note til ansvarlig</div>
                    <p>{{ task.note }}</p>
                </div>

                <ul v-if="task.sent_emails?.length || pendingMails.length" class="task-mails">
                    <li v-for="mail in task.sent_emails" :key="`sent-${mail.id}`">
                        <i class="fas fa-check-circle mail-sent" aria-hidden="true"></i>
                        <span>Notifikation sendt til {{ mailReceiver(mail.description) }} · {{ mail.recipient }}<template v-if="formatBooking(mail.sent)"> · {{ formatBooking(mail.sent) }}</template></span>
                    </li>
                    <li v-for="mail in pendingMails" :key="mail.id">
                        <i class="far fa-clock" aria-hidden="true"></i>
                        <span>Notifikation planlagt til {{ mailReceiver(mail.description) }} · {{ mail.recipient }}</span>
                        <button v-if="isAdmin" type="button" class="mail-delete" title="Slet planlagt mail" aria-label="Slet planlagt mail" @click="deletePendingMail(mail.id)">
                            <i class="fas fa-times" aria-hidden="true"></i>
                        </button>
                    </li>
                </ul>
            </div>

            <button v-if="canComplete"
                    type="button"
                    class="task-completion"
                    :class="{ 'is-complete': task.result }"
                    :disabled="isUpdating"
                    :aria-pressed="task.result"
                    :aria-label="`${task.result ? 'Markér som ikke gennemført' : 'Markér som gennemført'}: ${task.title}`"
                    :title="task.result ? 'Markér som ikke gennemført' : 'Markér som gennemført'"
                    @click="toggleResult">
                <i class="fas fa-check" aria-hidden="true"></i>
            </button>
        </div>

        <div class="task-footer">
            <router-link v-if="showCourse && courseLink" class="footer-course" :to="courseLink" title="Åbn forløbet">
                <i class="far fa-folder-open" aria-hidden="true"></i> {{ task.name || 'Gå til forløb' }}
            </router-link>
            <span v-if="task.ansvarlig" title="Ansvarlig medarbejder"><i class="far fa-user" aria-hidden="true"></i> {{ firstAndLastName(task.ansvarlig) }}</span>
            <span v-if="task.booking && !relativeTiming && formatBooking(task.booking)" title="Booking"><i class="far fa-calendar-alt" aria-hidden="true"></i> {{ formatBooking(task.booking) }}</span>
            <span v-if="relativeTiming && task.relativ_slutdag" title="Varighed"><i class="far fa-clock" aria-hidden="true"></i> {{ formatDays(task.relativ_slutdag) }}</span>
            <span v-if="task.hidden" class="footer-hidden" title="Opgaven vises kun for administratorer og den ansvarlige"><i class="fas fa-eye-slash" aria-hidden="true"></i> Skjult for medarbejder</span>

            <template v-if="!external && (canEditResources || canManage)">
                <div class="filler"></div>
                <button v-if="canEditResources" type="button" class="footer-action" @click="gotoRessource()"><i class="fas fa-plus" aria-hidden="true"></i> Tilføj ressource</button>
                <button v-if="canManage" type="button" class="footer-action" @click="gotoTask"><i class="far fa-edit" aria-hidden="true"></i> Redigér opgave</button>
                <button v-if="canManage" type="button" class="footer-action footer-action-danger" @click="deleteTask"><i class="far fa-trash-alt" aria-hidden="true"></i> Slet opgave</button>
            </template>
        </div>
    </article>
</template>

<style scoped>
    .course-task { padding: 20px 22px 21px; min-width: 0; background: #fff; }
    .course-task + .course-task { border-top: 1px solid var(--line); }
    .course-task.is-complete { background: var(--wash2); }
    .course-task.is-complete .task-title { color: var(--muted); }
    .task-topline { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px 16px; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .04em; }
    .task-id { color: var(--green); }
    .task-timing { font-weight: 600; }
    .task-timing.is-done { color: var(--green); }
    .task-timing.is-overdue { color: #b94e3f; }
    .task-main { display: flex; align-items: center; gap: 20px; }
    .task-body { flex: 1; min-width: 0; }
    .task-title { margin-top: 11px; }
    .task-description { margin-top: 7px; color: var(--text); font-size: 12px; line-height: 1.65; white-space: pre-line; overflow-wrap: anywhere; }

    .task-completion { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border: 1px solid #a9bcb1; border-radius: 3px; background: #fff; color: var(--green); cursor: pointer; }
    .task-completion i { opacity: 0; }
    .task-completion:hover { border-color: var(--green); background: var(--wash); }
    .task-completion:hover i { opacity: 1; }
    .task-completion.is-complete { border-color: var(--green); background: var(--green); color: #fff; }
    .task-completion.is-complete i { opacity: 1; }
    .task-completion:disabled { cursor: progress; }
    .task-completion:focus-visible { outline: 2px solid var(--green); outline-offset: 3px; }

    .ressource-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .ressource { display: flex; min-width: 0; max-width: 100%; }
    .ressource-item { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 3px 9px; min-width: 0; max-width: 100%; padding: 9px 12px; border: 1px solid var(--line); border-radius: 3px; background: var(--wash); color: var(--ink); font-size: 12px; text-align: left; cursor: pointer; transition: background-color 150ms ease, border-color 150ms ease; }
    span.ressource-item { cursor: default; }
    .ressource-item i { grid-row: span 2; align-self: start; margin-top: 2px; color: var(--green); }
    .ressource-title { font-weight: 700; line-height: 1.3; }
    .ressource-address { min-width: 0; color: var(--muted); font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
    .ressource-item:hover { background: #dcece4; border-color: var(--line-strong); }
    .ressource-item:focus-visible, .ressource-edit:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
    .ressource:has(.ressource-edit) .ressource-item { border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .ressource-edit { display: grid; place-items: center; width: 32px; flex: none; border: 1px solid var(--line); border-left: 0; border-radius: 0 3px 3px 0; background: #fff; color: var(--muted); cursor: pointer; }
    .ressource-edit:hover { background: var(--wash); color: var(--green); }

    .task-note { margin-top: 16px; padding: 12px 15px; border: 1px solid #e5dfb5; border-left: 3px solid #c5aa52; border-radius: 3px; background: #faf8e9; color: #514e39; }
    .task-note-label { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; color: #79672d; font-size: 11px; font-weight: 700; }
    .task-note p { font-size: 12px; line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere; }

    .task-mails { display: flex; flex-direction: column; gap: 4px; margin: 14px 0 0; padding: 0; list-style: none; color: var(--muted); font-size: 11px; }
    .task-mails li { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .task-mails li span { min-width: 0; overflow-wrap: anywhere; }
    .task-mails .mail-sent { color: var(--green); }
    .mail-delete { display: grid; place-items: center; flex: none; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--danger); cursor: pointer; }
    .mail-delete:hover { background: var(--danger-wash); }

    .task-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 16px; padding-top: 13px; border-top: 1px solid #eef1ed; color: #627870; font-size: 11px; }
    .task-footer:not(:has(> *)) { display: none; }
    .task-footer span, .task-footer a { display: inline-flex; align-items: center; gap: 8px; }
    .footer-course { color: var(--green); font-weight: 700; }
    .footer-course:hover { text-decoration: underline; }
    .footer-hidden { color: #8a6d2f; }
    .filler { flex-grow: 1; }
    .footer-action { display: inline-flex; align-items: center; gap: 8px; padding: 8px 10px; border: 0; border-radius: 3px; background: transparent; color: var(--green); font-size: 11px; font-weight: 500; cursor: pointer; transition: background-color 150ms ease, color 150ms ease; }
    .footer-action:hover { background: var(--wash); color: var(--green-dark); }
    .footer-action:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
    .footer-action-danger { color: var(--danger); }
    .footer-action-danger:hover { background: var(--danger-wash); color: var(--danger-strong); }

    @media (max-width: 520px) {
        .course-task { padding: 18px; }
        .filler { display: none; }
    }
</style>
