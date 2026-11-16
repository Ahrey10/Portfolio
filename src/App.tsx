import { useState } from "react";
import { profile, skills, experience, projects, education } from "./data";
import { useTheme, useParallax, usePrefersReducedMotion, useActiveSection } from "./hooks";
import Background from "./Background";
import Contact from "./Contact";
import { Card, Shot, Logo, Welcome, Leaf, Highlighted } from "./ui";

const NAV = ["work", "projects", "skills", "education", "contact"] as const;
const SECTIONS = ["top", ...NAV];

const Sun = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M2 12h2M20 12h2M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400" /></svg>;
const Moon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" /></svg>;

export default function App() {
  const [theme, toggle] = useTheme();
  const reduced = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  const active = useActiveSection(SECTIONS);
  useParallax(reduced);

  return (
    <>
      <Background theme={theme} />
      {!ready && <Welcome onDone={() => setReady(true)} />}
      <header className="nav">
        <Logo />
        <nav aria-label="Primary">
          {NAV.map((id) => <a key={id} href={`#${id}`} aria-current={active === id ? "true" : undefined}>{id === "work" ? "Experience" : id[0].toUpperCase() + id.slice(1)}</a>)}
        </nav>
        <button className="theme" onClick={toggle} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>{theme === "light" ? <Moon /> : <Sun />}</button>
      </header>

      <main>
        <section id="top" className="hero" aria-labelledby="h1">
          <div className={`hero-copy ${ready ? "go" : ""}`}>
            <p className="badge"><i aria-hidden="true" />{profile.availability}</p>
            <h1 id="h1">{profile.name.split(" ").map((w, k) => <span key={k} className="word" style={{ animationDelay: `${k * 90}ms` }}>{w}&nbsp;</span>)}</h1>
            <p className="role">{profile.role}</p>
            <p className="lead">{profile.summary}</p>
            <div className="cta"><a className="btn primary" href="#projects">View projects</a><a className="btn" href="#contact">Get in touch</a></div>
            <ul className="facts"><li>4 years of experience</li><li>{profile.location}</li><li>Logistics systems</li></ul>
          </div>
        </section>

        <section id="work" className="sec" aria-labelledby="h-work">
          <h2 id="h-work">Experience</h2>
          <div className="timeline">
            {[experience].map((x, i) => (
              <div className="tl-item" key={x.title}>
                <Card i={i}>
                  <h3>{x.title}</h3>
                  <p className="meta mono">{x.company} · {x.period}</p>
                  <ul>{x.points.map((p) => <li key={p}><Highlighted text={p} /></li>)}</ul>
                </Card>
              </div>
            ))}
          </div>
        </section>

        <section id="projects" className="sec" aria-labelledby="h-projects">
          <h2 id="h-projects">Projects</h2>
          <p className="privacy">Note: Screenshots are intentionally blurred and redacted to protect client confidentiality.</p>
          <div className="proj-grid">
            {projects.map((p, i) => (
              <Card key={p.name} i={i} className="proj">
                <Shot src={p.image} name={p.name} />
                <h3>{p.name}</h3>
                <p><Highlighted text={p.text} /></p>
                <p className="impact"><Leaf />{p.impact}</p>
                <ul className="pills" aria-label="Tech stack">{p.stack.map((s) => <li key={s} className="mono">{s}</li>)}</ul>
              </Card>
            ))}
          </div>
        </section>

        <section id="skills" className="sec" aria-labelledby="h-skills">
          <h2 id="h-skills">Skills</h2>
          <div className="bento">
            {skills.map((s, i) => (
              <Card key={s.group} i={i}>
                <h3>{s.group}</h3>
                <ul className="bullets">{s.items.map((it) => <li key={it}><Leaf />{it}</li>)}</ul>
              </Card>
            ))}
          </div>
        </section>

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

        <section id="contact" className="sec" aria-labelledby="h-contact">
          <h2 id="h-contact">Let’s talk</h2>
          <div className="two">
            <Card i={0}>
              <h3>Direct contact</h3>
              <p className="avail"><i aria-hidden="true" />{profile.availability}</p>
              <p>{profile.email}</p><p>{profile.phone}</p><p>{profile.location}</p>
              <p className="meta">Messages from the form go straight to my inbox.</p>
            </Card>
            <Card i={1}><h3>Send a message</h3><Contact /></Card>
          </div>
        </section>
      </main>
      <footer className="foot">© {new Date().getFullYear()} {profile.name}</footer>
    </>
  );
}
