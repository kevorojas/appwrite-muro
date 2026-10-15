import { useEffect, useState } from 'react'
import Acceso from './components/Acceso.jsx'
import Muro from './components/Muro.jsx'
import { cerrarSesion, faltaConfig, usuarioActual } from './lib/appwrite.js'

export default function App() {
  // undefined = todavía no sabemos, null = sin sesión, objeto = usuario logueado
  const [usuario, setUsuario] = useState(undefined)

  // Al cargar la página preguntamos a Appwrite si ya hay una sesión abierta
  useEffect(() => {
    usuarioActual().then(setUsuario)
  }, [])

  async function salir() {
    await cerrarSesion()
    setUsuario(null)
  }

  if (faltaConfig.length > 0) {
    return (
      <main className="contenedor">
        <div className="error">
          Faltan variables en el archivo <code>.env</code>: {faltaConfig.join(', ')}.
          Copia <code>.env.example</code> como <code>.env</code> y completa los IDs.
        </div>
      </main>
    )
  }

  return (
    <main className="contenedor">
      <header className="cabecera">
        <h1>
          Muro <span className="acento">en tiempo real</span>
        </h1>
        {usuario && (
          <div className="sesion">
            <span>{usuario.name || usuario.email}</span>
            <button className="boton-secundario" onClick={salir}>
              Salir
            </button>
          </div>
        )}
      </header>

      {usuario === undefined && <p className="tenue">Cargando…</p>}
      {usuario === null && <Acceso alEntrar={setUsuario} />}
      {usuario && <Muro usuario={usuario} />}

      <footer className="pie">Hecho con React + Appwrite</footer>
    </main>
  )
}
