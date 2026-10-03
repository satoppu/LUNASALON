export default function ClickableUserName({ name, customerByName, onSelect }) {
  if (!customerByName.has(name)) return name;
  return (
    <button
      type="button"
      onClick={() => onSelect(customerByName.get(name))}
      className="underline decoration-dotted"
      style={{ color: "#262421" }}
    >
      {name}
    </button>
  );
}
