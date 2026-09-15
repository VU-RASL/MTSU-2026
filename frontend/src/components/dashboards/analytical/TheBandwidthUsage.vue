<script setup lang="ts">
import { ref,onMounted, computed } from "vue";
const chartOptions = computed(() => {
    return {
        series: [
            {
                name: "",
                data: [5, 0, 12, 1, 8, 3, 12, 15],
            },
        ],

        colors: ["#fff"],
        grid: {
            show: false,
            padding: {
                left: 0,
                right: 0,
            },
        },
        chart: {
            toolbar: {
                show: false,
            },
            sparkline: {
                enabled: true,
            },
        },
        dataLabels: {
            enabled: false,
        },
        stroke: {
            curve: "smooth",
            width: 3,
            colors: "rgba(255, 255, 255, 0.5)",
        },
        tooltip: {
            theme: "dark",
        },
    }
});
const Chart = {
  series: [
    { name: "Ample", data: [355, 390, 300, 350, 390, 180, 250] },
    { name: "Pixel", data: [280, 250, 325, 215, 250, 310, 170] },
  ],
};
const elementVisible = ref(false);
onMounted(() => {
  setTimeout(() => (elementVisible.value = true), 10);
});
</script>
<template>
    <VCard elevation="10" class="overflow-hidden">
        <v-card-text class="bg-primary">
            <div class="d-flex align-center">
                <v-icon size="30">mdi-chart-donut</v-icon>
                <div class="mx-4">
                    <h3 class="text-h5">Bandwidth usage</h3>
                    <div class="text-subtitle-1">March 2021</div>
                </div>
            </div>
            <v-row class="mt-1">
                <v-col cols="5" class="d-flex align-center">
                    <h2 class="font-weight-light white--text text-nowrap">50 GB</h2>
                </v-col>
                <v-col cols="7">
                    <div class="float-right" v-show="elementVisible">
                        <apexchart type="line" height="70px" width="150px" :options="chartOptions"
                            :series="chartOptions.series"></apexchart>
                    </div>
                </v-col>
            </v-row>
        </v-card-text>
    </VCard>
</template>
