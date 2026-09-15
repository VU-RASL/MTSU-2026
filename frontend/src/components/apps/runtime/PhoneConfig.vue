<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { usePersonaStore } from '@/stores/apps/personas';
import axios from "axios";

const store = usePersonaStore();

const scenarioList = computed(() => store.personas.map(p => p.PersonaTitle.content));
const scenarioTitle = ref<string | undefined>();
const getScenario = computed(() => store.personas[store.selectedPersonaId - 1]);

const success = ref(false)
const error = ref(false)

// Update selectedPersonaId when scenarioTitle changes
watch(scenarioTitle, (newTitle) => {
  const idx = store.personas.findIndex(p => p.PersonaTitle.content === newTitle);
  if (idx !== -1) {
    store.SelectPersona(idx + 1)
  }
});

async function ConfigureDialIn() {
  success.value = false
  error.value = false
  try {
    await axios.post("https://simphony-backend.ngrok.dev/dialin", {
      headers: { 'ngrok-skip-browser-warning': 1 },
      params: {
        Persona: getScenario.value
      }
    })
    success.value = true
  } catch (err) {
    console.error(`Failed to configure dialin`, err)
    error.value = true
  }
}
</script>


<template>
    <div class="pa-6">
      <h4 class="text-h6 mb-4">Phone Config</h4>
  
      <div class="mb-5">
        <div class="text-center mt-4">
          <v-select
            v-model="scenarioTitle"
            :items="scenarioList"
            label="Scenario"
          ></v-select>
  
          <v-textarea
            :model-value="getScenario?.PersonaSummary?.content || ''"
            label="Scenario Summary"
          ></v-textarea>
  
          <v-btn @click="ConfigureDialIn" color="primary">
            Configure
          </v-btn>
  
          <v-alert
            v-if="success"
            type="success"
            class="mt-4"
            title="Dial-in configured"
            text="The dial-in connection was successfully set up."
          />
  
          <v-alert
            v-if="error"
            type="error"
            class="mt-4"
            title="Configuration failed"
            text="Something went wrong while configuring the dial-in."
          />
        </div>
      </div>
    </div>
</template>
  

<style lang="scss">
.persona-sheet {
  transition: 0.1s ease-in;
  &:hover {
    transform: scale(1.02);
  }
}
</style>
