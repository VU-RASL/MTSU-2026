<script setup lang="ts">
import { stringify } from "flatted";
import { ref, onMounted, computed, toRaw } from "vue";
import { usePersonaStore } from '@/stores/apps/personas';
import axios from "axios";


const props = defineProps<{
  transcript: string;
  status: string;
  error: string;
}>();

</script>

<template>
  <v-container>
    <v-row justify="center" class="mt-4">
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>
            <h1 class="text-h5">OpenAI Real-time Audio Demo</h1>
          </v-card-title>

          <v-card-text>
            <v-row justify="center" class="mb-4">
              <!-- <v-btn @click="init" :disabled="isStartDisabled" color="primary">Start</v-btn> -->
              <!-- <v-btn @click="stopRecording" :disabled="isStopDisabled" color="error" class="ml-2">Stop</v-btn> -->
              <!-- <v-btn @click="updateInstructions" :disabled="isStartDisabled" color="warning" class="ml-2">Update Instructions</v-btn> -->
            </v-row>

            <v-divider></v-divider>

            <v-row>
              <v-col>
                <div id="transcript" class="transcript">{{ transcript }}</div>
              </v-col>
            </v-row>

            <v-row>
              <v-col>
                <div id="status" class="status">{{ status }}</div>
                <div v-if="error" id="error" class="error">{{ error }}</div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.status {
  margin-top: 10px;
  font-size: 1.1rem;
}

.error {
  color: red;
  font-size: 1.1rem;
  margin-top: 10px;
}

.transcript {
  background: #f9f9f9;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 5px;
  min-height: 100px;
}
</style>
