import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function Dashboard() {
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadForms() {
      const q = query(
        collection(db, "forms"),
        where("ownerId", "==", auth.currentUser.uid),
      );
      const snap = await getDocs(q);
      setForms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    loadForms();
  }, []);

  async function loadSubmissions(formId) {
    setSelectedForm(formId);
    const snap = await getDocs(collection(db, "forms", formId, "submissions"));
    setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "60px auto",
        padding: "0 20px",
        fontFamily: "sans-serif",
      }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
        }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}>
            + New form
          </button>
          <button
            onClick={() => auth.signOut()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}>
            Log out
          </button>
        </div>
      </div>

      {forms.length === 0 && (
        <p style={{ color: "#666" }}>No forms yet. Go create your first one!</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {forms.map((form) => (
          <div
            key={form.id}
            style={{
              padding: 16,
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: "pointer",
              background: selectedForm === form.id ? "#f5f3ff" : "#fff",
            }}
            onClick={() => loadSubmissions(form.id)}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
              <div>
                <p style={{ margin: 0, fontWeight: 500 }}>{form.title}</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
                  {form.fields?.length} fields · created{" "}
                  {new Date(form.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(
                    `${window.location.origin}/form/${form.id}`,
                  );
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                }}>
                Copy link
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedForm && (
        <div style={{ marginTop: 40 }}>
          <h3>Submissions</h3>
          {submissions.length === 0 && (
            <p style={{ color: "#888" }}>No submissions yet.</p>
          )}
          {submissions.map((sub) => (
            <div
              key={sub.id}
              style={{
                padding: 16,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginBottom: 12,
              }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#888" }}>
                {new Date(sub.submittedAt).toLocaleString()}
              </p>
              {Object.entries(sub)
                .filter(([k]) => k !== "submittedAt" && k !== "id")
                .map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 6 }}>
                    <span
                      style={{ fontSize: 13, color: "#666", marginRight: 8 }}>
                      {key}:
                    </span>
                    {typeof val === "string" && val.startsWith("https://") ? (
                      <a
                        href={val}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 13, color: "#4F46E5" }}>
                        View image
                      </a>
                    ) : (
                      <span style={{ fontSize: 13 }}>{String(val)}</span>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
