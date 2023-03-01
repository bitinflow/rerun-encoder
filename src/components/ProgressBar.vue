<template>
  <div class="flex flex-col items-center justify-center gap-1.5 w-64">
    <div class="text-xs text-zinc-400 flex justify-between w-full">
      <div class="font-bold capitalize">{{ stage }}</div>
      <div>{{ format(progress) }}%</div>
    </div>
    <div class="w-full h-2 bg-base-500 rounded-full">
      <div
          class="h-2 bg-primary-500 rounded-full"
          :style="{ width: `${progress}%` }"
      ></div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: "ProgressBar",

  props: {
    progress: {
      type: Number,
      default: 0
    },
    stage: {
      type: String,
      default: ""
    }
  },

  methods: {
    format(progress: number) {
      return Math.round(progress)
    }
  }
}
</script>