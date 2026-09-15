<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { getPrimary, getSecondary } from '@/utils/UpdateColors';
/*Chart*/
const chartOptions = computed(() => {
  return {
    series: [
      { name: "Ample", data: [100, 390, 210, 350, 290, 180, 250] },
      { name: "Pixel", data: [100, 250, 125, 215, 150, 310, 170] },
    ],
    grid: {
      show: false,
      borderColor: "transparent",
      padding: { left:28, right: 0, bottom: 0 },
    },
    plotOptions: {},
    colors: [getPrimary.value, getSecondary.value],
    fill: { type: "solid", opacity: 1 },
    chart: {
      type: "line",
      height: 220,
      offsetX: -15,
      toolbar: { show: false },
      foreColor: "#adb0bb",
      fontFamily: `inherit`,
    },

    legend: { show: false },
    xaxis: {
      type: "category",
      categories: ["Jan", "Feb", "Mar", "Jun", "Jul", "Aug", "Sep"],
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
    stroke: { curve: "smooth", width: "4" },
    tooltip: { theme: "dark" },
  }
});

</script>

<template>
  <!-- ------------------------------------ -->
  <!-- html -->
  <!-- ------------------------------------ -->
  <VCard elevation="10">
    <span class="lstick"></span>
    <v-card-text>
      <div class="d-sm-flex align-center">
        <div>
          <h3 class="text-h5 title mb-1">Sales Overview</h3>
          <h5 class="text-subtitle-1">Year 2021</h5>
        </div>
        <div class="ml-auto">
          <div class="d-flex align-center">
            <div class="d-flex align-center px-2">
              <span class="text-primary">
                <span class="text-overline">
                  <i class="mdi mdi-brightness-1 mx-1"></i>
                </span>
                <span class="text-subtitle-1">Ample</span>
              </span>
            </div>
            <div class="d-flex align-center px-2">
              <span class="text-secondary">
                <span class="text-overline">
                  <i class="mdi mdi-brightness-1 mx-1"></i>
                </span>
                <span class="text-subtitle-1">Pixel </span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <v-alert color="primary" class="mt-5">
      <v-row>
        <v-col cols="12" sm="4" lg="4"
          >
          <div class="text-subtitle-1">Total Sales</div>
          <h3 class="text-h6 mt-1">$10,345</h3></v-col
        >
        <v-col cols="12" sm="4" lg="4"
          >
          <div class="text-subtitle-1">This Year</div>
          <h3 class="text-h6 mt-1">$7,589</h3></v-col
        >
        <v-col cols="12" sm="4" lg="4"
          >
          <div class="text-subtitle-1">This Month</div>
          <h3 class="text-h6 mt-1">$1,476</h3></v-col
        >
      </v-row>
    </v-alert>
      <div class="mt-5">
        <apexchart type="line" height="220px" :options="chartOptions" :series="chartOptions.series">
        </apexchart>
      </div>
    </v-card-text>
  </VCard>
</template>
