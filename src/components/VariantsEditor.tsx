export type EditableVariant = {
  id: string;
  name: string;
  price_in_cents: number;
  stripe_price_id: string;
  inventory: number | null;
};

export function VariantsEditor({
  variants,
  onChange,
}: {
  variants: EditableVariant[];
  onChange: (variants: EditableVariant[]) => void;
}) {
  const update = (index: number, values: Partial<EditableVariant>) =>
    onChange(
      variants.map((variant, position) =>
        position === index ? { ...variant, ...values } : variant,
      ),
    );
  return (
    <section className="form-panel">
      <div className="admin-panel-title">
        <div>
          <h2>Print sizes</h2>
          <p className="panel-help">Each size needs its own Stripe Price ID.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            onChange([
              ...variants,
              {
                id: crypto.randomUUID(),
                name: "",
                price_in_cents: 100,
                stripe_price_id: "",
                inventory: null,
              },
            ])
          }
        >
          Add size
        </button>
      </div>
      {!variants.length ? (
        <p className="admin-empty">No print sizes configured.</p>
      ) : (
        <div className="variant-list">
          {variants.map((variant, index) => (
            <div key={variant.id}>
              <label>
                Size name
                <input
                  required
                  value={variant.name}
                  onChange={(event) =>
                    update(index, { name: event.target.value })
                  }
                />
              </label>
              <label>
                Price in cents
                <input
                  required
                  min="1"
                  type="number"
                  value={variant.price_in_cents}
                  onChange={(event) =>
                    update(index, {
                      price_in_cents: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Stripe Price ID
                <input
                  required
                  placeholder="price_…"
                  value={variant.stripe_price_id}
                  onChange={(event) =>
                    update(index, { stripe_price_id: event.target.value })
                  }
                />
              </label>
              <label>
                Inventory
                <input
                  min="0"
                  type="number"
                  placeholder="Unlimited"
                  value={variant.inventory ?? ""}
                  onChange={(event) =>
                    update(index, {
                      inventory: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="remove-button"
                onClick={() => onChange(variants.filter((_, i) => i !== index))}
              >
                Remove size
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
