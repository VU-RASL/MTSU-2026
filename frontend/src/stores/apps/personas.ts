import { defineStore } from 'pinia';
// project imports
import axios from '@/utils/axios';
import { map } from 'lodash';
import { personaDescriptions } from '@/constants/personaDescriptions';
import { merge } from 'lodash';

interface BaseObject {
    description: string;
}

// Define the Atomic Object type
interface AtomicObject extends BaseObject {
    exampleDialogue: string[];
    content: string;
    synthetic: string[];
    hints: {
        saved: string[],
        suggested: string[]
    };
}

// interface ContainerObject extends BaseObject{
//     [key: Exclude<string, "name" | "description">]: AtomicObject; 
// }
type ContainerObject = BaseObject & {
    [key: string]: AtomicObject | ContainerObject; // Additional fields must be AtomicObject or ContainerObject
};

interface Metadata extends BaseObject {
    ContentWarnings: AtomicObject;
}

interface PresentationAndResultingBehavior extends BaseObject {
    Affect: AtomicObject;
    Speech: AtomicObject;
    Misc: AtomicObject;
}

interface Identity extends BaseObject {
    Name: AtomicObject;
    Age: AtomicObject;
    Ethnicity: AtomicObject;
    Sex: AtomicObject;
    Gender: AtomicObject;
    SexualOrientation: AtomicObject;
}

interface HealthComponents extends BaseObject {
    ChiefComplaint: AtomicObject;
    Diagnosis: {
        description: string;
        Differential: AtomicObject;
        Actual: AtomicObject;
    };
    HistoryOfPresentIllness: {
        description: string;
        MedicationsAndAllergies: AtomicObject;
    };
    PastMedicalHistory: AtomicObject;
    FamilyMedicalHistory: AtomicObject;
    PsychiatricProfile: AtomicObject;
}

// Define the structure for the Persona schema
interface Persona {
    id: number | any;
    color?: string;
    PersonaTitle: AtomicObject;
    datef?: Date | any;
    deleted?: boolean;
    PersonaSummary: AtomicObject;
    Metadata: Metadata;
    PresentationAndResultingBehavior: PresentationAndResultingBehavior;
    Identity: Identity;
    HealthComponents: HealthComponents;
    Goals: AtomicObject;
    Challenges: AtomicObject;
    ThoughtsAndFeelings: AtomicObject;
    TasksAndActivities: AtomicObject;
    InfluencesAndSupports: AtomicObject;
    SocialHistory: AtomicObject;
    CulturalComponents: AtomicObject;
    EmotionalWellbeing: AtomicObject;
    SocialDeterminantsOfHealth: AtomicObject;
    PromptsAndSpecialInstructions: AtomicObject;
}

// Define the state for the store
interface PersonaState {
    personas: Persona[];
    selectedPersonaId: number;
    searchQuery: string;
}

