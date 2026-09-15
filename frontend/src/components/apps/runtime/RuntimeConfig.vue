<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { usePersonaStore,  } from '@/stores/apps/personas';

const store = usePersonaStore();

const personaStore = usePersonaStore()

// onMounted(async () => {
//   await nextTick() // Wait for pinia plugin to load data
//   await personaStore.initializePersonaStore()
// })


const emit = defineEmits<{
    (e: 'start'): void,
    (e: 'stop'): void,
    (e: 'interject', command: string): void,
    (e: 'listen'): void,
    (e: 'converse'): void
}>();

const props = defineProps<{
  isStartDisabled: boolean;
  isStopDisabled: boolean;
}>();


const scenarioList = computed(() => store.personas.map(p => p.PersonaTitle.content));

// Bind scenarioTitle to the currently selected persona title
const scenarioTitle = ref<string | undefined>();

// Get the selected persona based on the selectedPersonaId in the store
const getScenario = computed(() => store.personas[store.selectedPersonaId - 1]);


// Update selectedPersonaId when scenarioTitle changes
watch(scenarioTitle, (newTitle) => {
  const idx = store.personas.findIndex(p => p.PersonaTitle.content === newTitle);
  if (idx !== -1) {
    store.SelectPersona(idx+1)
  }
});
</script>

<template>
  <div class="pa-6">
    <h4 class="text-h6 mb-4">Runtime Config</h4>

    <div class="mb-5">
      <div class="text-center mt-4">
        <v-select
          v-model="scenarioTitle"
          :items="scenarioList"
          label="Scenario"
        ></v-select>
        <v-textarea :model-value="getScenario?.PersonaSummary?.content || ''" label="Scenario Summary"></v-textarea>
        <v-btn @click="emit('start')" :disabled="props.isStartDisabled" color="primary">
        Start
        </v-btn>
        <v-btn @click="emit('listen')" :disabled="props.isStopDisabled" color="primary">
        Listen Only
        </v-btn>
        <v-btn @click="emit('interject', 'Ask a question with relevant conversation context.')" :disabled="props.isStopDisabled" color="primary">
        Interject
        </v-btn>
        <v-btn @click="emit('converse')" :disabled="props.isStopDisabled" color="primary">
        Respond Normally
        </v-btn>
        <v-btn @click="emit('stop')" :disabled="props.isStopDisabled" color="error" class="ml-2">
        Stop
        </v-btn>

      </div>
    </div>

    <!-- <v-sheet :class="'persona-sheet pa-6 pb-4 rounded-md cursor-pointer mb-4  bg-light'"> -->
        
        <!-- <v-textarea :model-value="getScenario?.PersonaSummary?.content || ''" label="Scenario Summary"></v-textarea> -->

        <!-- </v-sheet> -->
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
