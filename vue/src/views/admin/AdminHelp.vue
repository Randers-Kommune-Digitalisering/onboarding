<script setup>
    import { ref } from 'vue'
    import { getUserInfo } from '@/services/keycloakService.js'
    import PageHeader from '@/components/PageHeader.vue'

    const userFullName = ref('')

    getUserInfo().then(userInfo => {
        userFullName.value = userInfo.name || ''
    }).catch(error => {
        console.error('Error fetching user info:', error)
    })
</script>

<template>
    <PageHeader eyebrow="HJÆLP" title="Sådan bruger du onboardingmodulet" />

    <div class="page-content shell-width">
        <div class="help-content">
            <section>
                <h3>Introduktion</h3>
                <p>Hej{{ userFullName ? ` ${userFullName}` : '' }}!</p>
                <p>
                    Du er logget ind som en leder (administrator),
                    og har derfor adgang til de onboardingforløb, som du er ansvarlig for,
                    samt opgaver som du er ansvarlig for at hjælpe nye medarbejdere med.
                </p>
            </section>

            <section>
                <h3>Overblik</h3>
                <p>
                    Som leder kan du se de onboardingforløb, som du er ansvarlig for, under <router-link to="/admin-overview">Overblik</router-link>.
                </p>
                <p>
                    Her kan du følge med i, hvordan onboardingforløbene skrider frem,
                    og se hvilke opgaver der er blevet gennemført af de nye medarbejdere.
                </p>
            </section>

            <section>
                <h3>Åbne forløb</h3>
                <p>
                    De forløb og skabeloner, du åbner, vises som faner under menuen, så du hurtigt kan skifte mellem dem
                    – også midt i redigeringen af en opgave. Brug plus-knappen til at søge efter og åbne et forløb.
                    Du kan have op til 12 forløb åbne ad gangen.
                </p>
            </section>

            <section>
                <h3>Mine ansvar</h3>
                <p>
                    Hvis en leder har givet dig ansvar for at hjælpe en ny medarbejder med en specifik opgave i forbindelse med deres onboardingforløb,
                    kan du finde det under <router-link to="/ansvarlig-overview">Mine ansvar</router-link>.
                </p>
                <p>
                    Vær opmærksom på, at det er dit ansvar at markere opgaverne som færdige, efter at du har hjulpet den nye medarbejder.
                    Det gør du ved at klikke på flueben-knappen til højre for opgaven.
                </p>
            </section>
        </div>
    </div>
</template>