const usePersonaStore = defineStore({
    id: 'personas',
    state: (): PersonaState => ({
        personas: [],
        selectedPersonaId: 1,
        searchQuery: ''
    }),
    sync: true,
    defaultFactory: () => ({
        personas: [createEmptyPersona()],
        selectedPersonaId: 1,
        searchQuery: ''
      }),
    actions: {
        // async initializePersonaStore() {
        //     try {
        //         console.log('[initializePersonaStore] Before:', this.personas.length)
        //         if (this.personas.length === 0) {
        //           const persona = createEmptyPersona()
        //           persona.id = 1
        //           this.personas = [persona]
        //         }
        //         console.log('[initializePersonaStore] After:', this.personas.length)                
        //     } catch (err) {
        //       console.error('[PersonaStore] Failed to initialize default persona:', err)
        //     }
        //   },
          
          

        // Select a persona by ID
        SelectPersona(personaId: number) {
            if (personaId > this.personas.length){
                personaId = this.personas.length
            }
            console.log('Seclected Persona ID: ', personaId);
            this.selectedPersonaId = personaId;
        },

        // Delete a persona by ID
        deletePersona(personaId: number) {
            console.log("length ", this.personas.length)
            console.log('Seclected Persona ID: ', personaId);
            const index = this.personas.findIndex((persona) => persona.id === personaId);
            if (index !== -1) {
                this.personas.splice(index, 1);
            }
            if (this.selectedPersonaId > this.personas.length-1){
                this.SelectPersona(this.personas.length -1)
            }
        },

        // Helper function to update persona fields
        updateStorePersona(personaId: number, updates: Partial<Persona>) {
            const persona = this.personas[personaId -1]
            if(persona){
                // Iterate over keys in the updates object
                for (const key in updates) {
                    if (key in persona) {
                        const field = key as keyof Persona;
                        if (typeof updates[field] === 'object' && !Array.isArray(updates[field])) {
                            // If the field is an object, deep merge it
                            persona[field] = { ...persona[field], ...updates[field] };
                        } else {
                            // Otherwise, directly assign the value
                            persona[field] = updates[field] as any;
                        }
                    }
                }
            this.personas[personaId-1] = persona
            console.log('Persona Updated!')
            }
        },

        // Update a specific atomic field in a persona
        // updatePersonaField(personaId: number, section: keyof Persona, field: keyof AtomicObject, value: any) {
        //     const persona = this.personas.find((p) => p.id === personaId);
        //     if (persona && section in persona) {
        //         const targetSection = persona[section] as any;
        //         if (field in targetSection) {
        //             targetSection[field] = value;
        //         }
        //     }
        // },
        updatePersonaColor(personaId: number, color : string) {
            const persona = this.personas[personaId -1];
            if (persona ) {
                persona.color = color;
                this.personas[personaId-1] = persona;
            }
        },

        // Create a new empty persona
        createPersona(data? : Partial<Persona>) {
            const newPersona = createEmptyPersona();
            const newPersonaId = this.personas.length+1;
            newPersona.id = newPersonaId;
            this.personas.push(newPersona);
            return newPersonaId;
        },

        // Search for personas by query
        searchPersonas(query: string) {
            this.searchQuery = query.toLowerCase();
            return this.personas.filter((persona) =>
                JSON.stringify(persona).toLowerCase().includes(this.searchQuery)
            );
        },

        // getCategories() {
        //     return [
        //         'Metadata',
        //         'PersonaSummary',
        //         'PresentationAndResultingBehavior',
        //         'Identity',
        //         'HealthComponents',
        //         'Goals',
        //         'Challenges',
        //         'ThoughtsAndFeelings',
        //         'TasksAndActivities',
        //         'InfluencesAndSupports',
        //         'SocialHistory',
        //         'CulturalComponents',
        //         'EmotionalWellbeing',
        //         'SocialDeterminantsOfHealth',
        //         'PromptsAndSpecialInstructions'
        //     ];
        // }
        getString() {
            return JSON.stringify(this.personas[this.selectedPersonaId-1]);
        },

        getNonEmptyString() {
            // Helper function to determine if a value is empty
            const isEmpty = (value: any): boolean => {
                if (value == null) return true; // Handles null or undefined
                if (typeof value === "string" && value.trim() === "") return true; // Empty string
                if (Array.isArray(value) && value.length === 0) return true; // Empty array
                if (typeof value === "object" && Object.keys(value).length === 0) return true; // Empty object
                return false;
            };
        
            // Recursive function to filter non-empty fields
            const filterNonEmpty = (obj: any): any => {
                if (Array.isArray(obj)) {
                    // Process arrays, keeping only non-empty elements
                    return obj.filter(item => !isEmpty(item)).map(filterNonEmpty);
                }
                if (typeof obj === "object" && obj !== null) {
                    // Process objects, keeping only non-empty fields
                    return Object.fromEntries(
                        Object.entries(obj)
                            .filter(([_, value]) => !isEmpty(value)) // Keep non-empty fields
                            .map(([key, value]) => [key, filterNonEmpty(value)]) // Recurse
                    );
                }
                return obj; // Return primitive values as-is
            };
        
            // Filter the persona and stringify the result
            const filteredPersona = filterNonEmpty(this.personas[this.selectedPersonaId-1]);
            return JSON.stringify(filteredPersona); 
        }
        


    }
});

