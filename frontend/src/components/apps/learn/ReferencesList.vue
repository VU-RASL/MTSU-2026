<script setup lang="ts">
import { ref } from 'vue'
import { referencesList } from '@/_mockApis/apps/learn/ReferencesPDFList'
import RefPdfEmbed from '@/components/apps/learn/RefPdfEmbed.vue'
import type { ReferenceData } from '@/types/apps/ReferenceType'

const selectedReference = ref<ReferenceData | null>(null)
const dialog = ref(false)

function openReference(refItem: ReferenceData) {
  selectedReference.value = refItem
  dialog.value = true
}
</script>

<template>
  <VCard elevation="10" class="overflow-hidden">
    <v-card-text class="pa-0">
      <div class="bg-primary pa-5">
        <h2 class="text-h5 mb-1">References</h2>
        <!-- <h5 class="text-subtitle-1">subtitle here</h5> -->
      </div>

      <div class="pa-4">
        <v-list>
          <v-list-item
            v-for="(item, i) in referencesList"
            :key="i"
            @click="openReference(item)"
            class="cursor-pointer"
          >
            <v-list-item-title>
              <div class="d-flex align-center py-3">
                <div class="mx-3">
                  <h4 class="text-h6 mt-n1 mb-1">{{ item.title }}</h4>
                  <div class="truncate-text text-subtitle-2 textSecondary">{{ item.desc }}</div>
                </div>
              </div>
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </div>
    </v-card-text>
  </VCard>

  <!-- Dialog -->
  <v-dialog v-model="dialog" max-width="900px">
    <v-card>
      <v-card-title>
        <span class="text-h6">{{ selectedReference?.title }}</span>
        <v-spacer />
        <v-btn icon @click="dialog = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <RefPdfEmbed v-if="selectedReference" :source="selectedReference.url" />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
