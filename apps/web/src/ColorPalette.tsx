export const colorPresets = [
  { name: "Nebbia", background: "#d7d8d5", color: "#1c201e" },
  { name: "Salvia", background: "#b9c9bc", color: "#203329" },
  { name: "Cielo", background: "#bccfe4", color: "#203248" },
  { name: "Lavanda", background: "#d3c9e4", color: "#362947" },
  { name: "Sabbia", background: "#e5d6c2", color: "#423526" },
  { name: "Lime", background: "#d6ef53", color: "#242b16" },
  { name: "Carta", background: "#f3f3ed", color: "#1c201e" },
  { name: "Inchiostro", background: "#202622", color: "#f3f3ed" },
];

export function ColorPalette({
  value,
  onSelect,
  label = "Colori pronti",
}: {
  value: string;
  onSelect: (preset: (typeof colorPresets)[number]) => void;
  label?: string;
}) {
  return (
    <div className="color-palette" role="group" aria-label={label}>
      {colorPresets.map((preset) => (
        <button
          key={preset.name}
          type="button"
          aria-pressed={value.toLowerCase() === preset.background}
          onClick={() => onSelect(preset)}
          title={preset.name}
        >
          <span
            className="color-swatch"
            style={{ background: preset.background, color: preset.color }}
            aria-hidden="true"
          >
            Aa
          </span>
          <span>{preset.name}</span>
        </button>
      ))}
    </div>
  );
}
