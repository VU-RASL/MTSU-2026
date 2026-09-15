<script setup lang="ts">
import { ref, computed } from "vue";
import { getPrimary, getSecondary } from '@/utils/UpdateColors';
import { weeklyStatesData } from '@/_mockApis/components/dashboards/MinimalData';
import type { DotsIcon } from "vue-tabler-icons";
/*Chart*/
const chartOptions = computed(() => {
    return {
        series: [
            {
                name: "Weekly Stats",
                data: [40, 60, 50, 65],
            },
        ],
        colors: [getSecondary.value],
        fill: {
            colors: getSecondary.value,
            opacity: 0.05,
            type: "solid",
        },
        chart: {
            type: "area",
            height: 135,
            toolbar: {
                show: false,
            },
            foreColor: "#adb0bb",
            fontFamily: "'DM Sans',sans-serif",
            sparkline: {
                enabled: true,
            },
        },
        dataLabels: {
            enabled: false,
        },
        markers: {
            size: 0,
        },
        legend: {
            show: false,
        },
        stroke: {
            show: true,
            width: 2,
            curve: "smooth",
        },
        tooltip: {
            theme: "dark",
        },
    }
});
const items = ref([
    { title: "Click Me" },
    { title: "Click Me" },
    { title: "Click Me" },
    { title: "Click Me 2" },
]);

</script>


<template>
    <v-card elevation="10" class="overflow-hidden">
        <span class="lstick"></span>
        <v-card-text>
            <div class="d-flex align-center mb-7">
                <div>
                <h2 class="text-h5 title mb-1">Weekly Stats</h2>
                <h5 class="text-subtitle-1">Overview of week</h5>
                </div>
                <div class="ml-auto">
                    <v-menu bottom left>
                        <template v-slot:activator="{ props }">
                            <v-btn icon color="inherit" v-bind="props" flat>
                                <DotsIcon stroke-width="1.5" size="20" />
                            </v-btn>
                        </template>
                        <v-list>
                            <v-list-item v-for="(item, i) in items" :key="i">
                                <v-list-item-title>{{ item.title }}</v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </div>
            </div>
            <!-- lists -->
            <div class="px-0" v-for="(item, i) in weeklyStatesData" :key="i">
                <div class="d-flex align-center py-4">
                    <div class>
                        <v-btn :color="item.color" icon size="small" elevation="0" class="mr-3" flat>
                            <component :is="item.icon" stroke-width="2" size="18" />
                        </v-btn>
                    </div>
                    <div class="ml-2">
                        <h4 class="text-h6 mb-1 mt-n1">
                            {{ item.title }}
                        </h4>
                        <span class="
                                text-grey-darken-1
                                text-subtitle-2
                                d-block
                                text-truncate
                              ">{{ item.desc }}</span>
                    </div>
                    <div class="ml-auto">
                        <v-chip label size="small" class="font-weight-bold" color="inherit"> +{{ item.percent }}% </v-chip>
                    </div>
                </div>
            </div>
            <div class="position-relative">
            <apexchart type="area" height="135px" :options="chartOptions" :series="chartOptions.series">
            </apexchart>
        </div>
        </v-card-text>
    </v-card>
</template>
