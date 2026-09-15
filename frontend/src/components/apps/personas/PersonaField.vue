<script setup lang="ts">
import { isAtomicObject, isContainerObject, isBaseObject } from '@/stores/apps/personas';
import { ref, computed, toRef } from 'vue';
import axios from "axios";
import * as changeCase from "change-case";

const props = defineProps({
    sectionValue: {
        type: Object,
        required: true,
    },
    sectionKey: {
        type: String,
        required: true,
    },
    Persona: {
        type: Object,
        required: true,
    },
});

const reactiveSectionValue = toRef(props, 'sectionValue');
const examplesDialog = ref(false);
const examplesDialogContent = ref([]);
const hintsDialog = ref(false);
const hintsDialogContent = ref([]);
const apiResp = ref("");

const getSections = computed(() => {
    const entries = Object.entries(props.sectionValue);
    // Filter to include only BaseObjects
    const filtered = entries.filter(([key, value]) => isBaseObject(value));

    return Object.fromEntries(filtered); // Convert back to an object
});

async function openExamplesDialog() {
    examplesDialog.value = true;
    examplesDialogContent.value = ["Loading..."]
    try {
        // const response = await axios.get("https://f3532fa99844.ngrok.app/generate-examples", {
        const response = await axios.get("https://simphony-backend.ngrok.dev/generate-examples", {
            headers: {'ngrok-skip-browser-warning': 1},
            params: {
                Persona: props.Persona,
                Field: props.sectionKey,
            }
        });

        const responseData = response.data;
        console.log(responseData)

        if (responseData && Array.isArray(responseData.content) && responseData.content.every(item => typeof item === "string")) {
            examplesDialogContent.value = responseData.content;
        } else {
            examplesDialogContent.value = ["No examples available."];
        }
        
    } catch (error) {
        console.error("Error fetching API data:", error);
        examplesDialogContent.value = ["Failed to fetch content."];
    }
}



function closeExamplesDialog() {
    examplesDialog.value = false;
}


async function openHintsDialog() {
    console.log("Hints Dialog");
    hintsDialog.value = true;
    hintsDialogContent.value = ["Loading..."];

    try {
        console.log('hints before')
        // const response = await axios.get("https://f3532fa99844.ngrok.app/provide-hints", {
        const response = await axios.get("https://simphony-backend.ngrok.dev/provide-hints", {
            headers: {'ngrok-skip-browser-warning': 1},
            params: {
                Persona: props.Persona,
                Field: props.sectionKey,
            }
        });
        console.log(response.data)
        const responseData = response.data

        // const responseData = JSON.parse(response.data);
        // console.log(responseData)

        if (responseData && Array.isArray(responseData.content) && responseData.content.every(item => typeof item === "string")) {
            hintsDialogContent.value = responseData.content;
        } else {
            hintsDialogContent.value = ["No hints available."];
        }
    } catch (error) {
        console.error("Error fetching API data:", error);
        hintsDialogContent.value = ["Failed to fetch content."];
    }
}

function closeHintsDialog() {
    hintsDialog.value = false;
}
</script>

<template>
    <template v-if="isAtomicObject(sectionValue)">
        <v-list-item>
            <v-text-field
                class="custom-placeholder-color custom-label-color custom-hint-color mt-3"
                v-model="sectionValue.content"
                :label="changeCase.capitalCase(sectionKey)"
                :hint="sectionValue.description"
                persistent-placeholder
                persistent-hint
                auto-grow
                append-inner-icon="mdi-chat-question-outline"
                append-icon="mdi-format-list-bulleted-square"
                outlined
                @click:append-inner="openHintsDialog"
                @click:append="openExamplesDialog"
            />
        </v-list-item>

        <v-dialog v-model="examplesDialog" max-width="1000">
            <v-card>
                <v-card-title>
                    {{ changeCase.capitalCase(sectionKey) }} Examples
                </v-card-title>

                <v-card-text>
                    <v-list>
                        <v-list-item v-for="(example, index) in examplesDialogContent"
                        :key="index"
                        :title="'Example '+ (index+1)"
                        :subtitle="example">
                        </v-list-item>
                    </v-list>
                </v-card-text>

                <v-card-actions>
                    <v-spacer />
                    <v-btn color="primary" text @click="closeExamplesDialog">Close</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <v-dialog v-model="hintsDialog" max-width="1000">
            <v-card>
                <v-card-title>
                    {{ changeCase.capitalCase(sectionKey) }} Hints
                </v-card-title>

                <v-card-text>
                    <v-list>
                        <v-list-item v-for="(hint, index) in hintsDialogContent"
                        :key="index"
                        :title="'Hint ' + (index+1)"
                        :subtitle="hint">
                        </v-list-item>
                    </v-list>
                </v-card-text>

                <v-card-actions>
                    <v-spacer />
                    <v-btn color="primary" text @click="closeHintsDialog">Close</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </template>
    <template v-else-if="isContainerObject(sectionValue)">
        <v-list-group value="true">
            <template v-slot:activator="{ props }">
                <v-list-item
                    v-bind="props"
                    :title="changeCase.capitalCase(sectionKey)"
                />
            </template>
            <PersonaField
                v-for="(sectionValue, sectionKey) in getSections"
                :key="sectionKey"
                :section-value="sectionValue"
                :section-key="sectionKey"
                :Persona="Persona"
            />
        </v-list-group>
    </template>
    <template v-else>
        <v-list-item title="Error"/>
    </template>
</template>

<style scoped>
.custom-placeholder-color ::v-deep(input::placeholder) {
  color: black;
 
  font-weight: bold;
}

.custom-label-color ::v-deep(.v-label) {
  color: black;
  
  font-weight: bold;
}

.custom-hint-color ::v-deep(.v-messages__message){
  color: black;
  
  font-weight: bold;
}
</style>
