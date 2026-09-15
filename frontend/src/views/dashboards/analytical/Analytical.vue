<script setup lang="ts">
import { ref } from "vue";

import BaseBreadcrumb from "@/components/shared/BaseBreadcrumb.vue";
import UiTittleSubtitleCard from "@/components/shared/UiTittleSubtitleCard.vue";
import TheSalesOverview from "@/components/dashboards/analytical/TheSalesOverview.vue";
import TotalSales from "@/components/dashboards/analytical/TotalSales.vue";
import TheEarningCard from "@/components/dashboards/minimal/TheEarningCard.vue";
import BlogCard from "@/components/dashboards/analytical/BlogCard.vue";
import NewsletterCampaign from "@/components/dashboards/analytical/NewsletterCampaign.vue";
import TheBandwidthUsage from "@/components/dashboards/analytical/TheBandwidthUsage.vue";
import TheDownloadCount from "@/components/dashboards/analytical/TheDownloadCount.vue";
import TheWeatherCard from '@/components/dashboards/analytical/TheWeatherCardVue.vue';
import RecentComments from "@/components/dashboards/minimal/RecentComments.vue";
import ToDoList from "@/components/dashboards/analytical/ToDoList.vue";

const page = ref({ title: "Analytical" });
const breadcrumbs = ref([
  {
    text: "Dashboard",
    disabled: false,
    href: "#",
  },
  {
    text: "Analytical",
    disabled: true,
    href: "#",
  },
]);
</script>

<template>
  <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
  <v-row>
    <!---Sales overview--->
    <v-col cols="12" sm="12" lg="8">
      <TheSalesOverview />
    </v-col>
    <!---Our visiters--->
    <v-col cols="12" sm="12" lg="4">
        <TotalSales />
    </v-col>
    <!---TheEarningCard--->
    <v-col cols="12" class="mt-3">
      <TheEarningCard />
    </v-col>
    <!---Blog cards--->
    <v-col cols="12" sm="12" lg="4">
      <BlogCard />
    </v-col>
    <!---Newsletter Campaign--->
    <v-col cols="12" sm="12" lg="8">
      <NewsletterCampaign />
    </v-col>
    <!---Bandwidth usage--->
    <v-col cols="12" sm="12" lg="4">
      <TheBandwidthUsage />
    </v-col>
    <!---Download count--->
    <v-col cols="12" sm="12" lg="4">
      <TheDownloadCount />
    </v-col>
    <!---Weather Card--->
    <v-col cols="12" sm="12" lg="4">
      <TheWeatherCard />
    </v-col>
    <!---Recent Commments--->
    <v-col cols="12" sm="12" lg="6">
      <RecentComments/>
    </v-col>
    <!---The TodoList--->
    <v-col cols="12" sm="12" lg="6">
      <ToDoList/>
    </v-col>
  </v-row>
</template>
