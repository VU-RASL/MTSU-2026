<script setup lang="ts">
import { ref, watch } from 'vue'
import VuePdfEmbed from 'vue-pdf-embed'
import 'vue-pdf-embed/dist/styles/annotationLayer.css'
import 'vue-pdf-embed/dist/styles/textLayer.css'

const props = defineProps({
  source: {
    type: String,
    required: true,
  }
})

const isLoading = ref(true)
const page = ref<number | undefined>(undefined)
const pageCount = ref<number | null>(null)
const showAllPages = ref(true)

watch(showAllPages, (value) => {
  page.value = value ? undefined : 1
})

function handleDocumentLoad({ numPages }: { numPages: number }) {
  pageCount.value = numPages
}

function handleDocumentRender() {
  isLoading.value = false
}
</script>

<template>
  <v-container>
    <v-card class="pa-4" elevation="4">
      <v-row justify="space-between" align="center" v-if="!isLoading">
        <v-col cols="auto" v-if="showAllPages">
          <span>{{ pageCount }} page(s)</span>
        </v-col>

        <v-col cols="auto" v-else-if="page !== undefined">
          <v-btn icon @click="page!--" :disabled="page <= 1">
            <v-icon>mdi-chevron-left</v-icon>
          </v-btn>
          <span>{{ page }} / {{ pageCount }}</span>
          <v-btn icon @click="page++" :disabled="page >= pageCount!">
            <v-icon>mdi-chevron-right</v-icon>
          </v-btn>
        </v-col>

        <v-col cols="auto">
          <v-checkbox
            v-model="showAllPages"
            label="Show all pages"
            hide-details
            density="compact"
            class="mt-0"
          />
        </v-col>
      </v-row>

      <v-row justify="end" class="mt-2" v-if="!isLoading">
        <v-col cols="auto">
          <v-btn :href="props.source" target="_blank" download variant="text">
            <v-icon start>mdi-download</v-icon>
            Download PDF
          </v-btn>
        </v-col>
      </v-row>

      <v-row justify="center" v-if="isLoading">
        <v-progress-circular indeterminate color="primary" />
      </v-row>

      <div class="mt-4">
        <VuePdfEmbed
          class="mx-auto"
          :source="props.source"
          :page="page"
          annotation-layer
          text-layer
          @loaded="handleDocumentLoad"
          @rendered="handleDocumentRender"
        />
      </div>
    </v-card>
  </v-container>
</template>

<style scoped>
.vue-pdf-embed__page {
  margin-bottom: 8px;
  box-shadow: 0 2px 8px 4px rgba(0, 0, 0, 0.1);
}
</style>
