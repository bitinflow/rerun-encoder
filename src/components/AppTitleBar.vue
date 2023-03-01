<template>
  <div class="flex justify-between p-4 text-sm title-bar">
    <div class="flex gap-2">
      <i class="fas fa-solid fa-arrow-rotate-right self-center"></i>
      <div>
        Rerun Manager - Encoder
      </div>
    </div>
    <div class="flex gap-3">
      <a href="#" @click="minimizeCompanion">
        <i class="fal fa-dash"></i>
      </a>
      <a href="#" @click="closeCompanion">
        <i class="fal fa-xmark"></i>
      </a>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: "AppTitleBar",
  methods: {
    minimizeCompanion() {
      // @ts-ignore
      window.api.minimize()
    },
    closeCompanion() {
      // @ts-ignore
      window.api.quit();
    },
  },
}
</script>