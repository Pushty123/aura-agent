const CONFETTI_COLORS = ['#64d5a4', '#f3b84e', '#ad8cff', '#f078ad', '#6ea8ff'];

export function CelebrationMoment({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="celebration-backdrop">
      <section className="celebration-moment" role="dialog" aria-modal="true" aria-labelledby="celebration-title">
        <div className="celebration-confetti" aria-hidden="true">
          {CONFETTI_COLORS.map((color, index) => (
            <span
              key={index}
              style={{
                left: `${8 + index * 19}%`,
                backgroundColor: color,
                animationDelay: `${index * 70}ms`,
              }}
            />
          ))}
        </div>
        <span className="celebration-sparkle" aria-hidden="true">✦</span>
        <p className="xs muted">A moment worth celebrating</p>
        <h2 id="celebration-title">{title}</h2>
        <p className="small">{message}</p>
        <button type="button" className="btn primary" onClick={onClose}>Keep going</button>
      </section>
    </div>
  );
}
