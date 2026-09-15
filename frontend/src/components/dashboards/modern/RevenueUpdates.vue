<script setup lang="ts">
import { ref, computed } from "vue";
import { getPrimary, getSecondary } from '@/utils/UpdateColors';
/*Chart */
const Chart = computed(() => {
    return {
        series: [
            {
                name: "Earnings",
                data: [0, 5, 6, 8, 25, 9, 11, 24],
            },
            {
                name: "Expense",
                data: [0, 3, 1, 2, 8, 1, 5, 1],
            },
        ],
        colors: [getSecondary.value, getPrimary.value],
        fill: {
            type: "solid",
            opacity: 1,
        },
        chart: {
            toolbar: {
                show: false,
            },
            type: "line",
            foreColor: "#adb0bb",
            fontFamily: `inherit`,
            height: 300,
        },
        dataLabels: {
            enabled: false,
        },
        markers: {
            size: 4,
            border: 1,
        },
        legend: {
            show: false,
        },
        xaxis: {
            categories: [
                "16/08",
                "17/08",
                "18/08",
                "19/08",
                "20/08",
                "21/08",
                "22/08",
                "23/08",
            ],
        },
        grid: {
            show: true,
            borderColor: "rgba(0, 0, 0, .2)",
            color: "#777e89",
            strokeDashArray: 2,
            xaxis: {
                lines: {
                    show: false,
                },
            },
            yaxis: {
                lines: {
                    show: true,
                },
            },
        },
        stroke: {
            curve: "smooth",
            width: 3,
        },
        tooltip: {
            x: {
                format: "dd/MM/yy HH:mm",
            },
            theme: "dark",
        },
    }
});

const select = ref("March");
const items = ref(["March", "April", "May", "June"]);
</script>

<template>
    <v-card elevation="10">
        <v-card-text>
            <div class="d-sm-flex align-start">
                <div>
                    <h2 class="text-h5">Revenue Updates</h2>
                </div>
                <v-spacer></v-spacer>
                <div class="ml-auto">
                    <v-select v-model="select" :items="items" variant="outlined" dense hide-details></v-select>
                </div>
            </div>
            <div>
                <apexchart type="line" height="300px" :options="Chart" :series="Chart.series">
                </apexchart>
            </div>
            <div class="d-flex justify-center">
                <div class="d-flex align-center text-primary px-2">
                    <span class="text-overline">
                        <i class="mdi mdi-brightness-1 mx-1"></i>
                    </span>
                    <span class="font-weight-regular">Earnings</span>
                </div>
                <div class="d-flex align-center px-2 text-secondary">
                    <span class="text-overline">
                        <i class="mdi mdi-brightness-1 mx-1"></i>
                    </span>
                    <span class="font-weight-regular">Expense</span>
                </div>
            </div>
        </v-card-text>
    </v-card>
</template>