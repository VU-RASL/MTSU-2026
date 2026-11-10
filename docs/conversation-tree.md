# Conversation Tree (Issue #29)



Frontend engine for the conversation dialogue graph. It tracks the back-and-forth dialogue between a student and an AI patient, supports **turn reversals ("↺ Retry Turn")**, and preserves all abandoned conversational attempts so educators can review them.



- **Files:** `frontend/src/types/tree.ts` (models), `frontend/src/utils/treeUtils.ts` (graph logic), `frontend/src/pages/TreeDemo.tsx` (dual-view demo)

- **Status:** Engine & verification demo complete; ready to connect to backend turn collector (#36) and Educator Portal review panel (#27).



---



## 1. Data Shape



The conversation is stored as a normalized dictionary of nodes (`nodes[id]`) instead of a simple flat array. This allows fast lookups and branching without losing past dialogue.



```typescript

export interface DialogueNode {

  id: string;

  parentId: string | null;

  childrenIds: string[];

  speaker: 'student' | 'patient';

  text: string;

  timestamp: string;

}



export interface ConversationTree {

  rootNodeId: string | null;

  activeNodeId: string | null;

  nodes: Record<string, DialogueNode>;

}

```



---



## 2. How Branching & Rewind Works



When a student retries a turn, the system does not delete the old message. Instead, it resets `activeNodeId` back to an earlier node and creates a new branch.



```text

               [Root: Patient Opening]

                         |

                [Turn 1: Student Q1]

                         |

                [Turn 2: Patient R1]

                    /          \

          (Abandoned Branch)  (Active Branch)

          [Turn 3a: Student]  [Turn 3b: Student (Retry)]

                  |                    |

          [Turn 4a: Patient]  [Turn 4b: Patient] <-- (activeNodeId)

```



- **Student Portal:** Only displays the active chain (`getActiveConversationPath(tree)`), assembled by following `parentId` pointers up from `activeNodeId` to the root.

- **Educator Portal:** Inspects the full `tree.nodes` map to see what the student tried first, where communication broke down, and how they adjusted.



---



## 3. Core Functions (`treeUtils.ts`)



| Function | What it does |

|---|---|

| `addDialogueNode(tree, text, speaker)` | Appends a new child to `activeNodeId` and advances the active pointer. |

| `rewindToNode(tree, targetNodeId)` | Moves `activeNodeId` back to an earlier node so the next turn starts a new branch. |

| `getActiveConversationPath(tree)` | Returns the clean, linear array of messages from root to current leaf for the student UI and LLM prompt. |



---



## 4. Integration with Backend & Educator Portal



```text

[Student Portal]              [Realtime API / DB]               [Educator Portal]

      |                                |                                |

      |--- 1. Send dialogue turn ----->|                                |

      |<-- 2. Return patient reply ----|                                |

      |                                |                                |

 (addDialogueNode updates local tree)  |                                |

 (If retry: rewindToNode branches)     |                                |

      |                                |                                |

      |--- 3. POST /assignments/:id/results (transcript + tree) ------> |

                                       |                                |

                                       |<-- 4. GET results (tree) ------|

                                       |                                |

                                       |    AttemptsPanel renders       |

                                       |    branch forks & retries      |

```



1. **Live session:** Student dialogue events are appended to the tree locally and streamed to the backend turn collector (#36 / #48).

2. **Saving results:** On scenario completion (`POST /api/assignments/:id/results`), the linear transcript is saved for standard text display, and the full tree payload is saved for detailed audit.

3. **Educator review:** The `AttemptsPanel` in the Educator Portal (#27) loads the tree structure to visually display student retry forks and communication adjustments.
