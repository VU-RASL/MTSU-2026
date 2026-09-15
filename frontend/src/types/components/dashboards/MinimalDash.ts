import type { TablerIconComponent } from "vue-tabler-icons";

type weeklyStates = {
    color: string,
        icon: TablerIconComponent;
        title: string,
        desc:string,
        percent:number,
}

type earningCards = {
    title: string;
    img:string;
    number: string;
};

type projectEarningTable = {
    img: string;
    activestate: string;
    leadname: string;
    leademail: string;
    projectname: string;
    statuscolor: string;
    statustext: string;
    money: string;
}

type recentComments = {
    img: string;
    activeClass: string;
    username: string;
    desc: string;
    date: string;
    badgebg: string;
    status: string;
}

export type {weeklyStates,earningCards,projectEarningTable,recentComments}