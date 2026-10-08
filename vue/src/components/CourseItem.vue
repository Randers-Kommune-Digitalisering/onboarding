<script setup>
    import { computed, onMounted, ref } from 'vue'

    import { getOpgaverByForloebID, getOpgaverByForloebsskabelonID } from '@/services/opgaveService.js'
    import { completionPercentage } from '@/utils/taskSections.js'

    const props = defineProps({
        course: {
            type: Object,
            required: true
        }
    })

    const tasks = ref(null)

    const isTemplate = computed(() => props.course.ForløbsskabelonID != null && props.course.ForløbID == null)
    const id = computed(() => isTemplate.value ? props.course.ForløbsskabelonID : props.course.ForløbID)
    const link = computed(() => `/forloeb-overview?${isTemplate.value ? 'tid' : 'id'}=${id.value}`)
    const hasStarted = computed(() => !isTemplate.value && !props.course.isPreparation && !!props.course.startdate && new Date(props.course.startdate) <= new Date())
    const isCompleted = computed(() => !isTemplate.value && !props.course.isPreparation && !!props.course.enddate && new Date(props.course.enddate) < new Date())
    const progress = computed(() => completionPercentage(tasks.value || []))
    const markClass = computed(() => ({
        'is-template': isTemplate.value,
        'is-preparation': !isTemplate.value && props.course.isPreparation === true,
        'is-completed': isCompleted.value,
    }))

    const formatDate = (value) => value ? new Date(value).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'
    const countLabel = (count) => `${count} ${count === 1 ? 'opgave' : 'opgaver'}`

    onMounted(async () => {
        // Progress and task counts are only shown where they add information
        if (!isTemplate.value && !hasStarted.value && !props.course.isPreparation)
            return
        try {
            const response = isTemplate.value
                ? await getOpgaverByForloebsskabelonID(id.value)
                : await getOpgaverByForloebID(id.value)
            tasks.value = [response?.data ?? []].flat()
        } catch (error) {
            console.error('Error fetching tasks for course row:', error)
        }
    })
</script>

<template>
    <router-link class="course-row" :class="{ 'is-complete': isCompleted }" :to="link">
        <span class="row-mark course-mark" :class="markClass" aria-hidden="true">{{ isTemplate ? 'S' : 'F' }}<span>{{ String(id).padStart(2, '0') }}</span></span>

        <span class="row-main">
            <span class="row-title">{{ course.name || (isTemplate ? 'Skabelon uden titel' : 'Forløb uden titel') }}</span>
            <span class="row-sub">
                <template v-if="!isTemplate">{{ course.userdq || course.usermail }}</template>
                <template v-else>{{ course.varighed ?? 0 }} dage</template>
            </span>
        </span>

        <span class="row-meta">
            <span v-if="course.isPreparation" class="status-tag"><span class="status-dot"></span>Under forberedelse</span>
            <template v-else-if="!isTemplate">
                <span class="row-dates"><i class="far fa-calendar-alt" aria-hidden="true"></i> {{ formatDate(course.startdate) }} – {{ formatDate(course.enddate) }}</span>
            </template>
            <span v-if="(isTemplate || course.isPreparation) && tasks" class="row-count">{{ countLabel(tasks.length) }}</span>
            <span v-if="hasStarted && tasks" class="progress" :title="`${progress}% gennemført`">
                <span class="progress-track"><span class="progress-fill" :style="{ width: `${progress}%` }"></span></span>
                <span class="progress-value">{{ progress }}%</span>
            </span>
        </span>

        <i class="fas fa-arrow-right row-arrow" aria-hidden="true"></i>
    </router-link>
</template>

<style scoped>
    .course-row { display: flex; align-items: center; gap: 16px; min-height: 68px; padding: 12px 18px; color: var(--ink); transition: background-color 150ms ease; }
    .course-row + .course-row { border-top: 1px solid var(--line); }
    .course-row:hover { background: var(--wash2); }
    .course-row:hover .row-arrow { opacity: 1; transform: translateX(2px); }
    .course-row:focus-visible { outline: 2px solid var(--green); outline-offset: -2px; }
    .row-mark { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: none; width: 40px; height: 40px; font: 700 15px/1 var(--font); }
    .row-mark span { margin-top: 3px; font-size: 8px; letter-spacing: .08em; }
    .row-main { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
    .row-title { overflow: hidden; font-size: 14px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .row-sub { overflow: hidden; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .row-meta { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px 16px; color: var(--muted); font-size: 11px; }
    .row-dates { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .row-count { white-space: nowrap; }
    .progress-value { display: inline-block; min-width: 4ch; text-align: right; font-variant-numeric: tabular-nums; }
    .row-arrow { flex: none; color: var(--green); font-size: 11px; opacity: .35; transition: opacity 150ms ease, transform 150ms ease; }

    @media (max-width: 620px) {
        .course-row { flex-wrap: wrap; }
        .row-main { flex-basis: calc(100% - 90px); }
        .row-meta { justify-content: flex-start; flex-basis: 100%; padding-left: 56px; }
        .row-arrow { display: none; }
    }
</style>
