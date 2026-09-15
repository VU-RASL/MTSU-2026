from __future__ import annotations

import io
import threading
from collections import deque

import numpy as np
import sounddevice as sd
from pydub import AudioSegment

CHUNK_LENGTH_S = 0.05  # 100ms
SAMPLE_RATE = 24000
FORMAT = np.int16
CHANNELS = 1

# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false


def audio_to_pcm16_base64(audio_bytes: bytes) -> bytes:
    # load the audio file from the byte stream
    audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
    print(f"Loaded audio: {audio.frame_rate=} {audio.channels=} {audio.sample_width=} {audio.frame_width=}")
    # resample to 24kHz mono pcm16
    pcm_audio = audio.set_frame_rate(SAMPLE_RATE).set_channels(CHANNELS).set_sample_width(2).raw_data
    return pcm_audio


class AudioPlayerAsync:
    def __init__(self):
        self.queue = deque()
        self.lock = threading.Lock()
        self.stream = sd.OutputStream(
            callback=self.callback,
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype=np.int16,
            blocksize=int(CHUNK_LENGTH_S * SAMPLE_RATE),
        )
        self.playing = False
        self._frame_count = 0

    def callback(self, outdata, frames, _time, _status):
        with self.lock:
            data = np.zeros(frames, dtype=np.int16)  # Preallocate buffer
            
            if self.queue:
                item = self.queue.popleft()  # Fast O(1) operation
                frames_needed = min(frames, len(item))
                data[:frames_needed] = item[:frames_needed]
                
                if len(item) > frames_needed:
                    self.queue.appendleft(item[frames_needed:])  # O(1) operation
            
            self._frame_count += len(data)

        outdata[:] = data.reshape(-1, 1)  # Ensure correct shape

    def reset_frame_count(self):
        self._frame_count = 0

    def get_frame_count(self):
        return self._frame_count

    def add_data(self, data: bytes):
        with self.lock:
            # bytes is pcm16 single channel audio data, convert to numpy array
            np_data = np.frombuffer(data, dtype=np.int16)
            self.queue.append(np_data)
            if not self.playing:
                self.start()

    def start(self):
        self.playing = True
        self.stream.start()

    def stop(self):
        self.playing = False
        self.stream.stop()
        with self.lock:
            self.queue = []

    def terminate(self):
        self.stream.close()