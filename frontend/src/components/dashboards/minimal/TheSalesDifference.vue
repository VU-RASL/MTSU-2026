<script setup lang="ts">
import { ref, computed } from "vue";
import { getPrimary, getSecondary } from '@/utils/UpdateColors';
/*Chart*/
const chartOptions = computed(() => {
    return {
        series: [25, 10],

        labels: ["Increase", "Decrease"],
        dataLabels: {
            enabled: false,
        },
        grid: {
            padding: {
                left: 0,
                right: 0,
            },
        },
        chart: {},
        plotOptions: {
            pie: {
                donut: {
                    size: "60px",
                },
            },
        },
        stroke: {
            width: 0,
        },
        legend: {
            show: false,
        },
        colors: [getSecondary.value, "rgb(242, 244, 248)"],
        tooltip: {
            enabled: true,
            theme: "dark",
            fillSeriesColor: false,
        },
    }
});
</script>
<template>
    <v-card elevation="10">
        <v-card-text class="pa-5">
            <h3 class="text-h5 title mb-1">Sales Difference</h3>
            <v-row class="mt-3">
                <v-col cols="6">
                    <span class="display-3 title">$4316</span>
                    <h6 class="text-subtitle-2 mt-2">10% Increased</h6>
                    <h5 class="text-subtitle-1 font-weight-medium text-no-wrap mt-1">(150-165 Sales)</h5>
                </v-col>
                <v-col cols="6" class="d-flex">
                    <div class="ml-auto mb-9" style="height: 80px">
                        <apexchart type="donut" width="130" :options="chartOptions"
                            :series="chartOptions.series"></apexchart>
                    </div>
                </v-col>
            </v-row>
        </v-card-text>
    </v-card>
</template>

  