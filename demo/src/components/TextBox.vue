<template>
  <div class="text" @active="onActive()" v-if="!textActive">
    {{text}}
  </div>
  <textarea ref="area" v-model="text" class="textarea" @blur="onBlur" v-else>
  </textarea>
</template>

<script>
  export default {
    data() {
      return {
        text: 'Double click me to edit',
        textActive: false
      }
    },
    mounted() {
      this.$on('active', this.onActive)
    },
    methods: {
      onActive() {
        this.textActive = true
        this.$nextTick(() => {
          this.$refs.area.focus()
          this.text = 'Now you can edit me. Click outside when finished.'
        })

      },
      onBlur() {
        this.textActive = false
        this.$parent.$emit('content-inactive')
      }
    }
  }
</script>

<style>
  .text {
    width: 100%;
    height: 100%;
    border: 1px solid lightgrey;
  }

  .textarea {
    position: absolute;
    width: 100%;
    height: 100%;
  }
</style>
