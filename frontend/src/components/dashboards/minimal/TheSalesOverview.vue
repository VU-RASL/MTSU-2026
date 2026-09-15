<script setup lang="ts">
import { ref, computed } from "vue";
import { getPrimary, getSecondary } from '@/utils/UpdateColors';
import type { DotsIcon } from "vue-tabler-icons";
/*Chart*/
const chartOptions = computed(() => {
    return {
        series: [
            {
                name: "Sales",
                data: [0, 150, 110, 240, 200, 200, 300, 200, 380, 300, 400, 380],
            },
            {
                name: "Expense",
                data: [0, 100, 70, 100, 240, 180, 220, 140, 250, 210, 340, 320],
            },
            {
                name: "Earning",
                data: [0, 50, 30, 60, 180, 120, 180, 80, 190, 150, 240, 240],
            },
        ],

        chart: {
            height: 320,
            type: "area",
            stacked: true,
            fontFamily: `inherit`,
            toolbar: {
                show: false,
            },
        },
        dataLabels: {
            enabled: false,
        },
        markers: {
            size: 3,
            strokeColors: "transparent",
        },
        stroke: {
            curve: "smooth",
            width: "2",
        },
        fill: {
            type: "solid",
            colors: ["#e9edf2", getPrimary.value, "#7460ee"],
            opacity: 1,
        },
        colors: ["#e9edf2", getPrimary.value, "#7460ee"],
        legend: {
            show: false,
        },
        grid: {
            padding: { left:25, right: 0, bottom: 0 },
            show: true,
            strokeDashArray: 0,
            borderColor: "rgba(0,0,0,0.1)",
            yaxis: {
                show: false,
            },
        },
        xaxis: {
            type: "category",
            categories: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
            ],
            labels: {
                style: {
                    colors: "#a1aab2",
                },
            },
        },
        yaxis: {
            labels: {
                style: {
                    colors: "#a1aab2",
                },
            },
        },
        tooltip: {
            theme: "dark",
            fillColors: ["#e9edf2", "#398bf7", "#7460ee"],
        },

    }
});
</script>

<template>
    <!-- ------------------------------------ -->
    <!-- html -->
    <!-- ------------------------------------ -->
    <v-card elevation="10">
        <span class="lstick"></span>
        <v-card-text>
            <div class="d-sm-flex align-center">
                <div>
                    <h3 class="text-h5 title mb-1">Sales Overview</h3>
                    <h5 class="text-subtitle-1">Year 2021</h5>
                </div>
                <div class="ml-auto">
                    <div class="d-flex align-center mt-sm-0 mt-3">
                        <div class="d-flex align-baseline">
                            <v-icon color="primary" size="sm">mdi-circle</v-icon>
                            <div class="ml-2">
                                <h3 class="text-subtitle-1 font-weight-medium">10,320</h3>
                                Expense
                            </div>
                        </div>
                        <div class="mx-4 d-flex align-baseline">
                            <v-icon color="info" size="sm">mdi-circle</v-icon>
                            <div class="ml-2">
                                <h3 class="text-subtitle-1 font-weight-medium">13,200</h3>
                                Earning
                            </div>
                        </div>
                        <div class="d-flex align-baseline">
                            <v-icon color="" size="sm">mdi-circle</v-icon>
                            <div class="ml-2">
                                <h3 class="text-subtitle-1 font-weight-medium">15,200</h3>
                                Sales
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mt-5">
                <apexchart type="area" height="320px" :options="chartOptions" :series="chartOptions.series"></apexchart>
            </div>
        </v-card-text>
    </v-card>
</template>
