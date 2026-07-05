import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faSun } from "@fortawesome/free-regular-svg-icons";
import { useTheme } from "../context/useTheme";

export default function ThemeToggle() {
  const { dark, setDark } = useTheme();

  return (
    <button
      onClick={() => setDark((d) => !d)}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--code-bg)",
        color: "var(--text-h)",
        cursor: "pointer",
        fontSize: 16,
        display: "flex",
        alignItems: "center",
      }}>
      <FontAwesomeIcon icon={dark ? faSun : faMoon} />
    </button>
  );
}
