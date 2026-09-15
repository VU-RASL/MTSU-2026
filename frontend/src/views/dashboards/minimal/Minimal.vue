<script setup lang="ts">
import { ref } from "vue";

import BaseBreadcrumb from "@/components/shared/BaseBreadcrumb.vue";
import TheEarningCard from "@/components/dashboards/minimal/TheEarningCard.vue";
import TheSalesOverview from "@/components/dashboards/minimal/TheSalesOverview.vue";
import Visits from "@/components/dashboards/minimal/Visits.vue";
import EarningReportTable from "@/components/dashboards/minimal/EarningReportTable.vue";
import RecentComments from "@/components/dashboards/minimal/RecentComments.vue";
import TheBandwidthUsage from "@/components/dashboards/analytical/TheBandwidthUsage.vue";
import TheDownloadCount from "@/components/dashboards/analytical/TheDownloadCount.vue";
import TheSocialCount from "@/components/dashboards/minimal/TheSocialCount.vue";
import TheProfileCard from '@/components/dashboards/analytical/TheProfileCard.vue';
import TheMyContacts from '@/components/dashboards/analytical/TheMyContacts.vue';
import TheActivityTimeline from '@/components/dashboards/analytical/TheActivityTimeline.vue'

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
        <!---Earning card---->
        <v-col cols="12" lg="12">
            <TheEarningCard />
        </v-col>
        <!---Sales Overview---->
        <v-col cols="12" lg="8">
            <TheSalesOverview />
        </v-col>
        <!---Visits---->
        <v-col cols="12" lg="4">
            <Visits />
        </v-col>
        <!---EarningReport---->
        <v-col cols="12" lg="6">
            <EarningReportTable />
        </v-col>
        <!---TheRecentComments---->
        <v-col cols="12" lg="6">
            <RecentComments />
        </v-col>
        <!---Bandwidth usage--->
        <v-col cols="12" sm="12" lg="4">
            <TheBandwidthUsage />
        </v-col>
        <!---Download count--->
        <v-col cols="12" sm="12" lg="4">
            <TheDownloadCount />
        </v-col>
        <!---TheSocial Count--->
        <v-col cols="12" sm="12" lg="4">
            <TheSocialCount />
        </v-col>
        <!---Profile card /my contacts--->
        <v-col cols="12" sm="12" lg="4">
            <TheProfileCard />
            <div class="mt-7"></div>
            <TheMyContacts />
        </v-col>
        <!---Activity timeline tabs--->
        <v-col cols="12" sm="12" lg="8">
            <TheActivityTimeline />
        </v-col>
    </v-row>
</template>
