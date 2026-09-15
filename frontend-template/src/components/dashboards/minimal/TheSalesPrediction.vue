<script setup lang="ts">
import { ref, computed } from "vue";
import { getPrimary, getSecondary } from '@/utils/UpdateColors';
/*Chart*/
const chartOptions = computed(() => {
    return {
        series: [76],


    colors: ["#7460ee"],
    chart: {
      type: "radialBar",
      offsetY: -20,
    },
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        track: {
          background: "#e7e7e7",
          strokeWidth: "97%",
          margin: 5, // margin is in pixels
          shadow: {
            enabled: true,
            top: 2,
            left: 0,
            color: "#999",
            opacity: 1,
            blur: 2,
          },
        },
        dataLabels: {
          name: {
            show: false,
          },
          value: {
            offsetY: -2,
            fontSize: "22px",
          },
        },
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        shadeIntensity: 0.4,
        inverseColors: false,
        opacityFrom: 1,
        opacityTo: 1,
        stops: [0, 50, 53, 91],
      },
    },
    labels: ["Average Results"],
    tooltip: {
      theme: "dark",
    },
    }
});
</script>
<template>
    <v-card elevation="10">
      <v-card-text class="pa-5">
        <h3 class="text-h5 title mb-1">Sales Prediction</h3>
        <v-row class="mt-3">
          <v-col cols="6">
            <span class="display-3 title">$3528</span>
            <h6 class="text-subtitle-2 mt-2">10% Increased</h6>
            <h5 class="text-subtitle-1 font-weight-medium text-no-wrap mt-1">(150-165 Sales)</h5>
          </v-col>
          <v-col cols="6">
            <div class="ml-auto" style="height: 70px; width: 150px">
              <apexchart
                height="200px"
                width="150px"
                :options="chartOptions"
                :series="chartOptions.series"
              ></apexchart>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </template>
  