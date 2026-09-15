<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { getPrimary, getSecondary } from '@/utils/UpdateColors';
/*Chart*/
const chartOptions = computed(() => {
    return {

            colors: [ getSecondary.value, getPrimary.value,],
            fill: {
                type: "gradient",
                opacity: ["0.1", "0.1"],
            },
            chart: {
                type: "area",
                fontFamily: "inherit",
                height: 365,
		foreColor: "#adb0bb",
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
                categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
            },
            grid: {
                padding: { left:28, right: 0, bottom: 0 },
                show: true,
                borderColor: "rgba(0, 0, 0, .2)",
                color: "rgba(0, 0, 0, .2)",
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
                theme: "dark",
            },
        }
});
const Chart = {
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
};
const select = ref("March");
const items = ref(["March", "April", "May", "June"]);
const elementVisible = ref(false);
onMounted(() => {
    setTimeout(() => (elementVisible.value = true), 10);
});
</script>

<template>
    <VCard elevation="10">
        <span class="lstick"></span>
        <v-card-text>
            <div class="d-sm-flex align-start">
                <div>
                    <h3 class="text-h5 title mb-1">Newsletter Campaign</h3>
                    <h5 class="text-subtitle-1">Overview of Newsletter Campaign</h5>
                </div>
                <div class="ml-auto">
                    <div class="ml-auto">
                        <div class="d-flex align-center">
                            <div class="d-flex align-center px-2">
                                <span class="text-primary">
                                    <span class="text-overline">
                                        <i class="mdi mdi-brightness-1 mx-1"></i>
                                    </span>
                                    <span class="text-subtitle-1">Earning</span>
                                </span>
                            </div>
                            <div class="d-flex align-center px-2">
                                <span class="text-secondary">
                                    <span class="text-overline">
                                        <i class="mdi mdi-brightness-1 mx-1"></i>
                                    </span>
                                    <span class="text-subtitle-1">Expense</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-show="elementVisible" class="mt-6">
                <apexchart type="area" height="365" :options="chartOptions" :series="Chart.series"></apexchart>
            </div>
            <div class="d-flex justify-center">
                <div class="d-flex align-center text-primary px-2">
                    <span class="text-overline">
                        <i class="mdi mdi-brightness-1 mx-1"></i>
                    </span>
                    <span class="text-subtitle-1">Earnings</span>
                </div>
                <div class="d-flex align-center px-2 text-secondary">
                    <span class="text-overline">
                        <i class="mdi mdi-brightness-1 mx-1"></i>
                    </span>
                    <span class="text-subtitle-1">Expense</span>
                </div>
            </div>
        </v-card-text>
    </VCard>
</template>
