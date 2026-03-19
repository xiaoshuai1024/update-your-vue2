import Vue from "vue";

// Intentional Vue2 patterns for codemod notes:
Vue.use(function () {});

new Vue({
  render: (h) => h("div", "hello")
}).$mount("#app");

