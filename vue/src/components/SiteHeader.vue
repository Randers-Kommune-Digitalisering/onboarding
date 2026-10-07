<script setup>
    import { computed, ref, watch } from 'vue'
    import { useRoute } from 'vue-router'

    const props = defineProps({
        userInfo: {
            type: Object,
            default: null
        }
    })

    const route = useRoute()
    const mobileMenuOpen = ref(false)

    const adminLinks = [
        { title: 'Overblik', to: '/admin-overview' },
        { title: 'Mine ansvar', to: '/ansvarlig-overview' },
        { title: 'Opret forløb', to: '/create-forloeb' },
        { title: 'Skabeloner', to: '/template-overview' },
        { title: 'Hjælp', to: '/admin-help' },
    ]

    const medarbejderLinks = [
        { title: 'Mit forløb', to: '/medarbejder-overview' },
        { title: 'Mine ansvar', to: '/ansvarlig-overview' },
        { title: 'Hjælp', to: '/help' },
    ]

    const links = computed(() => {
        if (props.userInfo?.isAdmin)
            return adminLinks
        if (props.userInfo?.isMedarbejder)
            return medarbejderLinks
        return []
    })

    const homePath = computed(() => links.value[0]?.to ?? '/')

    watch(() => route.fullPath, () => { mobileMenuOpen.value = false })
</script>

<template>
    <div class="site-bar" @keydown.esc="mobileMenuOpen = false">
        <div class="site-bar-inner shell-width">
            <router-link class="site-brand" :to="homePath">
                <span class="site-brand-mark" aria-hidden="true">O</span>
                <span>Onboarding</span>
            </router-link>

            <nav class="site-links" aria-label="Sidenavigation">
                <router-link v-for="link in links" :key="link.to" class="site-link" :to="link.to">{{ link.title }}</router-link>
            </nav>

            <span v-if="userInfo?.email" class="site-account" :title="userInfo.email">
                <i class="far fa-user" aria-hidden="true"></i> {{ userInfo.email }}
            </span>

            <button v-if="links.length"
                    class="site-menu-button"
                    type="button"
                    :aria-expanded="mobileMenuOpen"
                    aria-controls="mobile-site-links"
                    :aria-label="mobileMenuOpen ? 'Luk menu' : 'Åbn menu'"
                    @click="mobileMenuOpen = !mobileMenuOpen">
                <i :class="mobileMenuOpen ? 'fas fa-times' : 'fas fa-bars'" aria-hidden="true"></i>
            </button>
        </div>

        <nav v-if="mobileMenuOpen" id="mobile-site-links" class="mobile-site-links" aria-label="Sidenavigation mobil">
            <router-link v-for="link in links" :key="link.to" :to="link.to">{{ link.title }}</router-link>
            <span v-if="userInfo?.email" class="mobile-account">{{ userInfo.email }}</span>
        </nav>
    </div>
</template>

<style scoped>
    .site-bar { position: relative; background: #fff; border-bottom: 1px solid var(--line); }
    .site-bar-inner { display: flex; align-items: center; gap: 32px; height: 60px; }
    .site-brand { display: inline-flex; align-items: center; gap: 10px; flex: none; color: var(--ink); font-size: 14px; font-weight: 700; }
    .site-brand-mark { display: grid; place-items: center; width: 28px; height: 28px; background: var(--green); color: #fff; font-size: 16px; }
    .site-links { display: flex; align-self: stretch; gap: 5px; min-width: 0; }
    .site-link { display: inline-flex; align-items: center; padding: 0 13px; border-bottom: 2px solid transparent; color: #526b60; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .site-link:hover { color: var(--green); background: var(--wash2); }
    .site-link.router-link-active { border-bottom-color: var(--green); color: var(--green); }
    .site-account { display: inline-flex; align-items: center; gap: 9px; min-width: 0; margin-left: auto; overflow: hidden; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .site-account i { color: var(--green); }
    .site-menu-button, .mobile-site-links { display: none; }
    a:focus-visible, button:focus-visible { outline: 2px solid var(--green); outline-offset: -2px; }

    @media (max-width: 900px) {
        .site-bar-inner { gap: 20px; }
        .site-account { display: none; }
    }

    @media (max-width: 760px) {
        .site-links { display: none; }
        .site-menu-button { display: grid; place-items: center; width: 38px; height: 38px; margin-left: auto; border: 1px solid var(--line); border-radius: 3px; background: #fff; color: var(--green); cursor: pointer; }
        .mobile-site-links { position: absolute; top: 100%; right: 24px; z-index: 30; display: flex; flex-direction: column; width: min(260px, calc(100vw - 48px)); padding: 7px; border: 1px solid var(--line); background: #fff; box-shadow: var(--shadow-pop); }
        .mobile-site-links a { padding: 12px; color: var(--ink); font-size: 13px; }
        .mobile-site-links a:hover, .mobile-site-links a.router-link-active { background: var(--wash); color: var(--green); }
        .mobile-account { margin-top: 4px; padding: 10px 12px 6px; border-top: 1px solid var(--line); overflow: hidden; color: var(--muted); font-size: 11px; text-overflow: ellipsis; }
    }

    @media (max-width: 520px) {
        .mobile-site-links { right: 16px; }
    }
</style>
