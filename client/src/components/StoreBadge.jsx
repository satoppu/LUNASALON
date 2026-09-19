export default function StoreBadge({ store, storeColor }) {
  if (!store) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
      style={{ background: storeColor(store), color: "#262421" }}
      title={store}
    >
      {store.charAt(0)}
    </span>
  );
}
