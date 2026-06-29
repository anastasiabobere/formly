import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db, storage } from "../firebase";
import { doc, getDoc, addDoc, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function FormPage() {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [values, setValues] = useState({});
  const [imageFiles, setImageFiles] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadForm() {
      const docRef = doc(db, "forms", formId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setForm(docSnap.data());
      } else {
        setNotFound(true);
      }
    }
    loadForm();
  }, [formId]);

  function handleChange(id, value) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function handleImageUpload(fieldId, file) {
    if (!file) return;
    setImagePreviews((prev) => ({
      ...prev,
      [fieldId]: URL.createObjectURL(file),
    }));
    setImageFiles((prev) => ({ ...prev, [fieldId]: file }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const uploadedUrls = {};
      for (const [fieldId, file] of Object.entries(imageFiles)) {
        const storageRef = ref(
          storage,
          `submissions/${formId}/${Date.now()}_${file.name}`,
        );
        await uploadBytes(storageRef, file);
        uploadedUrls[fieldId] = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "forms", formId, "submissions"), {
        ...values,
        ...uploadedUrls,
        submittedAt: new Date().toISOString(),
      });

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Submit failed: " + err.message);
    }
    setSubmitting(false);
  }

  if (notFound)
    return (
      <p style={{ padding: 40, fontFamily: "sans-serif" }}>Form not found.</p>
    );
  if (!form)
    return <p style={{ padding: 40, fontFamily: "sans-serif" }}>Loading...</p>;

  if (submitted) {
    return (
      <div
        style={{
          maxWidth: 600,
          margin: "100px auto",
          textAlign: "center",
          fontFamily: "sans-serif",
        }}>
        <div style={{ fontSize: 48 }}>✓</div>
        <h2 style={{ color: "#16a34a" }}>Submitted!</h2>
        <p style={{ color: "#666" }}>Your response has been recorded.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "60px auto",
        padding: "0 20px",
        fontFamily: "sans-serif",
      }}>
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
          width: "100%",
          padding: "12px 32px",
          background: "#4F46E5",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 15,
          cursor: "pointer",
        }}>
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </div>
  );
}
