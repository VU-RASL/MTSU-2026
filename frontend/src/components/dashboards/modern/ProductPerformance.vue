<script setup lang="ts">
import { ref } from "vue";
import { product_PerformanceData } from "@/_mockApis/components/dashboards/ModernData";
</script>

<template>
  <v-card elevation="10" flat class="w-100">
    <span class="lstick"></span>
    <v-card-text>
      <div class="">
        <div>
          <h2 class="text-h5 mb-1">Product Performance</h2>
          <h5 class="text-subtitle-1 ">Product Performance</h5>
        </div>
        
      </div>
      <v-table class="month-table mt-5">
        <template v-slot:default>
          <thead>
            <tr>
              <th class="font-weight-medium text-subtitle-1">Assigned</th>
              <th class="font-weight-medium text-subtitle-1">Name</th>
              <th class="font-weight-medium text-subtitle-1">Priority</th>
              <th class="font-weight-medium text-subtitle-1">Budget</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in product_PerformanceData"
              :key="item.leadname"
              :class="item.activestate"
              class="month-item"
            >
              <td>
                <div class="d-flex align-center">
                  <v-avatar size="40">
                    <img
                      :src="item.img"
                      :alt="item.img"
                      width="40"
                  /></v-avatar>
                  <div class="mx-3">
                    <h4 class="text-subtitle-1 text-no-wrap font-weight-medium">
                      {{ item.leadname }}
                    </h4>
                  </div>
                </div>
              </td>
              <td>
                <h5
                  class="text-no-wrap text-body-1"
                >
                  {{ item.projectname }}
                </h5>
              </td>
              <td>
                <v-chip
                  class="ma-2"
                  :color="item.statuscolor"
                  size="small"
                  label
                  >{{ item.statustext }}</v-chip
                >
              </td>
              <td>
                <h4 class="text-no-wrap text-body-1">{{ item.money }}</h4>
              </td>
            </tr>
          </tbody>
        </template>
      </v-table>
    </v-card-text>
  </v-card>
</template>
