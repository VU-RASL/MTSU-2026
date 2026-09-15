<script setup lang="ts">
import { ref } from 'vue';
const slider1 = ref(50);
</script>
<template>
    <UiChildCard title="Basic Slider">
        <v-slider v-model="slider1" hide-details color="primary" ></v-slider>
    </UiChildCard>
</template>
