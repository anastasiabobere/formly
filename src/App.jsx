import { useState } from "react";
import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

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

  if (!response.ok) {
    console.error("Groq error:", data);
    throw new Error(data.error?.message || "Groq API error");
  }

  return data.choices[0].message.content;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(false);

  async function generateForm() {
    setLoading(true);
    try {
      const systemPrompt = `You are a form builder. The user will describe a form they need.
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

      const raw = await callGroq(systemPrompt + "\n\nForm request: " + prompt);

      console.log("Raw Groq response:", raw);

      const cleaned = raw.replace(/```json|```/g, "").trim();
      const json = JSON.parse(cleaned);

      console.log("Parsed form:", json);
      setForm(json);
    } catch (err) {
      console.error("Generation failed:", err);
      alert("Something went wrong: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "60px auto",
        padding: "0 20px",
        fontFamily: "sans-serif",
      }}>
      <h1>Formly</h1>
      <p style={{ color: "#666" }}>
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
        }}
        placeholder="e.g. A cake order form for a bakery with name, email, occasion dropdown, and reference image upload"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <button
        onClick={generateForm}
        disabled={loading || !prompt}
        style={{
          marginTop: 12,
          padding: "10px 24px",
          background: "#4F46E5",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 15,
          cursor: "pointer",
        }}>
        {loading ? "Generating..." : "Generate form"}
      </button>

      {form && <FormPreview form={form} />}
    </div>
  );
}

function FormPreview({ form }) {
  const [values, setValues] = useState({});
  const [imageFiles, setImageFiles] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(id, value) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function handleImageUpload(fieldId, file) {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setImagePreviews((prev) => ({ ...prev, [fieldId]: previewUrl }));
    setImageFiles((prev) => ({ ...prev, [fieldId]: file }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const uploadedUrls = {};
      for (const [fieldId, file] of Object.entries(imageFiles)) {
        const storageRef = ref(
          storage,
          `submissions/${Date.now()}_${file.name}`,
        );
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        uploadedUrls[fieldId] = url;
      }

      const submission = {
        ...values,
        ...uploadedUrls,
        submittedAt: new Date().toISOString(),
      };
      console.log("Submission ready for Firestore:", submission);
      setSubmitted(true);
    } catch (err) {
      console.error("Submit failed:", err);
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div
        style={{
          marginTop: 40,
          padding: 24,
          background: "#f0fdf4",
          borderRadius: 12,
          textAlign: "center",
        }}>
        <div style={{ fontSize: 32 }}>✓</div>
        <h3 style={{ color: "#16a34a" }}>Form submitted!</h3>
        <p style={{ color: "#666" }}>Your response has been recorded.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 40 }}>
      <h2>{form.title}</h2>

      {form.fields.map((field) => (
        <div key={field.id} style={{ marginBottom: 24 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
            {field.label}{" "}
            {field.required && <span style={{ color: "red" }}>*</span>}
          </label>

          {field.type === "textarea" && (
            <textarea
              rows={3}
              placeholder={field.placeholder}
              onChange={(e) => handleChange(field.id, e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #ddd",
                boxSizing: "border-box",
              }}
            />
          )}

          {field.type === "dropdown" && (
            <select
              onChange={(e) => handleChange(field.id, e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}>
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          )}

          {field.type === "checkbox" && (
            <input
              type="checkbox"
              onChange={(e) => handleChange(field.id, e.target.checked)}
            />
          )}

          {["text", "email", "number"].includes(field.type) && (
            <input
              type={field.type}
              placeholder={field.placeholder}
              onChange={(e) => handleChange(field.id, e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #ddd",
                boxSizing: "border-box",
              }}
            />
          )}

          {field.type === "image" && (
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(field.id, e.target.files[0])}
                style={{ marginBottom: 10 }}
              />
              {imagePreviews[field.id] && (
                <img
                  src={imagePreviews[field.id]}
                  alt="preview"
                  style={{
                    width: "100%",
                    maxHeight: 240,
                    objectFit: "cover",
                    borderRadius: 8,
                  }}
                />
              )}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          padding: "12px 32px",
          background: "#4F46E5",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 15,
          cursor: "pointer",
          width: "100%",
        }}>
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </div>
  );
}
