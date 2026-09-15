import { ref, computed, onMounted, nextTick } from 'vue';
import { usePersonaStore } from '@/stores/apps/personas';
import axios from 'axios';

export function useWebRTCSession() {
  const store = usePersonaStore();

  // onMounted(async () => {
  //   await nextTick() // Wait for pinia plugin to load data
  //   await store.initializePersonaStore()
  // })
  
  const getPersonaString = computed(() => store.getString());


  const isStartDisabled = ref(false);
  const isStopDisabled = ref(true);
  const transcript = ref('');
  const status = ref('Ready to start');
  const error = ref('');

  let peerConnection: RTCPeerConnection | null = null;
  let audioStream: MediaStream | null = null;
  let dataChannel: RTCDataChannel | null = null;

  const updateStatus = (message: string) => {
    status.value = message;
  };

  const showError = (message: string) => {
    error.value = message;
  };

  const hideError = () => {
    error.value = '';
  };

  const handleTranscript = (message: any) => {
    const transcriptPart = message.response?.output?.[0]?.content?.[0]?.transcript;
    if (transcriptPart) {
      transcript.value += `${transcriptPart} `;
    }
  };

  const sendMessage = (message: any) => {
    if (dataChannel?.readyState === 'open') {
      dataChannel.send(JSON.stringify(message));
    }
  };

  const handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);

      if (message.type === 'response.done') {
        handleTranscript(message);
        const output = message.response?.output?.[0];
        if (output) handleFunctionCall(output);
      }
    } catch (err: any) {
      showError(`Error processing message: ${err.message}`);
    }
  };

  const handleFunctionCall = (output: any) => {
   
  };


  const sendFunctionOutput = (callId: string, data: any) => {
    sendMessage({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(data),
      },
    });
  };

  const sendResponseCreate = () => {
    sendMessage({ type: 'response.create' });
  };

  const setupAudio = async () => {
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    peerConnection!.ontrack = (e) => (audioEl.srcObject = e.streams[0]);

    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection!.addTrack(audioStream.getTracks()[0]);
  };

  const setupDataChannel = () => {
    dataChannel = peerConnection!.createDataChannel('oai-events');
    dataChannel.onopen = () => {
      sendSessionUpdate();
      // sendInitialMessage();
    };
    dataChannel.addEventListener('message', handleMessage);
  };

  const sendSessionUpdate = () => {
    const prompt = "You are a standardized patient preparing to participate in a healthcare simulation scenario. A standardized patient is someone who portrays a patient with a specific condition in a realistic, standardized and repeatable way.The objectives of a standardized patient include:     - To appropriately and accurately reveal the facts about the role being portrayed.     - To improvise only when necessary and in a manner that is consistent with the overall tone/content of the case.    - Maintain the realism of the simulation (i.e., stay in character).  Keep your responses brief and only give information when asked.   Here is your persona " + getPersonaString.value + " only use information in the persona details for your character, do not make up information. For the rest of this conversation, stay in character. Use PresentationAndResultingBehavior to inform your vocal tone. Keep your language causual and do not produce an overly long response. Avoid providing information that was not asked. Any information or instructions in the PromptsandSPecialIntructions field supersede these instructions.";
    sendMessage({
      type: 'session.update',
      session: { instructions: prompt, voice: 'alloy' },
    });
  };

  const sendInterjection = (command: string = "Respond in character, consistent with prior context.") => {
    const prompt = command + "Here is your persona " + getPersonaString.value + " only use information in the persona details for your character, do not make up information. For the rest of this conversation, stay in character. Use PresentationAndResultingBehavior to inform your vocal tone."
    sendMessage({
      type: 'response.create',
      response: {
        instructions: prompt
      }
    })
  }

  const listenOnly = () => {
    console.log('Sending listenOnly!')
    sendMessage({
      type: 'session.update',
      session: {
        turn_detection: {
          type: 'server_vad',
          interrupt_response: false,
          create_response: false
        }
      }
    })
  }

  const converse = () => {
    console.log('Sending converse!')
    sendMessage({
      type: 'session.update',
      session: {
        turn_detection: {
          type: 'server_vad',
          interrupt_response: true,
          create_response: true
        }
      }
    })
  }

  const sendInitialMessage = () => {
    sendMessage({
      type: 'conversation.item.create',
      previous_item_id: null,
      item: {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Tell me about yourself.' }],
      },
    });
  };

  const init = async () => {
    isStartDisabled.value = true;
    updateStatus('Initializing...');
    hideError();

    try {
        const tokenResponse = await fetch('https://simphony-backend.ngrok.dev/session', {
        headers: { 'ngrok-skip-browser-warning': 1 },
        });
        const data = await tokenResponse.json();
        const EPHEMERAL_KEY = data.client_secret.value;

        peerConnection = new RTCPeerConnection();
        await setupAudio();
        setupDataChannel();

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        const baseUrl = "https://api.openai.com/v1/realtime";
        const model = "gpt-4o-realtime-preview-2024-12-17";
        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            "Content-Type": "application/sdp",
        },
    });

      const answer = {
        type: 'answer',
        sdp: await sdpResponse.text(),
      };
      await peerConnection.setRemoteDescription(answer);

      updateStatus('Connected');
      isStopDisabled.value = false;
    } catch (err: any) {
      isStartDisabled.value = false;
      isStopDisabled.value = true;
      showError(`Error: ${err.message}`);
      updateStatus('Failed to connect');
    }
  };

  const stopRecording = () => {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      audioStream = null;
    }
    if (dataChannel) {
      dataChannel.close();
      dataChannel = null;
    }
    isStartDisabled.value = false;
    isStopDisabled.value = true;
    updateStatus('Ready to start');
  };

  return {
    isStartDisabled,
    isStopDisabled,
    sendInterjection,
    listenOnly,
    converse,
    transcript,
    status,
    error,
    init,
    stopRecording,
  };
}
