<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import ProgressBar from "./components/ProgressBar.vue";
import AppTitleBar from "./components/AppTitleBar.vue";
import VButton from "./components/VButton.vue";
import {Settings, Video} from "../shared/schema";

console.log("[App.vue]", `Hello world from Electron ${process.versions.electron}!`)

const isEncoding = ref(false)
const isCompleted = ref(false)
const encodingProgress = ref(0)
const encodingProgressStage = ref<string>('unknown')
const encodingError = ref<string | null>(null)
const version = ref<string>('unknown')

const reset = () => {
  encodingProgress.value = 0
  encodingProgressStage.value = 'unknown'
  encodingError.value = null
  isEncoding.value = false
  isCompleted.value = false
}

const requestEncode = (event: any) => {
  // get file from @change event
  const file = event.target.files[0] as File

  // @ts-ignore
  window.api.on('encode-start', (event: any, id: string) => {
    encodingProgressStage.value = 'starting'
    encodingProgress.value = 0
    console.log('encode-start', id)
  })

  // @ts-ignore
  window.api.on('encode-progress', (event: any, id: string, progress: number) => {
    encodingProgress.value = progress
    encodingProgressStage.value = 'transcoding'
    console.log('encode-progress', id, progress)
  })

  // @ts-ignore
  window.api.on('encode-upload-progress', (event: any, id: string, progress: number) => {
    encodingProgress.value = progress
    encodingProgressStage.value = 'uploading'
    console.log('encode-upload-progress', id, progress)
  })

  // @ts-ignore
  window.api.on('encode-upload-complete', (event: any, id: string, video: Video) => {
    encodingProgressStage.value = 'complete'
    encodingProgress.value = 100
    isEncoding.value = false
    isCompleted.value = true
    console.log('encode-upload-complete', id, video)
  })

  // @ts-ignore
  window.api.on('encode-error', (event: any, id: string, error: any) => {
    encodingProgressStage.value = 'error'
    encodingProgress.value = 0
    isEncoding.value = false
    isCompleted.value = false
    encodingError.value = error
    console.log('encode-error', id, error)
  })

  try {
    isEncoding.value = true
    encodingError.value = null
    isCompleted.value = false
    // @ts-ignore
    window.api.encode('file-upload-123', file.path, {
      title: file.name,
      publishOnComplete: true,
    })
  } catch (err) {
    isEncoding.value = false
    isCompleted.value = false
    encodingError.value = 'Failed to encode video'
    console.error(err)
  }
}

const settings = ref<Settings | null>(null);
const fileInput = ref<HTMLInputElement | null>(null)

// Authorization Code Grant with PKCE
const oauthHref = computed(() => {
  const params = new URLSearchParams({
    client_id: '97be2e0d-fc64-4a0c-af7b-959f754f516e',
    redirect_uri: 'http://localhost:8361/oauth',
    response_type: 'token',
    scope: 'user:read video:read video:manage',
  })

  return `https://rerunmanager.com/oauth/authorize?${params.toString()}`
})

const settingsChanged = (settings: any) => {
  console.log('settingsChanged', settings)
}

const logout = () => {
  // @ts-ignore
  window.api.logout()
}

const storageUpgradeRequired = computed(() => {
  if (!settings.value) return false
  if (!settings.value.credentials) return false
  // @ts-ignore
  return !settings.value.credentials.user.config.premium
})

onMounted(() => {
  // @ts-ignore
  window.api.onSettingsChanged((x: any) => settings.value = x)
  // @ts-ignore
  window.api.getSettings()
      .then((x: any) => settings.value = x)
      .catch((err: any) => console.error(err))

  // @ts-ignore
  window.api.getVersion().then((x: any) => version.value = `v${x}`)
})
</script>

<template>
  <div class="app h-screen w-screen bg-base-800 text-white flex flex-col justify-between">
    <div>
      <app-title-bar/>

      <div class="px-6 flex">
        <div>
          <img src="./assets/ffmpeg.svg" class="h-16" alt="ffmpeg">
        </div>
        <div>
          <div class="font-bold text-xl mt-2">Rerun Encoder</div>
          <div class="text-sm text-zinc-400">Powered by FFmpeg</div>

          <div class="flex gap-4 mt-4">
            <a
                class="text-rose-400"
                href="https://www.bitinflow.com/legal/privacy/"
                target="_blank"
            >
              <i class="far fa-arrow-up-right-from-square"></i>
              Privacy & terms
            </a>
            <a
                class="text-rose-400"
                href="https://github.com/bitinflow/rerun-encoder#readme"
                target="_blank"
            >
              <i class="far fa-arrow-up-right-from-square"></i>
              More details
            </a>
          </div>
        </div>
      </div>
    </div>
    <div>
      <div>
        <div v-if="settings && settings.credentials" class="p-4 flex justify-between bg-base-900">
          <div class="test flex gap-2">
            <div>
              <img
                  class="h-16 rounded-full"
                  :src="settings.credentials.user.avatar_url"
                  alt="channel avatar"
              >
            </div>
            <div class="self-center">
              <div class="text-lg">{{ settings.credentials.user.name }}</div>
              <div class="text-sm text-zinc-400">
                {{ settings.credentials.user.config.storage_used }}
                of {{ settings.credentials.user.config.storage_limit }}
                GB used
              </div>
              <div class="flex text-sm text-zinc-600 gap-1">
                <div>
                  {{ version }}
                </div>
                <div class="text-zinc-700">|</div>
                <a href="#" @click.prevent="logout">Logout</a>
              </div>
            </div>
          </div>
          <div class="self-center">
            <div v-if="encodingError" class="text-right">
              <div class="text-rose-400 text-sm w-64">
                {{ encodingError }}
              </div>
              <a href="#"
                 class="text-zinc-400 text-sm"
                 @click="reset">
                Retry
              </a>
            </div>
            <div v-else-if="isCompleted" class="text-right">
              <div class="text-emerald-400 w-64">
                <i class="fa-solid fa-check"></i>
                Video uploaded successfully!
              </div>
              <a href="#"
                 class="text-zinc-400 text-sm"
                 @click="reset">
                Upload another
              </a>
            </div>
            <template v-else-if="isEncoding">
              <progress-bar :progress="encodingProgress" :stage="encodingProgressStage"/>
            </template>
            <template v-else>
              <input
                  ref="fileInput"
                  class="hidden"
                  type="file"
                  accept="video/mp4"
                  @change="requestEncode"
              >
              <v-button
                  @click="fileInput && fileInput.click()"
                  :disabled="isEncoding"
              >
                <i class="fal fa-upload"></i>
                Transcode & Upload
              </v-button>
            </template>
          </div>
        </div>
        <div v-else class="p-4 flex justify-between bg-base-900">
          <div class="self-center opacity-70">
            Login required
          </div>
          <div class="py-5">
            <a :href="oauthHref" class="bg-primary-500 py-1.5 px-4 rounded text-white" target="_blank">
              <i class="fal fa-lock"></i>
              Login with Rerun Manager
            </a>
          </div>
        </div>
      </div>
      <div
          v-if="storageUpgradeRequired"
          class="bg-primary-500 text-white px-4 py-1 text-sm flex justify-between">
        <div>
          <i class="fa-solid fa-stars"></i>
          Need more storage? Get Rerun Manager Premium!
        </div>
        <div class="text-sm">
          <a href="https://www.rerunmanager.com/plans" target="_blank" class="text-white">
            <i class="far fa-arrow-up-right-from-square"></i>
            Learn more
          </a>
        </div>
      </div>
    </div>
  </div>
</template>