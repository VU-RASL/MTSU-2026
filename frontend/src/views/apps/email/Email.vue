<script setup lang="ts">
import { ref } from 'vue';
// common components
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatDetail from '@/components/apps/chats/ChatDetail.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';

// theme breadcrumb
const page = ref({ title: 'Email app' });

const breadcrumbs = ref([
    {
        text: 'Look at Inbox',
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

    <v-card elevation="10" class="inside-left-sidebar">
        <AppBaseCard>
            <template v-slot:leftpart>
                test
            </template>
            <template v-slot:rightpart>
                test
            </template>

            <template v-slot:mobileLeftContent>
               test
            </template>
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
