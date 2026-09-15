import type { weeklyStates,earningCards,projectEarningTable,recentComments } from "@/types/components/dashboards/MinimalDash";
import { MessageDotsIcon, ShoppingCartIcon, StarIcon } from 'vue-tabler-icons';
import img1 from '@/assets/images/profile/1.jpg';
import img2 from '@/assets/images/profile/2.jpg';
import img3 from '@/assets/images/profile/3.jpg';
import img4 from '@/assets/images/profile/4.jpg';
import img5 from '@/assets/images/profile/5.jpg';

import icon1 from '@/assets/images/svgs/income.svg'
import icon2 from '@/assets/images/svgs/expense.svg'
import icon3 from '@/assets/images/svgs/assets.svg'
import icon4 from '@/assets/images/svgs/staff.svg'

const weeklyStatesData: weeklyStates[] = [
  {
    color: "primary",
    icon: ShoppingCartIcon,
    title: "Top Sales",
    desc: "Johnathan Doe",
    percent: 68,
  },
  {
    color: "warning",
    icon: StarIcon,
    title: "Best Seller",
    desc: "MaterialPro Admin",
    percent: 45,
  },
  {
    color: "success",
    icon: MessageDotsIcon,
    title: "Most Commented",
    desc: "Ample Admin",
    percent: 10,
  },
]

const earningCardsData: earningCards[] = [
  {
    title: "Total Income",
    img:icon1,
    number: "953,000",
},
{
    title: "Total Expense",
    img:icon2,
    number: "236,000",
},
{
    title: "Total Assets",
    img:icon3,
    number: "987,563",
},
{
    title: "Total Staff",
    img:icon4,
    number: "987,563",
},
]

const projectEarningTableData: projectEarningTable[] = [
  {
    img: img1,
    activestate: "",
    leadname: "Sunil Joshi",
    leademail: "Web Designer",
    projectname: "Elite Admin",
    statuscolor: "success",
    statustext: "Low",
    money: "$3.9K",
},
{
    img: img2,
    activestate: "active",
    leadname: "Andrew",
    leademail: "Project Manager",
    projectname: "Real Homes",
    statuscolor: "info",
    statustext: "Medium",
    money: "$23.9K",
},
{
    img: img3,
    activestate: "",
    leadname: "Bhavesh patel",
    leademail: "Developer",
    projectname: "MedicalPro Theme",
    statuscolor: "deep-purple accent-2 white--text",
    statustext: "High",
    money: "$12.9K",
},
{
    img: img4,
    activestate: "",
    leadname: "Nirav Joshi",
    leademail: "Frontend Eng",
    projectname: "Elite Admin",
    statuscolor: "error",
    statustext: "Low",
    money: "$10.9K",
},
{
    img: img5,
    activestate: "",
    leadname: "Micheal Doe",
    leademail: "Content Writer",
    projectname: "Helping Hands",
    statuscolor: "warning",
    statustext: "High",
    money: "$12.9K",
},
]

const recentCommentsData: recentComments[] = [
  {
      img: img1,
      activeClass: "",
      username: "James Anderson",
      desc: "Lorem Ipsum is simply dummy text of the printing and type setting industry.",
      date: "April 14, 2022",
      badgebg: "primary",
      status: "Pending",
  },
  {
      img: img2,
      activeClass: "active",
      username: "Michael Jorden",
      desc: "Lorem Ipsum has beenorem Ipsum is simply dummy text of the printing and type setting industry.",
      date: "April 14, 2022",
      badgebg: "secondary",
      status: "Approved",
  },
  {
      img: img3,
      activeClass: "",
      username: "Johnathan Doeting",
      desc: "Lorem Ipsum is simply dummy text of the printing and type setting industry.",
      date: "April 14, 2022",
      badgebg: "error",
      status: "Rejected",
  },
  {
      img: img4,
      activeClass: "",
      username: "James Anderson",
      desc: "Lorem Ipsum is simply dummy text of the printing and type setting industry.",
      date: "April 14, 2022",
      badgebg: "info",
      status: "Pending",
  },
];
export {weeklyStatesData,earningCardsData,projectEarningTableData,recentCommentsData }