<script setup>
    import { onBeforeUnmount, ref, watch } from 'vue'

    import TaskCard from '@/components/TaskCard.vue'

    const props = defineProps({
        sections: {
            type: Array,
            required: true
        },
        // Prefixes element ids so several mounted course tabs never collide
        idPrefix: {
            type: String,
            required: true
        },
        active: {
            type: Boolean,
            default: true
        },
        isPreparation: {
            type: Boolean,
            default: false
        },
        userInfo: {
            type: Object,
            default: null
        },
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
        external: {
            type: Boolean,
            default: false
        },
        accessKey: {
            type: String,
            default: null
        },
        scrollToItem: {
            type: Number,
            default: null
        },
        footnote: {
            type: String,
            default: null
        }
    })

    const emit = defineEmits(['result-change', 'changed'])

    const navRef = ref(null)
    const activeSection = ref(props.sections[0]?.id ?? null)
    let scrollFrame = 0

    const sectionElementId = (id) => `${props.idPrefix}-${id}`
    const countLabel = (count) => `${count} ${count === 1 ? 'opgave' : 'opgaver'}`
    const taskKey = (task) => task.OpgaveID ?? task.OpgaveskabelonID

    function updateActiveSection() {
        const threshold = Math.min(180, window.innerHeight * 0.35)
        for (const section of [...props.sections].reverse()) {
            const element = document.getElementById(sectionElementId(section.id))
            if (element && element.getBoundingClientRect().top <= threshold) {
                activeSection.value = section.id
                return
            }
        }
        activeSection.value = props.sections[0]?.id ?? null
    }

    function onScroll() {
        if (scrollFrame)
            return
        scrollFrame = requestAnimationFrame(() => {
            scrollFrame = 0
            updateActiveSection()
        })
    }

    function scrollToSection(id) {
        activeSection.value = id
        document.getElementById(sectionElementId(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const addListeners = () => {
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        requestAnimationFrame(updateActiveSection)
    }

    const removeListeners = () => {
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', onScroll)
        cancelAnimationFrame(scrollFrame)
        scrollFrame = 0
    }

    watch(() => props.active, (active) => active ? addListeners() : removeListeners(), { immediate: true })

    watch(() => props.sections.map(section => section.id).join(), () => {
        activeSection.value = props.sections[0]?.id ?? null
        if (props.active)
            requestAnimationFrame(updateActiveSection)
    })

    // Keep the active link visible in the horizontally scrolling mobile nav
    watch(activeSection, (id) => {
        const nav = navRef.value
        const link = nav?.querySelector(`[data-section="${id}"]`)
        if (!link || nav.scrollWidth <= nav.clientWidth)
            return
        const navRect = nav.getBoundingClientRect()
        const linkRect = link.getBoundingClientRect()
        if (linkRect.left < navRect.left)
            nav.scrollLeft += linkRect.left - navRect.left
        if (linkRect.right > navRect.right)
            nav.scrollLeft += linkRect.right - navRect.right
    })

    onBeforeUnmount(removeListeners)
</script>

<template>
    <div class="course-layout">
        <div class="course-tasks">
            <section v-for="(section, index) in sections"
                     :id="sectionElementId(section.id)"
                     :key="section.id"
                     class="course-task-container"
                     :aria-labelledby="`${sectionElementId(section.id)}-title`">
                <div class="section-heading">
                    <div class="section-identity">
                        <span class="section-number">0{{ index + 1 }}</span>
                        <div>
                            <span class="eyebrow">{{ section.label }}</span>
                            <h3 :id="`${sectionElementId(section.id)}-title`">{{ section.title }}</h3>
                        </div>
                    </div>
                    <span class="section-count">{{ countLabel(section.tasks.length) }}</span>
                </div>

                <div v-if="section.groups.length" class="task-groups">
                    <div v-for="group in section.groups" :key="group.key" class="task-group" :class="{ 'is-ungrouped': !group.name }">
                        <div v-if="group.name" class="group-heading">
                            <i class="far fa-folder" aria-hidden="true"></i>
                            <span>{{ group.name }}</span>
                            <span class="group-count">{{ group.items.length }}</span>
                        </div>
                        <div class="task-list">
                            <TaskCard v-for="task in group.items"
                                      :key="taskKey(task)"
                                      :task="task"
                                      :userInfo="userInfo"
                                      :courseId="courseId"
                                      :courseIsTemplate="courseIsTemplate"
                                      :courseUsermail="courseUsermail"
                                      :isPreparation="isPreparation"
                                      :external="external"
                                      :accessKey="accessKey"
                                      :highlight="active && scrollToItem === taskKey(task)"
                                      @result-change="emit('result-change', $event)"
                                      @changed="emit('changed')" />
                        </div>
                    </div>
                </div>
                <div v-else class="empty-section"><i :class="['fas', section.icon]" aria-hidden="true"></i> Ingen opgaver lige nu</div>
            </section>
        </div>

        <aside class="course-types" aria-label="Opgavesektioner">
            <div class="types-sticky">
                <span class="nav-eyebrow">NAVIGÉR I FORLØBET</span>
                <nav ref="navRef" class="type-nav" aria-label="Opgavesektioner">
                    <a v-for="(section, index) in sections"
                       :key="section.id"
                       :href="`#${sectionElementId(section.id)}`"
                       :data-section="section.id"
                       class="course-type"
                       :class="{ active: activeSection === section.id }"
                       :aria-current="activeSection === section.id ? 'location' : undefined"
                       @click.prevent="scrollToSection(section.id)">
                        <span class="nav-index">0{{ index + 1 }}</span>
                        <span class="nav-detail"><strong>{{ section.title }}</strong><small>{{ countLabel(section.tasks.length) }}</small></span>
                        <i class="fas fa-arrow-right nav-arrow" aria-hidden="true"></i>
                    </a>
                </nav>
                <div v-if="footnote" class="nav-footnote"><span class="status-dot"></span> {{ footnote }}</div>
            </div>
        </aside>
    </div>
</template>

<style scoped>
    .course-layout { display: grid; grid-template-columns: minmax(0, 1fr) 232px; gap: 52px; align-items: start; }
    .course-tasks { min-width: 0; }
    .course-task-container { position: relative; padding-block: 35px 42px; scroll-margin-top: calc(var(--site-shell-height) + 12px); }
    .course-task-container ~ .course-task-container { margin-top: 15rem; border-top: 1px solid var(--line-strong); }
    .course-task-container ~ .course-task-container::before { content: ''; position: absolute; top: -1px; left: 100%; width: 52px; border-top: 1px solid var(--line-strong); }
    .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 23px; }
    .section-identity { display: flex; align-items: center; gap: 15px; }
    .section-identity h3 { margin-top: 4px; }
    .section-number { display: grid; place-items: center; width: 37px; height: 37px; flex: none; border: 1px solid #c5dcd0; background: var(--wash); color: var(--green); font-size: 11px; font-weight: 700; }
    .section-count { padding-bottom: 4px; color: var(--muted); font-size: 12px; white-space: nowrap; }

    .course-types { align-self: stretch; border-left: 1px solid var(--line); }
    .types-sticky { position: sticky; top: calc(var(--site-shell-height) + 24px); padding-top: 38px; }
    .nav-eyebrow { display: block; margin-bottom: 21px; padding-left: 23px; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .09em; }
    .type-nav { position: relative; display: flex; flex-direction: column; }
    .type-nav::before { content: ''; position: absolute; top: 25px; bottom: 25px; left: 0; width: 1px; background: #bfd6c7; }
    .course-type { position: relative; display: flex; align-items: center; gap: 12px; min-height: 68px; padding: 11px 6px 11px 23px; color: #60736b; }
    .course-type::before { content: ''; position: absolute; top: 50%; left: -1px; width: 13px; border-top: 1px solid #bfd6c7; }
    .course-type.active::after { content: ''; position: absolute; top: 12px; bottom: 12px; left: -2px; width: 3px; background: var(--green); }
    .course-type:hover, .course-type.active { background: var(--wash); color: var(--green); }
    .course-type:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
    .nav-index { font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; opacity: .5; }
    .nav-detail { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
    .nav-detail strong { color: var(--ink); font-size: 12px; line-height: 1.3; }
    .course-type.active .nav-detail strong { color: var(--green); }
    .nav-detail small { color: var(--muted); font-size: 11px; }
    .nav-arrow { margin-left: auto; padding-right: 2px; font-size: 10px; opacity: 0; }
    .course-type:hover .nav-arrow, .course-type.active .nav-arrow { opacity: 1; }
    .nav-footnote { display: flex; align-items: center; gap: 9px; margin: 26px 0 0 23px; padding-top: 18px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; line-height: 1.4; }

    @media (max-width: 760px) {
        .course-layout { grid-template-columns: minmax(0, 1fr); gap: 0; }
        .course-task-container { scroll-margin-top: calc(var(--site-shell-height) + 56px); }
        .course-task-container ~ .course-task-container { margin-top: 6rem; }
        .course-task-container ~ .course-task-container::before { display: none; }
        .course-types { position: sticky; top: var(--site-shell-height); z-index: 5; order: -1; margin-inline: -24px; padding-inline: 24px; border-left: 0; border-bottom: 1px solid var(--line); background: #f5f7f5; }
        .types-sticky { position: static; padding-top: 0; }
        .nav-eyebrow, .nav-footnote, .nav-index, .nav-arrow { display: none; }
        .type-nav { flex-direction: row; overflow-x: auto; scrollbar-width: none; }
        .type-nav::-webkit-scrollbar { display: none; }
        .type-nav::before, .course-type::before { display: none; }
        .course-type { flex: 1 0 auto; min-height: 52px; padding: 9px 14px; }
        .course-type.active::after { top: auto; right: 10px; bottom: 0; left: 10px; width: auto; height: 3px; }
        .nav-detail { gap: 2px; }
    }

    @media (max-width: 520px) {
        .course-types { margin-inline: -16px; padding-inline: 16px; }
        .section-heading { align-items: start; }
        .section-count { padding-top: 8px; }
    }
</style>
