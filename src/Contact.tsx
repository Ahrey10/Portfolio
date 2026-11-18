import { useState, type FormEvent } from "react";
import { profile } from "./data";

type Status = "idle" | "submitting" | "success" | "error";
type Fields = { name: string; email: string; message: string };
const { VITE_EMAILJS_SERVICE_ID: SERVICE, VITE_EMAILJS_TEMPLATE_ID: TEMPLATE, VITE_EMAILJS_PUBLIC_KEY: KEY } = import.meta.env;
const configured = Boolean(SERVICE && TEMPLATE && KEY);

function validate(f: Fields): Partial<Fields> {
  const e: Partial<Fields> = {};
  if (f.name.trim().length < 2) e.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email address.";
  if (f.message.trim().length < 10) e.message = "Write at least 10 characters.";
  return e;
}

export default function Contact() {
  const [f, setF] = useState<Fields>({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Partial<Fields>>({});
  const [status, setStatus] = useState<Status>("idle");
  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate(f);
    setErrors(v);
    if (Object.keys(v).length || !configured) return;
    setStatus("submitting");
    try {
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: SERVICE,
          template_id: TEMPLATE,
          user_id: KEY,
          template_params: {
            name: f.name,
            email: f.email,
            title: `New message from ${f.name}`, // fills {{title}} in the Subject
            time: new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }),
            message: f.message,
          },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("success"); setF({ name: "", email: "", message: "" });
    } catch { setStatus("error"); }
  };

  const field = (k: keyof Fields, label: string, type = "text") => (
    <label>{label}
      {k === "message"
        ? <textarea rows={5} value={f[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={`${k}-e`} />
        : <input type={type} value={f[k]} onChange={set(k)} autoComplete={k} aria-invalid={!!errors[k]} aria-describedby={`${k}-e`} />}
      <span id={`${k}-e`} className="fe" role="alert">{errors[k]}</span>
    </label>
  );

  return (
    <form className="form" onSubmit={submit} noValidate>
      {!configured && <p className="notice">Email delivery is not configured yet. Add the EmailJS keys to <code>.env</code> (see README).</p>}
      {field("name", "Your name")}{field("email", "Your email", "email")}{field("message", "Message")}
      <button type="submit" className="btn primary" disabled={status === "submitting"}>
        {status === "submitting" && <span className="spin" aria-hidden="true" />}{status === "submitting" ? "Sending" : "Send message"}
      </button>
      {status === "success" && <p role="status" className="ok">Message sent. I’ll reply to your email soon.</p>}
      {status === "error" && <p role="alert" className="bad">The message didn’t send. Check your connection and try again.</p>}
    </form>
  );
}
