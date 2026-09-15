<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import { useCustomizerStore } from '@/stores/customizer';
import sidebarItems from './sidebarItem';

import NavGroup from './NavGroup/index.vue';
import NavItem from './NavItem/index.vue';
import NavCollapse from './NavCollapse/NavCollapse.vue';
import Logo from '../logo/Logo.vue';
import { useAuthStore } from '@/stores/auth';
const customizer = useCustomizerStore();
const sidebarMenu = shallowRef(sidebarItems);
const authStore = useAuthStore();
</script>

<template>
    <v-navigation-drawer left v-model="customizer.Sidebar_drawer" elevation="0" rail-width="75" mobile-breakpoint="960" app
        class="leftSidebar" :rail="customizer.mini_sidebar" expand-on-hover width="256">

        <!-- ---------------------------------------------- -->
        <!---Navigation -->
        <!-- ---------------------------------------------- -->
        <perfect-scrollbar class="scrollnavbar">
            <div class="sidebar_profile border-bottom">
                <v-list class="bg-muted">
                    <v-list-item class="pa-4 ml-1">
                        <v-list-item-title class="text-h6">Simphony User</v-list-item-title>
                        <v-list-item-subtitle  class="text-subtitle-1">Domain Expert</v-list-item-subtitle>
                    <template v-slot:prepend class="me-0">
                        <v-avatar size="45" class="me-0">
                        <img src="@/assets/images/profile/user2.jpg" width="50" />
                        </v-avatar>
                    </template>
                    <!-- <template v-slot:append>
                        <v-btn variant="text" icon rounded="md" @click="authStore.logout()">
                            <PowerIcon size="22" />
                            <v-tooltip activator="parent" location="top">Logout</v-tooltip>
                        </v-btn>
                    </template> -->
                    </v-list-item>
                </v-list>
            </div>
            <v-list class="py-5 px-4 bg-muted">
                <!---Menu Loop -->
                <template v-for="(item, i) in sidebarMenu">
                    <!---Item Sub Header -->
                    <NavGroup :item="item" v-if="item.header" :key="item.title" />
                    <!---If Has Child -->
                    <NavCollapse class="leftPadding" :item="item" :level="0" v-else-if="item.children" />
                    <!---Single Item-->
                    <NavItem :item="item" v-else class="leftPadding" />
                    <!---End Single Item-->
                </template>
            </v-list>
        </perfect-scrollbar>
    </v-navigation-drawer>
</template>
