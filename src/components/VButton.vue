<template>
  <button
      type="button"
      @click="$emit('click')"
      class="bg-primary-500 py-1.5 px-4 rounded text-white"
  >
    <slot/>
  </button>
</template>

<script lang="ts">
export default {
  name: "VButton",
  emits: ['click']
}
</script>