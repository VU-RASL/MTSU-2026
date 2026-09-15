<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import { usePersonaStore } from '@/stores/apps/personas';
import { colorVariation } from '@/_mockApis/apps/personas/index';
import { uniqueId } from 'lodash';

// common components
const dialog = ref(false);
const name = ref('');
const color = ref('primary');
const store = usePersonaStore();


function addPersona() {
    const id = store.createPersona()
    console.log("New Persona Id: ", id)
    store.selectedPersonaId = id
}
</script>

<template>
    <!-- ---------------------------------------------------- -->
    <!-- Table Basic -->
    <!-- ---------------------------------------------------- -->

    <v-sheet>
        <v-btn color="primary" @click="addPersona">New Persona</v-btn>
    </v-sheet>
</template>
