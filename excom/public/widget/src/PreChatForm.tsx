import { useState } from "preact/hooks";

interface Props {
  fields: string[];
  color: string;
  onSubmit: (data: { name: string; email: string; phone: string }) => void;
}

export function PreChatForm({ fields, color, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (fields.includes("name") && !name.trim()) return;
    if (fields.includes("email") && !email.trim()) return;
    onSubmit({ name: name.trim() || "Visitor", email: email.trim(), phone: phone.trim() });
  };

  const inp: Record<string, string> = {
    width: "100%", padding: "10px 12px", border: "1px solid #d1d5db",
    borderRadius: "8px", fontSize: "14px", outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: "24px 20px" }}>
      <p style={{ color: "#6b7280", fontSize: "13px", marginBottom: "16px", lineHeight: "1.5" }}>
        Please share your details so we can assist you better.
      </p>
      {fields.includes("name") && (
        <div style={{ marginBottom: "12px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "4px" }}>Name *</label>
          <input type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="Your name" required style={inp} />
        </div>
      )}
      {fields.includes("email") && (
        <div style={{ marginBottom: "12px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "4px" }}>Email *</label>
          <input type="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} placeholder="your@email.com" required style={inp} />
        </div>
      )}
      {fields.includes("phone") && (
        <div style={{ marginBottom: "12px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "4px" }}>Phone</label>
          <input type="tel" value={phone} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} placeholder="+91 98765 43210" style={inp} />
        </div>
      )}
      <button type="submit" style={{
        width: "100%", padding: "10px", backgroundColor: color, color: "white",
        border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600",
        cursor: "pointer", marginTop: "8px", fontFamily: "inherit",
      }}>Start Chat</button>
    </form>
  );
}
