import type { product_Performance } from "@/types/components/dashboards/ModernDash";
import img1 from '@/assets/images/profile/1.jpg';
import img2 from '@/assets/images/profile/2.jpg';
import img3 from '@/assets/images/profile/3.jpg';
import img4 from '@/assets/images/profile/4.jpg';
import img5 from '@/assets/images/profile/5.jpg';
const product_PerformanceData: product_Performance[] = [
    {
        img: img1,
        activestate: "",
        leadname: "Sunil Joshi",
        leademail: "Web Designer",
        projectname: "Elite Admin",
        statuscolor: "blue lighten-1 white--text",
        statustext: "Low",
        money: "$3.9K",
      },
      {
        img: img2,
        activestate: "",
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
        statuscolor: "warning",
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
        statuscolor: "success",
        statustext: "Low",
        money: "$12.9K",
      },
]

export {product_PerformanceData}