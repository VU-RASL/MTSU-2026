<script setup lang="ts">
import { ref } from "vue";
import { earningCardsData } from '@/_mockApis/components/dashboards/MinimalData';
</script>
<template>
    <v-row>
        <v-col cols="12" lg="3" sm="6" v-for="revenuecard in earningCardsData" :revenuecard="revenuecard"
            :key="revenuecard.title" class="py-0 mb-3">
            <VCard elevation="10">
                <span class="lstick"></span>
                <v-card-text class="pa-5">
                    <div class="d-flex align-center">
                        <img :src="revenuecard.img" alt="icon"  class="mr-4">
                        <div>
                            <h4 class="text-subtitle-1">
                                {{ revenuecard.title }}
                            </h4>
                            <h2 class="text-h5">
                                {{ revenuecard.number }}
                            </h2>        
                        </div>
                    </div>
                </v-card-text>
            </VCard>
        </v-col>
    </v-row>
</template>
  
<style scoped>
.lstick{
    top:45px;
}
</style>
  
  