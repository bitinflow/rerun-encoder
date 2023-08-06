<script setup lang="ts">
import { PropType } from 'vue'
import { Settings } from '../../shared/schema'

const props = defineProps({
  settings: Object as PropType<Settings>,
  isOptionsOpen: Boolean,
  onOptionsOpen: Function as PropType<() => void>,
  onOptionsClose: Function as PropType<() => void>,
})

const emits = defineEmits(['close', 'commit-settings'])

// watch for changes to the settings object
const commitSettings = () => {
  const clone = JSON.parse(JSON.stringify(props.settings))
  // commit the settings object to the main process
  // @ts-ignore
  window.api.commitSettings(clone)
  console.log('settings updated', clone)
}

</script>

<template>
  <div
      class="px-6 pb-6 no-drag grid gap-2"
      style="max-height: 220px; overflow-y: auto;"
  >
    <div>
      <button
          type="button"
          class="text-white/50"
          @click="emits('close')"
      >
        <i class="fal fa-arrow-left mr-1"></i>
        Go Back
      </button>
    </div>
    <div class="font-bold text-sm text-white/80">Encoding</div>
    <div
        v-if="props.settings && props.settings.output"
        class="grid gap-3"
    >
      <div class="bg-base-600/40 rounded flex items-center p-3 gap-4 justify-between">
        <div>
          <div class="text-sm">Video Encoder</div>
          <div class="text-xs text-white/50">
            If available, use hardware encoding.
          </div>
        </div>
        <div>
          <select
              class="w-full rounded bg-base-700 text-white/50 border-0 py-1.5"
              v-model="props.settings.output.video.encoder"
              @change="commitSettings"
          >
            <option value="libx264">Software (libx264)</option>
            <option value="nvenc_h264">Hardware (NVENC, H.264)</option>
          </select>
        </div>
      </div>
      <div class="bg-base-600/40 rounded flex items-center p-3 gap-4 justify-between">
        <div class="self-center">
          <div class="text-sm">Video Bitrate</div>
          <div class="text-xs text-white/50">
            Select your desired video bitrate.
          </div>
        </div>
        <div>
          <select
              class="w-full rounded bg-base-700 text-white/50 border-0 py-1.5"
              v-model.number="props.settings.output.video.bitrate"
              @change="commitSettings"
          >
            <option value="6000">6000 kbps (1080p @ 60 FPS)</option>
            <option value="4500">4500 kbps (1080p @ 30 FPS)</option>
            <option value="4500">4500 kbps (720p @ 60 FPS)</option>
            <option value="3000">3000 kbps (720p @ 30 FPS)</option>
          </select>
        </div>
      </div>
      <div class="bg-base-600/40 rounded flex items-center p-3 gap-4 justify-between">
        <div class="self-center">
          <div class="text-sm">Audio Encoder</div>
          <div class="text-xs text-white/50">
            Select your desired audio encoder.
          </div>
        </div>
        <div>
          <select
              class="w-full rounded bg-base-700 text-white/50 border-0 py-1.5"
              v-model="props.settings.output.audio.encoder"
              @change="commitSettings"
          >
            <option value="aac">AAC</option>
          </select>
        </div>
      </div>
      <div class="bg-base-600/40 rounded flex items-center p-3 gap-4 justify-between">
        <div class="self-center">
          <div class="text-sm">Audio Bitrate</div>
          <div class="text-xs text-white/50">
            We recommend using 192 kbps.
          </div>
        </div>
        <div>
          <select
              class="w-full rounded bg-base-700 text-white/50 border-0 py-1.5"
              v-model.number="props.settings.output.audio.bitrate"
              @change="commitSettings"
          >
            <option value="64">64 kbps</option>
            <option value="96">96 kbps</option>
            <option value="128">128 kbps</option>
            <option value="160">160 kbps</option>
            <option value="192" selected>192 kbps</option>
            <option value="224">224 kbps</option>
            <option value="256">256 kbps</option>
            <option value="288">288 kbps</option>
            <option value="320">320 kbps</option>
          </select>
        </div>
      </div>
      <div class="bg-base-600/40 rounded flex items-center p-3 gap-4 justify-between">
        <div class="self-center">
          <div class="text-sm">Preset</div>
          <div class="text-xs text-white/50">
            We recommend using the fast preset.
          </div>
        </div>
        <div>
          <select
              class="w-full rounded bg-base-700 text-white/50 border-0 py-1.5"
              v-model="props.settings.output.preset"
              @change="commitSettings"
          >
            <option value="default">Default</option>
            <option value="fast">Fast</option>
            <option value="medium">Medium</option>
            <option value="slow">Slow</option>
          </select>
        </div>
      </div>
      <div class="bg-base-600/40 rounded flex items-center p-3 gap-4 justify-between">
        <div class="self-center">
          <div class="text-sm">Profile</div>
          <div class="text-xs text-white/50">
            We recommend using the high profile.
          </div>
        </div>
        <div>
          <select
              class="w-full rounded bg-base-700 text-white/50 border-0 py-1.5"
              v-model="props.settings.output.profile"
              @change="commitSettings"
          >
            <option value="high">High</option>
            <option value="main">Main</option>
            <option value="baseline">Baseline</option>
          </select>
        </div>
      </div>
      <div class="bg-base-600/40 rounded flex items-center p-3 gap-4 justify-between">
        <div class="self-center">
          <div class="text-sm">CRF</div>
          <div class="text-xs text-white/50">
            Lower values mean higher quality, 17-28 is usually a good range.
          </div>
        </div>
        <div>
          <input
              type="number"
              min="0"
              max="51"
              step="1"
              class="w-full rounded bg-base-700 text-white/50 border-0 py-1.5"
              v-model.number="props.settings.output.crf"
              @change="commitSettings"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 4px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

</style>