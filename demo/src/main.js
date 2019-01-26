import Vue from 'vue'
import App from './App.vue'
import drr from '@minogin/vue-drag-resize-rotate'

Vue.config.productionTip = false

Vue.component('drr', drr)

new Vue({
  render: h => h(App),
}).$mount('#app')
