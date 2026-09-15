import type { feeds } from "@/types/components/dashboards/Demographical";
import img1 from '@/assets/images/profile/1.jpg';
import img2 from '@/assets/images/profile/2.jpg';
import img3 from '@/assets/images/profile/3.jpg';
import img4 from '@/assets/images/profile/4.jpg';
const feedsData: feeds[] = [
    {
        title: "You have 4 pending tasks",
        avatar: img1,
        avatarstatus: "success",
        desc: "To: Pawan deep",
    },
    {
        title: "Server #1 overloaded",
        avatar: img2,
        avatarstatus: "error",
        desc: "To: pamela",
    },
    {
        title: "New order received.",
        avatar: img3,
        avatarstatus: "warning",
        desc: "To: Arijit.com",
    },
    {
        title: "New user registered",
        avatar: img4,
        avatarstatus: "success",
        desc: "To: kat@gmail.com",
    },
];

export {feedsData}