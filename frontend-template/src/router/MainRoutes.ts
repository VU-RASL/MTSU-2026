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
            name: 'Minimal',
            path: '/dashboards/minimal',
            component: () => import('@/views/dashboards/minimal/Minimal.vue'),
        },
        {
            name: 'Analytical',
            path: '/dashboards/analytical',
            component: () => import('@/views/dashboards/analytical/Analytical.vue'),
        },
        {
            name: 'Demographical',
            path: '/dashboards/demographical',
            component: () => import('@/views/dashboards/demographical/Demographical.vue'),
        },
        {
            name: 'Modern',
            path: '/dashboards/modern',
            component: () => import('@/views/dashboards/modern/Modern.vue'),
        },
        {
            name: 'Chats',
            path: '/apps/chats',
            component: () => import('@/views/apps/chat/Chats.vue')
        },
        {
            name: 'Email',
            path: '/apps/email',
            component: () => import('@/views/apps/email/Email.vue')
        },
        {
            name: 'ecom Products',
            path: '/ecommerce/products',
            component: () => import('@/views/apps/eCommerce/Products.vue')
        },
        {
            name: 'Product detail',
            path: '/ecommerce/product/detail/:id',
            component: () => import('@/views/apps/eCommerce/ProductDetails.vue')
        },
        {
            name: 'Product Checkout',
            path: '/ecommerce/checkout',
            component: () => import('@/views/apps/eCommerce/ProductCheckout.vue')
        },
        {
            name: 'Product Listing',
            path: '/ecommerce/productlist',
            component: () => import('@/views/apps/eCommerce/ProductList.vue')
        },
        {
            name: 'Posts',
            path: '/apps/blog/posts',
            component: () => import('@/views/apps/blog/Posts.vue')
        },
        {
            name: 'Detail',
            path: '/apps/blog/:id',
            component: () => import('@/views/apps/blog/Detail.vue')
        },

        {
            name: 'UserProfile',
            path: '/apps/user/profile',
            component: () => import('@/views/apps/user-profile/Profile.vue')
        },
        {
            name: 'UserFollowers',
            path: '/apps/user/profile/followers',
            component: () => import('@/views/apps/user-profile/Followers.vue')
        },
        {
            name: 'UserFriends',
            path: '/apps/user/profile/friends',
            component: () => import('@/views/apps/user-profile/Friends.vue')
        },
        {
            name: 'UserGallery',
            path: '/apps/user/profile/gallery',
            component: () => import('@/views/apps/user-profile/Gallery.vue')
        },
        {
            name: 'Notes',
            path: '/apps/notes',
            component: () => import('@/views/apps/notes/Notes.vue')
        },
        {
            name: 'Contact',
            path: '/apps/contacts',
            component: () => import('@/views/apps/contact/Contact.vue')
        },
        {
            name: 'Calendar',
            path: '/apps/calendar',
            component: () => import('@/views/apps/calendar/Calendar.vue')
        },
        {
            name: 'Kanban',
            path: '/apps/kanban',
            component: () => import('@/views/apps/kanban/Kanban.vue')
        },
        {
            name: 'Alert',
            path: '/ui-components/alert',
            component: () => import('@/views/ui-elements/UiAlert.vue')
        },
        {
            name: 'Accordion',
            path: '/ui-components/accordion',
            component: () => import('@/views/ui-elements/UiExpansionPanel.vue')
        },
        {
            name: 'Avtar',
            path: '/ui-components/avatar',
            component: () => import('@/views/ui-elements/UiAvatar.vue')
        },
        {
            name: 'Chip',
            path: '/ui-components/chip',
            component: () => import('@/views/ui-elements/UiChip.vue')
        },
        {
            name: 'Dialog',
            path: '/ui-components/dialogs',
            component: () => import('@/views/ui-elements/UiDialog.vue')
        },
        {
            name: 'List',
            path: '/ui-components/list',
            component: () => import('@/views/ui-elements/UiList.vue')
        },
        {
            name: 'Menus',
            path: '/ui-components/menus',
            component: () => import('@/views/ui-elements/UiMenus.vue')
        },
        {
            name: 'Rating',
            path: '/ui-components/rating',
            component: () => import('@/views/ui-elements/UiRating.vue')
        },
        {
            name: 'Tabs',
            path: '/ui-components/tabs',
            component: () => import('@/views/ui-elements/UiTabs.vue')
        },
        {
            name: 'Tooltip',
            path: '/ui-components/tooltip',
            component: () => import('@/views/ui-elements/UiTooltip.vue')
        },
        {
            name: 'Typography',
            path: '/ui-components/typography',
            component: () => import('@/views/style-animation/Typography.vue')
        },
        {
            name: 'Line',
            path: '/charts/line-chart',
            component: () => import('@/views/charts/ApexLineChart.vue')
        },
        {
            name: 'Area',
            path: '/charts/area-chart',
            component: () => import('@/views/charts/ApexAreaChart.vue')
        },
        {
            name: 'Gredient',
            path: '/charts/gredient-chart',
            component: () => import('@/views/charts/ApexGredientChart.vue')
        },
        {
            name: 'Column',
            path: '/charts/column-chart',
            component: () => import('@/views/charts/ApexColumnChart.vue')
        },
        {
            name: 'Candlestick',
            path: '/charts/candlestick-chart',
            component: () => import('@/views/charts/ApexCandlestickChart.vue')
        },
        {
            name: 'Donut & Pie',
            path: '/charts/doughnut-pie-chart',
            component: () => import('@/views/charts/ApexDonutPieChart.vue')
        },
        {
            name: 'Radialbar & Radar',
            path: '/charts/radialbar-chart',
            component: () => import('@/views/charts/ApexRadialRadarChart.vue')
        },
        {
            name: 'Banners',
            path: '/widgets/banners',
            component: () => import('@/views/widgets/banners/banners.vue')
        },
        {
            name: 'Cards',
            path: '/widgets/cards',
            component: () => import('@/views/widgets/cards/cards.vue')
        },
        {
            name: 'Charts',
            path: '/widgets/charts',
            component: () => import('@/views/widgets/charts/charts.vue')
        },
        {
            name: 'Autocomplete',
            path: '/forms/form-elements/autocomplete',
            component: () => import('@/views/forms/form-elements/VAutocomplete.vue')
        },
        {
            name: 'Combobox',
            path: '/forms/form-elements/combobox',
            component: () => import('@/views/forms/form-elements/Combobox.vue')
        },
        {
            name: 'File Inputs',
            path: '/forms/form-elements/fileinputs',
            component: () => import('@/views/forms/form-elements/FileInputs.vue')
        },
        {
            name: 'Custom Inputs',
            path: '/forms/form-elements/custominputs',
            component: () => import('@/views/forms/form-elements/CustomInputs.vue')
        },
        {
            name: 'Select',
            path: '/forms/form-elements/select',
            component: () => import('@/views/forms/form-elements/Select.vue')
        },
        {
            name: 'Button',
            path: '/forms/form-elements/button',
            component: () => import('@/views/forms/form-elements/VButtons.vue')
        },
        {
            name: 'Checkbox',
            path: '/forms/form-elements/checkbox',
            component: () => import('@/views/forms/form-elements/VCheckbox.vue')
        },
        {
            name: 'Radio',
            path: '/forms/form-elements/radio',
            component: () => import('@/views/forms/form-elements/VRadio.vue')
        },
        {
            name: 'Date Time',
            path: '/forms/form-elements/date-time',
            component: () => import('@/views/forms/form-elements/VDateTime.vue')
        },
        {
            name: 'Slider',
            path: '/forms/form-elements/slider',
            component: () => import('@/views/forms/form-elements/VSlider.vue')
        },
        {
            name: 'Switch',
            path: '/forms/form-elements/switch',
            component: () => import('@/views/forms/form-elements/VSwitch.vue')
        },
        {
            name: 'Form Layout',
            path: '/forms/form-layouts',
            component: () => import('@/views/forms/FormLayouts.vue')
        },
        {
            name: 'Form Horizontal',
            path: '/forms/form-horizontal',
            component: () => import('@/views/forms/FormHorizontal.vue')
        },
        {
            name: 'Form Vertical',
            path: '/forms/form-vertical',
            component: () => import('@/views/forms/FormVertical.vue')
        },
        {
            name: 'Form Custom',
            path: '/forms/form-custom',
            component: () => import('@/views/forms/FormCustom.vue')
        },
        {
            name: 'Form Validation',
            path: '/forms/form-validation',
            component: () => import('@/views/forms/FormValidation.vue')
        },
        {
            name: 'Editor',
            path: '/forms/editor',
            component: () => import('@/views/forms/plugins/editor/Editor.vue')
        },
        {
            name: 'Basic Table',
            path: '/tables/basic',
            component: () => import('@/views/tables/TableBasic.vue')
        },
        {
            name: 'Dark Table',
            path: '/tables/dark',
            component: () => import('@/views/tables/TableDark.vue')
        },
        {
            name: 'Density Table',
            path: '/tables/density',
            component: () => import('@/views/tables/TableDensity.vue')
        },
        {
            name: 'Fixed Header Table',
            path: '/tables/fixed-header',
            component: () => import('@/views/tables/TableHeaderFixed.vue')
        },
        {
            name: 'Height Table',
            path: '/tables/height',
            component: () => import('@/views/tables/TableHeight.vue')
        },
        {
            name: 'Editable Table',
            path: '/tables/editable',
            component: () => import('@/views/tables/TableEditable.vue')
        },
        {
            name: 'Basic Data Table',
            path: '/datatables/basic',
            component: () => import('@/views/tables/datatables/BasicTable.vue')
        },
        {
            name: 'Header Data Table',
            path: '/datatables/header',
            component: () => import('@/views/tables/datatables/HeaderTables.vue')
        },
        {
            name: 'Selection Data Table',
            path: '/datatables/selection',
            component: () => import('@/views/tables/datatables/Selectable.vue')
        },
        {
            name: 'Sorting Data Table',
            path: '/datatables/sorting',
            component: () => import('@/views/tables/datatables/SortingTable.vue')
        },
        {
            name: 'Pagination Data Table',
            path: '/datatables/pagination',
            component: () => import('@/views/tables/datatables/Pagination.vue')
        },
        {
            name: 'Filtering Data Table',
            path: '/datatables/filtering',
            component: () => import('@/views/tables/datatables/Filtering.vue')
        },
        {
            name: 'Grouping Data Table',
            path: '/datatables/grouping',
            component: () => import('@/views/tables/datatables/Grouping.vue')
        },
        {
            name: 'Slots Data Table',
            path: '/datatables/slots',
            component: () => import('@/views/tables/datatables/Slots.vue')
        },
        {
            name: "Material",
            path: "/icons/material",
            component: () => import("@/views/icons/MaterialIcons.vue"),
        },
        {
            name: "Tabler",
            path: "/icons/tabler",
            component: () => import("@/views/icons/TablerIcons.vue"),
        },

    ]
};

export default MainRoutes;
