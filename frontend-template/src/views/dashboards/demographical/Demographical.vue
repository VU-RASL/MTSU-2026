<script setup lang="ts">
import { ref } from "vue";
import BaseBreadcrumb from "@/components/shared/BaseBreadcrumb.vue";
import ThePieCards from "@/components/dashboards/demographical/ThePieCards.vue";
import NewsletterCampaign from "@/components/dashboards/analytical/NewsletterCampaign.vue";
import TheProfileCard from "@/components/dashboards/analytical/TheProfileCard.vue";
import TheBandwidthUsage from "@/components/dashboards/analytical/TheBandwidthUsage.vue";
import TheDownloadCount from "@/components/dashboards/analytical/TheDownloadCount.vue";
import TheMyContacts from "@/components/dashboards/demographical/TheMyContacts.vue";
import TheFeed from "@/components/dashboards/demographical/TheFeed.vue";
import TheRecentComments from "@/components/dashboards/minimal/RecentComments.vue";
import TheTodoList from "@/components/dashboards/analytical/ToDoList.vue";

const page = ref({ title: "Demographical" });
const breadcrumbs = ref([
    {
        text: "Dashboard",
        disabled: false,
        href: "#",
    },
    {
        text: "Demographical",
        disabled: true,
        href: "#",
    },
]);
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <!---Chart pie cards---->
        <v-col col="12" sm="12" lg="12">
            <ThePieCards />
        </v-col>
        <!---Newsletter campaign---->
        <v-col cols="12" sm="12" lg="8">
            <NewsletterCampaign />
        </v-col>
        <!---Profile card---->
        <v-col cols="12" sm="12" lg="4">
            <TheProfileCard />
        </v-col>
        <!---Bandwidth usage / Download count--->
        <v-col cols="12" sm="12" lg="4">
            <TheBandwidthUsage />
            <div class="mt-7"></div>
            <TheDownloadCount />
        </v-col>
        <!---My contacts--->
        <v-col cols="12" sm="12" lg="4">
            <TheMyContacts />
        </v-col>
        <!---Feeds--->
        <v-col cols="12" sm="12" lg="4">
            <TheFeed />
        </v-col>
        <!---Recent comments--->
        <v-col cols="12" sm="12" lg="6">
            <TheRecentComments />
        </v-col>
        <!---To do list--->
        <v-col cols="12" sm="12" lg="6">
            <TheTodoList />
        </v-col>
    </v-row>
</template>
