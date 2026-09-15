<script setup lang="ts">
import { ref } from "vue";
import { backIconData } from "@/_mockApis/components/widget/card";
</script>

<template>
  <!-- ----------------------------------------------------------------------------- -->
  <!-- Background Card -->
  <!-- ----------------------------------------------------------------------------- -->
  <v-row>
    <v-col cols="12" lg="2" v-for="(item, i) in backIconData" :key="i">
      <v-card :class="item.color" elevation="10">
        <v-card-text class="pa-6">
          <component :is="item.icon" stroke-width="1.5" size="25" />
          <h5 class="text-h5 mt-2 text-white">{{ item.title }}</h5>
          <span class="text-white">{{
            item.subtitle
          }}</span>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
