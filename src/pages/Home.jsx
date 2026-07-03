import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";

const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const outlineBtn = {
  padding: "8px 16px",
  borderRadius: 8,
  margin: "10px",
  border: "1px solid var(--border)",
  background: "var(--code-bg)",
  color: "var(--text-h)",
  cursor: "pointer",
  fontSize: 14,
};

const primaryBtn = {
  padding: "10px 24px",
  background: "#4F46E5",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 15,
  cursor: "pointer",
};

async function callGroq(text) {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: text }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Groq API error");
  return data.choices[0].message.content;
}

const FORM_SYSTEM_PROMPT = `You are a form builder. The user will describe a form they need.
Return ONLY a JSON object with this exact structure, no markdown, no explanation, no backticks:
{
  "title": "Form title",
  "fields": [
    {
      "id": "field_1",
      "label": "Field label",
      "type": "text",
      "required": true,
      "placeholder": "placeholder text"
    }
  ]
}
Supported types: text, email, number, textarea, dropdown, checkbox, image.
For dropdown, add an "options" array of strings.
For image type use: { "id": "field_x", "label": "Upload reference image", "type": "image", "required": false }
IMPORTANT: Always include an image field when the request involves visual references, designs, or inspiration.`;

export default function Home() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [formId, setFormId] = useState(null);
  const [shareLink, setShareLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  async function handleAuth() {
    setAuthError("");
    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  }

  async function generateForm() {
    setLoading(true);
    setShareLink(null);
    setForm(null);
    setFormId(null);
    try {
      const raw = await callGroq(
        FORM_SYSTEM_PROMPT + "\n\nForm request: " + prompt,
      );
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const json = JSON.parse(cleaned);

      const docRef = await addDoc(collection(db, "forms"), {
        ...json,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
      });

      setForm(json);
      setFormId(docRef.id);
      setShareLink(`${window.location.origin}/form/${docRef.id}`);
    } catch (err) {
      console.error(err);
      alert("Something went wrong: " + err.message);
    }
    setLoading(false);
  }

  async function editForm() {
    if (!editPrompt || !formId) return;
    setEditing(true);
    try {
      const editSystemPrompt = `You are a form builder. The user has an existing form and wants to modify it.
Current form:
${JSON.stringify(form, null, 2)}

Apply the user's requested changes and return the COMPLETE updated form as a JSON object.
Return ONLY the JSON, no markdown, no explanation, no backticks. Keep the same structure.`;

      const raw = await callGroq(
        editSystemPrompt + "\n\nEdit request: " + editPrompt,
      );
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const json = JSON.parse(cleaned);

      await updateDoc(doc(db, "forms", formId), {
        ...json,
        updatedAt: new Date().toISOString(),
      });

      setForm(json);
      setEditPrompt("");
    } catch (err) {
      console.error(err);
      alert("Edit failed: " + err.message);
    }
    setEditing(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!user) {
    return (
      <div
        style={{
          maxWidth: 400,
          margin: "100px auto",
          padding: "0 20px",
          fontFamily: "sans-serif",
        }}>
        <h1>Formly</h1>
        <p style={{ color: "#666" }}>AI-powered forms for your business.</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setAuthMode("login")}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ddd",
              background: authMode === "login" ? "#4F46E5" : "#fff",
              color: authMode === "login" ? "#fff" : "#333",
              cursor: "pointer",
            }}>
            Log in
          </button>
          <button
            onClick={() => setAuthMode("signup")}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ddd",
              background: authMode === "signup" ? "#4F46E5" : "#fff",
              color: authMode === "signup" ? "#fff" : "#333",
              cursor: "pointer",
            }}>
            Sign up
          </button>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ddd",
            marginBottom: 10,
            boxSizing: "border-box",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ddd",
            marginBottom: 10,
            boxSizing: "border-box",
          }}
        />

        {authError && <p style={{ color: "red", fontSize: 13 }}>{authError}</p>}

        <button
          onClick={handleAuth}
          style={{
            width: "100%",
            padding: 12,
            background: "#4F46E5",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            cursor: "pointer",
          }}>
          {authMode === "login" ? "Log in" : "Sign up"}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "60px auto",
        padding: "0 40px",
        fontFamily: "sans-serif",
      }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ margin: "0 0 16px" }}>Formly</h1>
        <div style={{ gap: 10 }}>
          <button onClick={() => navigate("/dashboard")} style={outlineBtn}>
            Dashboard
          </button>
          <button onClick={() => auth.signOut()} style={outlineBtn}>
            Log out
          </button>
        </div>
      </div>

      {/* Form builder */}
      <p style={{ color: "#666", marginBottom: 12 }}>
        Describe the form you need and AI will build it.
      </p>

      <textarea
        rows={4}
        style={{
          width: "100%",
          padding: 12,
          fontSize: 15,
          borderRadius: 8,
          border: "1px solid #ddd",
          boxSizing: "border-box",
          marginBottom: 12,
        }}
        placeholder="e.g. A cake order form for a bakery with name, email, occasion dropdown, and reference image upload"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <button
        onClick={generateForm}
        disabled={loading || !prompt}
        style={primaryBtn}>
        {loading ? "Generating..." : "Generate form"}
      </button>

      {/* Share link */}
      {shareLink && (
        <div
          style={{
            marginTop: 32,
            padding: 16,
            background: "#f0fdf4",
            borderRadius: 10,
            border: "1px solid #bbf7d0",
          }}>
          <p style={{ margin: "0 0 10px", fontWeight: 500, color: "#16a34a" }}>
            ✓ Form created! Share this link with your clients:
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              readOnly
              value={shareLink}
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 6,
                border: "1px solid #ddd",
                fontSize: 13,
              }}
            />
            <button
              onClick={handleCopy}
              style={{ ...outlineBtn, padding: "8px 14px" }}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Form preview */}
      {form && (
        <div style={{ marginTop: 48 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}>
            <h2 style={{ margin: 0 }}>{form.title}</h2>
            <span
              style={{
                fontSize: 12,
                color: "#888",
                background: "#f3f4f6",
                padding: "4px 10px",
                borderRadius: 99,
              }}>
              Preview
            </span>
          </div>

          {form.fields.map((field) => (
            <div key={field.id} style={{ marginBottom: 24 }}>
              <label
                style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                {field.label}{" "}
                {field.required && <span style={{ color: "red" }}>*</span>}
              </label>

              {field.type === "textarea" && (
                <textarea
                  rows={3}
                  placeholder={field.placeholder}
                  disabled
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    boxSizing: "border-box",
                    background: "#fafafa",
                  }}
                />
              )}

              {field.type === "dropdown" && (
                <select
                  disabled
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "#fafafa",
                  }}>
                  <option>Select...</option>
                  {field.options?.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.type === "checkbox" && <input type="checkbox" disabled />}

              {["text", "email", "number"].includes(field.type) && (
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  disabled
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    boxSizing: "border-box",
                    background: "#fafafa",
                  }}
                />
              )}

              {field.type === "image" && (
                <div
                  style={{
                    padding: 20,
                    border: "2px dashed #ddd",
                    borderRadius: 8,
                    textAlign: "center",
                    color: "#aaa",
                    fontSize: 14,
                  }}>
                  Image upload field
                </div>
              )}
            </div>
          ))}

          {/* Edit form */}
          <div
            style={{
              marginTop: 32,
              paddingTop: 32,
              borderTop: "1px solid #eee",
            }}>
            <p style={{ fontWeight: 500, marginBottom: 10 }}>
              Want to change something?
            </p>
            <textarea
              rows={2}
              style={{
                width: "100%",
                padding: 10,
                fontSize: 14,
                borderRadius: 8,
                border: "1px solid #ddd",
                boxSizing: "border-box",
                marginBottom: 10,
              }}
              placeholder="e.g. Add a phone number field, rename Email to Business Email, remove the checkbox"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
            />
            <button
              onClick={editForm}
              disabled={editing || !editPrompt}
              style={outlineBtn}>
              {editing ? "Updating..." : " Edit form"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
