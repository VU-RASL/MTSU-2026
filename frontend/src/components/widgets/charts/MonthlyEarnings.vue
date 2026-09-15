<script setup lang="ts">
import { computed } from 'vue';

import { getPrimary } from '@/utils/UpdateColors';

/* Chart */
const areachartOptions = computed(() => {
    return {
        chart: {
            type: 'area',
            height: 60,
            fontFamily: `inherit`,
            foreColor: '#a1aab2',
            toolbar: {
                show: false
            },
            sparkline: {
                enabled: true
            },
            group: 'sparklines'
        },
        colors: [getPrimary.value],
        stroke: {
            curve: 'smooth',
            width: 2
        },
        fill: {
            type: 'solid',
            opacity: 0.05
        },
        markers: {
            size: 0
        },
        tooltip: {
            theme: 'dark',
            x: {
                show: false
            }
        }
    };
});

const areaChart = {
    series: [
        {
            name: '',
            data: [25, 66, 20, 40, 12, 58, 20]
        }
    ]
};
</script>
<template>
    <v-card elevation="10" class=" mt-6">
        <v-card-item class="">
            <div class="d-flex align-center justify-space-between">
                <v-card-title class="text-h5">Monthly Earnings</v-card-title>
                <v-avatar class="rounded-md bg-lightprimary text-primary">
                    <img src="@/assets/images/svgs/icon-master-card-2.svg" alt="ico" />
                </v-avatar>
            </div>
            <div class="my-sm-9 my-6 d-flex align-center">
                <h3 class="text-h3">$6,820</h3>
                <div class="d-flex align-center">
                    <v-avatar class="bg-lightsuccess text-success ml-2" size="20">
                        <ArrowUpLeftIcon size="18" />
                    </v-avatar>
                    <span class="text-subtitle-1 ml-2 textSecondary">+9%</span>
                </div>
            </div>
            <apexchart type="area" height="60" :options="areachartOptions" :series="areaChart.series"> </apexchart>
        </v-card-item>
    </v-card>
</template>
