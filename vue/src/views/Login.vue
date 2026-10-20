<script setup>
    import { onMounted } from 'vue'
    import { useRouter } from 'vue-router'
    import { getUserInfo } from '@/services/keycloakService.js'

    const router = useRouter()

    onMounted(async () => {
        try {
            const userInfo = await getUserInfo()
            if (userInfo?.email)
                router.replace(router.options.history.state.back || '/')
        } catch (error) {
            console.error(error)
        }
    })
</script>

<template>
    <main class="login-page">
        <div class="login-card">
            <span class="login-mark" aria-hidden="true">O</span>
            <span class="eyebrow">ONBOARDING</span>
            <h1>Du er ikke logget ind</h1>
            <p>Log ind for at se dine onboardingforløb og opgaver.</p>
            <a class="action action-primary" href="/login">Log ind med KOMBIT</a>
        </div>
    </main>
</template>

<style scoped>
    .login-page { display: grid; place-items: center; min-height: 100vh; padding: 24px; }
    .login-card { display: flex; flex-direction: column; align-items: center; gap: 12px; width: min(420px, 100%); padding: 40px 32px; border: 1px solid var(--line); background: #fff; text-align: center; }
    .login-card p { margin-bottom: 8px; color: var(--muted); font-size: 13px; }
    .login-mark { display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 6px; background: var(--green); color: #fff; font-size: 22px; font-weight: 700; }
</style>
