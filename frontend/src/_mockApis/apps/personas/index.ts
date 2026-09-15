import mock from '../../mockAdapter';

interface PersonasType {
    id?: number | any;
    color?: string;
    PersonaTitle: {content: string;};
    datef?: string | Date;
}

const PersonasData: Object[] = [
    {
        id: 1,
        PersonaTitle: {
          content: "Patient with a Stomach Bug"
        },
        PersonaSummary: {
          content: "A brief overview of a patient experiencing stomach flu symptoms"
        },
        Metadata: {
          ContentWarnings: {
            content: "Nausea and vomiting-related discussions"
          }
        },
        PresentationAndResultingBehavior: {
          Affect: {
            content: "Appears fatigued and slightly irritable due to discomfort"
          },
          Speech: {
            content: "Speaks in short sentences, occasionally interrupted by nausea"
          },
          Misc: {
            content: "None"
          }
        },
        Identity: {
          Name: {
            content: "Alex Johnson"
          },
          Age: {
            content: "32"
          },
          Ethnicity: {
            content: "Caucasian"
          },
          Sex: {
            content: ""
          },
          Gender: {
            content: "Non-binary"
          },
          SexualOrientation: {
            content: "None"
          }
        },
        HealthComponents: {
          ChiefComplaint: {
            content: "Persistent nausea, vomiting, and diarrhea for the past 24 hours"
          },
          Diagnosis: {
            Differential: {
              content: "Gastroenteritis or food poisoning"
            },
            Actual: {
              content: "None"
            }
          },
          HistoryOfPresentIllness: {
            MedicationsAndAllergies: {
              content: "Currently taking over-the-counter antacids. No known allergies"
            }
          },
          PastMedicalHistory: {
            content: "No significant past medical history"
          },
          FamilyMedicalHistory: {
            content: "Father has a history of acid reflux"
          },
          PsychiatricProfile: {
            content: "None"
          }
        },
        Goals: {
          content: "Wants to recover quickly to attend an important work event in 2 days"
        },
        Challenges: {
          content: "Unable to retain fluids due to vomiting, leading to dehydration"
        },
        ThoughtsAndFeelings: {
          content: "Worried about the severity of symptoms and possible delay in recovery"
        },
        TasksAndActivities: {
          content: "Currently resting at home and attempting to hydrate with electrolyte solutions"
        },
        InfluencesAndSupports: {
          content: "Supportive roommate helping with meals and monitoring symptoms"
        },
        SocialHistory: {
          content: "Lives with a roommate and works a desk job"
        },
        CulturalComponents: {
          content: "None"
        },
        EmotionalWellbeing: {
          content: "Feeling anxious about health and upcoming responsibilities"
        },
        SocialDeterminantsOfHealth: {
          content: "Access to healthcare and medications is not a concern"
        },
        PromptsAndSpecialInstructions: {
          content: "Encourage rehydration and advise medical consultation if symptoms worsen"
        },
        datef: '2023-06-03T23:28:56.782Z',
        color: 'primary'
    },          
    {
        id: 2,
        color: 'success',
        PersonaTitle: {content:'Yasmine'},
        datef: '2023-06-03T23:28:56.782Z'
    },
    {
        id: 3,
        color: 'warning',
        PersonaTitle: {content:'Xan'},
        datef: '2023-06-01T23:28:56.782Z'
    },
    {
        id: 4,
        color: 'success',
        PersonaTitle: {content:'Doug'},
        datef: '2023-06-03T23:28:56.782Z'
    }
];

interface colorVariationType {
    id?: number;
    color?: string;
}

export const colorVariation: colorVariationType[] = [
    {
        id: 1,
        color: 'warning'
    },
    {
        id: 2,
        color: 'secondary'
    },
    {
        id: 3,
        color: 'error'
    },
    {
        id: 4,
        color: 'success'
    },
    {
        id: 5,
        color: 'primary'
    }
];

mock.onGet('/api/data/personas/PersonasData').reply(() => {
    return [200, PersonasData];
});
export default PersonasData;
