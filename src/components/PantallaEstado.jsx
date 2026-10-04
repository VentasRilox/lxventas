export default function PantallaEstado({ mensaje, children }) {
  return (
    <div className="estado">
      <div>
        <p>{mensaje}</p>
        {children}
      </div>
    </div>
  )
}
