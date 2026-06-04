import BadgeCanvas from './BadgeCanvas'

export default function App() {
  return (
    <div style={{ padding: 24, background: '#f0f0f0', minHeight: '100vh' }}>
      <div style={{ transform: 'scale(0.4)', transformOrigin: 'top left' }}>
        <BadgeCanvas
          name="Alejandro González Iñárritu"
          role="Director"
          filmTitle="The Brutalist"
        />
      </div>
    </div>
  )
}
