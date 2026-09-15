<script setup lang="ts">
import { ref, onMounted,computed } from "vue";
const chartOptions = computed(() => {
    return {
        series: [
    {
      name: "",
      data: [4, 5, 2, 10, 9, 12, 4, 9, 4, 5, 3, 10, 9, 12, 10, 9, 12, 4, 9],
    },
  ],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "20%",
      },
    },
    grid: {
      show: false,
      padding: {
        left: 0,
        right: 0,
      },
    },
    colors: "rgba(255, 255, 255, 0.5)",
    chart: {
      toolbar: {
        show: false,
      },
      sparkline: {
        enabled: true,
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      theme: "dark",
    },
    }
});
const elementVisible = ref(false);
onMounted(() => {
  setTimeout(() => (elementVisible.value = true), 10);
});
</script>
<template>
  <VCard elevation="10" class="overflow-hidden">
    <v-card-text class="bg-secondary">
      <div class="d-flex align-center">
        <v-icon size="30">mdi-chart-donut</v-icon>
        <div class="mx-4">
          <h3 class="text-h5">Download Count</h3>
          <div class="text-subtitle-1">March 2021</div>
        </div>
      </div>
      <v-row class="mt-2">
        <v-col cols="4" class="d-flex align-center">
          <h2 class="font-weight-light white--text text-nowrap">35487</h2>
        </v-col>
        <v-col cols="8">
          <div v-show="elementVisible" class="ml-auto">
            <apexchart
              type="bar"
              height="70px"
              :options="chartOptions"
              :series="chartOptions.series"
            ></apexchart>
          </div>
        </v-col>
      </v-row>
    </v-card-text>
  </VCard>
</template>
