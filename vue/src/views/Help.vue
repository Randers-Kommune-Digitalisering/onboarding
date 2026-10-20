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
                    Du er logget ind som en almindelig medarbejder,
                    og har derfor adgang til dit eget forløb,
                    samt opgaver som du er ansvarlig for at hjælpe andre med.
                </p>
            </section>

            <section>
                <h3>Mit forløb</h3>
                <p>
                    Hvis du er ny medarbejder eller ny i din nuværende stilling, og har et igangværende onboardingforløb,
                    kan du finde det under <router-link to="/medarbejder-overview">Mit forløb</router-link>.
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

            <section>
                <h3>Åbne forløb</h3>
                <p>
                    De forløb, du åbner, vises som faner under menuen, så du hurtigt kan skifte mellem dem.
                    Brug plus-knappen til at åbne et forløb, og krydset på fanen til at lukke det igen.
                </p>
            </section>
        </div>
    </div>
</template>
