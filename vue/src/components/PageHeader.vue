<script setup>
    defineProps({
        eyebrow: {
            type: String,
            default: ''
        },
        title: {
            type: String,
            required: true
        },
        lead: {
            type: String,
            default: ''
        }
    })
</script>

<template>
    <header class="page-header">
        <div class="page-header-inner shell-width">
            <div class="page-heading">
                <div>
                    <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
                    <h1>{{ title }}</h1>
                    <p v-if="lead" class="page-lead">{{ lead }}</p>
                </div>
                <div v-if="$slots.actions" class="page-actions">
                    <slot name="actions" />
                </div>
            </div>
        </div>
    </header>
</template>

<style scoped>
    .page-heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; }
    .page-actions { display: flex; flex-wrap: wrap; gap: 6px; flex: none; }

    @media (max-width: 520px) {
        .page-heading { flex-direction: column; align-items: start; }
    }
</style>
