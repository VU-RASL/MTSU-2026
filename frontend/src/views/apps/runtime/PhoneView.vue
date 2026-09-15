<script setup lang="ts">
import { ref } from 'vue';
// common components
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
// component
import PhoneConfig from '@/components/apps/runtime/PhoneConfig.vue';


// theme breadcrumb
const page = ref({ title: 'Phone Configuration' });

const breadcrumbs = ref([
    {
        text: 'Phone Configuration',
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
            <template v-slot:leftpart>
                <PhoneConfig/>
            </template>
        </AppBaseCard>
    </v-card>
</template>
