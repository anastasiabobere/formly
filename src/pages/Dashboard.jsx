import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import ThemeToggle from "../components/ThemeToggle";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";

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

export default function Dashboard() {
  const [forms, setForms] = useState([]);
  const [openFormId, setOpenFormId] = useState(null);
  const [submissions, setSubmissions] = useState({});
  const [loadingSubmissions, setLoadingSubmissions] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchForms() {
      if (!auth.currentUser) return;

      const q = query(
        collection(db, "forms"),
        where("ownerId", "==", auth.currentUser.uid),
      );

      const snap = await getDocs(q);

      setForms(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })),
      );
    }

    fetchForms();
  }, []);

  async function toggleForm(formId) {
    if (openFormId === formId) {
      setOpenFormId(null);
      return;
    }

    setOpenFormId(formId);

    if (!submissions[formId]) {
      setLoadingSubmissions(formId);

      const snap = await getDocs(
        collection(db, "forms", formId, "submissions"),
      );

      setSubmissions((prev) => ({
        ...prev,
        [formId]: snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })),
      }));

      setLoadingSubmissions(null);
    }
  }

  async function deleteForm(e, formId) {
    e.stopPropagation();

    if (!confirm("Delete this form? This cannot be undone.")) return;

    await deleteDoc(doc(db, "forms", formId));

    setForms((prev) => prev.filter((f) => f.id !== formId));

    if (openFormId === formId) setOpenFormId(null);
  }

  function copied(e, formId) {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/form/${formId}`);
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}>
          <h1 style={{ margin: 0 }}>Formly Dashboard</h1>
          <ThemeToggle />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/")} style={outlineBtn}>
            + New form
          </button>
          <button onClick={() => auth.signOut()} style={outlineBtn}>
            Log out
          </button>
        </div>
      </div>

      {forms.length === 0 && (
        <p style={{ color: "var(--text)" }}>
          No forms yet. Go create your first one!
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {forms.map((form) => (
          <div key={form.id}>
            {/* Form card */}
            <div
              onClick={() => toggleForm(form.id)}
              style={{
                padding: 18,
                borderRadius: openFormId === form.id ? "12px 12px 0 0" : 12,
                border: "1px solid var(--border)",
                borderBottom:
                  openFormId === form.id
                    ? "1px solid transparent"
                    : "1px solid var(--border)",
                cursor: "pointer",
                background:
                  openFormId === form.id
                    ? "var(--accent-bg)"
                    : "var(--code-bg)",
                transition: "0.2s ease",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 500,
                    fontSize: 15,
                    color: "var(--text-h)",
                  }}>
                  {form.title}
                </p>

                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    color: "var(--text)",
                  }}>
                  {form.fields?.length || 0} fields ·{" "}
                  {form.createdAt
                    ? new Date(form.createdAt).toLocaleDateString()
                    : "Unknown date"}
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={(e) => copied(e, form.id)} style={outlineBtn}>
                  Copy link
                </button>

                <button
                  onClick={(e) => deleteForm(e, form.id)}
                  style={{
                    ...outlineBtn,
                    color: "#dc2626",
                    borderColor: "#fca5a5",
                  }}>
                  Delete
                </button>

                <span
                  style={{ fontSize: 12, color: "var(--text)", marginLeft: 4 }}>
                  {openFormId === form.id ? "▲" : "▼"}
                </span>
              </div>
            </div>

            {/* Submissions */}
            {openFormId === form.id && (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderTop: "none",
                  borderRadius: "0 0 12px 12px",
                  padding: 16,
                  background: "var(--code-bg)",
                }}>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-h)",
                  }}>
                  Submissions
                </p>

                {loadingSubmissions === form.id && (
                  <p style={{ color: "var(--text)", fontSize: 13 }}>
                    Loading...
                  </p>
                )}

                {!loadingSubmissions && submissions[form.id]?.length === 0 && (
                  <p style={{ color: "var(--text)", fontSize: 13 }}>
                    No submissions yet.
                  </p>
                )}

                {submissions[form.id]?.map((sub) => {
                  const fieldLabels = Object.fromEntries(
                    (form.fields || []).map((f) => [f.id, f.label]),
                  );

                  return (
                    <div
                      key={sub.id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        marginBottom: 10,
                        background: "var(--bg)",
                      }}>
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: 11,
                          color: "var(--text)",
                        }}>
                        {sub.submittedAt
                          ? new Date(sub.submittedAt).toLocaleString()
                          : "Unknown time"}
                      </p>

                      {Object.entries(sub)
                        .filter(([k]) => k !== "submittedAt" && k !== "id")
                        .map(([key, val]) => (
                          <div
                            key={key}
                            style={{
                              marginBottom: 4,
                              fontSize: 13,
                            }}>
                            <span
                              style={{
                                color: "var(--text)",
                                marginRight: 6,
                              }}>
                              {fieldLabels[key] || key}:
                            </span>

                            {typeof val === "string" &&
                            val.startsWith("https://") ? (
                              <a
                                href={val}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: "var(--accent)",
                                  fontWeight: 500,
                                }}>
                                View image
                              </a>
                            ) : (
                              <span style={{ color: "var(--text-h)" }}>
                                {String(val)}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
