import { createRouter, createWebHistory } from 'vue-router'

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: () => import('./pages/Home.vue') },
    { path: '/box', component: () => import('./pages/BoxBuilder.vue') },
    { path: '/scad', component: () => import('./pages/OpenScadViewer.vue') },
    { path: '/:pathMatch(.*)*', component: () => import('./pages/NotFound.vue') },
  ],
})
