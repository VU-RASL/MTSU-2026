<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useCustomizerStore } from '../../../stores/customizer';
import { useEcomStore } from '@/stores/apps/eCommerce';
import { GridDotsIcon, LanguageIcon, SearchIcon, Menu2Icon, BellIcon, ShoppingCartIcon } from 'vue-tabler-icons';
import LanguageDD from './LanguageDD.vue';
import NotificationDD from './NotificationDD.vue';
import ProfileDD from './ProfileDD.vue';
import Searchbar from './Searchbar.vue';
import Logo from '../logo/Logo.vue';
import LogoIcon from '../logo/LogoIcon.vue'
import RightMobileSidebar from './RightMobileSidebar.vue';
import Navigations from './Navigations.vue';

const customizer = useCustomizerStore();
const showSearch = ref(false);
const appsdrawer = ref(false);
const priority = ref(customizer.setHorizontalLayout ? 0 : 0);
function searchbox() {
    showSearch.value = !showSearch.value;
}
watch(priority, (newPriority) => {
    priority.value = newPriority;
});

// count items
const store = useEcomStore();
const getCart = computed(() => {
    return store.cart;
});
</script>

<template>
    <v-app-bar elevation="10" :priority="priority" height="64" color=""  id="top">
        <div class="d-sm-flex d-none">
            <Logo />
        </div>
        <div class="d-sm-none d-flex mr-2">
           <LogoIcon/>
        </div>
        <v-btn
            class="hidden-md-and-down "
            icon
            color=""    
            variant="text"
            @click.stop="customizer.SET_MINI_SIDEBAR(!customizer.mini_sidebar)"
        >
            <Menu2Icon size="25"  />
        </v-btn>
        <v-btn class="hidden-lg-and-up" icon variant="text" @click.stop="customizer.SET_SIDEBAR_DRAWER" size="small">
            <Menu2Icon size="25" />
        </v-btn>

        <!-- ---------------------------------------------- -->
        <!-- Search part -->
        <!-- ---------------------------------------------- -->
        
            <Searchbar />
     

        <!---/Search part -->

        <!-- ---------------------------------------------- -->
        <!-- Mega menu -->
        <!-- ---------------------------------------------- -->
        <!-- <div class="hidden-md-and-down">
            <Navigations />
        </div> -->
        <v-spacer />
        <!-- ---------------------------------------------- -->
        <!---right part -->
        <!-- ---------------------------------------------- -->
        <!-- ---------------------------------------------- -->
        <!-- translate -->
        <!-- ---------------------------------------------- -->
        
        <LanguageDD />

        <!-- ---------------------------------------------- -->
        <!-- ShoppingCart -->
        <!-- ---------------------------------------------- -->
        <v-btn icon variant="text" color="primary" to="/ecommerce/checkout">
            <v-badge  color="error" :content="getCart?.length">
                <ShoppingCartIcon stroke-width="1.5" size="22" />
            </v-badge>
        </v-btn>


        <!-- ---------------------------------------------- -->
        <!-- Notification -->
        <!-- ---------------------------------------------- -->
        <NotificationDD />
        <!-- ---------------------------------------------- -->
        <!-- User Profile -->
        <!-- ---------------------------------------------- -->
        <div class="ml-2">
            <ProfileDD />
        </div>
    </v-app-bar>

    <!-- ---------------------------------------------- -->
    <!-- Right Sidebar -->
    <!-- ---------------------------------------------- -->
    <v-navigation-drawer v-model="appsdrawer" location="right" temporary>
        <RightMobileSidebar />
    </v-navigation-drawer>
</template>
