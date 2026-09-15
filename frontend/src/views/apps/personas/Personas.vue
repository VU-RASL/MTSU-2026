<script setup lang="ts">
import { ref } from 'vue';
// common components
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
// component
import PersonasListing from '@/components/apps/personas/PersonasListing.vue';
import PersonaContent from '@/components/apps/personas/PersonaContent.vue';
// theme breadcrumb
const page = ref({ title: 'Personas' });

const breadcrumbs = ref([
    {
        text: 'Add todo list',
        disabled: true,
        href: '#'
    }
]);
</script>

<template>
    <!-- ---------------------------------------------------- -->
    <!-- Table Basic -->
    <!-- ---------------------------------------------------- -->
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>

    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart> <PersonasListing /></template>
            <template v-slot:rightpart><PersonaContent /> </template>
            <template v-slot:mobileLeftContent><PersonasListing /> </template>
        </AppBaseCard>
    </v-card>
</template>

<style scoped lang="scss">
@media (max-width: 1279px) {
    .v-card {
        position: unset;
    }
}
</style>