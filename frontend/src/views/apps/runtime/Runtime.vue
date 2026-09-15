<script setup lang="ts">
import { ref } from 'vue';
// common components
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
// component
import RuntimeConfig from '@/components/apps/runtime/RuntimeConfig.vue';
import WebRTCSession from '@/components/apps/runtime/WebRTCSession.vue';

import { useWebRTCSession } from '@/components/apps/runtime/useWebRTCSession'; // <-- See step 4

const {
  isStartDisabled,
  isStopDisabled,
  sendInterjection,
  listenOnly,
  converse,
  transcript,
  status,
  error,
  init,
  stopRecording,
} = useWebRTCSession();

// theme breadcrumb
const page = ref({ title: 'Sim Runtime' });

const breadcrumbs = ref([
    {
        text: 'Sim Runtime',
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
                <RuntimeConfig
                    :isStartDisabled="isStartDisabled"
                    :isStopDisabled="isStopDisabled"
                    @start="init"
                    @stop="stopRecording"
                    @interject="sendInterjection"
                    @listen="listenOnly"
                    @converse="converse"
                />
            </template>
            <template v-slot:rightpart>
                <WebRTCSession
                    :transcript="transcript"
                    :status="status"
                    :error="error"
                />
            </template>
            <template v-slot:mobileLeftContent>
                <RuntimeConfig
                    :isStartDisabled="isStartDisabled"
                    :isStopDisabled="isStopDisabled"
                    @start="init"
                    @stop="stopRecording"
                    @interject="sendInterjection"
                    @listen="listenOnly"
                    @converse="converse"
                />
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