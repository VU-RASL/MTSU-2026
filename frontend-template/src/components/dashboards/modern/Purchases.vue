<script setup lang="ts">
import type { BasketIcon } from 'vue-tabler-icons';

</script>
<template>
  <v-card elevation="10">
    <span class="lstick"></span>
    <v-card-text>
      <div class="d-flex align-start">
        <h2 class="text-h5 mt-1">Purchases</h2>
        <v-spacer></v-spacer>
        <div class="ml-auto">
          <v-btn color="secondary" icon flat>
            <BasketIcon/>
          </v-btn>
        </div>
      </div>
      <div class="mt-9">
        <h2 class="title font-weight-bold text-h4 mb-1">2,367</h2>
        <span class="text-subtitle-1  textPrimary">Monthly Sales</span>
      </div>
    </v-card-text>
  </v-card>
</template>
