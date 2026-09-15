<script setup lang="ts">
import { ref, onMounted, computed, nextTick} from 'vue';
import { usePersonaStore, isBaseObject } from '@/stores/apps/personas';
import { CheckIcon } from 'vue-tabler-icons';
import AddPersona from './AddPersona.vue';
import { colorVariation } from '@/_mockApis/apps/personas/index';
import PersonaField from './PersonaField.vue';

const store = usePersonaStore();

// onMounted(async () => {
//   await nextTick() // Wait for pinia plugin to load data
//   await store.initializePersonaStore()
// })

// Get the selected persona based on the selectedPersonaId in the store
const getPersona = computed(() => store.personas[store.selectedPersonaId - 1]);

// Filter persona sections to only include base objects
const getSections = computed(() => {
    const persona = getPersona.value;
    if (!persona) return [];
    return Object.fromEntries(Object.entries(persona).filter(([key, value]) => isBaseObject(value)));
});


</script>

<template>
    <v-sheet>
        <v-sheet class="py-3 pl-6 pr-4 d-flex align-center">
            <h4 class="text-h6">Edit Persona</h4>
            <div class="ml-auto">
                <AddPersona />
            </div>
        </v-sheet>
        <v-divider></v-divider>
        <v-sheet v-if="getPersona">
            <v-sheet class="pa-6">
                <!-- Persona Sections -->
                <v-list>
                    <PersonaField
                        v-for="(sectionValue, sectionKey) in getSections"
                        :key="sectionKey"
                        :section-value="sectionValue"
                        :section-key="sectionKey"
                        :Persona="getPersona"
                    />
                </v-list>

                <!-- Persona Color Selection -->
                <h4 class="text-h6 mt-4 mb-4">Persona Color</h4>
                <div class="d-flex gap-3 align-center">
                    <v-btn
                        icon
                        v-for="btcolor in colorVariation"
                        :key="btcolor.id"
                        size="x-small"
                        :color="btcolor.color"
                        @click="store.updatePersonaColor(getPersona.id, btcolor.color as string)"
                    >
                        <CheckIcon width="16" v-if="getPersona.color === btcolor.color" />
                    </v-btn>
                </div>
            </v-sheet>
        </v-sheet>
        <v-sheet v-else class="pa-6">
            <v-alert type="error" title="Oops" text="No Persona selected. Please select a persona." />
        </v-sheet>
    </v-sheet>
</template>

<!-- <style scoped>
.custom-placeholder-color input::placeholder {
  color: red !important;
  opacity: 1;
}

.custom-label-color .v-label {
  color: red;
  opacity: 1;
}
</style> -->