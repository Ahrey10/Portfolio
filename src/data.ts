import type { IconName } from "./icons";

export const profile = {
  name: "Rey Mar O. Britania",
  role: "Full Stack Web Developer",
  location: "Imus, Cavite, Philippines",
  email: "reymar.britania10@gmail.com",
  phone: "+63 949 942 7413",
  availability: "Open to full-time and contract roles",
  summary:
    "Full stack web developer with four years of experience designing, building and maintaining business web applications, from operations and billing platforms to customer portals and REST APIs. I focus on clean, maintainable code, responsive interfaces and systems that integrate reliably.",
  facts: ["4 years of professional experience", "Imus, Cavite, Philippines", "Web applications, APIs and integrations"],
};

export interface Skill { name: string; icon: IconName }
export const skills: { group: string; items: Skill[] }[] = [
  { group: "Front-end", items: [
    { name: "HTML", icon: "html" }, { name: "CSS", icon: "css" }, { name: "SASS/SCSS", icon: "sass" }, { name: "Bootstrap", icon: "bootstrap" },
    { name: "Tailwind CSS", icon: "tailwind" }, { name: "JavaScript", icon: "javascript" }, { name: "jQuery", icon: "jquery" }, { name: "Vue", icon: "vue" },
    { name: "React", icon: "react" }, { name: "Inertia.js", icon: "inertia" },
  ] },
  { group: "Back-end", items: [
    { name: "PHP", icon: "php" }, { name: "Laravel", icon: "laravel" }, { name: "Node.js", icon: "node" }, { name: "Express.js", icon: "express" },
    { name: "OOP", icon: "oop" }, { name: "RESTful APIs", icon: "api" }, { name: "Swagger (OpenAPI)", icon: "swagger" },
  ] },
  { group: "Database", items: [{ name: "MySQL", icon: "mysql" }, { name: "Stored Procedures", icon: "procedure" }] },
  { group: "Tools & DevOps", items: [{ name: "Git", icon: "git" }, { name: "Redis", icon: "redis" }, { name: "CI/CD", icon: "cicd" }, { name: "Linux CentOS 9", icon: "centos" }] },
  { group: "AI tools", items: [{ name: "Claude", icon: "claude" }, { name: "Claude Code", icon: "claude" }] },
  { group: "Currently learning", items: [{ name: "Python", icon: "python" }, { name: "AI engineering", icon: "ai" }, { name: "PostgreSQL", icon: "postgresql" }] },
];

export const experience = {
  title: "Junior Full Stack Web Developer",
  company: "Glacier Integrated Logistics Incorporated, Parañaque City",
  period: "Oct 2022 – Oct 2026",
  points: [
    "Designed a reusable application template that became the standard base for every new company system.",
    "Built and maintained four integrated business applications (warehouse management, a client portal, billing and a CRM) that share data as one connected platform.",
    "Reviewed and debugged code across the team to diagnose and resolve system issues.",
    "Tested features across browsers and platforms, and delivered responsive, client-facing interfaces.",
    "Took part in code, system-issue and testing reviews, and planned new features and patches with the team.",
  ],
};

export interface Project { name: string; stack: string[]; text: string; impact: string; image?: string }
export const projects: Project[] = [
  { name: "Warehouse Management System", image: "/systems/wms.jpg", stack: ["PHP", "JavaScript", "jQuery"],
    text: "Core operations platform for managing rooms, inventory and storage locations. The other business applications integrate with it.",
    impact: "Inventory and location data managed in one system" },
  { name: "Client Portal", image: "/systems/cp.jpg", stack: ["Laravel", "JavaScript", "jQuery"],
    text: "Self-service customer portal built as a Laravel monolith and integrated end to end with the billing and warehouse systems.",
    impact: "End-to-end integration with billing and operations" },
  { name: "Integrated Billing System", image: "/systems/ibs.jpg", stack: ["PHP", "JavaScript"],
    text: "Decoupled billing module that connects directly to the core operations platform.",
    impact: "Billing kept in step with the core system" },
  { name: "CRM System", image: "/systems/crm.jpg", stack: ["Vue", "Inertia.js", "Laravel", "Tailwind CSS"],
    text: "Customer relationship management app on the VILT stack that creates customer records and generates customer codes for the QNE accounting system, linked to billing and the client portal.",
    impact: "Customer onboarding connected to billing, portal and accounting" },
  { name: "REST API with Swagger", image: "/systems/api.jpg", stack: ["Node.js", "Express.js", "Swagger"],
    text: "RESTful API built with Node.js and Express, with Swagger (OpenAPI) documentation for fast, consistent integration between systems.",
    impact: "Documented endpoints for straightforward integration" },
  { name: "E-Commerce Website (thesis)", stack: ["Web", "QR scanner"],
    text: "Online store with product location tracking through a QR code scanner, built as my undergraduate thesis.",
    impact: "Product location tracking via QR code" },
  { name: "E-Library System (commissioned)", stack: ["Web", "Offline mode"],
    text: "Commissioned library platform that supports both online and offline borrowing.",
    impact: "Online and offline borrowing workflows" },
];

export const education = [
  { name: "BS Information Technology", school: "National College of Science and Technology", period: "2018 – 2022" },
  { name: "Senior High School, ICT", school: "Philippine Christian University", period: "2016 – 2018" },
];

export const about = {
  paragraphs: [
    "I’m a full stack web developer based in Imus, Cavite, with four years of experience delivering business web applications end to end, from database design and APIs to responsive user interfaces.",
    "I’ve built and maintained a suite of integrated systems covering operations, billing, customer management and client self-service, and designed a reusable application template that became the standard base for new projects. I value clean, maintainable code, thoughtful user experience, and catching defects early through code reviews and testing.",
    "I’m currently expanding my skills in Python, AI engineering and PostgreSQL, and I use Claude and Claude Code every day to work faster without compromising quality. Outside of work I ride motorcycles, which inspired the mountain-road scenery on this site.",
  ],
  stats: [
    { label: "Experience", value: "4 years" },
    { label: "Connected systems", value: "4" },
    { label: "Reusable template", value: "1" },
  ],
};
