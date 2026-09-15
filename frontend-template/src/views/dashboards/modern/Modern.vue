<script setup lang="ts">
import { ref } from "vue";
import BaseBreadcrumb from "@/components/shared/BaseBreadcrumb.vue";
import CongratulationCard from "@/components/dashboards/modern/CongratulationCard.vue";
import Purchases from "@/components/dashboards/modern/Purchases.vue";
import TotalEarnings from "@/components/dashboards/modern/TotalEarnings.vue";
import CurrentVisits from "@/components/dashboards/modern/CurrentVisit.vue"
import MonthlyEarnings from "@/components/dashboards/modern/MonthlyEarnings.vue";
import Customers from "@/components/dashboards/modern/Customers.vue";
import TheWeatherCard from '@/components/dashboards/analytical/TheWeatherCardVue.vue';
import TotalSales from "@/components/dashboards/modern/TotalSales.vue";
import ProductPerformance from "@/components/dashboards/modern/ProductPerformance.vue";
import TheProfileCard from '@/components/dashboards/analytical/TheProfileCard.vue';
import TheMyContacts from '@/components/dashboards/analytical/TheMyContacts.vue';
import TheActivityTimeline from '@/components/dashboards/analytical/TheActivityTimeline.vue'
import TheBlogCard from "@/components/dashboards/minimal/TheBlogCard.vue";
import WeeklyStats from "@/components/dashboards/minimal/WeeklyStats.vue";
import MedicalProBranding from "@/components/dashboards/minimal/MedicalProBranding.vue";

const page = ref({ title: "Modern" });
const breadcrumbs = ref([
    {
        text: "Dashboard",
        disabled: false,
        href: "#",
    },
    {
        text: "Modern",
        disabled: true,
        href: "#",
    },
]);
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <!---Congratulation card---->
        <v-col cols="12" sm="12" lg="5">
            <CongratulationCard />
        </v-col>
        <!---Purchase / Total earnings---->
        <v-col cols="12" sm="12" lg="7">
            <v-row>
                <v-col lg="5">
                    <Purchases />
                </v-col>
                <v-col lg="7">
                    <TotalEarnings />
                </v-col>
            </v-row>
        </v-col>
        <!---Revenue updates---->
        <v-col cols="12" sm="12" lg="8">
            <CurrentVisits />
        </v-col>
        <!---Monthly earnings / Customers---->
        <v-col cols="12" sm="12" lg="4">
            <Customers />
            <MonthlyEarnings />
            <TheWeatherCard class="mt-7"/>
        </v-col>
        <!---Total sales---->
        <v-col cols="12" sm="12" lg="4">
            <TotalSales />
        </v-col>
        <!---Product performence---->
        <v-col cols="12" sm="12" lg="8">
            <ProductPerformance />
        </v-col>
        <!---Profile card / My contact---->
        <v-col cols="12" sm="12" lg="4">
            <TheProfileCard />
            <div class="mt-7"></div>
            <TheMyContacts />
        </v-col>
        <!---Activity timeline---->
        <v-col cols="12" sm="12" lg="8">
            <TheActivityTimeline />
        </v-col>
        <!---Blog card---->
        <v-col cols="12" lg="4">
            <TheBlogCard />
        </v-col>
        <!---Weekly stats---->
        <v-col cols="12" lg="4">
            <WeeklyStats />
        </v-col>
        <!---Mediacal pro branding---->
        <v-col cols="12" lg="4">
            <MedicalProBranding />
        </v-col>
    </v-row>
</template>
