import {
  ChartPieIcon,
  CoffeeIcon,
  CpuIcon,
  FlagIcon,
  BasketIcon,
  ApertureIcon,
  LayoutGridIcon,
  BoxIcon,
  Message2Icon,
  FilesIcon,
  CalendarIcon,
  UserCircleIcon,
  ChartBarIcon,
  ShoppingCartIcon,
  ChartLineIcon,
  ChartAreaIcon,
  ChartDotsIcon,
  ChartArcsIcon,
  ChartCandleIcon,
  ChartDonut3Icon,
  ChartRadarIcon,
  LayoutIcon,
  CardboardsIcon,
  PhotoIcon,
  FileTextIcon,
  BoxAlignBottomIcon,
  BoxAlignLeftIcon,
  FileDotsIcon,
  EditCircleIcon,
  AppsIcon,
  BorderAllIcon,
  BorderHorizontalIcon,
  BorderInnerIcon,
  BorderTopIcon,
  BorderVerticalIcon,
  BorderStyle2Icon,
  LoginIcon,
  CircleDotIcon,
  UserPlusIcon,
  RotateIcon,
  ZoomCodeIcon,
  SettingsIcon,
  AlertCircleIcon,
  BrandTablerIcon,
  CodeAsterixIcon,
  BrandCodesandboxIcon,
  ColumnsIcon,
  RowInsertBottomIcon,
  EyeTableIcon,
  SortAscendingIcon,
  PageBreakIcon,
  FilterIcon,
  BoxModelIcon,
  ServerIcon,
  JumpRopeIcon,
  LayoutKanbanIcon,
  MusicIcon

} from 'vue-tabler-icons';

export interface menu {
  header?: string;
  title?: string;
  icon?: any;
  to?: string;
  chip?: string;
  chipBgColor?: string;
  chipColor?: string;
  chipVariant?: string;
  chipIcon?: string;
  children?: menu[];
  disabled?: boolean;
  type?: string;
  subCaption?: string;
}

const sidebarItem: menu[] = [
  { header: 'Home' },
  {
    title: "Simphony",
    icon: MusicIcon,
    to: "/dashboards/minimal",
  },
  { header: 'Learn' },
  {
    title: 'References',
    icon: FilesIcon,
    to: '/apps/learn',
  },
  { header: 'Compose' },
  {
    title: 'Personas',
    icon: FilesIcon,
    to: '/apps/personas',
  },
  { header: 'Conduct' },
  {
    title: 'Run Sim',
    icon: FilesIcon,
    to: '/apps/runtime',
  },
  {
    title: 'Phone Config',
    icon: FilesIcon,
    to: '/apps/phone',
  },
  {
    title: 'Chats',
    icon: FilesIcon,
    to: '/apps/chats',
  },
];

export default sidebarItem;
