<script setup lang="ts">
import { ref, computed } from "vue";
import { getPrimary, getSecondary } from '@/utils/UpdateColors';
/*Chart */
const Chart = computed(() => {
    return {
        series: [
            {
                name: "Monthly Earnings",
                data: [6, 10, 9, 11, 9, 10, 12, 10, 9, 11, 9, 10, 12],
            },
        ],

        chart: {
            toolbar: {
                show: false,
            },
            foreColor: "#adb0bb",
            fontFamily: `inherit`,
            type: "bar",
            height: 35,
            sparkline: {
                enabled: true,
            },
        },
        colors: ["rgba(255,255,255,0.5)"],

        marker: {
            size: 0,
        },

        tooltip: {
            theme: "dark",
        },

        grid: {
            show: false,
        },

        stroke: {
            show: true,
            width: 2,
            curve: "smooth",
            colors: ["transparent"],
        },

        plotOptions: {
            bar: {
                horizontal: false,
                startingShape: "flat",
                endingShape: "flat",
                columnWidth: "30%",
                barHeight: "100%",
            },
        },
    }
});

const select = ref("March");
const items = ref(["March", "April", "May", "June"]);
</script>

<template>
    <v-card elevation="10" class="mt-7 bg-secondary">
        <v-card-text>
            <h3 class="text-h5">Monthly Earnings</h3>
            <div class="mt-4">
                <apexchart type="bar" height="35px" :options="Chart" :series="Chart.series">
                </apexchart>
            </div>
            <h2 class=" text-h4 mt-7  d-flex align-items-end">
                $39,358
                <span class="text-subtitle-1 ml-2 d-flex align-center "><ArrowUpLeftIcon  size="18"/>+9 this week</span>
            </h2>
        </v-card-text>
    </v-card>
</template>
