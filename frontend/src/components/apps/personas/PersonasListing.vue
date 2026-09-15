<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watchEffect} from 'vue';
import { usePersonaStore } from '@/stores/apps/personas';
import { TrashIcon } from 'vue-tabler-icons';

const store = usePersonaStore();

const storeReady = ref(false)

// onMounted(async () => {
//   await nextTick()
//   await store.initializePersonaStore()
//   storeReady.value = true
// })

watchEffect(() => {
  console.log('[watchEffect] Personas:', store.personas.length)
})


const getPersonas = computed(() => {
    return store.personas;
});

const PersonaItem = getPersonas;

const searchValue = ref('');
const filteredPersonas = computed(() => {
  if (searchValue.value.trim() === '') {
    // console.log("Returning this:", PersonaItem.value)
    return PersonaItem.value
  }

  return PersonaItem.value.filter((persona) => {
    // console.log("Returning this:", persona.PersonaTitle?.content
    //   ?.toLowerCase()
    //   .includes(searchValue.value.toLowerCase()))
    return persona.PersonaTitle?.content
      ?.toLowerCase()
      .includes(searchValue.value.toLowerCase())
  })
});

</script>

<template>
    <!-- ---------------------------------------------------- -->
    <!-- Table Basic -->
    <!-- ---------------------------------------------------- -->
    <div class="pa-6">
        <h4 class="text-h6 mb-4">All Personas</h4>

        <div class="mb-5">
            <v-text-field
                variant="outlined"
                v-model="searchValue"
                append-inner-icon="mdi-magnify"
                placeholder="Search Personas"
                hide-details
                density="compact"
            ></v-text-field>
        </div>

        <!-- Show personas only if store is ready -->
        <v-sheet
        v-if="filteredPersonas.length > 0"
        v-for="persona in filteredPersonas"
        :key="persona.id"
        :class="'persona-sheet pa-6 pb-4 rounded-md cursor-pointer mb-4 bg-light' + persona.color"
        @click="store.SelectPersona(persona.id)"
        >
        <h6 :class="'text-h6 text-truncate text-' + persona.color">
            {{ persona.PersonaTitle.content || 'Untitled Persona' }}
        </h6>
        <div class="d-flex mt-3 align-center">
            <small class="text-subtitle-2 opacity-25">
            {{ new Date(persona.datef).toLocaleDateString() }}
            </small>
            <v-btn icon variant="text" class="ml-auto" size="x-small" @click="store.deletePersona(persona.id)">
            <v-tooltip activator="parent" location="top">Delete Persona</v-tooltip>
            <TrashIcon size="18" />
            </v-btn>
        </div>
        </v-sheet>

        <!-- Only show the "Oops" message once store has initialized -->
        <v-sheet v-if="filteredPersonas.length === 0">
        <v-alert type="error" title="Oops" text="The personas you are looking for are not found" />
        </v-sheet>

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
