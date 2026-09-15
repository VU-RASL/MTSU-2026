import type { myContacts } from '@/types/components/dashboards/AnalyticalDash';
import img1 from '@/assets/images/profile/1.jpg';
import img2 from '@/assets/images/profile/2.jpg';
import img3 from '@/assets/images/profile/3.jpg';
import img4 from '@/assets/images/profile/4.jpg';
/*--Blog Cards--*/
const myContactsData: myContacts[] = [
    {
        title: "Pavan Kumar",
        avatar: img1,
        avatarstatus: "success",
        desc: "info@wrappixel.com",
      },
      {
        title: "Sonu Nigam",
        avatar: img2,
        avatarstatus: "error",
        desc: "pamela1987@gmail.com",
      },
      {
        title: "Arijit singh",
        avatar: img3,
        avatarstatus: "warning",
        desc: "cruise1298.fiplip@gmail.com",
      },
      {
        title: "Pavan Kumar",
        avatar: img4,
        avatarstatus: "success",
        desc: "kat@gmail.com",
      },
];

export { myContactsData }