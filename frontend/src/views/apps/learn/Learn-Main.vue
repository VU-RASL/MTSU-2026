<script setup lang="ts">
import { ref } from "vue";

import BaseBreadcrumb from "@/components/shared/BaseBreadcrumb.vue";
import References from '@/components/apps/learn/ReferencesList.vue';

const page = ref({ title: "Minimal" });
const breadcrumbs = ref([
    {
        text: "Dashboard",
        disabled: false,
        href: "#",
    },
    {
        text: "Minimal",
        disabled: true,
        href: "#",
    },
]);
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row class="mt-3">
        
        <!--- References --->
        <v-col cols="12" sm="12" lg="8">
            <References />
        </v-col>
    </v-row>
</template>
