<script setup lang="ts">
import { ref, computed } from "vue";
import { getPrimary, getSecondary } from '@/utils/UpdateColors';
/*Chart */
const Chart = computed(() => {
    return {
        series: [
            {
                name: "Customers",
                data: [1, 19, 3, 13, 2, 19],
            },
        ],

        chart: {
            toolbar: {
                show: false,
            },
            foreColor: "#adb0bb",
            fontFamily: `inherit`,
            type: "line",
            height: 25,
            sparkline: {
                enabled: true,
            },
        },
        colors: ["rgb(255,255,255)"],

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
        },
    }
});
</script>

<template>
    <v-card elevation="10" class="position-relative bg-primary">
        <v-card-text>
            <h2 class="text-h5">Customers</h2>
            <div class="mt-4">
                <apexchart type="line" height="25px" :options="Chart" :series="Chart.series"></apexchart>
            </div>
            <h2 class="title text-h4 text-white mt-7 font-weight-medium d-flex align-end">
                $39,358
                <span class="text-subtitle-1 ml-2 d-flex align-center"><ArrowUpLeftIcon  size="18"/>+9 this week</span>
            </h2>
        </v-card-text>
    </v-card>
</template>
