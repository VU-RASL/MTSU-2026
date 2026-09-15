<script setup lang="ts">
import { ref } from "vue";
import { imgCardData } from "@/_mockApis/components/widget/card";
</script>

<template>
  <!-- ----------------------------------------------------------------------------- -->
  <!-- Image Card -->
  <!-- ----------------------------------------------------------------------------- -->
  <v-row>
    <v-col cols="12" lg="4" v-for="(item, i) in imgCardData" :key="i">
      <v-card elevation="10" class="overflow-hidden">
        <v-img :src="item.image"  cover  class="w-100"  height="250"/>
        <v-card-text class="pa-6">
          <h5 class="text-h6 title">Special title treatment</h5>
          <p class=" text-subtitle-1 textSecondary mt-3"
            >With supporting text below as a natural lead-in to additional
            content.
          </p>
          <v-btn class="mt-4" :color="item.color">Go Somewhere</v-btn>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
