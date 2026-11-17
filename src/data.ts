export const profile = {
  name: "Rey Mar O. Britania",
  role: "Full Stack Web Developer",
  location: "Imus, Cavite, Philippines",
  email: "reymar.britania10@gmail.com",
  phone: "+63 949 942 7413",
  availability: "Open to full-time and contract roles",
  summary:
    "Four years building and maintaining web-based business systems for the logistics industry. I care about clean code, responsive interfaces, and systems that talk to each other.",
};

export const skills: { group: string; items: string[] }[] = [
  { group: "Front-end", items: ["HTML", "CSS", "SASS/SCSS", "Bootstrap", "Tailwind CSS", "JavaScript", "jQuery", "Vue", "React", "Inertia.js"] },
  { group: "Back-end", items: ["PHP", "Laravel", "Node.js", "Express.js", "OOP", "RESTful APIs", "Swagger (OpenAPI)"] },
  { group: "Database", items: ["MySQL", "Stored Procedures"] },
  { group: "Tools & DevOps", items: ["Git", "Redis", "CI/CD", "Linux CentOS 9"] },
  { group: "AI tools", items: ["Claude", "Claude Code"] },
  { group: "Learning", items: ["Python", "AI engineering", "PostgreSQL"] },
];

export const experience = {
  title: "Junior Full Stack Web Developer",
  company: "Glacier Integrated Logistics Incorporated, Parañaque City",
  period: "Oct 2022 – Oct 2026",
  points: [
    "Designed a reusable website template that became the standard base for all future company systems.",
    "Built and maintained a Warehouse Management System, Client Portal, Integrated Billing System and CRM, all connected to one another.",
    "Reviewed and debugged code from other developers to resolve system issues.",
    "Tested features across browsers and platforms, and shipped responsive client-facing interfaces.",
    "Took part in code, system-issue and testing reviews, and planned new features and patches with the team.",
  ],
};

export interface Project { name: string; stack: string[]; text: string; impact: string; image?: string }
export const projects: Project[] = [
  { name: "Warehouse Management System", impact: "Rooms, inventory and storage locations in one system", image: "/systems/wms.jpg", stack: ["PHP", "JavaScript", "jQuery"], text: "Core system covering rooms, inventory and storage-location management." },
  { name: "Client Portal", impact: "End-to-end integration with billing and the WMS", image: "/systems/cp.jpg", stack: ["Laravel", "JavaScript", "jQuery"], text: "Monolithic customer portal integrated end to end with billing and the WMS." },
  { name: "Integrated Billing System", impact: "Integrated with the core Warehouse Management System", image: "/systems/ibs.jpg", stack: ["PHP", "JavaScript"], text: "Decoupled billing module connected to the Warehouse Management System." },
  { name: "CRM System", impact: "Linked to billing and the portal; generates QNE customer codes", image: "/systems/crm.jpg", stack: ["Vue", "Inertia.js", "Laravel", "Tailwind CSS"], text: "VILT-stack CRM that creates customers and generates customer codes for QNE, linked to billing and the portal." },
  { name: "REST API with Swagger", impact: "Swagger documentation for easy integration", image: "/systems/api.jpg", stack: ["Node.js", "Express.js", "Swagger"], text: "Documented API built for easy integration between systems." },
  { name: "E-Commerce Website (thesis)", impact: "Product location tracking via QR code scanner", stack: ["Web", "QR scanner"], text: "Online store with product location tracking through a QR code scanner." },
  { name: "E-Library System (commissioned)", impact: "Online and offline borrowing", stack: ["Web", "Offline mode"], text: "Library platform supporting both online and offline borrowing." },
];

export const education = [
  { name: "BS Information Technology", school: "National College of Science and Technology", period: "2018 – 2022" },
  { name: "Senior High School, ICT", school: "Philippine Christian University", period: "2016 – 2018" },
];

export const about = {
  paragraphs: [
    "I’m a Full Stack Web Developer from Imus, Cavite. For four years I’ve built and maintained web-based business systems for a logistics company, from warehouse operations to billing and customer management.",
    "My work covers a Warehouse Management System, Client Portal, Integrated Billing System and CRM that all connect to one another, plus a reusable website template that became the standard base for new company systems. I care about clean, maintainable code, responsive interfaces, and catching bugs early through code reviews and testing.",
    "Right now I’m learning Python, AI engineering and PostgreSQL, and I use Claude and Claude Code in my daily workflow. Away from the keyboard I ride motorcycles, which is where the mountain scenery in this portfolio comes from.",
  ],
  stats: [
    { label: "Experience", value: "4 years" },
    { label: "Connected systems", value: "4" },
    { label: "Reusable template", value: "1" },
  ],
};