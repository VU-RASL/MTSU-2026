import type { TablerIconComponent } from "vue-tabler-icons";

/*Card types*/
type cardsType = {
    avatar: string;
    coveravatar: string;
    read: string;
    title: string;
    link: string;
    category: string;
    name: string;
    view: string;
    comments: string;
    time: string;
};

/*Follow card types*/
type followCard={
    title: string;
    location: string;
    avatar: string;
};

/*Music card types*/
type musicCards={
    title: string;
    subheader: string;
    img: string;
}

/*Products card types*/
type productsCards= {
    title: string;
    link: string;
    photo: string;
    salesPrice: number;
    price: number;
    rating: number;
};

/*Social Icon card types*/
type socialiconCards={
    name: string;
    icon: TablerIconComponent;
    color: string;
};

/*Profile card types*/
type profileCard={
    title: string;
    subtitle: string;
    avatar: string;
};

/*Upcomming List card types*/
type upcommingLists={
    icon: TablerIconComponent;
    title: string;
    subtitle: string;
    rank: string;
    bgcolor: string;
};

/*User card types*/
type userGroupType={
    icon:string;
}
type userCard ={
    title: string;
    subtitle: string;
    avatar: string;
    userGroup: userGroupType[]
};

/*Payment Gatway*/
type paymentGateway = {
    img: string;
    title: string;
    subtitle: string;
    rank: string;
    disable: string;
    bgcolor: string;
};

/*Recent transaction*/
type recentTrans = {
    title: string;
    subtitle: string;
    textcolor: string;
    boldtext: boolean;
    line: boolean;
    link: string;
    url: string;
};

/*background icon  card*/
type backIcon={
    color: string;
    icon: TablerIconComponent;
    title: string;
    subtitle: string;
};

/*image card*/
type imgCard={
    image: string;
    color: string;
};

export type{cardsType, followCard,musicCards,productsCards, socialiconCards,profileCard,upcommingLists,userCard,paymentGateway,recentTrans,backIcon,imgCard}