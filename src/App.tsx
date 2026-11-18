import { lazy, memo, Suspense, useCallback, useState } from "react";
import { profile, about, skills, experience, projects, education } from "./data";
import { useTheme, useActiveSection, type Theme } from "./hooks";
import Background from "./Background";
import Contact from "./Contact";
import { Card, Shot, Logo, Leaf, Highlighted, SkillIcon } from "./ui";
import type { Slide } from "./Lightbox";
import Welcome from "./Welcome";
import Cursor from "./Cursor";

const Lightbox = lazy(() => import("./Lightbox")); // loaded on the first preview

const NAV = ["about", "work", "projects", "skills", "education", "contact"] as const;
const SECTIONS = ["top", ...NAV];
// Only projects with a real screenshot can be previewed.
const SLIDES: Slide[] = projects.flatMap((p) => (p.image ? [{ src: p.image, name: p.name }] : []));
const slideOf = (image?: string) => SLIDES.findIndex((x) => x.src === image);

const Sun = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M2 12h2M20 12h2M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400" /></svg>;
const Moon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" /></svg>;

/*
 * Rendering: each section is its own memoised component with no changing props, so theme toggles, the screenshot preview
 * and the active-section highlight only re-render the parts that actually change. The header owns the active-section
 * state, so scrolling between sections re-renders the nav links only.
 */

const Header = memo(function Header({ theme, toggle }: { theme: Theme; toggle: () => void }) {
  const active = useActiveSection(SECTIONS);
  return (
    <header className="nav">
      <Logo />
      <nav aria-label="Primary">
        {NAV.map((id) => <a key={id} href={`#${id}`} aria-current={active === id ? "true" : undefined}>{id === "work" ? "Experience" : id[0].toUpperCase() + id.slice(1)}</a>)}
      </nav>
      <button className="theme" onClick={toggle} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>{theme === "light" ? <Moon /> : <Sun />}</button>
    </header>
  );
});

const Hero = memo(function Hero({ ready }: { ready: boolean }) {
  return (
    <section id="top" className="hero" aria-labelledby="h1">
      <div className={`hero-copy ${ready ? "go" : ""}`}>
        <p className="badge"><i aria-hidden="true" />{profile.availability}</p>
        <h1 id="h1">{profile.name.split(" ").map((w, k) => <span key={k} className="word" style={{ animationDelay: `${k * 90}ms` }}>{w}&nbsp;</span>)}</h1>
        <p className="role">{profile.role}</p>
        <p className="lead">{profile.summary}</p>
        <div className="cta"><a className="btn primary" href="#projects">View projects</a><a className="btn" href="#contact">Get in touch</a></div>
        <ul className="facts">{profile.facts.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
    </section>
  );
});

const About = memo(function About() {
  return (
    <section id="about" className="sec" aria-labelledby="h-about">
      <h2 id="h-about">About me</h2>
      <Card i={0} className="about">
        <img className="about-photo" src="/logo.jpg" alt="Portrait of Rey Mar Britania" width={240} height={240} loading="lazy" decoding="async" />
        <div>
          {about.paragraphs.map((p) => <p key={p}><Highlighted text={p} /></p>)}
          <dl className="stats">{about.stats.map((s) => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl>
        </div>
      </Card>
    </section>
  );
});

const Experience = memo(function Experience() {
  return (
    <section id="work" className="sec" aria-labelledby="h-work">
      <h2 id="h-work">Experience</h2>
      <div className="timeline">
        <div className="tl-item">
          <Card i={0}>
            <h3>{experience.title}</h3>
            <p className="meta mono">{experience.company} · {experience.period}</p>
            <ul>{experience.points.map((p) => <li key={p}><Highlighted text={p} /></li>)}</ul>
          </Card>
        </div>
      </div>
    </section>
  );
});

const Projects = memo(function Projects({ onPreview }: { onPreview: (slide: number) => void }) {
  return (
    <section id="projects" className="sec" aria-labelledby="h-projects">
      <h2 id="h-projects">Projects</h2>
      <p className="privacy">Note: Screenshots are intentionally blurred and redacted to protect client confidentiality.</p>
      <div className="proj-grid">
        {projects.map((p, i) => (
          <Card key={p.name} i={i} className="proj">
            <Shot src={p.image} name={p.name} onOpen={p.image ? () => onPreview(slideOf(p.image)) : undefined} />
            <h3>{p.name}</h3>
            <p><Highlighted text={p.text} /></p>
            <p className="impact"><Leaf />{p.impact}</p>
            <ul className="pills" aria-label="Tech stack">{p.stack.map((s) => <li key={s} className="mono">{s}</li>)}</ul>
          </Card>
        ))}
      </div>
    </section>
  );
});

const Skills = memo(function Skills() {
  return (
    <section id="skills" className="sec" aria-labelledby="h-skills">
      <h2 id="h-skills">Skills</h2>
      <div className="bento">
        {skills.map((s, i) => (
          <Card key={s.group} i={i}>
            <h3>{s.group}</h3>
            <ul className="bullets">{s.items.map((it) => <li key={it.name}><SkillIcon name={it.icon} />{it.name}</li>)}</ul>
          </Card>
        ))}
      </div>
    </section>
  );
});

const Education = memo(function Education() {
  return (
    <section id="education" className="sec" aria-labelledby="h-edu">
      <h2 id="h-edu">Education</h2>
      <div className="timeline">
        {education.map((e, i) => (
          <div className="tl-item" key={e.name}>
            <Card i={i}><h3>{e.name}</h3><p>{e.school}</p><p className="meta mono">{e.period}</p></Card>
          </div>
        ))}
      </div>
    </section>
  );
});

const ContactSection = memo(function ContactSection() {
  return (
    <section id="contact" className="sec" aria-labelledby="h-contact">
      <h2 id="h-contact">Let’s talk</h2>
      <div className="two">
        <Card i={0}>
          <h3>Direct contact</h3>
          <p className="avail"><i aria-hidden="true" />{profile.availability}</p>
          <p>{profile.email}</p><p>{profile.phone}</p><p>{profile.location}</p>
          <p className="meta">Messages sent through this form go directly to my inbox.</p>
        </Card>
        <Card i={1}><h3>Send a message</h3><Contact /></Card>
      </div>
    </section>
  );
});

const YEAR = new Date().getFullYear();

export default function App() {
  const [theme, toggle] = useTheme();
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const done = useCallback(() => setReady(true), []);
  const close = useCallback(() => setPreview(null), []);

  return (
    <>
      <Cursor />
      <Background theme={theme} paused={!ready} />
      {!ready && <Welcome onDone={done} />}
      <Header theme={theme} toggle={toggle} />
      <main>
        <Hero ready={ready} />
        <About />
        <Experience />
        <Projects onPreview={setPreview} />
        <Skills />
        <Education />
        <ContactSection />
      </main>
      {preview !== null && <Suspense fallback={null}><Lightbox slides={SLIDES} index={preview} onIndex={setPreview} onClose={close} /></Suspense>}
      <footer className="foot">© {YEAR} {profile.name}</footer>
    </>
  );
}
