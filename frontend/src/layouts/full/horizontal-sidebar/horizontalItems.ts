import {
    AlertCircleIcon,
    AppsIcon,
    BorderAllIcon,
    BrandTablerIcon,
    CircleDotIcon, ClipboardIcon, FileDescriptionIcon, HomeIcon, LoginIcon, RotateIcon, SettingsIcon, UserPlusIcon, ZoomCodeIcon,
    ColumnsIcon,
    RowInsertBottomIcon,
    EyeTableIcon,
    SortAscendingIcon,
    PageBreakIcon,
    FilterIcon,
    BoxModelIcon,
    ServerIcon,
    BrandAirtableIcon

} from 'vue-tabler-icons';

export interface menu {
    header?: string;
    title?: string;
    icon?: any;
    to?: string;
    divider?: boolean;
    chip?: string;
    chipColor?: string;
    chipVariant?: string;
    chipIcon?: string;
    children?: menu[];
    disabled?: boolean;
    subCaption?: string;
    class?: string;
    extraclass?: string;
    type?: string;
}

const horizontalItems: menu[] = [
   
    {
        title: 'Dashboard',
        icon: HomeIcon,
        to: '#',
        children: [
            {
                title: "Analytical",
                icon: CircleDotIcon,
                to: "/dashboards/analytical",
              },
              {
                title: "Demographical",
                icon: CircleDotIcon,
                to: "/dashboards/demographical",
              },
              {
                title: "Minimal",
                icon: CircleDotIcon,
                to: "/dashboards/minimal",
              },
              {
                title: "Modern",
                icon: CircleDotIcon,
                to: "/dashboards/modern",
              },

        ]
    },
    {
        title: 'Apps',
        icon: AppsIcon,
        to: '#',
        children: [
            {
                title: 'Chats',
                icon: CircleDotIcon,
                to: '/apps/chats'
            },
            {
                title: 'Blog',
                icon: CircleDotIcon,
                to: '/',
                children: [
                    {
                        title: 'Posts',
                        icon: CircleDotIcon,
                        to: '/apps/blog/posts'
                    },
                    {
                        title: 'Detail',
                        icon: CircleDotIcon,
                        to: '/apps/blog/early-black-friday-amazon-deals-cheap-tvs-headphones'
                    }
                ]
            },
            {
                title: 'E-Commerce',
                icon: CircleDotIcon,
                to: '/ecommerce/',
                children: [
                    {
                        title: 'Shop',
                        icon: CircleDotIcon,
                        to: '/ecommerce/products'
                    },
                    {
                        title: 'Detail',
                        icon: CircleDotIcon,
                        to: '/ecommerce/product/detail/1'
                    },
                    {
                        title: 'List',
                        icon: CircleDotIcon,
                        to: '/ecommerce/productlist'
                    },
                    {
                        title: 'Checkout',
                        icon: CircleDotIcon,
                        to: '/ecommerce/checkout'
                    }
                ]
            },
            {
                title: 'User Profile',
                icon: CircleDotIcon,
                to: '/',
                children: [
                    {
                        title: 'Profile',
                        icon: CircleDotIcon,
                        to: '/apps/user/profile'
                    },
                    {
                        title: 'Followers',
                        icon: CircleDotIcon,
                        to: '/apps/user/profile/followers'
                    },
                    {
                        title: 'Friends',
                        icon: CircleDotIcon,
                        to: '/apps/user/profile/friends'
                    },
                    {
                        title: 'Gallery',
                        icon: CircleDotIcon,
                        to: '/apps/user/profile/gallery'
                    }
                ]
            },
            {
                title: 'Notes',
                icon: CircleDotIcon,
                to: '/apps/notes'
            },
            {
                title: 'Calendar',
                icon: CircleDotIcon,
                to: '/apps/calendar'
            },
            {
                title: 'Kanban',
                icon: CircleDotIcon,
                to: '/apps/kanban'
            },
        ]
    },

    {
        title: 'Pages',
        icon: ClipboardIcon,
        to: '#',
        children: [
            {
                title: 'Widget',
                icon: CircleDotIcon,
                to: '/widget-card',
                children: [
                    {
                        title: 'Cards',
                        icon: CircleDotIcon,
                        to: '/widgets/cards'
                    },
                    {
                        title: 'Banners',
                        icon: CircleDotIcon,
                        to: '/widgets/banners'
                    },
                    {
                        title: 'Charts',
                        icon: CircleDotIcon,
                        to: '/widgets/charts'
                    }
                ]
            },
            {
                title: 'UI',
                icon: CircleDotIcon,
                to: '#',
                children: [
                    {
                        title: 'Alert',
                        icon: CircleDotIcon,
                        to: '/ui-components/alert'
                    },
                    {
                        title: 'Accordion',
                        icon: CircleDotIcon,
                        to: '/ui-components/accordion'
                    },
                    {
                        title: 'Avatar',
                        icon: CircleDotIcon,
                        to: '/ui-components/avatar'
                    },
                    {
                        title: 'Chip',
                        icon: CircleDotIcon,
                        to: '/ui-components/chip'
                    },
                    {
                        title: 'Dialog',
                        icon: CircleDotIcon,
                        to: '/ui-components/dialogs'
                    },
                    {
                        title: 'List',
                        icon: CircleDotIcon,
                        to: '/ui-components/list'
                    },
                    {
                        title: 'Menus',
                        icon: CircleDotIcon,
                        to: '/ui-components/menus'
                    },
                    {
                        title: 'Rating',
                        icon: CircleDotIcon,
                        to: '/ui-components/rating'
                    },
                    {
                        title: 'Tabs',
                        icon: CircleDotIcon,
                        to: '/ui-components/tabs'
                    },
                    {
                        title: 'Tooltip',
                        icon: CircleDotIcon,
                        to: '/ui-components/tooltip'
                    },
                    {
                        title: 'Typography',
                        icon: CircleDotIcon,
                        to: '/ui-components/typography'
                    }
                ]
            },
            {
                title: 'Charts',
                icon: CircleDotIcon,
                to: '#',
                children: [
                    {
                        title: 'Line',
                        icon: CircleDotIcon,
                        to: '/charts/line-chart'
                    },
                    {
                        title: 'Gredient',
                        icon: CircleDotIcon,
                        to: '/charts/gredient-chart'
                    },
                    {
                        title: 'Area',
                        icon: CircleDotIcon,
                        to: '/charts/area-chart'
                    },
                    {
                        title: 'Candlestick',
                        icon: CircleDotIcon,
                        to: '/charts/candlestick-chart'
                    },
                    {
                        title: 'Column',
                        icon: CircleDotIcon,
                        to: '/charts/column-chart'
                    },
                    {
                        title: 'Doughnut & Pie',
                        icon: CircleDotIcon,
                        to: '/charts/doughnut-pie-chart'
                    },
                    {
                        title: 'Radialbar & Radar',
                        icon: CircleDotIcon,
                        to: '/charts/radialbar-chart'
                    }
                ]
            },
            {
                title: 'Auth',
                icon: CircleDotIcon,
                to: '#',
                children: [
                    {
                        title: 'Error',
                        icon: AlertCircleIcon,
                        to: '/auth/404'
                    },
                    {
                        title: 'Maintenance',
                        icon: SettingsIcon,
                        to: '/auth/maintenance'
                    },
                    {
                        title: 'Login',
                        icon: LoginIcon,
                        to: '#',
                        children: [
                            {
                                title: 'Side Login',
                                icon: CircleDotIcon,
                                to: '/auth/login'
                            },
                            {
                                title: 'Boxed Login',
                                icon: CircleDotIcon,
                                to: '/auth/login2'
                            }
                        ]
                    },
                    {
                        title: 'Register',
                        icon: UserPlusIcon,
                        to: '#',
                        children: [
                            {
                                title: 'Side Register',
                                icon: CircleDotIcon,
                                to: '/auth/register'
                            },
                            {
                                title: 'Boxed Register',
                                icon: CircleDotIcon,
                                to: '/auth/register2'
                            }
                        ]
                    },
                    {
                        title: 'Forgot Password',
                        icon: RotateIcon,
                        to: '#',
                        children: [
                            {
                                title: 'Side Forgot Password',
                                icon: CircleDotIcon,
                                to: '/auth/forgot-password'
                            },
                            {
                                title: 'Boxed Forgot Password',
                                icon: CircleDotIcon,
                                to: '/auth/forgot-password2'
                            }
                        ]
                    },
                    {
                        title: 'Two Steps',
                        icon: ZoomCodeIcon,
                        to: '#',
                        children: [
                            {
                                title: 'Side Two Steps',
                                icon: CircleDotIcon,
                                to: '/auth/two-step'
                            },
                            {
                                title: 'Boxed Two Steps',
                                icon: CircleDotIcon,
                                to: '/auth/two-step2'
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        title: 'Forms',
        icon: FileDescriptionIcon,
        to: '#',
        children: [
            {
                title: 'Form Elements',
                icon: CircleDotIcon,
                to: '/components/',
                children: [
                    {
                        title: 'Autocomplete',
                        icon: CircleDotIcon,
                        to: '/forms/form-elements/autocomplete'
                    },
                    {
                        title: 'Combobox',
                        icon: CircleDotIcon,
                        to: '/forms/form-elements/combobox'
                    },
                    {
                        title: 'Button',
                        icon: CircleDotIcon,
                        to: '/forms/form-elements/button'
                    },
                    {
                        title: 'Checkbox',
                        icon: CircleDotIcon,
                        to: '/forms/form-elements/checkbox'
                    },
                    {
                        title: 'Custom Inputs',
                        icon: CircleDotIcon,
                        to: '/forms/form-elements/custominputs'
                    },
                    {
                        title: 'File Inputs',
                        icon: CircleDotIcon,
                        to: '/forms/form-elements/fileinputs'
                    },
                    {
                        title: 'Radio',
                        icon: CircleDotIcon,
                        to: '/forms/form-elements/radio'
                    },
                    {
                        title: 'Select',
                        icon: CircleDotIcon,
                        to: '/forms/form-elements/select'
                    },
                    {
                        title: 'Date Time',
                        icon: CircleDotIcon,
                        to: '/forms/form-elements/date-time'
                    },
                    {
                        title: 'Slider',
                        icon: CircleDotIcon,
                        to: '/forms/form-elements/slider'
                    },
                    {
                        title: 'Switch',
                        icon: CircleDotIcon,
                        to: '/forms/form-elements/switch'
                    }
                ]
            },
            {
                title: 'Form Layout',
                icon: CircleDotIcon,
                to: '/forms/form-layouts'
            },
            {
                title: 'Form Horizontal',
                icon: CircleDotIcon,
                to: '/forms/form-horizontal'
            },
            {
                title: 'Form Vertical',
                icon: CircleDotIcon,
                to: '/forms/form-vertical'
            },
            {
                title: 'Form Custom',
                icon: CircleDotIcon,
                to: '/forms/form-custom'
            },
            {
                title: 'Form Validation',
                icon: CircleDotIcon,
                to: '/forms/form-validation'
            }
        ]
    },
    {
        title: 'Tables',
        icon: BorderAllIcon,
        to: '#',
        children: [
            {
                title: 'Basic Table',
                icon: CircleDotIcon,
                to: '/tables/basic'
            },
            {
                title: 'Dark Table',
                icon: CircleDotIcon,
                to: '/tables/dark'
            },
            {
                title: 'Density Table',
                icon: CircleDotIcon,
                to: '/tables/density'
            },
            {
                title: 'Fixed Header Table',
                icon: CircleDotIcon,
                to: '/tables/fixed-header'
            },
            {
                title: 'Height Table',
                icon: CircleDotIcon,
                to: '/tables/height'
            },
            {
                title: 'Editable Table',
                icon: CircleDotIcon,
                to: '/tables/editable'
            },
        ]
    },
    {
        title: 'Data Tables',
        icon: BrandAirtableIcon,
        to: '#',
        children: [
            {
                title: 'Basic Table',
                icon: ColumnsIcon,
                to: '/datatables/basic'
            },
            {
                title: 'Header Table',
                icon: RowInsertBottomIcon,
                to: '/datatables/header'
            },
            {
                title: 'Selection Table',
                icon: EyeTableIcon,
                to: '/datatables/selection'
            },
            {
                title: 'Sorting Table',
                icon: SortAscendingIcon,
                to: '/datatables/sorting'
            },
            {
                title: 'Pagination Table',
                icon: PageBreakIcon,
                to: '/datatables/pagination'
            },
            {
                title: 'Filtering Table',
                icon: FilterIcon,
                to: '/datatables/filtering'
            },
            {
                title: 'Grouping Table',
                icon: BoxModelIcon,
                to: '/datatables/grouping'
            },
            {
                title: 'Table Slots',
                icon: ServerIcon,
                to: '/datatables/slots'
            },
        ]
    },
    {
        title: 'Icons',
        icon: BrandTablerIcon,
        to: '#',
        children: [
            {
                title: "Material",
                icon: CircleDotIcon,
                to: "/icons/material",
              },
              {
                title: "Tabler",
                icon: CircleDotIcon,
                to: "/icons/tabler",
              },
        ]
    },   
];

export default horizontalItems;
