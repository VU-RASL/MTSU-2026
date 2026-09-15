<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { getPrimary, getSecondary } from '@/utils/UpdateColors';
const Chart1 = computed(() => {
    return {
        series: [
            { name: "Ample", data: [355, 390, 300, 350, 390, 180, 250] },
            { name: "Pixel", data: [280, 250, 325, 215, 250, 310, 170] },
        ],
            grid: {
                show: false,
                borderColor: "transparent",
                padding: { left: 0, right: 0, bottom: 0 },
            },
            plotOptions: {
                bar: { horizontal: false, columnWidth: "35%", borderRadius: 0 },
            },
            colors: [getPrimary.value,getSecondary.value],
            fill: { type: "solid", opacity: 1 },
            chart: {
                type: "bar",
                height: 270,
                offsetX: -15,
                toolbar: { show: false },
                foreColor: "#adb0bb",
                fontFamily: "Poppins",
                sparkline: { enabled: false },
            },
            dataLabels: { enabled: false },
            markers: { size: 0 },
            legend: { show: false },
            xaxis: {
                type: "category",
                categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                labels: {
                    style: { cssClass: "grey--text lighten-2--text fill-color" },
                },
            },
            yaxis: {
                show: true,
                min: 100,
                max: 400,
                tickAmount: 3,
                labels: {
                    style: {
                        cssClass: "grey--text lighten-2--text fill-color",
                    },
                },
            },
            stroke: {
                show: true,
                width: 5,
                lineCap: "butt",
                colors: ["transparent"],
            },
            tooltip: { theme: "dark" },

    }
});
const elementVisible = ref(false);
onMounted(() => {
    setTimeout(() => (elementVisible.value = true), 10);
});
</script>

<template>
    <!-- ------------------------------------ -->
    <!-- html -->
    <!-- ------------------------------------ -->
    <v-card elevation="10">
        <v-card-text>
            <div class="d-sm-flex align-center">
                <div>
                    <h3 class="text-h5 title mb-1">Sales Overview</h3>
                    <h5 class="text-subtitle-1">Ample Admin Vs Pixel Admin</h5>
                </div>
            </div>
            <div v-show="elementVisible" class="mt-5">
                <apexchart type="bar" height="250px" :options="Chart1"
                    :series="Chart1.series"></apexchart>
            </div>
        </v-card-text>
    </v-card>
</template>
