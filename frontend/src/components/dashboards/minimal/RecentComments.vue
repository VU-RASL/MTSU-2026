<script setup lang="ts">
import { ref } from "vue";
import { recentCommentsData } from '@/_mockApis/components/dashboards/MinimalData';
const props = defineProps({
    comment: Object,
});
</script>
<template>
    <VCard elevation="10">
        <span class="lstick"></span>
        <v-card-text >
            <h2 class="text-h5 title mb-1">Recent Comments</h2>
            <h5 class="text-subtitle-1">Comments from Customers</h5>
        </v-card-text>
        <v-card-text class="pa-0">
            <div class="d-md-flex align-items-center">
                <perfect-scrollbar style="height: 550px">
                    <div v-for="comment in recentCommentsData" :comment="comment" :key="comment.username">
                        <!-- Comment Row -->
                        <div class="d-flex flex-row comment-row mt-0 pa-3" :class="[comment.activeClass]">
                            <div class="pa-2">
                                <v-avatar size="50">
                                    <img :src="comment.img" alt="user" width="50" />
                                </v-avatar>
                            </div>
                            <div class="comment-text w-100 pa-3">
                                <div class="d-flex align-center">
                                    <h3 class="text-h6">{{ comment.username }}<br /></h3>
                                    <v-chip class="ml-2" :color="comment.badgebg" size="x-small">{{ comment.status
                                    }}</v-chip>
                                </div>
                                <span class="d-block my-2 ">{{
                                    comment.desc
                                }}</span>
                                <div class="d-flex">
                                    <v-btn size="small" :color="comment.badgebg" flat>Read More</v-btn>
                                    <div class=" ml-auto">{{ comment.date }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </perfect-scrollbar>
            </div>
        </v-card-text>
    </VCard>
</template>
  
  
  