<script setup>
    import CourseItem from './CourseItem.vue'

    defineProps({
        courses: {
            type: Array,
            default: () => []
        },
        title: {
            type: String,
            default: ''
        },
        emptyText: {
            type: String,
            default: 'Ingen forløb fundet.'
        }
    })

    const courseKey = (course) => course.ForløbID != null ? `f-${course.ForløbID}` : `t-${course.ForløbsskabelonID}`
</script>

<template>
    <section class="course-list">
        <div v-if="title" class="section-title">
            <h3>{{ title }}</h3>
            <span class="section-count">{{ courses.length }}</span>
        </div>
        <div v-if="courses.length" class="row-list">
            <CourseItem v-for="course in courses" :key="courseKey(course)" :course="course" />
        </div>
        <div v-else class="empty-section">{{ emptyText }}</div>
    </section>
</template>

<style scoped>
    .course-list + .course-list { margin-top: 44px; }
</style>
