<script setup lang="ts">
import { ref, computed } from "vue";
import { getPrimary, getSecondary } from '@/utils/UpdateColors';
/*Chart */
const Chart = computed(() => {
    return {
        series: [25, 35, 35],
            labels: ["2021", "2020", "2019", "2018"],
            chart: {
                height: 280,
                type: "donut",
                foreColor: "#adb0bb",
                fontFamily: `inherit`,
            },
            colors: [getSecondary.value, getPrimary.value, "#ecf0f2"],
            dataLabels: { enabled: false },
            legend: { show: false },
            grid: {
                show: false,
                borderColor: "transparent",
                padding: { top: 0, right: 0 },
            },
            stroke: { colors: ["transparent"] },
            plotOptions: {
                pie: {
                    donut: {
                        size: "78%",
                        background: "transparent",
                        labels: {
                            show: false,
                            name: {
                                show: true,
                                fontSize: "18px",
                                color: undefined,
                                offsetY: -10,
                            },
                            value: { show: false, color: "#98aab4" },
                            total: { show: false, label: "Our Visitors", color: "#98aab4" },
                        },
                    },
                },
            },
            tooltip: { theme: "dark", fillSeriesColor: false },
            responsive: [{ breakpoint: 480, options: { chart: { height: 250 } } }],

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
            <div class="mb-sm-10">
                <h2 class="text-h5 mb-1">Total Sales</h2>
                <h5 class="text-subtitle-1">Checkout the sales</h5>
            </div>
            <div class="border-top mt-5 d-flex align-center">
                <h6 class="text-subtitle-1 text-grey-darken-1 font-weight-regular">
                    Sales Yearly
                </h6>
                <div class="ml-auto">
                    <h3 class="text-h4 font-weight-bold">8,364,398</h3>
                </div>
            </div>
            <div class="mt-5 pt-5 position-relative">
                <apexchart type="donut" height="280px" :options="Chart" :series="Chart.series">
                </apexchart>
                <ShoppingCartIcon size="35"  class="total-sales-icon"/>
            </div>
            <div class="d-flex align-center justify-space-between mt-9">
                <div class="d-flex align-center px-2">
                    <span>
                        <span class="text-overline">
                            <i class="mdi mdi-brightness-1 text-secondary mx-1"></i>
                        </span>
                        <span class="text-subtitle-1 mr-1">2021</span>
                    </span>
                </div>
                <div class="d-flex align-center px-2">
                    <span>
                        <span class="text-overline">
                            <i class="mdi mdi-brightness-1 text-primary mx-1"></i>
                        </span>
                        <span class="text-subtitle-1 mr-1">2020</span>
                    </span>
                </div>
                <div class="d-flex align-center px-2">
                    <span>
                        <span class="text-overline">
                            <i class="mdi mdi-brightness-1 text-warning mx-1"></i>
                        </span>
                        <span class="text-subtitle-1 mr-1">2019
                        </span>
                    </span>
                </div>
            </div>
        </v-card-text>
    </v-card>
</template>

<style scoped>
.total-sales-icon {
    position: absolute;
    left: 46%;
    top: 45%;
    opacity: 0.6;
}
</style>
