<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>
<template>
    <div class="logo">
      <RouterLink to="/" class="d-flex">
        <img src="@/assets/images/logos/white-logo-icon.svg" />
        <img
          src="@/assets/images/logos/white-logo-text.svg"
          class="pl-3"
        />
      </RouterLink>
    </div>
  </template>

  