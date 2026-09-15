<script setup lang="ts">
import { ref } from "vue";
import { projectEarningTableData } from "@/_mockApis/components/dashboards/MinimalData";
const select = ref({ state: "January", abbr: "FL" });
const items = ref([
    { state: "January", abbr: "FL" },
    { state: "February", abbr: "GA" },
    { state: "March", abbr: "NE" },
    { state: "April", abbr: "CA" },
]);
</script>
<template>
    <VCard elevation="10">
        <span class="lstick"></span>
        <v-card-text>
            <div>
                <h3 class="text-h5 title mb-1">Earning Report</h3>
                <h5 class="text-subtitle-1">Emplyee earning report</h5>
            </div>
            <v-alert class="mt-5" color="success" variant="tonal">
                <div class="d-flex align-center">
                    <div>
                    <h2 class="text-h5">July</h2>
                    <h5 class="text-subtitle-1">Total Earning</h5>
                    </div>
                    <div class="ml-auto "><h2 class="text-h5">$5420</h2></div>
                </div>
                </v-alert>
            <v-table class="month-table mt-7 mb-5">
                <template v-slot:default>
                    <thead>
                        <tr>
                            <th class="text-subtitle-1 font-weight-medium">Assigned</th>
                            <th class="text-subtitle-1 font-weight-medium">Name</th>
                            <th class="text-subtitle-1 font-weight-medium">Priority</th>
                            <th class="text-subtitle-1 font-weight-medium">Budget</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in projectEarningTableData" :key="item.leadname" :class="item.activestate" class="month-item">
                            <td>
                                <div class="d-flex align-center">
                                    <v-avatar size="40">
                                        <img :src="item.img" alt="user" width="45" />
                                    </v-avatar>
                                    <div class="mx-4">
                                        <h4 class="text-subtitle-1 text-no-wrap font-weight-medium">
                                            {{ item.leadname }}
                                        </h4>
                                        <h6 class="text-subtitle-2 text-no-wrap textSecondary mt-1">
                                            {{ item.leademail }}
                                        </h6>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <h5 class="text-no-wrap text-body-2">
                                    {{ item.projectname }}
                                </h5>
                            </td>
                            <td>
                                <v-chip class="ma-2" :color="item.statuscolor" size="small" label>{{ item.statustext
                                }}</v-chip>
                            </td>
                            <td >
                                <h4 class="text-no-wrap text-body-2">{{ item.money }}</h4>
                            </td>
                        </tr>
                    </tbody>
                </template>
            </v-table>
        </v-card-text>
    </VCard>
</template>
  
  
  