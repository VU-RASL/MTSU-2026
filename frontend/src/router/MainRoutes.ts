const MainRoutes = {
    path: '/main',
    meta: {
        requiresAuth: true
    },
    redirect: '/main',
    component: () => import('@/layouts/full/FullLayout.vue'),
    children: [
        {
            path: '/',
            redirect: "/dashboards/minimal",
        },
        {
            name: 'Learn',
            path: '/apps/learn',
            component: () => import('@/views/apps/learn/Learn-Main.vue')
        },
        {
            name: 'Minimal',
            path: '/dashboards/minimal',
            component: () => import('@/views/dashboards/minimal/Minimal.vue'),
        },
        {
            name: 'Personas',
            path: '/apps/personas',
            component: () => import('@/views/apps/personas/Personas.vue')
        },
        {
            name: 'Run Sim',
            path: '/apps/runtime',
            component: () => import('@/views/apps/runtime/Runtime.vue')
        },
        {
            name: 'Phone Config',
            path: '/apps/phone',
            component: () => import('@/views/apps/runtime/PhoneView.vue')
        },
        {
            name: 'Chats',
            path: '/apps/chats',
            component: () => import('@/views/apps/chat/Chats.vue')
        },
        
    ]
};

export default MainRoutes;