// Helper function to create an empty persona
function createEmptyPersona(): Persona {
    return {
        id: 1,
        color: "",
        PersonaTitle: createAtomicObject("PersonaTitle"),
        datef: new Date().toISOString(),
        deleted: false,
        PersonaSummary: createAtomicObject("PersonaSummary"),
        Metadata: {
            description: personaDescriptions.Metadata,
            ContentWarnings: createAtomicObject("ContentWarnings"),
        },
        Identity: {
            description: personaDescriptions.Identity,
            Name: createAtomicObject("Name"),
            Age: createAtomicObject("Age"),
            Ethnicity: createAtomicObject("Ethnicity"),
            Sex: createAtomicObject("Sex"),
            Gender: createAtomicObject("Gender"),
            SexualOrientation: createAtomicObject("SexualOrientation"),
        },
        PresentationAndResultingBehavior: {
            description: personaDescriptions.PresentationAndResultingBehavior,
            Affect: createAtomicObject("Affect"),
            Speech: createAtomicObject("Speech"),
            Misc: createAtomicObject("Misc"),
        },
        HealthComponents: {
            description: personaDescriptions.HealthComponents,
            ChiefComplaint: createAtomicObject("ChiefComplaint"),
            Diagnosis: {
                description: personaDescriptions.Diagnosis,
                Differential: createAtomicObject("Differential"),
                Actual: createAtomicObject("Actual"),
            },
            HistoryOfPresentIllness: {
                description: personaDescriptions.HistoryOfPresentIllness,
                MedicationsAndAllergies: createAtomicObject("MedicationsAndAllergies"),
            },
            PastMedicalHistory: createAtomicObject("PastMedicalHistory"),
            FamilyMedicalHistory: createAtomicObject("FamilyMedicalHistory"),
            PsychiatricProfile: createAtomicObject("PsychiatricProfile"),
        },
        Goals: createAtomicObject("Goals"),
        Challenges: createAtomicObject("Challenges"),
        ThoughtsAndFeelings: createAtomicObject("ThoughtsAndFeelings"),
        TasksAndActivities: createAtomicObject("TasksAndActivities"),
        InfluencesAndSupports: createAtomicObject("InfluencesAndSupports"),
        SocialHistory: createAtomicObject("SocialHistory"),
        CulturalComponents: createAtomicObject("CulturalComponents"),
        EmotionalWellbeing: createAtomicObject("EmotionalWellbeing"),
        SocialDeterminantsOfHealth: createAtomicObject("SocialDeterminantsOfHealth"),
        PromptsAndSpecialInstructions: createAtomicObject("PromptsAndSpecialInstructions"),
    };
}

function updatePersona(persona: Persona, updates: Partial<Persona>): Persona {
    // Iterate over keys in the updates object
    for (const key in updates) {
        if (key in persona) {
            const field = key as keyof Persona;
            if (typeof updates[field] === 'object' && !Array.isArray(updates[field])) {
                // If the field is an object, deep merge it
                persona[field] = { ...persona[field], ...updates[field] };
            } else {
                // Otherwise, directly assign the value
                persona[field] = updates[field] as any;
            }
        }
    }
    return persona;
}


// Helper function to create an empty atomic object
function createAtomicObject(key: keyof typeof personaDescriptions): AtomicObject {
    return {
        description: personaDescriptions[key],
        exampleDialogue: [""],
        content: "",
        synthetic: [""],
        hints: {
            saved: [""],
            suggested: [""]
        },
    };
}


// Type guard for BaseObject
function isBaseObject(obj: any): obj is BaseObject {
    return (
        typeof obj === 'object' &&
        'description' in obj
    );
}

// Type guard for AtomicObject
function isAtomicObject(obj: any): obj is AtomicObject {
    return (
        isBaseObject(obj) &&
        'exampleDialogue' in obj &&
        'content' in obj &&
        'synthetic' in obj &&
        'hints' in obj
    );
}

// Type guard for ContainerObject
function isContainerObject(obj: any): obj is ContainerObject {
    return (
        isBaseObject(obj) &&
        Object.keys(obj)
            .filter(key => key !== "description") // Ignore the "description" property
            .every(key => {
                const value = (obj as Record<string, any>)[key];
                return isAtomicObject(value) || isContainerObject(value);
            })
    );
}


export { usePersonaStore, isAtomicObject, isBaseObject, isContainerObject };